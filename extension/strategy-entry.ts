/**
 * Bundle entry — motor Um Fator + sala rotativa para a extensão Chrome (sem localhost).
 */
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
} from "../src/lib/roulette/entryWinBreakdown";
import { buildRotatingRoomTableIds } from "../src/lib/roulette/lobbyTables";
import { doisFatoresFactorLabel } from "../src/lib/roulette/doisFatoresStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "../src/lib/roulette/pragmaticExteriorBetMap";
import {
  buildUmFatorLiveView,
  defaultUmFatorMachineState,
  sanitizeUmFatorMachineForTableIds,
  tickUmFatorPlacar,
  UM_FATOR_MAX_RECOVERY,
  type UmFatorMachineState,
} from "../src/lib/roulette/rotatingRoomUmFatorStrategy";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";
import {
  EXTENSION_PRE_BET_WAIT_SEC,
  LIVE_TABLE_BETTING_WINDOW_SEC,
} from "../src/lib/roulette/liveTableBettingWindow";
import { umFatorAlertLabel } from "../src/lib/roulette/umFatorStrategy";

export const AUTOMATION_BANK_SHARE = 0.001;

export function baseStakeFromBalance(balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return balance * AUTOMATION_BANK_SHARE;
}

export function stakeForAutomationRecovery(
  recovery: number,
  balance: number | null | undefined,
  fallbackBase = 0.5,
): number {
  const level = Math.max(0, Math.floor(recovery));
  const base =
    typeof balance === "number" && Number.isFinite(balance) && balance > 0
      ? baseStakeFromBalance(balance)
      : fallbackBase;
  return base * 2 ** level;
}

export const ROTATING_ROOM_TABLE_IDS = buildRotatingRoomTableIds(206);
export { EXTENSION_PRE_BET_WAIT_SEC };

const LEGACY_BASE_STAKE = 0.5;
export const EXTENSION_MAX_GALES = 6;

export type CreateUmFatorEngineOptions = {
  tableIds?: readonly number[];
  maxRecovery?: number;
  initialStats?: RotatingRoomSessionStats | null;
};

export function clampExtensionMaxRecovery(value: unknown, fallback = UM_FATOR_MAX_RECOVERY): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.min(EXTENSION_MAX_GALES, Math.max(0, fallback));
  return Math.min(EXTENSION_MAX_GALES, Math.max(0, Math.floor(n)));
}

function stakeForRecovery(recovery: number, maxRecovery: number, balance?: number | null): number {
  const level = Math.min(Math.max(0, recovery), maxRecovery);
  return stakeForAutomationRecovery(level, balance, LEGACY_BASE_STAKE);
}

export type EngineSpinResult = {
  view: ReturnType<typeof buildUmFatorLiveView>;
  machine: UmFatorMachineState;
  stats: RotatingRoomSessionStats;
  flash: ReturnType<typeof tickUmFatorPlacar>["flash"];
};

