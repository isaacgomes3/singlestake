/**
 * Bundle entry — motor Bet Nacional Cruzamento 2F para extensão Chrome.
 */
import { doisFatoresFactorLabel } from "../src/lib/roulette/doisFatoresStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "../src/lib/roulette/pragmaticExteriorBetMap";
import {
  buildIce2fStreakChartMetrics,
  canPlaceIce2fBet,
  configureIce2fDefaultComparePairs,
  applyIce2fEnabledPairIds,
  ICE_2F_DEFAULT_ENABLED_PAIR_IDS,
  ICE_2F_KNOWN_COMPARE_PAIRS,
  ice2fPairLabel,
  configureIce2fComparePairs,
  defaultIce2fMachineState,
  emptyIce2fStats,
  formatIce2fWatchLabel,
  getIce2fComparePairs,
  ice2fWatchLabelForMachine,
  ICE_2F_BET_DELAY_MS,
  ICE_2F_FIRST_BET_SETTLE_MS,
  ICE_2F_IMMEDIATE_REBET_DELAY_MS,
  ICE_2F_MAX_RECOVERY,
  ICE_2F_MIN_HISTORY,
  getIce2fSoftMinHistory,
  ICE_2F_RECOVERY_BET_DELAY_MS,
  ICE_2F_ROULETTE_MESA_URL,
  ICE_2F_ROULETTE_TABLE_ID,
  ice2fBetDelayMs,
  ice2fBetDelayUntilMs,
  ice2fDoubleClicks,
  ice2fEffectiveZeroShift,
  ice2fPadFactorPlacementMs,
  ice2fStakeUnits,
  parseIce2fStats,
  primeIce2fWatchFromHistory,
  tickIce2fPlacar,
  tryArmCycleFromWatch,
  type Ice2fActive,
  type Ice2fCrossingAxis,
  type Ice2fCyclePhase,
  type Ice2fMachineState,
} from "../src/lib/roulette/iceCruzamento2fStrategy";
import type { RotatingRoomSessionStats } from "../src/lib/roulette/rotatingRoomStrategy";

configureIce2fDefaultComparePairs();

export const BN2F_TABLE_ID = 225;
export const BN2F_MESA_URL =
  "https://betnacional.bet.br/casino/game/225a54";
export const BN2F_MAX_GALES = ICE_2F_MAX_RECOVERY;
export const ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_2F_FIRST_BET_SETTLE_MS;
export const ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;

const BASE_STAKE = 0.5;

const BN2F_POSITIONS = new Set(
  ICE_2F_KNOWN_COMPARE_PAIRS.flatMap((p) => [...p.positions]),
);
const BN2F_AXES = new Set(["cor-altura", "altura-paridade", "cor-paridade"]);
const BN2F_PAIR_IDS = new Set(ICE_2F_KNOWN_COMPARE_PAIRS.map((p) => p.id));

export type Bn2fPersistedMachine = {
  lastSpinHead?: string | null;
  recovery?: number;
  phase?: Ice2fCyclePhase | null;
  criticalPosition?: number | null;
  axis?: Ice2fCrossingAxis | null;
  relaxedEntry?: boolean;
  nextEntryAxis?: Ice2fCrossingAxis | null;
  lockedPosition?: number | null;
  pendingRecovery?: number;
  gatePairId?: string | null;
  watch?: Record<string, { failures?: number }> | null;
};

function parsePersistedWatch(
  raw: Bn2fPersistedMachine["watch"],
): Ice2fMachineState["watch"] | null {
  if (!raw || typeof raw !== "object") return null;
  const base = defaultIce2fMachineState().watch;
  for (const id of BN2F_PAIR_IDS) {
    const slot = raw[id];
    if (slot && typeof slot.failures === "number" && Number.isFinite(slot.failures)) {
      base[id] = { failures: Math.max(0, Math.floor(slot.failures)) };
    }
  }
  return base;
}

export type CreateBn2fEngineOptions = {
  maxRecovery?: number;
  initialStats?: RotatingRoomSessionStats | null;
  initialMachine?: Bn2fPersistedMachine | null;
};

