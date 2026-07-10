/**
 * Bundle entry — motor ICE cobertura (2 dúzias + 11 números) + Fibonacci.
 */
import {
  canPlaceIceDuziaBet,
  defaultIceDuziaMachineState,
  emptyIceDuziaStats,
  ICE_DOZEN_BASE_UNITS,
  ICE_DUZIA_BET_DELAY_MS,
  ICE_DUZIA_FIRST_BET_SETTLE_MS,
  ICE_DUZIA_FIBONACCI_UNITS,
  ICE_DUZIA_MAX_RECOVERY,
  ICE_ROULETTE_MESA_URL,
  ICE_ROULETTE_TABLE_ID,
  iceDuziaBetDelayMs,
  iceDuziaBetKey,
  iceDuziaClampRecovery,
  iceDuziaLabel,
  iceDuziaUnitsForRecovery,
  iceNumberBetKey,
  iceStakePlanForRecovery,
  parseIceDuziaStats,
  tickIceDuziaPlacar,
  type IceDuziaActive,
  type IceDuziaMachineState,
  type IceDuziaSessionStats,
} from "../src/lib/roulette/iceDuziaEvolutionStrategy";

export const ICE_TABLE_ID = ICE_ROULETTE_TABLE_ID;
export const ICE_MESA_URL = ICE_ROULETTE_MESA_URL;
export const ICE_MAX_GALES = ICE_DUZIA_MAX_RECOVERY;
export const ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_DUZIA_FIRST_BET_SETTLE_MS;
export const ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_DUZIA_BET_DELAY_MS;

const BASE_STAKE = 0.5;

export type CreateIceCruzamentoEngineOptions = {
  initialStats?: IceDuziaSessionStats | null;
  initialMachine?: {
    recovery?: number;
    units?: number;
    lastBetUnits?: number | null;
    lastSpinHead?: string | null;
  } | null;
};

export type IceEngineSpinResult = {
  active: IceDuziaActive | null;
  units: number;
  recovery: number;
  machine: IceDuziaMachineState;
  stats: IceDuziaSessionStats;
  flash: ReturnType<typeof tickIceDuziaPlacar>["flash"];
};

function recoveryFromLegacyUnits(units: number): number {
  const u = Math.max(1, Math.floor(units));
  if (u === 1) return 0;
  if (u === ICE_DOZEN_BASE_UNITS) return 0;
  const scale = Math.max(1, Math.round(u / ICE_DOZEN_BASE_UNITS));
  const idx = ICE_DUZIA_FIBONACCI_UNITS.indexOf(
    scale as (typeof ICE_DUZIA_FIBONACCI_UNITS)[number],
  );
  if (idx >= 0) return idx;
  for (let i = ICE_DUZIA_FIBONACCI_UNITS.length - 1; i >= 0; i--) {
    if (ICE_DUZIA_FIBONACCI_UNITS[i]! <= scale) return i;
  }
  return 0;
}

