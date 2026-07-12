/**
 * ICE · Cruzamento 2 Fatores — comparação posições **11** e **22**.
 *
 * **Gatilho:** compara os números nas posições críticas 11 e 22 (newest-first).
 * Alerta os **2 factores em comum** quando o par partilha:
 * - cor/altura, ou
 * - paridade/altura, ou
 * - cor/paridade
 * Se partilham **3** factores → prioriza **cor/paridade**.
 *
 * **Indicação única:** o sinal vale só para aquele giro. Novo giro sem aposta
 * cancela a indicação; empate/derrota/vitória fecham o ciclo. Gale fica pendente
 * para a **próxima** indicação 11/22 (não reutiliza factores antigos).
 * **Zero** na indicação = **derrota** (gale normal).
 */

import {
  doisFatoresFactorLabel,
  evaluateDoisFatoresRound,
  type DoisFatoresActive,
  type DoisFatoresFactor,
  type DoisFatoresPairKind,
} from "@/lib/roulette/doisFatoresStrategy";
import {
  factorsForNumberOnAxis,
  pairKindFromCrossingAxis,
  type CrossingAxisKind,
} from "@/lib/roulette/doisFatoresPatternCrossing";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  recordRotatingRoomSessionFinalLoss,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionWin,
  type RotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";
import {
  umFatorOppositeFactor,
  umFatorSharedFactorsBetween,
  umFatorTriggerMatchCount,
} from "@/lib/roulette/umFatorStrategy";

export const ICE_2F_ROULETTE_TABLE_ID = 201;
export const ICE_2F_ROULETTE_MESA_URL =
  "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal";

/** Posições críticas comparadas (1-based, newest-first). */
export const ICE_2F_COMPARE_POSITIONS = [11, 22] as const;
/** @deprecated Preferir {@link ICE_2F_COMPARE_POSITIONS}. */
export const ICE_2F_CRITICAL_POSITIONS = ICE_2F_COMPARE_POSITIONS;
export const ICE_2F_CROSSING_AXES = [
  "cor-altura",
  "altura-paridade",
  "cor-paridade",
] as const;

/** Precisa das posições 11 e 22. */
export const ICE_2F_MIN_HISTORY = 22;
/** @deprecated Janela de eco removida — gatilho é 11 vs 22. */
export const ICE_2F_SCAN_WINDOW = 11;
export const ICE_2F_MAX_RECOVERY = 5;

/** @deprecated Já não há limiar de falhas de observação. */
export const ICE_2F_REQUIRED_FAILURES = 0;
export const ICE_2F_RELAXED_REQUIRED_FAILURES = 0;
export const ICE_2F_RELAXED_FALLBACK_FAILURES = 0;
export const ICE_2F_INACTIVE_SPINS_FOR_RELAX = 0;

export const ICE_2F_RECOVERY_BET_DELAY_MS = 6_000;
export const ICE_2F_IMMEDIATE_REBET_DELAY_MS = 6_000;
export const ICE_2F_FIRST_BET_SETTLE_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
export const ICE_2F_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;

export const ICE_2F_STAKE_UNITS = [1, 2, 4, 8, 16, 32] as const;
export const ICE_2F_GALE3_REFERENCE_UNITS = 8;

export function ice2fPadFactorPlacementMs(_units: number): number {
  return 0;
}

/** Posição 1-based no histórico (1 = mais recente). */
export type Ice2fCriticalPosition = number;
export type Ice2fCrossingAxis = (typeof ICE_2F_CROSSING_AXES)[number];

export type Ice2fWatchSlot = { failures: number };
export type Ice2fWatchAxisMap = Record<Ice2fCrossingAxis, Ice2fWatchSlot>;
export type Ice2fWatchCounters = Record<number, Ice2fWatchAxisMap>;

export type Ice2fActive = {
  criticalPosition: Ice2fCriticalPosition;
  axis: Ice2fCrossingAxis;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  pairKind: DoisFatoresPairKind;
  referenceNumber: number;
  armingDescription: string;
  /** Posição 22 (par de comparação). */
  matchPosition?: number;
  matchNumber?: number;
  /** Número na posição 11. */
  triggerNumber?: number;
};