export function createUmFatorEngine(
  tableIdsOrOptions: readonly number[] | CreateUmFatorEngineOptions = ROTATING_ROOM_TABLE_IDS,
) {
  const opts = Array.isArray(tableIdsOrOptions)
    ? { tableIds: tableIdsOrOptions }
    : tableIdsOrOptions;
  const ids = [...(opts.tableIds ?? ROTATING_ROOM_TABLE_IDS)];
  const maxRecovery = clampExtensionMaxRecovery(opts.maxRecovery);
  let machine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
  let stats =
    opts.initialStats != null
      ? parseRotatingRoomSessionStats(opts.initialStats, maxRecovery)
      : emptyRotatingRoomSessionStats(maxRecovery);
  const histories: Record<number, number[]> = {};
  const lastGameIdByTable: Record<number, string> = {};
  const spinBaselinedByTable: Record<number, boolean> = {};
  /** Momento do último giro ao vivo por mesa (não snapshot). */
  const lastLiveSpinAtByTable: Record<number, number> = {};
  /** Evita reancorar o relógio de espera no mesmo head (last20 repetido). */
  const lastAnchoredHeadByTable: Record<number, string> = {};

  for (const id of ids) histories[id] = [];

  function expireExtensionStalePending() {
    const now = Date.now();
    const maxAgeMs = (EXTENSION_PRE_BET_WAIT_SEC + LIVE_TABLE_BETTING_WINDOW_SEC) * 1000;
    const pendingByTable = { ...machine.pendingByTable };
    let changed = false;
    for (const tableId of ids) {
      if (!pendingByTable[String(tableId)]) continue;
      const at = lastLiveSpinAtByTable[tableId];
      if (at != null && now - at < maxAgeMs) continue;
      delete pendingByTable[String(tableId)];
      changed = true;
    }
    if (!changed) return;
    machine = {
      ...machine,
      pendingByTable,
      focusLockTableId: null,
    };
  }

  function runTick(): EngineSpinResult {
    expireExtensionStalePending();
    const tick = tickUmFatorPlacar(ids, histories, machine, stats, maxRecovery);
    machine = tick.nextMachine;
    stats = tick.stats;
    const view = buildUmFatorLiveView(ids, histories, machine);
    return { view, machine, stats, flash: tick.flash };
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
    if (result.machine.pendingByTable[String(tableId)]) {
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

  function buildBridgePayload(
    result: EngineSpinResult,
    mesaEmbedUrl: string | null = null,
    automationBalance: number | null = null,
  ) {
    const { view, machine } = result;
    if (!view.globalActive || view.globalTableId == null) return null;
    if (!canPlaceBet(view.globalTableId)) return null;

    const active = view.globalActive;
    const tableId = view.globalTableId;
    const recovery = machine.recovery;
    const signalId = `${tableId}:${active.resultNumber}:${active.alertFactor.kind}:${recovery}`;
    const betKey = pragmaticExteriorBetKeyFromFactor(active.alertFactor);
    const label = umFatorAlertLabel(active);
    const stakeAmount = stakeForRecovery(recovery, maxRecovery, automationBalance);

    return {
      type: "game-odds-glow/rotating-room-extension" as const,
      version: 1 as const,
      fingerprint: signalId,
      actions: [
        {
          kind: "click" as const,
          target: "factor-1" as const,
          label,
          reason: `Autopilot · ${label} · gale ${recovery}`,
        },
      ],
      context: {
        sessionMode: "active" as const,
        prepareTableId: null,
        currentTableId: tableId,
        mesaEmbedUrl,
        mesaProvider:
          typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/playtech")
            ? ("playtech" as const)
            : typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/pragmatic")
              ? ("pragmatic" as const)
              : ("outro" as const),
        factor1Label: label,
        factor2Label: null,
        factor1BetKey: betKey,
        factor2BetKey: null,
        singleFactorMode: true,
        signalId,
        automationBalance,
        stakeAmount,
        currentRecovery: recovery,
        baseStake: null,
        maxRecovery,
        executionMode: null,
        mesaCatalog: [],
      },
    };
  }

  return {
    tableIds: ids,
    ingestHistorySnapshot,
    ingestSpin,
    runTick,
    buildBridgePayload,
    canPlaceBet,
    getState: () => ({ machine, stats, histories, lastLiveSpinAtByTable, maxRecovery }),
    resetStats() {
      stats = emptyRotatingRoomSessionStats(maxRecovery);
    },
    reset() {
      machine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
      stats = emptyRotatingRoomSessionStats(maxRecovery);
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

declare global {
  interface Window {
    SinglestakeUmFator?: {
      ROTATING_ROOM_TABLE_IDS: readonly number[];
      UM_FATOR_MAX_RECOVERY: number;
      BASE_STAKE: number;
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
  createUmFatorEngine,
  clampExtensionMaxRecovery,
  doisFatoresFactorLabel,
};

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { SinglestakeUmFator: typeof api }).SinglestakeUmFator = api;
}

export default api;
