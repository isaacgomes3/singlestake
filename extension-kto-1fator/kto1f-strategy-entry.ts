/**
 * Bundle entry — motor KTO 1 Fator (score 1×13 → alerta pos 12).
 */
import { doisFatoresFactorLabel } from "../src/lib/roulette/doisFatoresStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "../src/lib/roulette/pragmaticExteriorBetMap";
import {
  canPlaceKto1fBet,
  defaultKto1fMachineState,
  emptyKto1fStats,
  formatKto1fWatchLabel,
  kto1fWatchLabelForMachine,
  KTO_1F_BET_DELAY_MS,
  KTO_1F_FIRST_BET_SETTLE_MS,
  KTO_1F_IMMEDIATE_REBET_DELAY_MS,
  KTO_1F_MAX_RECOVERY,
  KTO_1F_MESA_URL,
  KTO_1F_MIN_HISTORY,
  KTO_1F_RECOVERY_BET_DELAY_MS,
  KTO_1F_TABLE_ID,
  kto1fBetDelayMs,
  kto1fBetDelayUntilMs,
  kto1fDoubleClicks,
  kto1fPadFactorPlacementMs,
  kto1fPrimeScoreboardFromHistory,
  kto1fStakeUnits,
  parseKto1fStats,
  tickKto1fPlacar,
  tryArmKto1fCycle,
  kto1fBestKind,
  kto1fKindLabel,
  type Kto1fActive,
  type Kto1fCyclePhase,
  type Kto1fFactorKind,
  type Kto1fMachineState,
} from "../src/lib/roulette/kto1fScoreStrategy";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";

export const KTO1F_TABLE_ID = KTO_1F_TABLE_ID;
export const KTO1F_MESA_URL = KTO_1F_MESA_URL;
export const KTO1F_MAX_GALES = KTO_1F_MAX_RECOVERY;
export const ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = KTO_1F_FIRST_BET_SETTLE_MS;
export const ROTATING_ROOM_CROSSING_BET_DELAY_MS = KTO_1F_RECOVERY_BET_DELAY_MS;

const BASE_STAKE = 0.5;

export type Kto1fPersistedMachine = {
  lastSpinHead?: string | null;
  recovery?: number;
  phase?: Kto1fCyclePhase | null;
  alertKind?: Kto1fFactorKind | null;
  pendingRecovery?: number;
  totalRounds?: number;
};

export type CreateKto1fEngineOptions = {
  maxRecovery?: number;
  initialStats?: RotatingRoomSessionStats | null;
  initialMachine?: Kto1fPersistedMachine | null;
};

function clampMaxRecovery(value: unknown, fallback = KTO_1F_MAX_RECOVERY): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
  return Math.min(KTO_1F_MAX_RECOVERY, Math.max(0, Math.floor(n)));
}

function pendingRecoveryFromSaved(saved: Kto1fPersistedMachine): number {
  const stored =
    typeof saved.pendingRecovery === "number" && Number.isFinite(saved.pendingRecovery)
      ? Math.max(0, Math.floor(saved.pendingRecovery))
      : 0;
  if (stored > 0) return stored;
  const recovery =
    typeof saved.recovery === "number" && Number.isFinite(saved.recovery)
      ? Math.max(0, Math.floor(saved.recovery))
      : 0;
  if (saved.phase === "awaiting_bet" || saved.phase === "awaiting_result") {
    return recovery;
  }
  return 0;
}

export type Kto1fEngineSpinResult = {
  active: Kto1fActive | null;
  recovery: number;
  machine: Kto1fMachineState;
  stats: RotatingRoomSessionStats;
  flash: ReturnType<typeof tickKto1fPlacar>["flash"];
  missedBetWindow?: boolean;
};