function clampMaxRecovery(value: unknown, fallback = ICE_2F_MAX_RECOVERY): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
  return Math.min(ICE_2F_MAX_RECOVERY, Math.max(0, Math.floor(n)));
}

/** Só recupera gale pendente — nunca inventa Vermelho+Baixo nem reabre ciclo stale. */
function pendingRecoveryFromSaved(saved: Bn2fPersistedMachine): number {
  const stored =
    typeof saved.pendingRecovery === "number" && Number.isFinite(saved.pendingRecovery)
      ? Math.max(0, Math.floor(saved.pendingRecovery))
      : 0;
  if (stored > 0) return stored;
  const recovery =
    typeof saved.recovery === "number" && Number.isFinite(saved.recovery)
      ? Math.max(0, Math.floor(saved.recovery))
      : 0;
  if (
    saved.phase === "awaiting_bet" ||
    saved.phase === "awaiting_result" ||
    saved.phase === "awaiting_reference"
  ) {
    return recovery;
  }
  return 0;
}

export type Bn2fEngineSpinResult = {
  active: Ice2fActive | null;
  recovery: number;
  machine: Ice2fMachineState;
  stats: RotatingRoomSessionStats;
  flash: ReturnType<typeof tickIce2fPlacar>["flash"];
  missedBetWindow?: boolean;
};

