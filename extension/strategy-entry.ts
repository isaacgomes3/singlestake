/**
 * Bundle entry — motor Sala Rotativa (1 Fator + 2 Fatores cruzamento) para a extensão Chrome.
 */
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
} from "../src/lib/roulette/entryWinBreakdown";
import { buildRotatingRoomTableIds } from "../src/lib/roulette/lobbyTables";
import { doisFatoresFactorLabel } from "../src/lib/roulette/doisFatoresStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "../src/lib/roulette/pragmaticExteriorBetMap";
import {
  buildRotatingRoomCrossingSessionLiveView,
  defaultRotatingRoomCrossingMachineState,
  tickRotatingRoomCrossingSessionPlacar,
} from "../src/lib/roulette/rotatingRoomCrossingSession";
import {
  ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  sanitizeRotatingRoomCrossingMachineForTableIds,
  type RotatingRoomCrossingMachineState,
  type RotatingRoomCrossingPlacarFlash,
} from "../src/lib/roulette/rotatingRoomCrossingStrategy";
import {
  buildUmFatorLiveView,
  defaultUmFatorMachineState,
  sanitizeUmFatorMachineForTableIds,
  tickUmFatorPlacar,
  UM_FATOR_MAX_RECOVERY,
  type UmFatorMachineState,
  type UmFatorPlacarFlash,
} from "../src/lib/roulette/rotatingRoomUmFatorStrategy";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";
import { resolveRotativaTriggerFromSnapshot } from "../src/lib/roulette/rotatingRoomRotativaMerge";
import {
  EXTENSION_PRE_BET_WAIT_SEC,
  LIVE_TABLE_BETTING_WINDOW_SEC,
} from "../src/lib/roulette/liveTableBettingWindow";
import { umFatorAlertLabel, umFatorToTapeteActive } from "../src/lib/roulette/umFatorStrategy";
import type { StrategyGlobalSnapshot } from "../src/lib/roulette/strategyGlobalTypes";

export const ROTATING_ROOM_TABLE_IDS = buildRotatingRoomTableIds(206);
export { EXTENSION_PRE_BET_WAIT_SEC };

const BASE_STAKE = 50;
export const EXTENSION_MAX_GALES = 6;

export type CreateRotativaEngineOptions = {
  tableIds?: readonly number[];
  maxRecovery?: number;
  initialUmStats?: RotatingRoomSessionStats | null;
  initialCrossingStats?: RotatingRoomSessionStats | null;
  /** Por defeito activo — desligar para modo só 1 Fator. */
  crossingEnabled?: boolean;
};

export type CreateUmFatorEngineOptions = CreateRotativaEngineOptions;

export function clampExtensionMaxRecovery(value: unknown, fallback = UM_FATOR_MAX_RECOVERY): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.min(EXTENSION_MAX_GALES, Math.max(0, fallback));
  return Math.min(EXTENSION_MAX_GALES, Math.max(0, Math.floor(n)));
}

function stakeForRecovery(recovery: number, maxRecovery: number): number {
  const level = Math.min(Math.max(0, recovery), maxRecovery);
  return BASE_STAKE * 2 ** level;
}

export type RotativaActiveView = {
  trigger: "umFator" | "crossing";
  showTapeteSignal: boolean;
  currentTableId: number | null;
  currentRecovery: number;
  singleFactorMode: boolean;
  sessionMode: StrategyGlobalSnapshot["dois2fatores"]["sessionMode"] | "scanning" | "active";
  activeCrossing: ReturnType<typeof umFatorToTapeteActive> | null;
  umActive: ReturnType<typeof buildUmFatorLiveView>["globalActive"];
  betAttemptKey: string | null;
};

export type RotativaTickResult = {
  trigger: "umFator" | "crossing";
  umFlash: UmFatorPlacarFlash;
  crossingFlash: RotatingRoomCrossingPlacarFlash;
  umMachine: UmFatorMachineState;
  crossingMachine: RotatingRoomCrossingMachineState;
  umStats: RotatingRoomSessionStats;
  crossingStats: RotatingRoomSessionStats;
  active: RotativaActiveView;
};

