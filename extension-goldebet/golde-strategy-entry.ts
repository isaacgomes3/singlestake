/**
 * Bundle entry — motor GoldeBet Cruzamento Sequencial 2 Fatores (gales alternados).
 */
import { doisFatoresFactorLabel } from "../src/lib/roulette/doisFatoresStrategy";
import {
  canPlaceGoldeCruzamentoBet,
  defaultGoldeCruzamentoMachineState,
  emptyGoldeCruzamentoStats,
  goldeCruzamentoBetFactors,
  goldeCruzamentoUseOppositeFactors,
  goldeCruzamentoBetFactors,
  GOLDE_CRUZAMENTO_FIRST_BET_SETTLE_MS,
  GOLDE_CRUZAMENTO_MAX_RECOVERY,
  GOLDE_CRUZAMENTO_RECOVERY_BET_DELAY_MS,
  GOLDE_ROULETTE_MESA_URL,
  GOLDE_ROULETTE_TABLE_ID,
  parseGoldeCruzamentoStats,
  tickGoldeCruzamentoPlacar,
  type GoldeCruzamentoActive,
  type GoldeCruzamentoMachineState,
} from "../src/lib/roulette/goldeCruzamentoSequencialStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "../src/lib/roulette/pragmaticExteriorBetMap";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";

export const GOLDE_TABLE_ID = GOLDE_ROULETTE_TABLE_ID;
export const GOLDE_MESA_URL = GOLDE_ROULETTE_MESA_URL;
export const GOLDE_MAX_GALES = GOLDE_CRUZAMENTO_MAX_RECOVERY;
export const ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = GOLDE_CRUZAMENTO_FIRST_BET_SETTLE_MS;
export const ROTATING_ROOM_CROSSING_BET_DELAY_MS = GOLDE_CRUZAMENTO_RECOVERY_BET_DELAY_MS;

const BASE_STAKE = 0.5;

export type CreateGoldeCruzamentoEngineOptions = {
  maxRecovery?: number;
  initialStats?: RotatingRoomSessionStats | null;
  initialMachine?: { recovery?: number; lastSpinHead?: string | null } | null;
};

function clampMaxRecovery(value: unknown, fallback = GOLDE_CRUZAMENTO_MAX_RECOVERY): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
  return Math.min(6, Math.max(0, Math.floor(n)));
}

function stakeForRecovery(recovery: number, maxRecovery: number): number {
  const level = Math.min(Math.max(0, recovery), maxRecovery);
  return BASE_STAKE * 2 ** level;
}

export type GoldeEngineSpinResult = {
  active: GoldeCruzamentoActive | null;
  recovery: number;
  machine: GoldeCruzamentoMachineState;
  stats: RotatingRoomSessionStats;
  flash: ReturnType<typeof tickGoldeCruzamentoPlacar>["flash"];
};