export function createBn2fEngine(options: CreateBn2fEngineOptions = {}) {
  const maxRecovery = clampMaxRecovery(options.maxRecovery);
  let machine = defaultIce2fMachineState();
  if (options.initialMachine) {
    const saved = options.initialMachine;
    const restoredWatch = parsePersistedWatch(saved.watch);
    machine = {
      ...machine,
      lastSpinHead: saved.lastSpinHead ?? null,
      nextEntryAxis:
        saved.nextEntryAxis && BN2F_AXES.has(saved.nextEntryAxis)
          ? saved.nextEntryAxis
          : "cor-altura",
      lockedPosition:
        typeof saved.lockedPosition === "number" &&
        BN2F_POSITIONS.has(saved.lockedPosition)
          ? saved.lockedPosition
          : null,
      pendingRecovery:
        typeof saved.pendingRecovery === "number" && Number.isFinite(saved.pendingRecovery)
          ? Math.max(0, Math.floor(saved.pendingRecovery))
          : 0,
      gatePairId:
        typeof saved.gatePairId === "string" && BN2F_PAIR_IDS.has(saved.gatePairId)
          ? saved.gatePairId
          : machine.gatePairId,
      ...(restoredWatch ? { watch: restoredWatch } : {}),
    };
  }
  let pendingRestore: Bn2fPersistedMachine | null = options.initialMachine ?? null;
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

  function runTick(): Bn2fEngineSpinResult {
    const tick = tickIce2fPlacar(history, machine, stats, maxRecovery);
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
    const watch = primeIce2fWatchFromHistory(history);
    const preservedCycle = machine.cycle;
    machine = {
      ...defaultIce2fMachineState(),
      watch,
      lastSpinHead: head,
    };

    if (preservedCycle?.phase === "awaiting_result") {
      machine = {
        ...machine,
        lockedPosition: null,
        nextEntryAxis: preservedCycle.active.axis,
        pendingRecovery: 0,
        cycle: {
          ...preservedCycle,
          phase: "awaiting_result",
          armedHead: head,
        },
      };
    } else if (pendingRestore) {
      const axis =
        (pendingRestore.nextEntryAxis && BN2F_AXES.has(pendingRestore.nextEntryAxis)
          ? pendingRestore.nextEntryAxis
          : null) ??
        (pendingRestore.axis && BN2F_AXES.has(pendingRestore.axis)
          ? pendingRestore.axis
          : null) ??
        "cor-altura";
      const locked =
        typeof pendingRestore.lockedPosition === "number" &&
        BN2F_POSITIONS.has(pendingRestore.lockedPosition)
          ? pendingRestore.lockedPosition
          : null;
      const pendingRecovery = pendingRecoveryFromSaved(pendingRestore);
      const restoredWatch = parsePersistedWatch(pendingRestore.watch);
      const gatePairId =
        typeof pendingRestore.gatePairId === "string" &&
        BN2F_PAIR_IDS.has(pendingRestore.gatePairId)
          ? pendingRestore.gatePairId
          : machine.gatePairId;
      pendingRestore = null;
      machine = {
        ...machine,
        nextEntryAxis: axis,
        lockedPosition: locked,
        pendingRecovery,
        gatePairId,
        // Preferir watch persistido (falhas) sobre só o prime do snapshot.
        watch: restoredWatch ?? machine.watch,
      };
      if (history.length >= getIce2fSoftMinHistory()) {
        machine = tryArmCycleFromWatch(machine, history, head);
      }
    } else if (history.length >= getIce2fSoftMinHistory()) {
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
    if (history.length > 40) history.length = 40;
    return runTick();
  }

  function canPlaceBet(nowMs = Date.now()): boolean {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
    return canPlaceIce2fBet(machine.cycle.recovery, lastLiveSpinAt, nowMs, machine.cycle.immediateBet === true);
  }

  function beginBetCommit() {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
    machine = {
      ...machine,
      betCommitInFlight: true,
      betCommitArmedHead: machine.cycle.armedHead,
    };
    return true;
  }

  function abortBetCommit() {
    if (!machine.betCommitInFlight && machine.betCommitArmedHead == null) return;
    machine = {
      ...machine,
      betCommitInFlight: false,
      betCommitArmedHead: null,
    };
  }

  function markBetPlaced() {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") {
      machine = {
        ...machine,
        betCommitInFlight: false,
        betCommitArmedHead: null,
      };
      return false;
    }
    // Giro novo entretanto — não confirmar aposta da janela antiga.
    if (
      machine.betCommitArmedHead != null &&
      machine.cycle.armedHead !== machine.betCommitArmedHead
    ) {
      machine = {
        ...machine,
        betCommitInFlight: false,
        betCommitArmedHead: null,
      };
      return false;
    }
    machine = {
      ...machine,
      betCommitInFlight: false,
      betCommitArmedHead: null,
      cycle: { ...machine.cycle, phase: "awaiting_result", immediateBet: false },
    };
    return true;
  }

  function buildBridgePayload(mesaEmbedUrl: string | null = BN2F_MESA_URL) {
    if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
    if (!canPlaceBet()) return null;

    const { active, recovery } = machine.cycle;
    const zeroShift = ice2fEffectiveZeroShift(machine);
    const units = ice2fStakeUnits(recovery, zeroShift);
    const doubles = ice2fDoubleClicks(recovery, zeroShift);
    const signalId = `bn2f:${active.pairId ?? "pair"}:pos${active.criticalPosition}:${active.axis}:ref${active.referenceNumber}:r${recovery}:h${machine.cycle.armedHead}`;
    const f1Key = pragmaticExteriorBetKeyFromFactor(active.factor1);
    const f2Key = pragmaticExteriorBetKeyFromFactor(active.factor2);
    const f1Label = doisFatoresFactorLabel(active.factor1);
    const f2Label = doisFatoresFactorLabel(active.factor2);
    const stakeAmount = BASE_STAKE * units;
    const betDelayUntilMs = ice2fBetDelayUntilMs(recovery, lastLiveSpinAt, machine.cycle.immediateBet === true);
    const galeSuffix = recovery > 0 ? ` · gale ${recovery}` : " · entrada";

    const actions: Array<{
      kind: "click";
      target: "factor-1" | "factor-2" | "repeat-bet";
      label: string;
      reason: string;
    }> = [
      {
        kind: "click",
        target: "factor-1",
        label: f1Label,
        reason: `Bet Nacional 2F · ${f1Label}${galeSuffix}`,
      },
      {
        kind: "click",
        target: "factor-2",
        label: f2Label,
        reason: `Bet Nacional 2F · ${f2Label}${galeSuffix}`,
      },
    ];
    for (let i = 0; i < doubles; i++) {
      actions.push({
        kind: "click",
        target: "repeat-bet",
        label: "Dobrar",
        reason: `Bet Nacional 2F · Dobrar ${i + 1}/${doubles}${galeSuffix}`,
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
        currentTableId: BN2F_TABLE_ID,
        mesaEmbedUrl: mesaEmbedUrl ?? BN2F_MESA_URL,
        mesaProvider: "outro" as const,
        factor1Label: f1Label,
        factor2Label: f2Label,
        factor1BetKey: f1Key,
        factor2BetKey: f2Key,
        singleFactorMode: false,
        signalId,
        armedHead: machine.cycle.armedHead,
        pairId: active.pairId ?? null,
        stakeAmount,
        units,
        chipClicks: 1,
        useDoubleGale: true,
        doubleClicks: doubles,
        currentRecovery: recovery,
        baseStake: BASE_STAKE,
        maxRecovery,
        executionMode: null,
        strategy: "bn2fcruzamento" as const,
        rotativaTrigger: "critical" as const,
        betDelayUntilMs,
        mesaCatalog: [],
      },
    };
  }

  function dropCycleIfPairDisabled(enabledIds: readonly string[]): boolean {
    const pairId = machine.cycle?.active?.pairId;
    if (!pairId || !machine.cycle) return false;
    const allowed = new Set(
      (enabledIds ?? []).map((id) => String(id).trim()).filter(Boolean),
    );
    if (allowed.has(pairId)) return false;
    machine = {
      ...machine,
      cycle: null,
      betCommitInFlight: false,
      betCommitArmedHead: null,
    };
    return true;
  }

  return {
    tableId: BN2F_TABLE_ID,
    ingestHistorySnapshot,
    ingestSpin,
    runTick,
    buildBridgePayload,
    canPlaceBet,
    beginBetCommit,
    abortBetCommit,
    markBetPlaced,
    dropCycleIfPairDisabled,
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
      pendingRestore = null;
    },
  };
}