function buildTriggerSnapshot(
  umMachine: UmFatorMachineState,
  umStats: RotatingRoomSessionStats,
  umView: ReturnType<typeof buildUmFatorLiveView>,
  crossingMachine: RotatingRoomCrossingMachineState,
  crossingStats: RotatingRoomSessionStats,
  crossingView: ReturnType<typeof buildRotatingRoomCrossingSessionLiveView>,
  tableIds: readonly number[],
): StrategyGlobalSnapshot {
  const showUmTapete = umView.globalActive != null && umView.globalTableId != null;
  const crossingActive = crossingMachine.cycleActive;
  const crossingTableId =
    crossingMachine.cycleTableId != null && tableIds.includes(crossingMachine.cycleTableId)
      ? crossingMachine.cycleTableId
      : null;
  const showCrossTapete = crossingActive != null && crossingTableId != null;

  return {
    revision: 0,
    updatedAt: Date.now(),
    rotatingRoomTableIds: [...tableIds],
    tableHistories: {},
    um1fator: {
      phase: showUmTapete ? "active" : "waiting",
      sessionStats: umStats,
      showTapeteSignal: showUmTapete,
      singleFactorMode: true,
      currentRecovery: umMachine.recovery,
      currentTableId: showUmTapete ? umView.globalTableId : null,
      alertCategory: umView.globalActive?.armingDescription ?? null,
      alertBucketGap: 0,
      sessionMode: showUmTapete ? "active" : "scanning",
      umFatorScan: umView.tableScan,
      activeCrossing: showUmTapete && umView.globalActive ? umFatorToTapeteActive(umView.globalActive) : null,
      umActive: showUmTapete ? umView.globalActive : null,
      lobbyCooldownUntilMs: umMachine.lobbyCooldownUntilMs,
      postResultHoldUntilMs: umMachine.postResultHoldUntilMs,
      postResultHoldTableId: umMachine.postResultHoldTableId,
    },
    dois2fatores: {
      phase: showCrossTapete ? "active" : "waiting",
      sessionStats: crossingStats,
      showTapeteSignal: showCrossTapete,
      currentRecovery: crossingMachine.recovery,
      currentTableId: showCrossTapete ? crossingTableId : null,
      prepareTableId:
        crossingMachine.prepareTableId != null && tableIds.includes(crossingMachine.prepareTableId)
          ? crossingMachine.prepareTableId
          : null,
      alertCategory: crossingView.globalPick?.category ?? null,
      alertBucketGap: crossingView.globalPick?.bucketGap ?? 0,
      sessionMode: crossingView.mode,
      prepareCategory: crossingView.preparePick?.category ?? null,
      crossingScan: crossingView.crossingScan,
      activeCrossing: showCrossTapete ? crossingActive : null,
    },
    lifetime: {
      dois2fatores: { since: 0, wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] },
      um1fator: { since: 0, wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] },
    },
    ledgerTail: { dois2fatores: [], um1fator: [] },
  };
}

function buildActiveView(
  trigger: "umFator" | "crossing",
  umView: ReturnType<typeof buildUmFatorLiveView>,
  umMachine: UmFatorMachineState,
  crossingMachine: RotatingRoomCrossingMachineState,
  crossingView: ReturnType<typeof buildRotatingRoomCrossingSessionLiveView>,
  tableIds: readonly number[],
): RotativaActiveView {
  if (trigger === "crossing") {
    const crossingActive = crossingMachine.cycleActive;
    const tableId =
      crossingMachine.cycleTableId != null && tableIds.includes(crossingMachine.cycleTableId)
        ? crossingMachine.cycleTableId
        : null;
    const showTapete = crossingActive != null && tableId != null;
    const head = crossingMachine.lastEvaluatedHead ?? `s${crossingMachine.cycleSpinsWithoutWin}`;
    const betAttemptKey =
      showTapete && tableId != null && crossingActive
        ? `${tableId}:${crossingActive.pairKind}:${crossingMachine.recovery}:${head}`
        : null;
    return {
      trigger,
      showTapeteSignal: showTapete,
      currentTableId: tableId,
      currentRecovery: crossingMachine.recovery,
      singleFactorMode: false,
      sessionMode: crossingView.mode,
      activeCrossing: showTapete ? crossingActive : null,
      umActive: null,
      betAttemptKey,
    };
  }

  const tableId = umView.globalTableId;
  const umActive = umView.globalActive;
  const showTapete = umActive != null && tableId != null;
  const betAttemptKey =
    showTapete && umActive
      ? `${tableId}:${umActive.resultNumber}:${umActive.alertFactor.kind}:${umMachine.recovery}`
      : null;

  return {
    trigger: "umFator",
    showTapeteSignal: showTapete,
    currentTableId: tableId,
    currentRecovery: umMachine.recovery,
    singleFactorMode: true,
    sessionMode: showTapete ? "active" : "scanning",
    activeCrossing: showTapete && umActive ? umFatorToTapeteActive(umActive) : null,
    umActive: showTapete ? umActive : null,
    betAttemptKey,
  };
}

