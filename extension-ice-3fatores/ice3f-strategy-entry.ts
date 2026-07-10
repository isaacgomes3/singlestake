/**
 * Bundle entry — motor ICE 3 Fatores para extensão Chrome.
 */
import { doisFatoresFactorLabel } from "../src/lib/roulette/doisFatoresStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "../src/lib/roulette/pragmaticExteriorBetMap";
import {
  canPlaceIce3fBet,
  defaultIce3fMachineState,
  emptyIce3fStats,
  ICE_3F_BET_DELAY_MS,
  ICE_3F_CHIP_CLICK_STAGGER_MS,
  ICE_3F_CRITICAL_POSITIONS,
  ICE_3F_FIRST_BET_SETTLE_MS,
  ICE_3F_GALE3_REFERENCE_UNITS,
  ICE_3F_MIN_HISTORY,
  ICE_3F_RECOVERY_BET_DELAY_MS,
  ICE_3F_REQUIRED_TOTAL_DEFEATS,
  ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL,
  ICE_3F_ROULETTE_MESA_URL,
  ICE_3F_ROULETTE_TABLE_ID,
  ice3fPadFactorPlacementMs,
  ice3fUnitScaleForCycle,
  parseIce3fStats,
  primeIce3fWatchFromHistory,
  tickIce3fPlacar,
  tryArmCycleFromWatch,
  type Ice3fActive,
  type Ice3fMachineState,
} from "../src/lib/roulette/iceTresFatoresStrategy";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";

export const ICE3F_TABLE_ID = ICE_3F_ROULETTE_TABLE_ID;
export const ICE3F_MESA_URL = ICE_3F_ROULETTE_MESA_URL;
export const ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_3F_FIRST_BET_SETTLE_MS;
export const ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_3F_RECOVERY_BET_DELAY_MS;

const BASE_STAKE = 0.5;

export type CreateIce3fEngineOptions = {
  initialStats?: RotatingRoomSessionStats | null;
  initialMachine?: { lastSpinHead?: string | null } | null;
};

export type Ice3fEngineSpinResult = {
  active: Ice3fActive | null;
  unitScale: number;
  recovery: number;
  machine: Ice3fMachineState;
  stats: RotatingRoomSessionStats;
  flash: ReturnType<typeof tickIce3fPlacar>["flash"];
};

