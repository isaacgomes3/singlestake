/**
 * Bundle entry — motor KTO Cruzamento 2F para extensão Chrome.
 */
import { doisFatoresFactorLabel } from "../src/lib/roulette/doisFatoresStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "../src/lib/roulette/pragmaticExteriorBetMap";
import {
  canPlaceIce2fBet,
  defaultIce2fMachineState,
  emptyIce2fStats,
  formatIce2fWatchLabel,
  ICE_2F_BET_DELAY_MS,
  ICE_2F_FIRST_BET_SETTLE_MS,
  ICE_2F_MAX_RECOVERY,
  ICE_2F_RECOVERY_BET_DELAY_MS,
  ice2fBetDelayMs,
  ice2fBetDelayUntilMs,
  ice2fPadFactorPlacementMs,
  ice2fStakeUnits,
  parseIce2fStats,
  primeIce2fWatchFromHistory,
  tickIce2fPlacar,
  tryArmCycleFromWatch,
  type Ice2fActive,
  type Ice2fMachineState,
} from "../src/lib/roulette/iceCruzamento2fStrategy";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";

export const KTO2F_TABLE_ID = 230;
export const KTO2F_MESA_URL =
  "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/";
export const KTO2F_MAX_GALES = ICE_2F_MAX_RECOVERY;
export const ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_2F_FIRST_BET_SETTLE_MS;
export const ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;

const BASE_STAKE = 0.5;

export type CreateKto2fEngineOptions = {
  maxRecovery?: number;
  initialStats?: RotatingRoomSessionStats | null;
  initialMachine?: { lastSpinHead?: string | null } | null;
};

function clampMaxRecovery(value: unknown, fallback = ICE_2F_MAX_RECOVERY): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
  return Math.min(ICE_2F_MAX_RECOVERY, Math.max(0, Math.floor(n)));
}

export type Kto2fEngineSpinResult = {
  active: Ice2fActive | null;
  recovery: number;
  machine: Ice2fMachineState;
  stats: RotatingRoomSessionStats;
  flash: ReturnType<typeof tickIce2fPlacar>["flash"];
};