export type Ice2fCyclePhase = "awaiting_bet" | "awaiting_result" | "awaiting_reference";

export type Ice2fCycle = {
  active: Ice2fActive;
  armedHead: string;
  recovery: number;
  phase: Ice2fCyclePhase;
  relaxedEntry?: boolean;
  immediateBet?: boolean;
};

export type Ice2fMachineState = {
  cycle: Ice2fCycle | null;
  /** Stub para UI/compat. */
  watch: Ice2fWatchCounters;
  pendingArm: { position: Ice2fCriticalPosition; axis: Ice2fCrossingAxis } | null;
  lastSpinHead: string | null;
  betCommitInFlight?: boolean;
  betCommitArmedHead?: string | null;
  inactiveSpinsWithoutEntry?: number;
  /** Preferência de eixo (legado); o gatilho 11/22 define o eixo pelo match. */
  nextEntryAxis: Ice2fCrossingAxis;
  /** @deprecated Gatilho fixo 11/22 — mantido por persistência. */
  lockedPosition: Ice2fCriticalPosition | null;
  /** Gale a aplicar na próxima armação se a derrota não encontrou match de imediato. */
  pendingRecovery: number;
  zeroDebtUnits?: number;
  zeroRecoveredUnits?: number;
  zeroShift?: number;
  zeroRecoveryArmed?: boolean;
};

export type Ice2fFlash = {
  resultNumber: number;
  won: boolean;
  kind: "win" | "loss" | "tie" | "zero";
  criticalPosition: Ice2fCriticalPosition;
  axis: Ice2fCrossingAxis;
  recovery: number;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
};

export type Ice2fCriticalHit = {
  criticalPosition: Ice2fCriticalPosition;
  matchPosition: number;
  matchNumber: number;
  triggerNumber: number;
  axis: Ice2fCrossingAxis;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  sharedCount: 2 | 3;
};

function emptyWatchSlot(): Ice2fWatchSlot {
  return { failures: 0 };
}

function emptyWatchAxisMap(): Ice2fWatchAxisMap {
  return {
    "cor-altura": emptyWatchSlot(),
    "altura-paridade": emptyWatchSlot(),
    "cor-paridade": emptyWatchSlot(),
  };
}

export function emptyWatch(): Ice2fWatchCounters {
  const w: Ice2fWatchCounters = {};
  for (const pos of ICE_2F_COMPARE_POSITIONS) w[pos] = emptyWatchAxisMap();
  return w;
}

function cloneWatch(watch: Ice2fWatchCounters): Ice2fWatchCounters {
  const next: Ice2fWatchCounters = {};
  for (const key of Object.keys(watch)) {
    const pos = Number(key);
    const slot = watch[pos];
    if (!slot) continue;
    next[pos] = {
      "cor-altura": { failures: slot["cor-altura"]?.failures ?? 0 },
      "altura-paridade": { failures: slot["altura-paridade"]?.failures ?? 0 },
      "cor-paridade": { failures: slot["cor-paridade"]?.failures ?? 0 },
    };
  }
  return next;
}

export function defaultIce2fMachineState(): Ice2fMachineState {
  return {
    cycle: null,
    watch: emptyWatch(),
    pendingArm: null,
    lastSpinHead: null,
    betCommitInFlight: false,
    betCommitArmedHead: null,
    inactiveSpinsWithoutEntry: 0,
    nextEntryAxis: "cor-altura",
    lockedPosition: null,
    pendingRecovery: 0,
    zeroDebtUnits: 0,
    zeroRecoveredUnits: 0,
    zeroShift: 0,
    zeroRecoveryArmed: false,
  };
}

export function ice2fArmingThresholds(_machine: Ice2fMachineState): number[] {
  return [0];
}

export function ice2fRequiredFailuresForArming(_machine: Ice2fMachineState): number {
  return 0;
}

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function axisLabelPt(axis: Ice2fCrossingAxis): string {
  if (axis === "cor-altura") return "cor/altura";
  if (axis === "altura-paridade") return "paridade/altura";
  return "cor/paridade";
}

function axisShort(axis: Ice2fCrossingAxis): string {
  if (axis === "cor-altura") return "c/a";
  if (axis === "altura-paridade") return "p/a";
  return "c/p";
}

