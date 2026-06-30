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
import { pragmaticFibonacciBetKeyFromZone } from "../src/lib/roulette/pragmaticFibonacciBetMap";
import {
  buildRotatingRoomFibonacciSessionLiveView,
  tickRotatingRoomFibonacciSessionPlacar,
} from "../src/lib/roulette/rotatingRoomFibonacciSession";
import {
  ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  defaultRotatingRoomFibonacciMachineState,
  fibonacciZoneLabel,
  sanitizeRotatingRoomFibonacciMachineForTableIds,
  stakeUnitsAtRecovery,
  type RotatingRoomFibonacciActive,
  type RotatingRoomFibonacciMachineState,
  type RotatingRoomFibonacciPlacarFlash,
} from "../src/lib/roulette/rotatingRoomFibonacciStrategy";
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
  initialFibonacciStats?: RotatingRoomSessionStats | null;
  /** Por defeito activo — desligar para modo só 1 Fator. */
  crossingEnabled?: boolean;
  fibonacciEnabled?: boolean;
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

function stakeForFibonacciRecovery(recovery: number): number {
  const level = Math.max(0, Math.min(Math.floor(recovery), ROTATING_ROOM_FIBONACCI_MAX_RECOVERY));
  return BASE_STAKE * stakeUnitsAtRecovery(level);
}

export type RotativaActiveView = {
  trigger: "umFator" | "crossing" | "fibonacci";
  showTapeteSignal: boolean;
  currentTableId: number | null;
  currentRecovery: number;
  singleFactorMode: boolean;
  sessionMode: StrategyGlobalSnapshot["dois2fatores"]["sessionMode"] | "scanning" | "active";
  activeCrossing: ReturnType<typeof umFatorToTapeteActive> | null;
  umActive: ReturnType<typeof buildUmFatorLiveView>["globalActive"];
  fibonacciActive: RotatingRoomFibonacciActive | null;
  betAttemptKey: string | null;
};

export type RotativaTickResult = {
  trigger: "umFator" | "crossing" | "fibonacci";
  umFlash: UmFatorPlacarFlash;
  crossingFlash: RotatingRoomCrossingPlacarFlash;
  fibonacciFlash: RotatingRoomFibonacciPlacarFlash;
  umMachine: UmFatorMachineState;
  crossingMachine: RotatingRoomCrossingMachineState;
  fibonacciMachine: RotatingRoomFibonacciMachineState;
  umStats: RotatingRoomSessionStats;
  crossingStats: RotatingRoomSessionStats;
  fibonacciStats: RotatingRoomSessionStats;
  active: RotativaActiveView;
};

function buildTriggerSnapshot(
  umMachine: UmFatorMachineState,
  umStats: RotatingRoomSessionStats,
  umView: ReturnType<typeof buildUmFatorLiveView>,
  crossingMachine: RotatingRoomCrossingMachineState,
  crossingStats: RotatingRoomSessionStats,
  crossingView: ReturnType<typeof buildRotatingRoomCrossingSessionLiveView>,
  fibonacciMachine: RotatingRoomFibonacciMachineState,
  fibonacciStats: RotatingRoomSessionStats,
  fibonacciView: ReturnType<typeof buildRotatingRoomFibonacciSessionLiveView>,
  tableIds: readonly number[],
): StrategyGlobalSnapshot {
  const showUmTapete = umView.globalActive != null && umView.globalTableId != null;
  const crossingActive = crossingMachine.cycleActive;
  const crossingTableId =
    crossingMachine.cycleTableId != null && tableIds.includes(crossingMachine.cycleTableId)
      ? crossingMachine.cycleTableId
      : null;
  const showCrossTapete = crossingActive != null && crossingTableId != null;
  const showFibTapete =
    fibonacciMachine.cycleZone != null &&
    fibonacciMachine.cycleTableId != null &&
    tableIds.includes(fibonacciMachine.cycleTableId);
  const fibPrepareTableId =
    fibonacciMachine.prepareTableId != null && tableIds.includes(fibonacciMachine.prepareTableId)
      ? fibonacciMachine.prepareTableId
      : null;
  const fibSessionMode = showFibTapete
    ? "active"
    : fibPrepareTableId != null
      ? "prepare"
      : "scanning";

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
    fibonacci: {
      phase: showFibTapete ? "active" : "waiting",
      sessionStats: fibonacciStats,
      showTapeteSignal: showFibTapete,
      fibonacciMode: true,
      currentRecovery: fibonacciMachine.recovery,
      currentTableId: showFibTapete ? fibonacciMachine.cycleTableId : null,
      prepareTableId: fibPrepareTableId,
      alertCategory: fibonacciView.globalPick
        ? fibonacciView.globalPick.zone.kind === "dozen"
          ? `Dúzia ${fibonacciView.globalPick.zone.id}`
          : `Coluna ${fibonacciView.globalPick.zone.id}`
        : null,
      alertBucketGap: fibonacciView.globalPick?.absenceGap ?? 0,
      sessionMode: fibSessionMode,
      prepareCategory:
        fibPrepareTableId != null && fibonacciMachine.prepareZone
          ? fibonacciMachine.prepareZone.kind === "dozen"
            ? `Dúzia ${fibonacciMachine.prepareZone.id}`
            : `Coluna ${fibonacciMachine.prepareZone.id}`
          : null,
      fibonacciScan: fibonacciView.fibonacciScan,
      activeFibonacci:
        showFibTapete && fibonacciMachine.cycleZone && fibonacciMachine.cycleTableId != null
          ? {
              zone: fibonacciMachine.cycleZone,
              zoneLabel: fibonacciZoneLabel(fibonacciMachine.cycleZone),
              betKey:
                fibonacciMachine.cycleZone.kind === "dozen"
                  ? (`doz:${fibonacciMachine.cycleZone.id}` as const)
                  : (`col:${fibonacciMachine.cycleZone.id}` as const),
              absenceGap: fibonacciView.globalPick?.absenceGap ?? 0,
              stakeUnits: stakeUnitsAtRecovery(fibonacciMachine.recovery),
              profitUnits: 2 * stakeUnitsAtRecovery(fibonacciMachine.recovery),
              recoveryIndex: fibonacciMachine.recovery,
              tableId: fibonacciMachine.cycleTableId,
              armingDescription: `${fibonacciZoneLabel(fibonacciMachine.cycleZone)} · mesa ${fibonacciMachine.cycleTableId}`,
            }
          : null,
    },
    lifetime: {
      dois2fatores: { since: 0, wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] },
      um1fator: { since: 0, wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] },
      fibonacci: { since: 0, wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] },
    },
    ledgerTail: { dois2fatores: [], um1fator: [], fibonacci: [] },
  };
}