export function createKto1fEngine(options: CreateKto1fEngineOptions = {}) {
  const maxRecovery = clampMaxRecovery(options.maxRecovery);
  let machine = defaultKto1fMachineState();
  if (options.initialMachine) {
    const saved = options.initialMachine;
    machine = {
      ...machine,
      lastSpinHead: saved.lastSpinHead ?? null,
      pendingRecovery: pendingRecoveryFromSaved(saved),
      totalRounds:
        typeof saved.totalRounds === "number" && Number.isFinite(saved.totalRounds)
          ? Math.max(0, Math.floor(saved.totalRounds))
          : 0,
    };
  }
  let pendingRestore: Kto1fPersistedMachine | null = options.initialMachine ?? null;
  let stats =
    options.initialStats != null
      ? parseKto1fStats(options.initialStats, maxRecovery)
      : emptyKto1fStats(maxRecovery);
  let history: number[] = [];
  let lastGameId: string | null = null;
  let spinBaselined = false;
  let liveSpinSeen = false;
  let lastLiveSpinAt: number | null = null;

  function spinHead(): string {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }

  function runTick(): Kto1fEngineSpinResult {
    const tick = tickKto1fPlacar(history, machine, stats, maxRecovery);
    machine = tick.machine;
    stats = tick.stats;
    return {
      active: tick.globalActive,
      recovery: tick.globalRecovery,
      machine: tick.machine,
      stats: tick.stats,
      flash: tick.flash,
      missedBetWindow: tick.missedBetWindow === true,
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
    const scoreboard = kto1fPrimeScoreboardFromHistory(history);
    const preservedCycle = machine.cycle;
    machine = {
      ...defaultKto1fMachineState(),
      scoreboard,
      lastSpinHead: head,
      totalRounds: machine.totalRounds,
    };

    if (preservedCycle?.phase === "awaiting_result") {
      machine = {
        ...machine,
        pendingRecovery: 0,
        cycle: {
          ...preservedCycle,
          phase: "awaiting_result",
          armedHead: head,
        },
      };
    } else if (pendingRestore) {
      const pendingRecovery = pendingRecoveryFromSaved(pendingRestore);
      const totalRounds =
        typeof pendingRestore.totalRounds === "number" &&
        Number.isFinite(pendingRestore.totalRounds)
          ? Math.max(0, Math.floor(pendingRestore.totalRounds))
          : 0;
      pendingRestore = null;
      machine = {
        ...machine,
        pendingRecovery,
        totalRounds,
      };
      if (history.length >= KTO_1F_MIN_HISTORY) {
        machine = tryArmKto1fCycle(machine, history, head);
      }
    } else if (history.length >= KTO_1F_MIN_HISTORY) {
      machine = tryArmKto1fCycle(machine, history, head);
    }

    lastLiveSpinAt = Date.now();
    const tick = tickKto1fPlacar(history, machine, stats, maxRecovery);
    machine = tick.machine;
    return {
      active: tick.globalActive,
      recovery: tick.globalRecovery,
      machine: tick.machine,
      stats: tick.stats,
      flash: tick.flash,
      missedBetWindow: tick.missedBetWindow === true,
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
    if (history.length > 80) history.length = 80;
    return runTick();
  }

  function canPlaceBet(nowMs = Date.now()): boolean {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
    return canPlaceKto1fBet(
      machine.cycle.recovery,
      lastLiveSpinAt,
      nowMs,
      machine.cycle.immediateBet === true,
    );
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
      cycle: { ...machine.cycle, phase: "awaiting_result", immediateBet: false },
    };
  }

  function buildBridgePayload(mesaEmbedUrl: string | null = KTO1F_MESA_URL) {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
    if (!canPlaceBet()) return null;

    const { active, recovery } = machine.cycle;
    const units = kto1fStakeUnits(recovery);
    const doubles = kto1fDoubleClicks(recovery);
    const signalId = `kto1f:${active.alertKind}:base${active.baseNumber}:r${recovery}`;
    const f1Key = pragmaticExteriorBetKeyFromFactor(active.alertFactor);
    const f1Label = doisFatoresFactorLabel(active.alertFactor);
    const stakeAmount = BASE_STAKE * units;
    const betDelayUntilMs = kto1fBetDelayUntilMs(
      recovery,
      lastLiveSpinAt,
      machine.cycle.immediateBet === true,
    );
    const galeSuffix = recovery > 0 ? ` · gale ${recovery}` : " · entrada";

    const actions: Array<{
      kind: "click";
      target: "factor-1" | "repeat-bet";
      label: string;
      reason: string;
    }> = [
      {
        kind: "click",
        target: "factor-1",
        label: f1Label,
        reason: `KTO 1F · ${f1Label}${galeSuffix}`,
      },
    ];
    for (let i = 0; i < doubles; i++) {
      actions.push({
        kind: "click",
        target: "repeat-bet",
        label: "Dobrar",
        reason: `KTO 1F · Dobrar ${i + 1}/${doubles}${galeSuffix}`,
      });
    }

    return {
      type: "game-odds-glow/rotating-room-extension" as const,
      version: 1 as const,
      fingerprint: signalId,
      actions,
      context: {
        sessionMode: "active" as const,
        prepareTableId: null,
        currentTableId: KTO1F_TABLE_ID,
        mesaEmbedUrl: mesaEmbedUrl ?? KTO1F_MESA_URL,
        mesaProvider: "outro" as const,
        factor1Label: f1Label,
        factor2Label: null,
        factor1BetKey: f1Key,
        factor2BetKey: null,
        singleFactorMode: true,
        signalId,
        stakeAmount,
        units,
        chipClicks: 1,
        useDoubleGale: true,
        doubleClicks: doubles,
        currentRecovery: recovery,
        baseStake: BASE_STAKE,
        maxRecovery,
        executionMode: null,
        strategy: "kto1fator" as const,
        rotativaTrigger: "umFator" as const,
        betDelayUntilMs,
        mesaCatalog: [],
      },
    };
  }

  return {
    tableId: KTO1F_TABLE_ID,
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
      stats = emptyKto1fStats(maxRecovery);
    },
    reset() {
      machine = defaultKto1fMachineState();
      stats = emptyKto1fStats(maxRecovery);
      history = [];
      lastGameId = null;
      spinBaselined = false;
      liveSpinSeen = false;
      lastLiveSpinAt = null;
      pendingRestore = null;
    },
  };
}

const api = {
  KTO1F_TABLE_ID,
  KTO1F_MESA_URL,
  KTO1F_MAX_GALES,
  KTO_1F_BET_DELAY_MS,
  KTO_1F_FIRST_BET_SETTLE_MS,
  KTO_1F_IMMEDIATE_REBET_DELAY_MS,
  KTO_1F_MAX_RECOVERY,
  KTO_1F_RECOVERY_BET_DELAY_MS,
  ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
  ROTATING_ROOM_CROSSING_BET_DELAY_MS,
  formatKto1fWatchLabel,
  kto1fWatchLabelForMachine,
  kto1fBetDelayMs,
  kto1fBetDelayUntilMs,
  kto1fPadFactorPlacementMs,
  kto1fDoubleClicks,
  kto1fStakeUnits,
  createKto1fEngine,
  kto1fBestKind,
  kto1fKindLabel,
};

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as { SinglestakeKto1f?: typeof api }).SinglestakeKto1f = api;
}

export default api;