function pairKindFromFactors(
  f1: DoisFatoresFactor,
  f2: DoisFatoresFactor,
): Ice2fCrossingAxis {
  const kinds = new Set([f1.kind, f2.kind]);
  if (kinds.has("cor") && kinds.has("altura")) return "cor-altura";
  if (kinds.has("cor") && kinds.has("paridade")) return "cor-paridade";
  return "altura-paridade";
}

export function ice2fToggleAxis(axis: Ice2fCrossingAxis): Ice2fCrossingAxis {
  if (axis === "cor-altura") return "altura-paridade";
  if (axis === "altura-paridade") return "cor-paridade";
  return "cor-altura";
}

/**
 * Compara posições 11 e 22: 2 factores em comum → eixo correspondente;
 * 3 factores → prioriza cor/paridade.
 */
export function ice2fFindCriticalPosition(
  historyNewestFirst: readonly number[],
): Ice2fCriticalHit | null {
  if (historyNewestFirst.length < ICE_2F_MIN_HISTORY) return null;
  const number11 = historyNewestFirst[10]!;
  const number22 = historyNewestFirst[21]!;
  if (!Number.isFinite(number11) || !Number.isFinite(number22)) return null;
  if (number11 === 0 || number22 === 0) return null;

  const sharedCount = umFatorTriggerMatchCount(number11, number22);
  if (sharedCount < 2) return null;

  let axis: Ice2fCrossingAxis;
  let factor1: DoisFatoresFactor;
  let factor2: DoisFatoresFactor;

  if (sharedCount >= 3) {
    axis = "cor-paridade";
    const factors = factorsForNumberOnAxis(number11, axis);
    if (!factors) return null;
    factor1 = factors[0];
    factor2 = factors[1];
  } else {
    const shared = umFatorSharedFactorsBetween(number11, number22);
    if (shared.length !== 2) return null;
    factor1 = shared[0]!;
    factor2 = shared[1]!;
    axis = pairKindFromFactors(factor1, factor2);
  }

  return {
    criticalPosition: 11,
    matchPosition: 22,
    matchNumber: number22,
    triggerNumber: number11,
    axis,
    factor1,
    factor2,
    sharedCount: sharedCount >= 3 ? 3 : 2,
  };
}

function toTapeteActive(active: Ice2fActive): DoisFatoresActive {
  return {
    pairKind: active.pairKind,
    pairKindLabel: active.axis,
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: active.referenceNumber,
    factor1: active.factor1,
    factor2: active.factor2,
    triggerNumbers: [
      active.referenceNumber,
      active.matchNumber ?? active.referenceNumber,
    ] as const,
    armingDescription: active.armingDescription,
  };
}

export function ice2fClassifyBetRound(
  result: number,
  active: Ice2fActive,
): "W" | "L" | "continue" | "zero" {
  if (result === 0) return "L";
  return evaluateDoisFatoresRound(result, toTapeteActive(active));
}

export function ice2fIsWatchSlotArmed(
  _slot: Ice2fWatchSlot,
  _requiredFailures: number = ICE_2F_REQUIRED_FAILURES,
): boolean {
  return false;
}

export function ice2fOppositeBetFactors(
  factors: readonly [DoisFatoresFactor, DoisFatoresFactor],
): [DoisFatoresFactor, DoisFatoresFactor] {
  return [umFatorOppositeFactor(factors[0]), umFatorOppositeFactor(factors[1])];
}

export function ice2fBuildActiveFromHit(hit: Ice2fCriticalHit): Ice2fActive {
  const labels = [hit.factor1, hit.factor2]
    .map((f) => doisFatoresFactorLabel(f))
    .join(" · ");
  const tripleHint = hit.sharedCount === 3 ? " · 3F→cor/paridade" : "";
  return {
    criticalPosition: hit.criticalPosition,
    axis: hit.axis,
    factor1: hit.factor1,
    factor2: hit.factor2,
    pairKind: pairKindFromCrossingAxis(hit.axis as CrossingAxisKind),
    referenceNumber: hit.triggerNumber,
    armingDescription: `2F pos11/22 ${axisLabelPt(hit.axis)}: nº${hit.triggerNumber}·${hit.matchNumber} → ${labels}${tripleHint}`,
    matchPosition: hit.matchPosition,
    matchNumber: hit.matchNumber,
    triggerNumber: hit.triggerNumber,
  };
}