function buildActiveView(
  trigger: "umFator" | "crossing" | "fibonacci",
  umView: ReturnType<typeof buildUmFatorLiveView>,
  umMachine: UmFatorMachineState,
  crossingMachine: RotatingRoomCrossingMachineState,
  crossingView: ReturnType<typeof buildRotatingRoomCrossingSessionLiveView>,
  fibonacciMachine: RotatingRoomFibonacciMachineState,
  fibonacciView: ReturnType<typeof buildRotatingRoomFibonacciSessionLiveView>,
  tableIds: readonly number[],
): RotativaActiveView {
  if (trigger === "fibonacci") {
    const zone = fibonacciMachine.cycleZone;
    const tableId =
      fibonacciMachine.cycleTableId != null && tableIds.includes(fibonacciMachine.cycleTableId)
        ? fibonacciMachine.cycleTableId
        : null;
    const prepareTableId =
      fibonacciMachine.prepareTableId != null && tableIds.includes(fibonacciMachine.prepareTableId)
        ? fibonacciMachine.prepareTableId
        : null;
    const showTapete = zone != null && tableId != null;
    const sessionMode = showTapete
      ? "active"
      : prepareTableId != null
        ? "prepare"
        : fibonacciView.globalPick
          ? "scanning"
          : "scanning";
    const head = fibonacciMachine.lastEvaluatedHead ?? fibonacciMachine.armedAtHead ?? "0";
    const betAttemptKey =
      showTapete && zone
        ? `${tableId}:${zone.kind}:${zone.id}:${fibonacciMachine.recovery}:${head}`
        : null;
    const fibonacciActive =
      showTapete && zone && tableId != null
        ? {
            zone,
            zoneLabel: fibonacciZoneLabel(zone),
            betKey: pragmaticFibonacciBetKeyFromZone(zone),
            absenceGap: fibonacciView.globalPick?.absenceGap ?? 0,
            stakeUnits: stakeUnitsAtRecovery(fibonacciMachine.recovery),
            profitUnits: 2 * stakeUnitsAtRecovery(fibonacciMachine.recovery),
            recoveryIndex: fibonacciMachine.recovery,
            tableId,
            armingDescription: `${fibonacciZoneLabel(zone)} · mesa ${tableId}`,
          }
        : null;
    return {
      trigger,
      showTapeteSignal: showTapete,
      currentTableId: showTapete ? tableId : prepareTableId,
      currentRecovery: fibonacciMachine.recovery,
      singleFactorMode: true,
      sessionMode,
      activeCrossing: null,
      umActive: null,
      fibonacciActive,
      betAttemptKey,
    };
  }

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
      fibonacciActive: null,
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
    fibonacciActive: null,
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
  const fibonacciEnabled = opts.fibonacciEnabled !== false;

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

  let fibonacciMachine = sanitizeRotatingRoomFibonacciMachineForTableIds(
    defaultRotatingRoomFibonacciMachineState(),
    ids,
  );
  let fibonacciStats =
    opts.initialFibonacciStats != null
      ? parseRotatingRoomSessionStats(
          opts.initialFibonacciStats,
          ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
        )
      : emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);

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

    const fibonacciTick = fibonacciEnabled
      ? tickRotatingRoomFibonacciSessionPlacar(ids, histories, fibonacciMachine, fibonacciStats)
      : {
          nextMachine: fibonacciMachine,
          stats: fibonacciStats,
          statsChanged: false,
          flash: null as RotatingRoomFibonacciPlacarFlash,
        };
    fibonacciMachine = sanitizeRotatingRoomFibonacciMachineForTableIds(
      fibonacciTick.nextMachine,
      ids,
    );
    fibonacciStats = fibonacciTick.stats;

    const umView = buildUmFatorLiveView(ids, histories, umMachine);
    const crossingView = buildRotatingRoomCrossingSessionLiveView(ids, histories, crossingMachine);
    const fibonacciView = buildRotatingRoomFibonacciSessionLiveView(
      ids,
      histories,
      fibonacciMachine,
    );
    const snapshot = buildTriggerSnapshot(
      umMachine,
      umStats,
      umView,
      crossingMachine,
      crossingStats,
      crossingView,
      fibonacciMachine,
      fibonacciStats,
      fibonacciView,
      ids,
    );
    const trigger = resolveRotativaTriggerFromSnapshot(
      snapshot,
      crossingEnabled,
      fibonacciEnabled,
    );
    const active = buildActiveView(
      trigger,
      umView,
      umMachine,
      crossingMachine,
      crossingView,
      fibonacciMachine,
      fibonacciView,
      ids,
    );

    return {
      trigger,
      umFlash: umTick.flash,
      crossingFlash: crossingTick.flash,
      fibonacciFlash: fibonacciTick.flash,
      umMachine,
      crossingMachine,
      fibonacciMachine,
      umStats,
      crossingStats,
      fibonacciStats,
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
    if (
      umMachine.pendingByTable[String(tableId)] ||
      (fibonacciMachine.cycleTableId === tableId && fibonacciMachine.cycleZone) ||
      (fibonacciMachine.prepareTableId === tableId && fibonacciMachine.prepareZone)
    ) {
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

    if (active.trigger === "fibonacci" && active.fibonacciActive) {
      const fib = active.fibonacciActive;
      const label = fib.zoneLabel;
      const betKey = pragmaticFibonacciBetKeyFromZone(fib.zone);
      const signalId =
        active.betAttemptKey ?? `${tableId}:${fib.zone.kind}:${fib.zone.id}:${recovery}`;
      const stakeAmount = stakeForFibonacciRecovery(recovery);

      return {
        type: "game-odds-glow/rotating-room-extension" as const,
        version: 1 as const,
        fingerprint: signalId,
        actions: [
          {
            kind: "click" as const,
            target: "factor-1" as const,
            label,
            reason: `Autopilot Fibonacci · ${label} · gale ${recovery}`,
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
          rotativaTrigger: "fibonacci" as const,
          strategy: "fibonacci" as const,
          signalId,
          betAttemptKey: active.betAttemptKey,
          stakeAmount,
          currentRecovery: recovery,
          baseStake: BASE_STAKE,
          maxRecovery: ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
          executionMode: null,
          mesaCatalog: [],
        },
      };
    }

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
    fibonacciEnabled,
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
      fibonacciMachine,
      fibonacciStats,
      histories,
      lastLiveSpinAtByTable,
      maxRecovery,
      crossingMaxRecovery,
    }),
    resetStats() {
      umStats = emptyRotatingRoomSessionStats(maxRecovery);
      crossingStats = emptyRotatingRoomSessionStats(crossingMaxRecovery);
      fibonacciStats = emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
    },
    reset() {
      umMachine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
      crossingMachine = sanitizeRotatingRoomCrossingMachineForTableIds(
        defaultRotatingRoomCrossingMachineState(),
        ids,
      );
      fibonacciMachine = sanitizeRotatingRoomFibonacciMachineForTableIds(
        defaultRotatingRoomFibonacciMachineState(),
        ids,
      );
      umStats = emptyRotatingRoomSessionStats(maxRecovery);
      crossingStats = emptyRotatingRoomSessionStats(crossingMaxRecovery);
      fibonacciStats = emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
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