export function createKto2fEngine(options: CreateKto2fEngineOptions = {}) {
  const maxRecovery = clampMaxRecovery(options.maxRecovery);
  let machine = defaultIce2fMachineState();
  if (options.initialMachine?.lastSpinHead) {
    machine = { ...machine, lastSpinHead: options.initialMachine.lastSpinHead };
  }
  let stats =
    options.initialStats != null
      ? parseIce2fStats(options.initialStats, maxRecovery)
      : emptyIce2fStats(maxRecovery);
  let history: number[] = [];
  let lastGameId: string | null = null;
  let spinBaselined = false;
  let liveSpinSeen = false;
  let lastLiveSpinAt: number | null = null;

  function spinHead(): string {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }

  function runTick(): Kto2fEngineSpinResult {
    const tick = tickIce2fPlacar(history, machine, stats, maxRecovery);
    machine = tick.machine;
    stats = tick.stats;
    return {
      active: tick.globalActive,
      recovery: tick.globalRecovery,
      machine: tick.machine,
      stats: tick.stats,
      flash: tick.flash,
    };
  }

  function anchorSpinClock() {
    lastLiveSpinAt = Date.now();
  }

  function ingestHistorySnapshot(spins: { number: number; gameId: string }[]) {
    if (liveSpinSeen) return null;
    history = spins.map((s) => s.number);
    if (spins[0]) {
      lastGameId = spins[0].gameId;
      spinBaselined = true;
    }
    const head = spinHead();
    const watch = primeIce2fWatchFromHistory(history);
    machine = {
      ...defaultIce2fMachineState(),
      watch,
      lastSpinHead: head,
    };
    if (history.length >= 12) {
      machine = tryArmCycleFromWatch(machine, history, head);
    }
    lastLiveSpinAt = Date.now();
    const tick = tickIce2fPlacar(history, machine, stats, maxRecovery);
    machine = tick.machine;
    return {
      active: tick.globalActive,
      recovery: tick.globalRecovery,
      machine: tick.machine,
      stats: tick.stats,
      flash: tick.flash,
    };
  }

  function ingestSpin(number: number, gameId: string, replay = false) {
    if (!spinBaselined) {
      lastGameId = gameId;
      spinBaselined = true;
    }
    if (lastGameId === gameId && !replay) return null;
    lastGameId = gameId;
    liveSpinSeen = true;
    anchorSpinClock();
    history.unshift(number);
    if (history.length > 40) history.length = 40;
    return runTick();
  }

  function canPlaceBet(nowMs = Date.now()): boolean {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
    return canPlaceIce2fBet(machine.cycle.recovery, lastLiveSpinAt, nowMs);
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

  function buildBridgePayload(mesaEmbedUrl: string | null = KTO2F_MESA_URL) {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
    if (!canPlaceBet()) return null;

    const { active, recovery } = machine.cycle;
    const units = ice2fStakeUnits(recovery);
    const signalId = `kto2f:pos${active.criticalPosition}:${active.axis}:ref${active.referenceNumber}:r${recovery}`;
    const f1Key = pragmaticExteriorBetKeyFromFactor(active.factor1);
    const f2Key = pragmaticExteriorBetKeyFromFactor(active.factor2);
    const f1Label = doisFatoresFactorLabel(active.factor1);
    const f2Label = doisFatoresFactorLabel(active.factor2);
    const stakeAmount = BASE_STAKE * units;
    const betDelayUntilMs = ice2fBetDelayUntilMs(recovery, lastLiveSpinAt);
    const galeSuffix = recovery > 0 ? ` · gale ${recovery}` : " · entrada";

    return {
      type: "game-odds-glow/rotating-room-extension" as const,
      version: 1 as const,
      fingerprint: signalId,
      actions: [
        {
          kind: "click" as const,
          target: "factor-1" as const,
          label: f1Label,
          reason: `KTO 2F · ${f1Label}${galeSuffix}`,
        },
        {
          kind: "click" as const,
          target: "factor-2" as const,
          label: f2Label,
          reason: `KTO 2F · ${f2Label}${galeSuffix}`,
        },
      ],
      context: {
        sessionMode: "active" as const,
        prepareTableId: null,
        currentTableId: KTO2F_TABLE_ID,
        mesaEmbedUrl: mesaEmbedUrl ?? KTO2F_MESA_URL,
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
        strategy: "kto2fcruzamento" as const,
        rotativaTrigger: "critical" as const,
        betDelayUntilMs,
        mesaCatalog: [],
      },
    };
  }

  return {
    tableId: KTO2F_TABLE_ID,
    ingestHistorySnapshot,
    ingestSpin,
    runTick,
    buildBridgePayload,
    canPlaceBet,
    beginBetCommit,
    abortBetCommit,
    markBetPlaced,
    getState: () => ({
      machine,
      stats,
      history,
      lastLiveSpinAt,
      maxRecovery,
    }),
    resetStats() {
      stats = emptyIce2fStats(maxRecovery);
    },
    reset() {
      machine = defaultIce2fMachineState();
      stats = emptyIce2fStats(maxRecovery);
      history = [];
      lastGameId = null;
      spinBaselined = false;
      liveSpinSeen = false;
      lastLiveSpinAt = null;
    },
  };
}

const api = {
  KTO2F_TABLE_ID,
  KTO2F_MESA_URL,
  KTO2F_MAX_GALES,
  ICE_2F_BET_DELAY_MS,
  ICE_2F_FIRST_BET_SETTLE_MS,
  ICE_2F_MAX_RECOVERY,
  ICE_2F_RECOVERY_BET_DELAY_MS,
  ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
  ROTATING_ROOM_CROSSING_BET_DELAY_MS,
  formatIce2fWatchLabel,
  ice2fBetDelayMs,
  ice2fBetDelayUntilMs,
  ice2fPadFactorPlacementMs,
  createKto2fEngine,
};

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as { SinglestakeKto2f?: typeof api }).SinglestakeKto2f = api;
}

export default api;