export function ice2fBuildActiveFromHistory(
  historyNewestFirst: readonly number[],
  _position?: Ice2fCriticalPosition,
  _axis?: Ice2fCrossingAxis,
  _meta?: Partial<Pick<Ice2fActive, "matchPosition" | "matchNumber" | "triggerNumber">>,
): Ice2fActive | null {
  // Só arma com match real 11×22 (≥2 factores em comum). Nunca inventar
  // factores a partir de um único número (ex.: 35 Preto/Alto sem o 10 partilhar).
  const hit = ice2fFindCriticalPosition(historyNewestFirst);
  if (!hit) return null;
  return ice2fBuildActiveFromHit(hit);
}

export function primeIce2fWatchFromHistory(
  _historyNewestFirst: readonly number[],
): Ice2fWatchCounters {
  return emptyWatch();
}

export function ice2fNextCriticalSlot(
  position: Ice2fCriticalPosition,
  axis: Ice2fCrossingAxis,
): { position: Ice2fCriticalPosition; axis: Ice2fCrossingAxis } {
  return { position, axis: ice2fToggleAxis(axis) };
}

function ice2fClearCycleKeepGale(
  machine: Ice2fMachineState,
  recoveryToKeep: number,
): Ice2fMachineState {
  return {
    ...machine,
    cycle: null,
    betCommitInFlight: false,
    betCommitArmedHead: null,
    lockedPosition: null,
    pendingRecovery: Math.max(0, Math.floor(recoveryToKeep)),
  };
}

function armCycleFromHit(
  machine: Ice2fMachineState,
  head: string,
  hit: Ice2fCriticalHit,
  recovery: number,
): Ice2fMachineState {
  const active = ice2fBuildActiveFromHit(hit);
  return {
    ...machine,
    lockedPosition: hit.criticalPosition,
    nextEntryAxis: hit.axis,
    inactiveSpinsWithoutEntry: 0,
    pendingArm: null,
    pendingRecovery: 0,
    cycle: {
      active,
      armedHead: head,
      recovery,
      phase: "awaiting_bet",
      immediateBet: recovery > 0,
    },
  };
}

/** Arma ciclo quando pos 11 e 22 partilham 2+ factores. */
export function tryArmCycleFromWatch(
  machine: Ice2fMachineState,
  historyNewestFirst: readonly number[],
  head: string,
): Ice2fMachineState {
  if (machine.cycle) return machine;
  if (historyNewestFirst.length < ICE_2F_MIN_HISTORY) return machine;

  const pendingRecovery = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
  const hit = ice2fFindCriticalPosition(historyNewestFirst);
  if (!hit) return machine;

  return armCycleFromHit(
    { ...machine, betCommitInFlight: false },
    head,
    hit,
    pendingRecovery,
  );
}

/**
 * Após derrota: guarda gale e espera o **próximo giro** para nova indicação 11/22
 * (uma indicação por giro — não rearma no mesmo head).
 */
function armAfterLoss(
  machine: Ice2fMachineState,
  _historyNewestFirst: readonly number[],
  _head: string,
  nextRecovery: number,
  _previousAxis: Ice2fCrossingAxis,
): Ice2fMachineState {
  return {
    ...machine,
    lockedPosition: null,
    pendingRecovery: nextRecovery,
    cycle: null,
    betCommitInFlight: false,
  };
}

export function ice2fStakeUnits(recovery: number, zeroShift = 0): number {
  const idx = Math.min(
    Math.max(0, Math.floor(recovery)),
    ICE_2F_STAKE_UNITS.length - 1,
  );
  const shift = Math.max(0, Math.floor(zeroShift));
  return ICE_2F_STAKE_UNITS[idx]! * 2 ** shift;
}

export function ice2fDoubleClicks(recovery: number, zeroShift = 0): number {
  return Math.max(0, Math.floor(recovery)) + Math.max(0, Math.floor(zeroShift));
}