export function createGoldeCruzamentoEngine(options: CreateGoldeCruzamentoEngineOptions = {}) {
  const maxRecovery = clampMaxRecovery(options.maxRecovery);
  let machine = defaultGoldeCruzamentoMachineState();
  if (options.initialMachine) {
    machine = {
      ...machine,
      recovery:
        typeof options.initialMachine.recovery === "number" &&
        Number.isFinite(options.initialMachine.recovery)
          ? Math.max(0, Math.floor(options.initialMachine.recovery))
          : 0,
      lastSpinHead:
        typeof options.initialMachine.lastSpinHead === "string"
          ? options.initialMachine.lastSpinHead
          : null,
    };
  }
  let stats =
    options.initialStats != null
      ? parseGoldeCruzamentoStats(options.initialStats, maxRecovery)
      : emptyGoldeCruzamentoStats(maxRecovery);
  let history: number[] = [];
  let lastGameId: string | null = null;
  let spinBaselined = false;
  let liveSpinSeen = false;
  let lastLiveSpinAt: number | null = null;

  function spinHead(): string {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }

  function anchorSpinClock() {
    lastLiveSpinAt = Date.now();
  }

  function runTick(): GoldeEngineSpinResult {
    const tick = tickGoldeCruzamentoPlacar(history, machine, stats, maxRecovery);
    machine = tick.machine;
    stats = tick.stats;
    return {
      active: tick.globalActive,
      recovery: tick.globalRecovery,
      machine,
      stats,
      flash: tick.flash,
    };
  }

  function ingestHistorySnapshot(spins: { number: number; gameId: string }[]) {
    if (liveSpinSeen) return null;
    history = spins.map((s) => s.number);
    if (spins[0]) {
      lastGameId = spins[0].gameId;
      spinBaselined = true;
    }
    machine = { ...machine, lastSpinHead: spinHead() };
    return {
      active: null,
      recovery: 0,
      machine,
      stats,
      flash: null,
    };
  }

  function ingestSpin(number: number, gameId: string, replay = false) {
    const prefixed = gameId;

    if (!spinBaselined) {
      lastGameId = prefixed;
      spinBaselined = true;
    }

    if (lastGameId === prefixed && !replay) return null;
    lastGameId = prefixed;
    liveSpinSeen = true;
    anchorSpinClock();

    history.unshift(number);
    if (history.length > 40) history.length = 40;

    return runTick();
  }

  function canPlaceBet(nowMs = Date.now()): boolean {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
    return canPlaceGoldeCruzamentoBet(machine.cycle.recovery, lastLiveSpinAt, nowMs);
  }

  function beginBetCommit() {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
    machine = { ...machine, betCommitInFlight: true };
    return true;
  }

  function abortBetCommit() {
    if (!machine.betCommitInFlight) return;
    machine = { ...machine, betCommitInFlight: false };
  }

  function markBetPlaced() {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") {
      machine = { ...machine, betCommitInFlight: false };
      return;
    }
    machine = {
      ...machine,
      betCommitInFlight: false,
      cycle: { ...machine.cycle, phase: "awaiting_result" },
    };
  }

  function buildBridgePayload(mesaEmbedUrl: string | null = GOLDE_MESA_URL) {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
    if (!canPlaceBet()) return null;

    const { active, recovery } = machine.cycle;
    const bet = goldeCruzamentoBetFactors(active, recovery);
    const modeTag = bet.oppositeMode ? "opp" : "norm";
    const signalId = `golde:${active.triggerNumbers.join("-")}:${recovery}:${modeTag}`;
    const f1Key = pragmaticExteriorBetKeyFromFactor(bet.factor1);
    const f2Key = pragmaticExteriorBetKeyFromFactor(bet.factor2);
    const f1Label = doisFatoresFactorLabel(bet.factor1);
    const f2Label = doisFatoresFactorLabel(bet.factor2);
    const stakeAmount = stakeForRecovery(recovery, maxRecovery);

    const betDelayUntilMs =
      lastLiveSpinAt != null
        ? lastLiveSpinAt +
          (recovery > 0
            ? GOLDE_CRUZAMENTO_RECOVERY_BET_DELAY_MS
            : GOLDE_CRUZAMENTO_FIRST_BET_SETTLE_MS)
        : null;

    const galeSuffix = recovery > 0 ? ` · gale ${recovery}` : " · entrada";
    const modeSuffix = bet.oppositeMode ? " · oposto" : "";

    return {
      type: "game-odds-glow/rotating-room-extension" as const,
      version: 1 as const,
      fingerprint: signalId,
      actions: [
        {
          kind: "click" as const,
          target: "factor-1" as const,
          label: f1Label,
          reason: `Golde 2F · ${f1Label}${galeSuffix}${modeSuffix}`,
        },
        {
          kind: "click" as const,
          target: "factor-2" as const,
          label: f2Label,
          reason: `Golde 2F · ${f2Label}${galeSuffix}${modeSuffix}`,
        },
      ],
      context: {
        sessionMode: "active" as const,
        prepareTableId: null,
        currentTableId: GOLDE_TABLE_ID,
        mesaEmbedUrl: mesaEmbedUrl ?? GOLDE_MESA_URL,
        mesaProvider: "pragmatic" as const,
        factor1Label: f1Label,
        factor2Label: f2Label,
        factor1BetKey: f1Key,
        factor2BetKey: f2Key,
        singleFactorMode: false,
        signalId,
        stakeAmount,
        currentRecovery: recovery,
        baseStake: BASE_STAKE,
        maxRecovery,
        executionMode: null,
        strategy: "dois2fatores" as const,
        rotativaTrigger: "crossing" as const,
        betDelayUntilMs,
        mesaCatalog: [],
      },
    };
  }

  return {
    tableId: GOLDE_TABLE_ID,
    ingestHistorySnapshot,
    ingestSpin,
    runTick,
    buildBridgePayload,
    canPlaceBet,
    beginBetCommit,
    abortBetCommit,
    markBetPlaced,
    getState: () => ({ machine, stats, history, lastLiveSpinAt, maxRecovery }),
    resetStats() {
      stats = emptyGoldeCruzamentoStats(maxRecovery);
    },
    reset() {
      machine = defaultGoldeCruzamentoMachineState();
      stats = emptyGoldeCruzamentoStats(maxRecovery);
      history = [];
      lastGameId = null;
      spinBaselined = false;
      liveSpinSeen = false;
      lastLiveSpinAt = null;
    },
  };
}

declare global {
  interface Window {
    SinglestakeGoldeCruzamento?: {
      GOLDE_TABLE_ID: number;
      GOLDE_MESA_URL: string;
      GOLDE_MAX_GALES: number;
      createGoldeCruzamentoEngine: typeof createGoldeCruzamentoEngine;
    };
  }
}

const api = {
  GOLDE_TABLE_ID,
  GOLDE_MESA_URL,
  GOLDE_MAX_GALES,
  goldeCruzamentoBetFactors,
  goldeCruzamentoUseOppositeFactors,
  createGoldeCruzamentoEngine,
};

if (typeof globalThis !== "undefined") {
  (
    globalThis as typeof globalThis & { SinglestakeGoldeCruzamento: typeof api }
  ).SinglestakeGoldeCruzamento = api;
}

export default api;