export function createIceCruzamentoEngine(options: CreateIceCruzamentoEngineOptions = {}) {
  let machine = defaultIceDuziaMachineState();
  if (options.initialMachine) {
    const recovery =
      typeof options.initialMachine.recovery === "number" &&
      Number.isFinite(options.initialMachine.recovery)
        ? iceDuziaClampRecovery(options.initialMachine.recovery)
        : typeof options.initialMachine.units === "number" &&
            Number.isFinite(options.initialMachine.units)
          ? recoveryFromLegacyUnits(options.initialMachine.units)
          : 0;
    machine = {
      ...machine,
      recovery,
      lastBetUnits:
        typeof options.initialMachine.lastBetUnits === "number" &&
        Number.isFinite(options.initialMachine.lastBetUnits)
          ? Math.max(1, Math.floor(options.initialMachine.lastBetUnits))
          : null,
      lastSpinHead:
        typeof options.initialMachine.lastSpinHead === "string"
          ? options.initialMachine.lastSpinHead
          : null,
    };
  }
  let stats =
    options.initialStats != null
      ? parseIceDuziaStats(options.initialStats)
      : emptyIceDuziaStats();
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

  function runTick(): IceEngineSpinResult {
    const tick = tickIceDuziaPlacar(history, machine, stats);
    machine = tick.machine;
    stats = tick.stats;
    return {
      active: tick.globalActive,
      units: tick.globalUnits,
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
    const plan = iceStakePlanForRecovery(machine.recovery);
    return {
      active: null,
      units: plan.dozenUnits,
      recovery: machine.recovery,
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
    return canPlaceIceDuziaBet(machine.cycle.recovery, lastLiveSpinAt, nowMs);
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
      lastBetUnits: machine.cycle.dozenUnits,
      cycle: { ...machine.cycle, phase: "awaiting_result" },
    };
  }

  function buildBridgePayload(mesaEmbedUrl: string | null = ICE_MESA_URL) {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
    if (!canPlaceBet()) return null;

    const { active, dozenUnits, numberUnits, recovery, unitScale } = machine.cycle;
    const d1Label = iceDuziaLabel(active.dozen1);
    const d2Label = iceDuziaLabel(active.dozen2);
    const signalId = `ice:cov:${active.dozen1}-${active.dozen2}:${active.triggerNumbers.join("-")}:${recovery}:${unitScale}`;
    const stakeAmount = BASE_STAKE * dozenUnits;

    const betDelayUntilMs =
      lastLiveSpinAt != null ? lastLiveSpinAt + iceDuziaBetDelayMs(recovery) : null;

    const fibSuffix =
      recovery > 0
        ? ` · fib ×${unitScale} (${dozenUnits} un./dz)`
        : ` · ${dozenUnits} un./dz`;

    type BridgeAction = {
      kind: "click";
      target: string;
      label: string;
      reason: string;
      betKey: string;
      units: number;
    };

    const actions: BridgeAction[] = [
      {
        kind: "click",
        target: "dozen-1",
        label: d1Label,
        reason: `ICE cobertura · ${d1Label}${fibSuffix}`,
        betKey: iceDuziaBetKey(active.dozen1),
        units: dozenUnits,
      },
      {
        kind: "click",
        target: "dozen-2",
        label: d2Label,
        reason: `ICE cobertura · ${d2Label}${fibSuffix}`,
        betKey: iceDuziaBetKey(active.dozen2),
        units: dozenUnits,
      },
    ];

    for (const n of active.coveredNumbers) {
      actions.push({
        kind: "click",
        target: `num-${n}`,
        label: String(n),
        reason: `ICE cobertura · nº ${n}${fibSuffix}`,
        betKey: iceNumberBetKey(n),
        units: numberUnits,
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
        currentTableId: ICE_TABLE_ID,
        mesaEmbedUrl: mesaEmbedUrl ?? ICE_MESA_URL,
        mesaProvider: "outro" as const,
        factor1Label: `${d1Label} · ${d2Label}`,
        factor2Label: `+${active.coveredNumbers.length} núms`,
        factor1BetKey: iceDuziaBetKey(active.dozen1),
        factor2BetKey: iceDuziaBetKey(active.dozen2),
        singleFactorMode: false,
        signalId,
        stakeAmount,
        units: dozenUnits,
        unitScale,
        numberUnits,
        coveredNumbers: [...active.coveredNumbers],
        excludedNumbers: [...active.excludedNumbers],
        currentRecovery: recovery,
        baseStake: BASE_STAKE,
        maxRecovery: ICE_DUZIA_MAX_RECOVERY,
        executionMode: null,
        strategy: "iceDuzia" as const,
        rotativaTrigger: "crossing" as const,
        fastMultiTarget: true,
        betDelayUntilMs,
        mesaCatalog: [],
      },
    };
  }

  return {
    tableId: ICE_TABLE_ID,
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
      maxRecovery: ICE_DUZIA_MAX_RECOVERY,
    }),
    resetStats() {
      stats = emptyIceDuziaStats();
    },
    reset() {
      machine = defaultIceDuziaMachineState();
      stats = emptyIceDuziaStats();
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
    SinglestakeIceCruzamento?: {
      ICE_TABLE_ID: number;
      ICE_MESA_URL: string;
      ICE_MAX_GALES: number;
      createIceCruzamentoEngine: typeof createIceCruzamentoEngine;
    };
  }
}

const api = {
  ICE_TABLE_ID,
  ICE_MESA_URL,
  ICE_MAX_GALES,
  ICE_DUZIA_FIBONACCI_UNITS,
  iceDuziaUnitsForRecovery,
  createIceCruzamentoEngine,
};

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { SinglestakeIceCruzamento: typeof api }).SinglestakeIceCruzamento =
    api;
}

export default api;