export function ice2fZeroDebtForRecovery(recovery: number, zeroShift = 0): number {
  const r = Math.max(0, Math.floor(recovery));
  let sum = 0;
  for (let i = 0; i < r; i++) sum += ice2fStakeUnits(i, zeroShift);
  return sum;
}

export function ice2fEffectiveZeroShift(machine: Ice2fMachineState): number {
  const debt = machine.zeroDebtUnits ?? 0;
  if (debt <= 0) return 0;
  if (!machine.zeroRecoveryArmed) return 0;
  return Math.max(0, Math.floor(machine.zeroShift ?? 0));
}

function clearZeroRecovery(machine: Ice2fMachineState): Ice2fMachineState {
  return {
    ...machine,
    zeroDebtUnits: 0,
    zeroRecoveredUnits: 0,
    zeroShift: 0,
    zeroRecoveryArmed: false,
  };
}

function applyWinZeroRecoveryAccounting(
  machine: Ice2fMachineState,
  wonUnits: number,
): Ice2fMachineState {
  const debt = machine.zeroDebtUnits ?? 0;
  if (debt <= 0) return clearZeroRecovery(machine);
  if (!machine.zeroRecoveryArmed) {
    return {
      ...machine,
      zeroRecoveryArmed: true,
      zeroRecoveredUnits: 0,
    };
  }
  const recovered = (machine.zeroRecoveredUnits ?? 0) + Math.max(0, wonUnits);
  if (recovered >= debt) return clearZeroRecovery(machine);
  return {
    ...machine,
    zeroRecoveredUnits: recovered,
    zeroRecoveryArmed: true,
  };
}

export function ice2fRecoveryAfterWin(_recovery: number): number {
  return 0;
}

export function ice2fRecoveryAfterLoss(recovery: number): number {
  return Math.max(0, Math.floor(recovery)) + 1;
}

export function ice2fBetDelayMs(_recovery?: number, immediateBet?: boolean): number {
  return immediateBet === true
    ? ICE_2F_IMMEDIATE_REBET_DELAY_MS
    : ICE_2F_RECOVERY_BET_DELAY_MS;
}

export function ice2fBetDelayUntilMs(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  immediateBet?: boolean,
): number | null {
  const delayMs = ice2fBetDelayMs(recovery, immediateBet);
  return lastSpinAtMs != null && Number.isFinite(lastSpinAtMs)
    ? lastSpinAtMs + delayMs
    : null;
}

export function canPlaceIce2fBet(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
  immediateBet?: boolean,
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= ice2fBetDelayMs(recovery, immediateBet);
}

export type Ice2fTickResult = {
  machine: Ice2fMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: Ice2fFlash | null;
  globalActive: Ice2fActive | null;
  globalRecovery: number;
  /** Giro novo chegou antes de a aposta ser confirmada — não conta W/L. */
  missedBetWindow?: boolean;
};