export function createIce3fEngine(options: CreateIce3fEngineOptions = {}) {
  let machine = defaultIce3fMachineState();
  if (options.initialMachine?.lastSpinHead) {
    machine = { ...machine, lastSpinHead: options.initialMachine.lastSpinHead };
  }
  let stats =
    options.initialStats != null ? parseIce3fStats(options.initialStats) : emptyIce3fStats();
  let history: number[] = [];
  let lastGameId: string | null = null;
  let spinBaselined = false;
  let liveSpinSeen = false;
  let lastLiveSpinAt: number | null = null;

  function spinHead(): string {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }

  function toEngineResult(tick: ReturnType<typeof tickIce3fPlacar>): Ice3fEngineSpinResult {
    const unitScale = tick.globalUnitScale;
    return {
      active: tick.globalActive,
      unitScale,
      recovery: unitScale,
      machine: tick.machine,
      stats: tick.stats,
      flash: tick.flash,
    };
  }

  function anchorSpinClock() {
    lastLiveSpinAt = Date.now();
  }

  function runTick(): Ice3fEngineSpinResult {
    const tick = tickIce3fPlacar(history, machine, stats);
    machine = tick.machine;
    stats = tick.stats;
    return toEngineResult(tick);
  }

  function ingestHistorySnapshot(spins: { number: number; gameId: string }[]) {
    if (liveSpinSeen) return null;
    history = spins.map((s) => s.number);
    if (spins[0]) {
      lastGameId = spins[0].gameId;
      spinBaselined = true;
    }
    const head = spinHead();
    const watch = primeIce3fWatchFromHistory(history);
    machine = {
      ...defaultIce3fMachineState(),
      watch,
      lastSpinHead: head,
    };
    if (history.length >= ICE_3F_MIN_HISTORY) {
      machine = tryArmCycleFromWatch(machine, history, head);
    }
    lastLiveSpinAt = Date.now();
    const tick = tickIce3fPlacar(history, machine, stats);
    machine = tick.machine;
    return toEngineResult(tick);
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
    const scale = ice3fUnitScaleForCycle(machine.cycle);
    return canPlaceIce3fBet(scale, lastLiveSpinAt, nowMs);
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

  function buildBridgePayload(mesaEmbedUrl: string | null = ICE3F_MESA_URL) {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
    if (!canPlaceBet()) return null;

    const { active } = machine.cycle;
    const unitScale = ice3fUnitScaleForCycle(machine.cycle);
    const [f1, f2, f3] = active.factors;
    const signalId = `ice3f:pos${active.criticalPosition}:ref${active.referenceNumber}:s${unitScale}`;
    const f1Key = pragmaticExteriorBetKeyFromFactor(f1);
    const f2Key = pragmaticExteriorBetKeyFromFactor(f2);
    const f3Key = pragmaticExteriorBetKeyFromFactor(f3);
    const f1Label = doisFatoresFactorLabel(f1);
    const f2Label = doisFatoresFactorLabel(f2);
    const f3Label = doisFatoresFactorLabel(f3);
    const stakeAmount = BASE_STAKE * unitScale;
    const betDelayUntilMs =
      lastLiveSpinAt != null ? lastLiveSpinAt + ICE_3F_BET_DELAY_MS : null;

    const scaleSuffix = unitScale > 1 ? ` · ${unitScale}×` : " · entrada";

    return {
      type: "game-odds-glow/rotating-room-extension" as const,
      version: 1 as const,
      fingerprint: signalId,
      actions: [
        {
          kind: "click" as const,
          target: "factor-1" as const,
          label: f1Label,
          reason: `ICE 3F · ${f1Label}${scaleSuffix}`,
        },
        {
          kind: "click" as const,
          target: "factor-2" as const,
          label: f2Label,
          reason: `ICE 3F · ${f2Label}${scaleSuffix}`,
        },
        {
          kind: "click" as const,
          target: "factor-3" as const,
          label: f3Label,
          reason: `ICE 3F · ${f3Label}${scaleSuffix}`,
        },
      ],
      context: {
        sessionMode: "active" as const,
        prepareTableId: null,
        currentTableId: ICE3F_TABLE_ID,
        mesaEmbedUrl: mesaEmbedUrl ?? ICE3F_MESA_URL,
        mesaProvider: "outro" as const,
        factor1Label: f1Label,
        factor2Label: f2Label,
        factor3Label: f3Label,
        factor1BetKey: f1Key,
        factor2BetKey: f2Key,
        factor3BetKey: f3Key,
        singleFactorMode: false,
        threeFactorMode: true,
        signalId,
        stakeAmount,
        units: unitScale,
        currentRecovery: 0,
        baseStake: BASE_STAKE,
        maxRecovery: 0,
        executionMode: null,
        strategy: "tres3fatores" as const,
        rotativaTrigger: "critical" as const,
        betDelayUntilMs,
        mesaCatalog: [],
      },
    };
  }

  return {
    tableId: ICE3F_TABLE_ID,
    ingestHistorySnapshot,
    ingestSpin,
    runTick,
    buildBridgePayload,
    canPlaceBet,
    beginBetCommit,
    abortBetCommit,
    markBetPlaced,
    getState: () => ({ machine, stats, history, lastLiveSpinAt }),
    resetStats() {
      stats = emptyIce3fStats();
    },
    reset() {
      machine = defaultIce3fMachineState();
      stats = emptyIce3fStats();
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
    SinglestakeIce3f?: {
      ICE3F_TABLE_ID: number;
      ICE3F_MESA_URL: string;
      createIce3fEngine: typeof createIce3fEngine;
    };
  }
}

const api = {
  ICE3F_TABLE_ID,
  ICE3F_MESA_URL,
  ICE_3F_REQUIRED_TOTAL_DEFEATS,
  ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL,
  ICE_3F_BET_DELAY_MS,
  ICE_3F_GALE3_REFERENCE_UNITS,
  ICE_3F_CHIP_CLICK_STAGGER_MS,
  ICE_3F_CRITICAL_POSITIONS,
  ICE_3F_MIN_HISTORY,
  ice3fPadFactorPlacementMs,
  createIce3fEngine,
};

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as Window).SinglestakeIce3f = api;
}

export default api;
