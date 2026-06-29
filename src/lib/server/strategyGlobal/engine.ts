import type { RouletteSpin } from "@/lib/server/rouletteSocket";
import { parseLiveTableIdFromCompositeGameId } from "@/lib/roulette/liveTableConfig";
import { resolveRotatingRoomTableIds } from "@/lib/roulette/lobbyTables";
import {
  ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  sanitizeRotatingRoomCrossingMachineForTableIds,
  seedRotatingRoomCrossingMachineAfterPlacarReset,
  type RotatingRoomCrossingPlacarFlash,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import {
  UM_FATOR_MAX_RECOVERY,
  defaultUmFatorMachineState,
  sanitizeUmFatorMachineForTableIds,
  seedUmFatorMachineAfterPlacarReset,
  type UmFatorPlacarFlash,
} from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import {
  buildRotatingRoomCrossingSessionLiveView,
  tickRotatingRoomCrossingSessionPlacar,
  defaultRotatingRoomCrossingMachineState,
} from "@/lib/roulette/rotatingRoomCrossingSession";
import {
  buildRotatingRoomUmFatorSessionLiveView,
  tickRotatingRoomUmFatorSessionPlacar,
} from "@/lib/roulette/rotatingRoomUmFatorSession";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import { STRATEGY_PLACAR_DRAIN_MAX_STEPS, drainPlacarSteps } from "@/lib/roulette/strategySessionDrive";
import { crossingMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomCrossingPlacarDrive";
import { umFatorMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomUmFatorPlacarDrive";
import { umFatorToTapeteActive } from "@/lib/roulette/umFatorStrategy";
import {
  isRotatingRoomLobbyCooldownActive,
  isRotatingRoomPostResultHoldActive,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import type {
  StrategyGlobalCrossingClientView,
  StrategyGlobalKind,
  StrategyGlobalLedgerEntry,
  StrategyGlobalSnapshot,
  StrategyGlobalUmFatorClientView,
} from "@/lib/roulette/strategyGlobalTypes";
import type { ExtensionSyncPayload } from "@/lib/roulette/extensionSyncTypes";
import {
  applyExtensionMachineToState,
  getExtensionSourceStatus,
  isExtensionSourceActive,
  rememberExtensionSettlementKey,
  touchExtensionSource,
} from "@/lib/server/extensionSource";
import { broadcastStrategyGlobal } from "@/lib/server/strategyGlobal/broadcast";
import {
  appendLedger,
  appendTableSpin,
  emptyStrategyGlobalState,
  getStrategyGlobalState,
  historiesRecord,
  initStrategyGlobalState,
  rememberGameId,
  replaceStrategyGlobalState,
  schedulePersist,
  type StrategyGlobalPersistedState,
} from "@/lib/server/strategyGlobal/persistence";

import type { StrategyGlobalFlashPayload } from "@/lib/roulette/strategyGlobalTypes";

let initialized = false;

export async function ensureStrategyGlobalEngine(liveTableIds: readonly number[]): Promise<void> {
  if (initialized) return;
  const rotatingIds = resolveRotatingRoomTableIds(liveTableIds);
  await initStrategyGlobalState(rotatingIds);
  const state = getStrategyGlobalState();
  if (state.rotatingRoomTableIds.length === 0) {
    state.rotatingRoomTableIds = [...rotatingIds];
  }
  initialized = true;
}

function syncRotatingTableIds(state: StrategyGlobalPersistedState, liveTableIds: readonly number[]): void {
  const next = resolveRotatingRoomTableIds(liveTableIds);
  if (next.length === 0) return;
  state.rotatingRoomTableIds = next;
  state.dois2fatores.machine = sanitizeRotatingRoomCrossingMachineForTableIds(
    state.dois2fatores.machine,
    next,
  );
  state.um1fator.machine = sanitizeUmFatorMachineForTableIds(state.um1fator.machine, next);
}

function appendCrossingLedgerIfNeeded(
  state: StrategyGlobalPersistedState,
  crossing: { flash: RotatingRoomCrossingPlacarFlash; recoveryBefore: number },
): StrategyGlobalLedgerEntry[] {
  if (
    !crossing.flash ||
    (crossing.flash.kind !== "win" &&
      crossing.flash.kind !== "loss" &&
      crossing.flash.kind !== "recovery")
  ) {
    return [];
  }
  const ledgerEntry = ledgerFromFlash(crossing.flash, crossing.recoveryBefore);
  appendLedger(state, "dois2fatores", ledgerEntry, ROTATING_ROOM_CROSSING_MAX_RECOVERY);
  return [ledgerEntry];
}

function ledgerFromFlash(
  flash: NonNullable<RotatingRoomCrossingPlacarFlash | UmFatorPlacarFlash>,
  recovery: number,
  stake?: number,
): StrategyGlobalLedgerEntry {
  return {
    ts: Date.now(),
    tableId: flash.tableId,
    won: flash.won,
    recovery,
    kind: flash.kind,
    resultNumber: flash.resultNumber,
    factor1: flash.factor1,
    factor2: "factor2" in flash ? flash.factor2 : undefined,
    triggerNumbers: flash.triggerNumbers,
    bucketGap: "bucketGap" in flash ? flash.bucketGap : undefined,
    ...(typeof stake === "number" && stake > 0 && Number.isFinite(stake) ? { stake } : {}),
  };
}

function driveCrossing(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): { flash: RotatingRoomCrossingPlacarFlash; recoveryBefore: number } {
  const tableIds = state.rotatingRoomTableIds;
  const recoveryBefore = state.dois2fatores.machine.recovery;
  const result = drainPlacarSteps(
    state.dois2fatores.machine,
    state.dois2fatores.stats,
    (machine, stats) =>
      tickRotatingRoomCrossingSessionPlacar(tableIds, histories, machine, stats),
    crossingMachinePlacarStepProgressed,
  );
  state.dois2fatores.machine = sanitizeRotatingRoomCrossingMachineForTableIds(
    result.nextMachine,
    tableIds,
  );
  state.dois2fatores.stats = result.stats;
  return { flash: result.flash, recoveryBefore };
}

function driveUmFator(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): {
  flash: UmFatorPlacarFlash;
  recoveryBefore: number;
  settlements: Array<{ flash: NonNullable<UmFatorPlacarFlash>; recoveryBefore: number }>;
} {
  const tableIds = state.rotatingRoomTableIds;
  let machine = state.um1fator.machine;
  let stats = state.um1fator.stats;
  const settlements: Array<{ flash: NonNullable<UmFatorPlacarFlash>; recoveryBefore: number }> = [];

  for (let i = 0; i < STRATEGY_PLACAR_DRAIN_MAX_STEPS; i++) {
    const recoveryBefore = machine.recovery;
    const before = machine;
    const step = tickRotatingRoomUmFatorSessionPlacar(tableIds, histories, machine, stats);
    machine = sanitizeUmFatorMachineForTableIds(step.nextMachine, tableIds);
    stats = step.stats;
    if (
      step.flash &&
      (step.flash.kind === "win" || step.flash.kind === "loss" || step.flash.kind === "recovery")
    ) {
      settlements.push({ flash: step.flash, recoveryBefore });
    }
    if (!umFatorMachinePlacarStepProgressed(before, machine, step)) break;
  }

  state.um1fator.machine = machine;
  state.um1fator.stats = stats;

  const last = settlements.at(-1);
  return {
    flash: last?.flash ?? null,
    recoveryBefore: last?.recoveryBefore ?? state.um1fator.machine.recovery,
    settlements,
  };
}

async function pushAutomationSimSettlements(
  entries: readonly StrategyGlobalLedgerEntry[],
  snapshot: StrategyGlobalSnapshot,
): Promise<void> {
  const m = await import("@/lib/server/automationSim/engine");
  await m.ensureAutomationSimEngine();
  for (const entry of entries) {
    await m.ingestAutomationSimLedgerEntry(entry, snapshot, { publish: false });
  }
  await m.syncAutomationSimWithStrategy(snapshot);
}

function buildCrossingClientView(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): StrategyGlobalCrossingClientView {
  const tableIds = state.rotatingRoomTableIds;
  const machine = sanitizeRotatingRoomCrossingMachineForTableIds(state.dois2fatores.machine, tableIds);
  const liveView = buildRotatingRoomCrossingSessionLiveView(tableIds, histories, machine);
  const allowed = new Set(tableIds);
  const activeCrossing = machine.cycleActive;
  const showTapeteSignal = activeCrossing != null;
  const currentTableId =
    machine.cycleTableId != null && allowed.has(machine.cycleTableId) ? machine.cycleTableId : null;
  const prepareTableId =
    machine.prepareTableId != null && allowed.has(machine.prepareTableId)
      ? machine.prepareTableId
      : null;
  return {
    phase: showTapeteSignal && currentTableId != null ? "active" : "waiting",
    sessionStats: state.dois2fatores.stats,
    showTapeteSignal: showTapeteSignal && currentTableId != null,
    currentRecovery: machine.recovery,
    currentTableId,
    prepareTableId,
    alertCategory: liveView.globalPick?.category ?? null,
    alertBucketGap: liveView.globalPick?.bucketGap ?? 0,
    sessionMode: liveView.mode,
    prepareCategory: liveView.preparePick?.category ?? null,
    crossingScan: liveView.crossingScan,
    activeCrossing: showTapeteSignal && currentTableId != null ? activeCrossing : null,
  };
}

function buildUmFatorClientView(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): StrategyGlobalUmFatorClientView {
  const tableIds = state.rotatingRoomTableIds;
  const machine = sanitizeUmFatorMachineForTableIds(state.um1fator.machine, tableIds);
  const liveView = buildRotatingRoomUmFatorSessionLiveView(tableIds, histories, machine);
  const umActive = liveView.globalActive;
  const currentTableId = liveView.globalTableId;
  const lobbyCooldownUntilMs = machine.lobbyCooldownUntilMs;
  const postResultHoldUntilMs = machine.postResultHoldUntilMs;
  const postResultHoldTableId = machine.postResultHoldTableId;
  const lobbyCooldownActive = isRotatingRoomLobbyCooldownActive(lobbyCooldownUntilMs);
  const postResultHoldActive = isRotatingRoomPostResultHoldActive(postResultHoldUntilMs);
  const showTapeteSignalRaw = umActive != null && currentTableId != null;
  const showTapeteSignal =
    showTapeteSignalRaw && !lobbyCooldownActive && !postResultHoldActive;
  const activeCrossing =
    showTapeteSignal && umActive ? umFatorToTapeteActive(umActive) : null;
  return {
    phase: showTapeteSignal ? "active" : "waiting",
    sessionStats: state.um1fator.stats,
    showTapeteSignal,
    singleFactorMode: true,
    currentRecovery: machine.recovery,
    currentTableId: showTapeteSignal ? currentTableId : null,
    alertCategory: umActive?.armingDescription ?? null,
    alertBucketGap: 0,
    sessionMode: showTapeteSignal ? "active" : "scanning",
    umFatorScan: liveView.tableScan,
    activeCrossing,
    umActive: showTapeteSignal ? umActive : null,
    lobbyCooldownUntilMs,
    postResultHoldUntilMs,
    postResultHoldTableId,
  };
}

export function buildStrategyGlobalSnapshot(state: StrategyGlobalPersistedState): StrategyGlobalSnapshot {
  const histories = historiesRecord(state);
  const tableHistories: Record<number, number[]> = {};
  for (const [id, list] of Object.entries(histories)) {
    tableHistories[Number(id)] = [...list];
  }
  const extensionSource = getExtensionSourceStatus();
  return {
    revision: state.revision,
    updatedAt: state.updatedAt,
    rotatingRoomTableIds: [...state.rotatingRoomTableIds],
    tableHistories,
    dois2fatores: buildCrossingClientView(state, histories),
    um1fator: buildUmFatorClientView(state, histories),
    lifetime: state.lifetime,
    ledgerTail: {
      dois2fatores: state.ledger.dois2fatores.slice(-120),
      um1fator: state.ledger.um1fator.slice(-120),
    },
    extensionSource: {
      active: extensionSource.active,
      lastSyncAt: extensionSource.lastSyncAt,
      autopilotRunning: extensionSource.autopilotRunning,
    },
  };
}

function toFlashPayload(
  crossing: RotatingRoomCrossingPlacarFlash,
  um: UmFatorPlacarFlash,
): StrategyGlobalFlashPayload {
  return {
    dois2fatores: crossing
      ? {
          resultNumber: crossing.resultNumber,
          won: crossing.won,
          tableId: crossing.tableId,
          kind: crossing.kind,
        }
      : null,
    um1fator: um
      ? {
          resultNumber: um.resultNumber,
          won: um.won,
          tableId: um.tableId,
          kind: um.kind,
        }
      : null,
  };
}

function bumpAndBroadcast(
  state: StrategyGlobalPersistedState,
  crossingFlash: RotatingRoomCrossingPlacarFlash,
  umFlash: UmFatorPlacarFlash,
): StrategyGlobalSnapshot {
  state.revision += 1;
  state.updatedAt = Date.now();
  schedulePersist(state);
  const snapshot = buildStrategyGlobalSnapshot(state);
  const flashes = toFlashPayload(crossingFlash, umFlash);
  broadcastStrategyGlobal({ type: "update", revision: snapshot.revision, snapshot, flashes });
  void import("@/lib/server/automationSim/engine").then((m) => {
    void m.ensureAutomationSimEngine().then(() => {
      void m.syncAutomationSimWithStrategy(snapshot);
    });
  });
  return snapshot;
}

export function ingestStrategyGlobalSpin(
  spin: RouletteSpin,
  liveTableIds: readonly number[],
): StrategyGlobalSnapshot | null {
  if (!initialized) return null;
  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, liveTableIds);

  const tableId = parseLiveTableIdFromCompositeGameId(spin.gameId);
  if (tableId == null) return null;
  if (!rememberGameId(state, spin.gameId)) return null;

  const extensionActive = isExtensionSourceActive();
  if (!extensionActive) {
    appendTableSpin(state, tableId, spin.number);
  }
  const histories = historiesRecord(state);

  const crossing = driveCrossing(state, histories);
  const crossingLedgerEntries = appendCrossingLedgerIfNeeded(state, crossing);

  if (extensionActive) {
    const snapshot = bumpAndBroadcast(state, crossing.flash, null);
    if (crossingLedgerEntries.length > 0) {
      void pushAutomationSimSettlements(crossingLedgerEntries, snapshot);
    }
    return snapshot;
  }

  const um = driveUmFator(state, histories);
  const umLedgerEntries: StrategyGlobalLedgerEntry[] = [];
  for (const settlement of um.settlements) {
    const ledgerEntry = ledgerFromFlash(settlement.flash, settlement.recoveryBefore);
    appendLedger(state, "um1fator", ledgerEntry, UM_FATOR_MAX_RECOVERY);
    umLedgerEntries.push(ledgerEntry);
  }

  const snapshot = bumpAndBroadcast(state, crossing.flash, um.flash);
  const automationEntries = [...crossingLedgerEntries, ...umLedgerEntries];
  if (automationEntries.length > 0) {
    void pushAutomationSimSettlements(automationEntries, snapshot);
  }
  return snapshot;
}

/** Aplica estado do motor da extensão Chrome — visor, extrato e automação seguem a mesma fonte. */
export async function ingestStrategyGlobalExtensionSync(
  payload: ExtensionSyncPayload,
  liveTableIds: readonly number[],
): Promise<StrategyGlobalSnapshot | null> {
  if (!initialized) return null;

  touchExtensionSource(payload);
  const { saveAutomationConfig, getAutomationConfig } = await import(
    "@/lib/server/automationSim/config"
  );
  const { EXTENSION_REAL_BASE_STAKE } = await import("@/lib/back-office/rouletteAutomationSim");
  if (getAutomationConfig().baseStake !== EXTENSION_REAL_BASE_STAKE) {
    await saveAutomationConfig({ baseStake: EXTENSION_REAL_BASE_STAKE });
  }

  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, payload.tableIds.length > 0 ? payload.tableIds : liveTableIds);

  const maxRecovery = payload.maxRecovery ?? UM_FATOR_MAX_RECOVERY;
  for (const [key, numbers] of Object.entries(payload.histories)) {
    if (!Array.isArray(numbers) || numbers.length === 0) continue;
    state.tableHistories[key] = numbers.slice(0, 4_000);
  }

  state.um1fator.stats = payload.stats;
  state.um1fator.machine = applyExtensionMachineToState(
    state.rotatingRoomTableIds,
    payload.machine,
    payload.stats,
  );

  if (payload.crossingMachine && payload.crossingStats) {
    state.dois2fatores.stats = payload.crossingStats;
    state.dois2fatores.machine = sanitizeRotatingRoomCrossingMachineForTableIds(
      payload.crossingMachine,
      state.rotatingRoomTableIds,
    );
  }

  const histories = historiesRecord(state);
  let crossingFlash: RotatingRoomCrossingPlacarFlash = null;
  const crossingLedgerEntries: StrategyGlobalLedgerEntry[] = [];
  if (!payload.crossingMachine) {
    const crossing = driveCrossing(state, histories);
    crossingFlash = crossing.flash;
    crossingLedgerEntries.push(...appendCrossingLedgerIfNeeded(state, crossing));
  }

  const umLedgerEntries: StrategyGlobalLedgerEntry[] = [];
  const crossLedgerFromExtension: StrategyGlobalLedgerEntry[] = [];
  let umFlash: UmFatorPlacarFlash = null;
  for (const settlement of payload.settlements ?? []) {
    if (!rememberExtensionSettlementKey(settlement.dedupeKey)) continue;
    const ledgerEntry = ledgerFromFlash(
      settlement.flash,
      settlement.recoveryBefore,
      settlement.stake,
    );
    const kind = settlement.trigger === "dois2fatores" ? "dois2fatores" : "um1fator";
    const maxR = kind === "dois2fatores" ? ROTATING_ROOM_CROSSING_MAX_RECOVERY : maxRecovery;
    appendLedger(state, kind, ledgerEntry, maxR);
    if (kind === "dois2fatores") {
      crossLedgerFromExtension.push(ledgerEntry);
      crossingFlash = settlement.flash;
    } else {
      umLedgerEntries.push(ledgerEntry);
      umFlash = settlement.flash;
    }
  }

  const snapshot = bumpAndBroadcast(state, crossingFlash, umFlash);
  const automationEntries = [
    ...crossingLedgerEntries,
    ...crossLedgerFromExtension,
    ...umLedgerEntries,
  ];
  if (automationEntries.length > 0) {
    void pushAutomationSimSettlements(automationEntries, snapshot);
  }
  return snapshot;
}

/** Sem dedupe — usado para snapshot `last20Results` ao ligar o WS. */
export function ingestStrategyGlobalHistorySnapshot(
  tableId: number,
  spins: RouletteSpin[],
  liveTableIds: readonly number[],
): void {
  if (!initialized || spins.length === 0 || isExtensionSourceActive()) return;
  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, liveTableIds);

  const key = String(tableId);
  const existing = state.tableHistories[key] ?? [];
  if (existing.length > 0) return;

  const numbers = spins.map((s) => s.number);
  state.tableHistories[key] = numbers.slice(0, 4_000);
  for (const s of spins) {
    rememberGameId(state, s.gameId);
  }

  const histories = historiesRecord(state);
  driveCrossing(state, histories);
  driveUmFator(state, histories);
  bumpAndBroadcast(state, null, null);
}

export function ingestStrategyGlobalReplayBatch(
  spins: RouletteSpin[],
  liveTableIds: readonly number[],
): void {
  if (!initialized || spins.length === 0 || isExtensionSourceActive()) return;
  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, liveTableIds);

  let changed = false;
  for (const spin of spins) {
    const tableId = parseLiveTableIdFromCompositeGameId(spin.gameId);
    if (tableId == null) continue;
    const key = String(tableId);
    if ((state.tableHistories[key] ?? []).length > 0) continue;
    if (!rememberGameId(state, spin.gameId)) continue;
    appendTableSpin(state, tableId, spin.number);
    changed = true;
  }
  if (!changed) return;

  const histories = historiesRecord(state);
  driveCrossing(state, histories);
  driveUmFator(state, histories);
  bumpAndBroadcast(state, null, null);
}