export function tickIce2fPlacar(
  historyNewestFirst: readonly number[],
  machine: Ice2fMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = ICE_2F_MAX_RECOVERY,
): Ice2fTickResult {
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: Ice2fMachineState = {
    ...machine,
    lastSpinHead: head,
    watch: cloneWatch(machine.watch ?? emptyWatch()),
    nextEntryAxis: machine.nextEntryAxis ?? "cor-altura",
    lockedPosition: machine.lockedPosition ?? null,
    pendingRecovery: machine.pendingRecovery ?? 0,
  };
  let nextStats = stats;
  let statsChanged = false;
  let flash: Ice2fFlash | null = null;
  let missedBetWindow = false;

  if (
    nextMachine.cycle?.phase === "awaiting_bet" &&
    headChanged &&
    nextMachine.cycle.armedHead !== head
  ) {
    // Indicação única: novo giro sem aposta → cancela; gale fica para o próximo match.
    missedBetWindow = true;
    nextMachine = ice2fClearCycleKeepGale(nextMachine, nextMachine.cycle.recovery);
  }

  if (
    nextMachine.cycle?.phase === "awaiting_reference" &&
    headChanged &&
    nextMachine.cycle.armedHead !== head
  ) {
    nextMachine = ice2fClearCycleKeepGale(nextMachine, nextMachine.cycle.recovery);
  }

  if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
    const cycle = nextMachine.cycle;
    const resultNumber = historyNewestFirst[0]!;
    const outcome = ice2fClassifyBetRound(resultNumber, cycle.active);
    const { active, recovery } = cycle;

    if (outcome === "W") {
      const wonUnits = ice2fStakeUnits(
        recovery,
        ice2fEffectiveZeroShift(nextMachine),
      );
      nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
      statsChanged = true;
      nextMachine = ice2fClearCycleKeepGale(
        applyWinZeroRecoveryAccounting(nextMachine, wonUnits),
        0,
      );
      flash = {
        resultNumber,
        won: true,
        kind: "win",
        criticalPosition: active.criticalPosition,
        axis: active.axis,
        recovery,
        factor1: active.factor1,
        factor2: active.factor2,
      };
    } else if (outcome === "continue") {
      // Empate: fecha indicação (única); mantém o mesmo gale para o próximo match 11/22.
      nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recovery, maxRecovery);
      statsChanged = true;
      nextMachine = ice2fClearCycleKeepGale(nextMachine, recovery);
      flash = {
        resultNumber,
        won: false,
        kind: "tie",
        criticalPosition: active.criticalPosition,
        axis: active.axis,
        recovery,
        factor1: active.factor1,
        factor2: active.factor2,
      };
    } else {
      const nextRecovery = ice2fRecoveryAfterLoss(recovery);
      if (nextRecovery > maxRecovery) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recovery, maxRecovery);
        statsChanged = true;
        nextMachine = {
          ...ice2fClearCycleKeepGale(nextMachine, 0),
          nextEntryAxis: ice2fToggleAxis(active.axis),
        };
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2,
        };
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recovery, maxRecovery);
        statsChanged = true;
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2,
        };
        nextMachine = armAfterLoss(
          nextMachine,
          historyNewestFirst,
          head,
          nextRecovery,
          active.axis,
        );
      }
    }
  }

  if (
    !nextMachine.cycle &&
    headChanged &&
    historyNewestFirst.length >= ICE_2F_MIN_HISTORY
  ) {
    // Novo giro → leitura fresca 11×22 (inclui após W/L/empate no mesmo tick).
    // Não reutiliza factores antigos: ice2fFindCriticalPosition só arma com o par actual.
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
  }

  if (
    !nextMachine.cycle &&
    machine.lastSpinHead == null &&
    historyNewestFirst.length >= ICE_2F_MIN_HISTORY
  ) {
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
  }

  const globalActive =
    nextMachine.cycle?.phase === "awaiting_bet" ||
    nextMachine.cycle?.phase === "awaiting_result"
      ? nextMachine.cycle.active
      : null;
  const globalRecovery =
    nextMachine.cycle?.recovery ??
    Math.max(0, Math.floor(nextMachine.pendingRecovery ?? 0));

  return {
    machine: nextMachine,
    stats: nextStats,
    statsChanged,
    flash,
    globalActive,
    globalRecovery,
    missedBetWindow,
  };
}

export function parseIce2fStats(
  raw: unknown,
  maxRecovery = ICE_2F_MAX_RECOVERY,
): RotatingRoomSessionStats {
  return parseRotatingRoomSessionStats(raw, maxRecovery);
}

export function emptyIce2fStats(maxRecovery = ICE_2F_MAX_RECOVERY): RotatingRoomSessionStats {
  return emptyRotatingRoomSessionStats(maxRecovery);
}

export function formatIce2fWatchLabel(
  _watch: Ice2fWatchCounters,
  _requiredFailures: number = ICE_2F_REQUIRED_FAILURES,
): string {
  return "pos 11×22 · 2F em comum";
}

export function ice2fWatchLabelForMachine(machine: Ice2fMachineState): string {
  const pending = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
  const cycle = machine.cycle?.active;
  if (cycle) {
    return `11/22 ${axisShort(cycle.axis)} · gale ${machine.cycle?.recovery ?? 0}`;
  }
  return pending > 0
    ? `aguarda 11/22 · gale ${pending}`
    : "aguarda 11/22 · 2F em comum";
}
