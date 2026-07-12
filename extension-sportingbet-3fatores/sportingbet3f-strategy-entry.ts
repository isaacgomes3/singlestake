/**
 * Bundle entry — motor Sportingbet 3 Fatores para extensão Chrome.
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
    ICE_3F_ROULETTE_TABLE_ID,
  ICE_3F_MAX_GALES,
  ICE_3F_WINS_PER_ENTRY_BUMP,
  ICE_3F_MAX_ENTRY_UNITS,
  ice3fDoubleClicks,
  ice3fEntryUnitsOf,
  ice3fNormalizeEntryUnits,
  ice3fPadFactorPlacementMs,
  ice3fStakeModeOf,
  ice3fUnitScaleForCycle,
  parseIce3fStats,
  primeIce3fWatchFromHistory,
  tickIce3fPlacar,
  tryArmCycleFromWatch,
  type Ice3fActive,
  type Ice3fMachineState,
  type Ice3fStakeMode,
} from "../src/lib/roulette/iceTresFatoresStrategy";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";

export const SPORTINGBET3F_TABLE_ID = ICE_3F_ROULETTE_TABLE_ID;
/** Sportingbet sem URL directa. */
export const SPORTINGBET3F_MESA_URL = "";
export const ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_3F_FIRST_BET_SETTLE_MS;
export const ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_3F_RECOVERY_BET_DELAY_MS;

const BASE_STAKE = 0.5;

export type CreateSportingbet3fEngineOptions = {
  initialStats?: RotatingRoomSessionStats | null;
  initialMachine?: {
    lastSpinHead?: string | null;
    entryUnits?: number;
    stakeMode?: Ice3fStakeMode;
    winsTowardEntryBump?: number;
  } | null;
};

export type Sportingbet3fEngineSpinResult = {
  active: Ice3fActive | null;
  unitScale: number;
  recovery: number;
  entryUnits: number;
  stakeMode: Ice3fStakeMode;
  winsTowardEntryBump: number;
  machine: Ice3fMachineState;
  stats: RotatingRoomSessionStats;
  flash: ReturnType<typeof tickIce3fPlacar>["flash"];
};