export function getStrategyGlobalSnapshotOrThrow(): StrategyGlobalSnapshot {
  return buildStrategyGlobalSnapshot(getStrategyGlobalState());
}

export function resetStrategyGlobalSession(
  kind: StrategyGlobalKind | "all",
  liveTableIds: readonly number[],
): StrategyGlobalSnapshot {
  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, liveTableIds);
  const histories = historiesRecord(state);
  const tableIds = state.rotatingRoomTableIds;

  const resetOne = (k: StrategyGlobalKind) => {
    if (k === "dois2fatores") {
      state.dois2fatores.stats = emptyRotatingRoomSessionStats(ROTATING_ROOM_CROSSING_MAX_RECOVERY);
      state.dois2fatores.machine = seedRotatingRoomCrossingMachineAfterPlacarReset(
        defaultRotatingRoomCrossingMachineState(),
        tableIds,
        histories,
      );
    } else {
      state.um1fator.stats = emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
      state.um1fator.machine = seedUmFatorMachineAfterPlacarReset(
        defaultUmFatorMachineState(),
        tableIds,
        histories,
      );
    }
  };

  if (kind === "all") {
    resetOne("dois2fatores");
    resetOne("um1fator");
  } else {
    resetOne(kind);
  }

  return bumpAndBroadcast(state, null, null);
}

export function wipeStrategyGlobalState(liveTableIds: readonly number[]): StrategyGlobalSnapshot {
  const rotatingIds = resolveRotatingRoomTableIds(liveTableIds);
  const next = emptyStrategyGlobalState(rotatingIds);
  replaceStrategyGlobalState(next);
  const snapshot = buildStrategyGlobalSnapshot(next);
  broadcastStrategyGlobal({ type: "sync", snapshot });
  return snapshot;
}
