/**
 * Bundle entry — motor KTO Cruzamento Sequencial 2 Fatores para extensão Chrome.
 */
import {
  doisFatoresFactorLabel,
} from "../src/lib/roulette/doisFatoresStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "../src/lib/roulette/pragmaticExteriorBetMap";
import {
  canPlaceKtoCruzamentoBet,
  defaultKtoCruzamentoMachineState,
  emptyKtoCruzamentoStats,
  KTO_ROULETTE_TABLE_ID,
  KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS,
  KTO_CRUZAMENTO_MAX_RECOVERY,
  KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS,
  KTO_CRUZAMENTO_STAKE_UNITS,
  KTO_ROULETTE_MESA_URL,
  ktoCruzamentoBetFactors,
  ktoCruzamentoStakeUnits,
  ktoCruzamentoUseOppositeFactors,
  parseKtoCruzamentoStats,
  tickKtoCruzamentoPlacar,
  type KtoCruzamentoActive,
  type KtoCruzamentoMachineState,
} from "../src/lib/roulette/ktoCruzamentoSequencialStrategy";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";

export const KTO_TABLE_ID = KTO_ROULETTE_TABLE_ID;
export const KTO_MESA_URL = KTO_ROULETTE_MESA_URL;
export const KTO_MAX_GALES = KTO_CRUZAMENTO_MAX_RECOVERY;
export const ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS;
export const ROTATING_ROOM_CROSSING_BET_DELAY_MS = KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS;

const BASE_STAKE = 0.5;

export type CreateKtoCruzamentoEngineOptions = {
  maxRecovery?: number;
  initialStats?: RotatingRoomSessionStats | null;
  initialMachine?: { recovery?: number; lastSpinHead?: string | null } | null;
};

function clampMaxRecovery(value: unknown, fallback = KTO_CRUZAMENTO_MAX_RECOVERY): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
  return Math.min(KTO_CRUZAMENTO_MAX_RECOVERY, Math.max(0, Math.floor(n)));
}

function stakeForRecovery(recovery: number, maxRecovery: number): number {
  const level = Math.min(Math.max(0, recovery), maxRecovery, KTO_CRUZAMENTO_STAKE_UNITS.length - 1);
  return BASE_STAKE * ktoCruzamentoStakeUnits(level);
}

export type KtoEngineSpinResult = {
  active: KtoCruzamentoActive | null;
  recovery: number;
  machine: KtoCruzamentoMachineState;
  stats: RotatingRoomSessionStats;
  flash: ReturnType<typeof tickKtoCruzamentoPlacar>["flash"];
};

export function createKtoCruzamentoEngine(options: CreateKtoCruzamentoEngineOptions = {}) {
  const maxRecovery = clampMaxRecovery(options.maxRecovery);
  let machine = defaultKtoCruzamentoMachineState();
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
      ? parseKtoCruzamentoStats(options.initialStats, maxRecovery)
      : emptyKtoCruzamentoStats(maxRecovery);
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

  function runTick(): KtoEngineSpinResult {
    const tick = tickKtoCruzamentoPlacar(history, machine, stats, maxRecovery);
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

    // Novo gameId — regista sempre (mesmo número repetido, ex.: 6 depois de 6).
    history.unshift(number);
    if (history.length > 40) history.length = 40;

    return runTick();
  }

  function canPlaceBet(nowMs = Date.now()): boolean {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
    return canPlaceKtoCruzamentoBet(machine.cycle.recovery, lastLiveSpinAt, nowMs);
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

  function buildBridgePayload(mesaEmbedUrl: string | null = KTO_MESA_URL) {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
    if (!canPlaceBet()) return null;

    const { active, recovery } = machine.cycle;
    const bet = ktoCruzamentoBetFactors(active, recovery);
    const modeTag = bet.oppositeMode ? "opp" : "norm";
    const signalId = `kto:${active.triggerNumbers.join("-")}:${recovery}:${modeTag}`;
    const f1Key = pragmaticExteriorBetKeyFromFactor(bet.factor1);
    const f2Key = pragmaticExteriorBetKeyFromFactor(bet.factor2);
    const f1Label = doisFatoresFactorLabel(bet.factor1);
    const f2Label = doisFatoresFactorLabel(bet.factor2);
    const stakeAmount = stakeForRecovery(recovery, maxRecovery);
    const units = ktoCruzamentoStakeUnits(recovery);

    const betDelayUntilMs =
      lastLiveSpinAt != null
        ? lastLiveSpinAt +
          (recovery > 0
            ? KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS
            : KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS)
        : null;

    const galeSuffix = recovery > 0 ? ` · gale ${recovery}` : " · entrada";
    const modeSuffix = bet.oppositeMode ? " · oposto" : "";
    const unitsSuffix = ` · ${units} un.`;

    return {
      type: "game-odds-glow/rotating-room-extension" as const,
      version: 1 as const,
      fingerprint: signalId,
      actions: [
        {
          kind: "click" as const,
          target: "factor-1" as const,
          label: f1Label,
          reason: `KTO 2F · ${f1Label}${galeSuffix}${modeSuffix}${unitsSuffix}`,
        },
        {
          kind: "click" as const,
          target: "factor-2" as const,
          label: f2Label,
          reason: `KTO 2F · ${f2Label}${galeSuffix}${modeSuffix}${unitsSuffix}`,
        },
      ],
      context: {
        sessionMode: "active" as const,
        prepareTableId: null,
        currentTableId: KTO_TABLE_ID,
        mesaEmbedUrl: mesaEmbedUrl ?? KTO_MESA_URL,
        mesaProvider: "outro" as const,
        factor1Label: f1Label,
        factor2Label: f2Label,
        factor1BetKey: f1Key,
        factor2BetKey: f2Key,
        singleFactorMode: false,
        signalId,
        stakeAmount,
        units,
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
    tableId: KTO_TABLE_ID,
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
      stats = emptyKtoCruzamentoStats(maxRecovery);
    },
    reset() {
      machine = defaultKtoCruzamentoMachineState();
      stats = emptyKtoCruzamentoStats(maxRecovery);
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
    SinglestakeKtoCruzamento?: {
      KTO_TABLE_ID: number;
      KTO_MESA_URL: string;
      KTO_MAX_GALES: number;
      createKtoCruzamentoEngine: typeof createKtoCruzamentoEngine;
    };
  }
}

const api = {
  KTO_TABLE_ID,
  KTO_MESA_URL,
  KTO_MAX_GALES,
  KTO_CRUZAMENTO_STAKE_UNITS,
  ktoCruzamentoStakeUnits,
  ktoCruzamentoBetFactors,
  ktoCruzamentoUseOppositeFactors,
  createKtoCruzamentoEngine,
};

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { SinglestakeKtoCruzamento: typeof api }).SinglestakeKtoCruzamento =
    api;
}

export default api;