export function createSportingbet3fEngine(options: CreateSportingbet3fEngineOptions = {}) {
  let machine = defaultIce3fMachineState();
  if (options.initialMachine) {
    const im = options.initialMachine;
    machine = {
      ...machine,
      lastSpinHead: im.lastSpinHead ?? null,
      entryUnits: ice3fNormalizeEntryUnits(im.entryUnits ?? 1),
      stakeMode: im.stakeMode === "manual" ? "manual" : "auto",
      winsTowardEntryBump: Math.max(0, Math.floor(im.winsTowardEntryBump ?? 0)),
    };
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

  function toEngineResult(tick: ReturnType<typeof tickIce3fPlacar>): Sportingbet3fEngineSpinResult {
    const unitScale = tick.globalUnitScale;
    return {
      active: tick.globalActive,
      unitScale,
      recovery: unitScale,
      entryUnits: ice3fEntryUnitsOf(tick.machine),
      stakeMode: ice3fStakeModeOf(tick.machine),
      winsTowardEntryBump: Math.max(0, Math.floor(tick.machine.winsTowardEntryBump ?? 0)),
      machine: tick.machine,
      stats: tick.stats,
      flash: tick.flash,
    };
  }

  function anchorSpinClock() {
    lastLiveSpinAt = Date.now();
  }

  function runTick(): Sportingbet3fEngineSpinResult {
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
    const stakeMode = ice3fStakeModeOf(machine);
    const entryUnits = ice3fEntryUnitsOf(machine);
    const winsTowardEntryBump = Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0));
    machine = {
      ...defaultIce3fMachineState(),
      watch,
      lastSpinHead: head,
      stakeMode,
      entryUnits,
      winsTowardEntryBump,
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

  function buildBridgePayload(mesaEmbedUrl: string | null = SPORTINGBET3F_MESA_URL) {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
    if (!canPlaceBet()) return null;

    const { active } = machine.cycle;
    const unitScale = ice3fUnitScaleForCycle(machine.cycle);
    const doubles = ice3fDoubleClicks(unitScale);
    const [f1, f2, f3] = active.factors;
    const signalId = `sportingbet3f:pos${active.criticalPosition}:ref${active.referenceNumber}:s${unitScale}:h${machine.cycle.armedHead}`;
    const f1Key = pragmaticExteriorBetKeyFromFactor(f1);
    const f2Key = pragmaticExteriorBetKeyFromFactor(f2);
    const f3Key = pragmaticExteriorBetKeyFromFactor(f3);
    const f1Label = doisFatoresFactorLabel(f1);
    const f2Label = doisFatoresFactorLabel(f2);
    const f3Label = doisFatoresFactorLabel(f3);
    const stakeAmount = BASE_STAKE * 3 * unitScale;
    const betDelayUntilMs =
      lastLiveSpinAt != null ? lastLiveSpinAt + ICE_3F_BET_DELAY_MS : null;

    const scaleSuffix =
      unitScale > 1
        ? ` · ${unitScale}×${doubles > 0 ? ` · dobrar ×${doubles}` : ""}`
        : " · entrada 3u";

    const actions: Array<{
      kind: "click";
      target: "factor-1" | "factor-2" | "factor-3" | "repeat-bet";
      label: string;
      reason: string;
    }> = [
      {
        kind: "click",
        target: "factor-1",
        label: f1Label,
        reason: `ICE 3F · ${f1Label}${scaleSuffix}`,
      },
      {
        kind: "click",
        target: "factor-2",
        label: f2Label,
        reason: `ICE 3F · ${f2Label}${scaleSuffix}`,
      },
      {
        kind: "click",
        target: "factor-3",
        label: f3Label,
        reason: `ICE 3F · ${f3Label}${scaleSuffix}`,
      },
    ];
    for (let i = 0; i < doubles; i++) {
      actions.push({
        kind: "click",
        target: "repeat-bet",
        label: "Dobrar",
        reason: `ICE 3F · Dobrar ${i + 1}/${doubles}${scaleSuffix}`,
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
        currentTableId: SPORTINGBET3F_TABLE_ID,
        mesaEmbedUrl: (typeof mesaEmbedUrl === "string" && mesaEmbedUrl.trim() ? mesaEmbedUrl.trim() : SPORTINGBET3F_MESA_URL),
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
        chipClicks: 1,
        useDoubleGale: true,
        doubleClicks: doubles,
        currentRecovery: Math.max(0, Math.round(Math.log2(Math.max(1, unitScale)))),
        baseStake: BASE_STAKE,
        maxRecovery: 5,
        executionMode: null,
        strategy: "tres3fatores" as const,
        rotativaTrigger: "echo-left" as const,
        betDelayUntilMs,
        mesaCatalog: [],
      },
    };
  }

  return {
    tableId: SPORTINGBET3F_TABLE_ID,
    ingestHistorySnapshot,
    ingestSpin,
    runTick,
    buildBridgePayload,
    canPlaceBet,
    beginBetCommit,
    abortBetCommit,
    markBetPlaced,
    getState: () => ({ machine, stats, history, lastLiveSpinAt }),
    getStakeConfig: () => ({
      entryUnits: ice3fEntryUnitsOf(machine),
      stakeMode: ice3fStakeModeOf(machine),
      winsTowardEntryBump: Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0)),
      winsPerBump: ICE_3F_WINS_PER_ENTRY_BUMP,
      maxEntryUnits: ICE_3F_MAX_ENTRY_UNITS,
    }),
    setStakeConfig(patch: {
      entryUnits?: number;
      stakeMode?: Ice3fStakeMode;
      winsTowardEntryBump?: number;
    }) {
      machine = {
        ...machine,
        ...(patch.stakeMode != null
          ? { stakeMode: patch.stakeMode === "manual" ? "manual" : "auto" }
          : {}),
        ...(patch.entryUnits != null
          ? { entryUnits: ice3fNormalizeEntryUnits(patch.entryUnits) }
          : {}),
        ...(patch.winsTowardEntryBump != null
          ? {
              winsTowardEntryBump: Math.max(
                0,
                Math.floor(patch.winsTowardEntryBump),
              ),
            }
          : {}),
      };
      return {
        entryUnits: ice3fEntryUnitsOf(machine),
        stakeMode: ice3fStakeModeOf(machine),
        winsTowardEntryBump: Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0)),
      };
    },
    resetStats() {
      stats = emptyIce3fStats();
    },
    reset() {
      const stakeMode = ice3fStakeModeOf(machine);
      const entryUnits =
        stakeMode === "manual" ? ice3fEntryUnitsOf(machine) : 1;
      machine = {
        ...defaultIce3fMachineState(),
        stakeMode,
        entryUnits,
        winsTowardEntryBump: 0,
      };
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
    SinglestakeSportingbet3f?: {
      SPORTINGBET3F_TABLE_ID: number;
      SPORTINGBET3F_MESA_URL: string;
      createSportingbet3fEngine: typeof createSportingbet3fEngine;
    };
  }
}

const api = {
  SPORTINGBET3F_TABLE_ID,
  SPORTINGBET3F_MESA_URL,
  ICE_3F_REQUIRED_TOTAL_DEFEATS,
  ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL,
  ICE_3F_BET_DELAY_MS,
  ICE_3F_GALE3_REFERENCE_UNITS,
  ICE_3F_CHIP_CLICK_STAGGER_MS,
  ICE_3F_CRITICAL_POSITIONS,
  ICE_3F_MIN_HISTORY,
  ICE_3F_MAX_GALES,
  ICE_3F_WINS_PER_ENTRY_BUMP,
  ICE_3F_MAX_ENTRY_UNITS,
  ice3fPadFactorPlacementMs,
  ice3fDoubleClicks,
  ice3fNormalizeEntryUnits,
  createSportingbet3fEngine,
};

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as Window).SinglestakeSportingbet3f = api;
}

export default api;