export function createRotativaEngine(
  tableIdsOrOptions: readonly number[] | CreateRotativaEngineOptions = ROTATING_ROOM_TABLE_IDS,
) {
  const opts = Array.isArray(tableIdsOrOptions)
    ? { tableIds: tableIdsOrOptions }
    : tableIdsOrOptions;
  const ids = [...(opts.tableIds ?? ROTATING_ROOM_TABLE_IDS)];
  const maxRecovery = clampExtensionMaxRecovery(opts.maxRecovery);
  const crossingMaxRecovery = Math.min(maxRecovery, ROTATING_ROOM_CROSSING_MAX_RECOVERY);
  const crossingEnabled = opts.crossingEnabled !== false;

  let umMachine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
  let umStats =
    opts.initialUmStats != null
      ? parseRotatingRoomSessionStats(opts.initialUmStats, maxRecovery)
      : emptyRotatingRoomSessionStats(maxRecovery);

  let crossingMachine = sanitizeRotatingRoomCrossingMachineForTableIds(
    defaultRotatingRoomCrossingMachineState(),
    ids,
  );
  let crossingStats =
    opts.initialCrossingStats != null
      ? parseRotatingRoomSessionStats(opts.initialCrossingStats, crossingMaxRecovery)
      : emptyRotatingRoomSessionStats(crossingMaxRecovery);

  const histories: Record<number, number[]> = {};
  const lastGameIdByTable: Record<number, string> = {};
  const spinBaselinedByTable: Record<number, boolean> = {};
  const lastLiveSpinAtByTable: Record<number, number> = {};
  const lastAnchoredHeadByTable: Record<number, string> = {};

  for (const id of ids) histories[id] = [];

  function expireExtensionStalePending() {
    const now = Date.now();
    const maxAgeMs = (EXTENSION_PRE_BET_WAIT_SEC + LIVE_TABLE_BETTING_WINDOW_SEC) * 1000;
    const pendingByTable = { ...umMachine.pendingByTable };
    let changed = false;
    for (const tableId of ids) {
      if (!pendingByTable[String(tableId)]) continue;
      const at = lastLiveSpinAtByTable[tableId];
      if (at != null && now - at < maxAgeMs) continue;
      delete pendingByTable[String(tableId)];
      changed = true;
    }
    if (!changed) return;
    umMachine = { ...umMachine, pendingByTable, focusLockTableId: null };
  }

  function runTick(): RotativaTickResult {
    expireExtensionStalePending();

    const crossingTick = crossingEnabled
      ? tickRotatingRoomCrossingSessionPlacar(ids, histories, crossingMachine, crossingStats)
      : {
          nextMachine: crossingMachine,
          stats: crossingStats,
          statsChanged: false,
          flash: null as RotatingRoomCrossingPlacarFlash,
        };
    crossingMachine = sanitizeRotatingRoomCrossingMachineForTableIds(crossingTick.nextMachine, ids);
    crossingStats = crossingTick.stats;

    const umTick = tickUmFatorPlacar(ids, histories, umMachine, umStats, maxRecovery);
    umMachine = umTick.nextMachine;
    umStats = umTick.stats;

    const umView = buildUmFatorLiveView(ids, histories, umMachine);
    const crossingView = buildRotatingRoomCrossingSessionLiveView(ids, histories, crossingMachine);
    const snapshot = buildTriggerSnapshot(
      umMachine,
      umStats,
      umView,
      crossingMachine,
      crossingStats,
      crossingView,
      ids,
    );
    const trigger = resolveRotativaTriggerFromSnapshot(snapshot, crossingEnabled);
    const active = buildActiveView(trigger, umView, umMachine, crossingMachine, crossingView, ids);

    return {
      trigger,
      umFlash: umTick.flash,
      crossingFlash: crossingTick.flash,
      umMachine,
      crossingMachine,
      umStats,
      crossingStats,
      active,
    };
  }

  function spinHeadForTable(tableId: number): string {
    const h = histories[tableId] ?? [];
    return h.length === 0 ? "0" : `${h.length}:${h[0]}`;
  }

  function anchorLiveSpinClockForFormation(tableId: number) {
    const head = spinHeadForTable(tableId);
    if (lastAnchoredHeadByTable[tableId] === head) return;
    lastAnchoredHeadByTable[tableId] = head;
    lastLiveSpinAtByTable[tableId] = Date.now();
  }

  function ingestHistorySnapshot(tableId: number, spins: { number: number; gameId: string }[]) {
    if (!ids.includes(tableId)) return null;
    histories[tableId] = spins.map((s) => s.number);
    if (spins[0]) {
      lastGameIdByTable[tableId] = `${tableId}::${spins[0].gameId}`;
      spinBaselinedByTable[tableId] = true;
    }
    const result = runTick();
    if (umMachine.pendingByTable[String(tableId)]) {
      anchorLiveSpinClockForFormation(tableId);
    }
    return result;
  }

  function canPlaceBet(tableId: number, nowMs = Date.now()): boolean {
    const at = lastLiveSpinAtByTable[tableId];
    if (!at) return false;
    return nowMs - at >= EXTENSION_PRE_BET_WAIT_SEC * 1000;
  }

  function ingestSpin(tableId: number, number: number, gameId: string, replay = false) {
    if (!ids.includes(tableId)) return null;
    const prefixed = `${tableId}::${gameId}`;

    if (!spinBaselinedByTable[tableId]) {
      lastGameIdByTable[tableId] = prefixed;
      spinBaselinedByTable[tableId] = true;
      if (!replay) return null;
    }

    if (lastGameIdByTable[tableId] === prefixed) return null;
    lastGameIdByTable[tableId] = prefixed;
    anchorLiveSpinClockForFormation(tableId);

    const h = histories[tableId] ?? [];
    h.unshift(number);
    if (h.length > 40) h.length = 40;
    histories[tableId] = h;
    return runTick();
  }

  function buildBridgePayload(result: RotativaTickResult, mesaEmbedUrl: string | null = null) {
    const { active } = result;
    if (!active.showTapeteSignal || active.currentTableId == null) return null;
    if (!canPlaceBet(active.currentTableId)) return null;

    const tableId = active.currentTableId;
    const recovery = active.currentRecovery;
    const mesaProvider =
      typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/playtech")
        ? ("playtech" as const)
        : typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/pragmatic")
          ? ("pragmatic" as const)
          : ("outro" as const);

    if (active.trigger === "crossing" && active.activeCrossing) {
      const crossing = active.activeCrossing;
      const f1Label = doisFatoresFactorLabel(crossing.factor1);
      const f2Label = doisFatoresFactorLabel(crossing.factor2);
      const f1Key = pragmaticExteriorBetKeyFromFactor(crossing.factor1);
      const f2Key = pragmaticExteriorBetKeyFromFactor(crossing.factor2);
      const signalId = active.betAttemptKey ?? `${tableId}:${crossing.pairKind}:${recovery}`;
      const stakeAmount = stakeForRecovery(recovery, crossingMaxRecovery);

      return {
        type: "game-odds-glow/rotating-room-extension" as const,
        version: 1 as const,
        fingerprint: signalId,
        actions: [
          {
            kind: "click" as const,
            target: "factor-1" as const,
            label: f1Label,
            reason: `Autopilot 2F · ${f1Label} · gale ${recovery}`,
          },
          {
            kind: "click" as const,
            target: "factor-2" as const,
            label: f2Label,
            reason: `Autopilot 2F · ${f2Label} · gale ${recovery}`,
          },
        ],
        context: {
          sessionMode: active.sessionMode,
          prepareTableId: null,
          currentTableId: tableId,
          mesaEmbedUrl,
          mesaProvider,
          factor1Label: f1Label,
          factor2Label: f2Label,
          factor1BetKey: f1Key,
          factor2BetKey: f2Key,
          singleFactorMode: false,
          rotativaTrigger: "crossing" as const,
          strategy: "dois2fatores" as const,
          signalId,
          betAttemptKey: active.betAttemptKey,
          stakeAmount,
          currentRecovery: recovery,
          baseStake: BASE_STAKE,
          maxRecovery: crossingMaxRecovery,
          executionMode: null,
          mesaCatalog: [],
        },
      };
    }

    const umActive = active.umActive;
    if (!umActive) return null;
    const label = umFatorAlertLabel(umActive);
    const betKey = pragmaticExteriorBetKeyFromFactor(umActive.alertFactor);
    const signalId = active.betAttemptKey ?? `${tableId}:${umActive.resultNumber}:${umActive.alertFactor.kind}:${recovery}`;
    const stakeAmount = stakeForRecovery(recovery, maxRecovery);

    return {
      type: "game-odds-glow/rotating-room-extension" as const,
      version: 1 as const,
      fingerprint: signalId,
      actions: [
        {
          kind: "click" as const,
          target: "factor-1" as const,
          label,
          reason: `Autopilot 1F · ${label} · gale ${recovery}`,
        },
      ],
      context: {
        sessionMode: "active" as const,
        prepareTableId: null,
        currentTableId: tableId,
        mesaEmbedUrl,
        mesaProvider,
        factor1Label: label,
        factor2Label: null,
        factor1BetKey: betKey,
        factor2BetKey: null,
        singleFactorMode: true,
        rotativaTrigger: "umFator" as const,
        strategy: "um1fator" as const,
        signalId,
        betAttemptKey: active.betAttemptKey,
        stakeAmount,
        currentRecovery: recovery,
        baseStake: BASE_STAKE,
        maxRecovery,
        executionMode: null,
        mesaCatalog: [],
      },
    };
  }

  return {
    tableIds: ids,
    crossingEnabled,
    ingestHistorySnapshot,
    ingestSpin,
    runTick,
    buildBridgePayload,
    canPlaceBet,
    getState: () => ({
      machine: umMachine,
      stats: umStats,
      crossingMachine,
      crossingStats,
      histories,
      lastLiveSpinAtByTable,
      maxRecovery,
      crossingMaxRecovery,
    }),
    resetStats() {
      umStats = emptyRotatingRoomSessionStats(maxRecovery);
      crossingStats = emptyRotatingRoomSessionStats(crossingMaxRecovery);
    },
    reset() {
      umMachine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
      crossingMachine = sanitizeRotatingRoomCrossingMachineForTableIds(
        defaultRotatingRoomCrossingMachineState(),
        ids,
      );
      umStats = emptyRotatingRoomSessionStats(maxRecovery);
      crossingStats = emptyRotatingRoomSessionStats(crossingMaxRecovery);
      for (const id of ids) {
        histories[id] = [];
        delete lastGameIdByTable[id];
        delete spinBaselinedByTable[id];
        delete lastLiveSpinAtByTable[id];
        delete lastAnchoredHeadByTable[id];
      }
    },
  };
}

/** @deprecated Alias — use createRotativaEngine */
export const createUmFatorEngine = createRotativaEngine;

declare global {
  interface Window {
    SinglestakeUmFator?: {
      ROTATING_ROOM_TABLE_IDS: readonly number[];
      UM_FATOR_MAX_RECOVERY: number;
      BASE_STAKE: number;
      createRotativaEngine: typeof createRotativaEngine;
      createUmFatorEngine: typeof createUmFatorEngine;
      clampExtensionMaxRecovery: typeof clampExtensionMaxRecovery;
      EXTENSION_MAX_GALES: number;
      doisFatoresFactorLabel: typeof doisFatoresFactorLabel;
    };
  }
}

const api = {
  ROTATING_ROOM_TABLE_IDS,
  UM_FATOR_MAX_RECOVERY,
  EXTENSION_MAX_GALES,
  BASE_STAKE,
  EXTENSION_PRE_BET_WAIT_SEC,
  createRotativaEngine,
  createUmFatorEngine,
  clampExtensionMaxRecovery,
  doisFatoresFactorLabel,
};

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { SinglestakeUmFator: typeof api }).SinglestakeUmFator = api;
}

export default api;