const api = {
  BN2F_TABLE_ID,
  BN2F_MESA_URL,
  BN2F_MAX_GALES,
  ICE_2F_BET_DELAY_MS,
  ICE_2F_FIRST_BET_SETTLE_MS,
  ICE_2F_IMMEDIATE_REBET_DELAY_MS,
  ICE_2F_MAX_RECOVERY,
  ICE_2F_RECOVERY_BET_DELAY_MS,
  ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
  ROTATING_ROOM_CROSSING_BET_DELAY_MS,
  emptyIce2fStats,
  buildIce2fStreakChartMetrics,
  formatIce2fWatchLabel,
  ice2fWatchLabelForMachine,
  ice2fBetDelayMs,
  ice2fBetDelayUntilMs,
  ice2fPadFactorPlacementMs,
  ice2fDoubleClicks,
  ice2fEffectiveZeroShift,
  ice2fStakeUnits,
  ICE_2F_KNOWN_COMPARE_PAIRS,
  ICE_2F_DEFAULT_ENABLED_PAIR_IDS,
  ice2fPairLabel,
  applyIce2fEnabledPairIds,
  configureIce2fComparePairs,
  configureIce2fDefaultComparePairs,
  getIce2fComparePairs,
  createBn2fEngine,
};

// Reexportar nomes usados pelo runner/background — o esbuild IIFE só expõe
// named exports; sem isto SinglestakeBn2f.applyIce2fEnabledPairIds fica undefined.
export {
  applyIce2fEnabledPairIds,
  configureIce2fComparePairs,
  configureIce2fDefaultComparePairs,
  getIce2fComparePairs,
  ICE_2F_KNOWN_COMPARE_PAIRS,
  ICE_2F_DEFAULT_ENABLED_PAIR_IDS,
  ice2fPairLabel,
  emptyIce2fStats,
  buildIce2fStreakChartMetrics,
  formatIce2fWatchLabel,
  ice2fWatchLabelForMachine,
  ice2fBetDelayMs,
  ice2fBetDelayUntilMs,
  ice2fPadFactorPlacementMs,
  ice2fDoubleClicks,
  ice2fEffectiveZeroShift,
  ice2fStakeUnits,
  ICE_2F_BET_DELAY_MS,
  ICE_2F_FIRST_BET_SETTLE_MS,
  ICE_2F_IMMEDIATE_REBET_DELAY_MS,
  ICE_2F_MAX_RECOVERY,
  ICE_2F_RECOVERY_BET_DELAY_MS,
};

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as { SinglestakeBn2f?: typeof api }).SinglestakeBn2f = api;
}

export default api;
