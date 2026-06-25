/**
 * Estratégia **Fatores 3,2%** (espelho ao vivo):
 * - **Gatilho:** compara **pos. 1** e **pos. 6** (grelha 2×5: coluna 0, linhas 0 e 1) em paridade e altura.
 *   - **Convergência:** paridade e altura iguais → contador convergência+1, divergência zera.
 *   - **Divergência:** paridade e altura opostas → contador divergência+1, convergência zera.
 * - **Alerta:** base na **pos. 5** (grelha [0][4]); factores **paridade + altura**.
 *   - Convergência activa → mesma paridade e altura da ref.
 *   - Divergência activa → paridade e altura opostas à ref.
 *   - **Modo segurança** (alternância ≥ 2): segue o contador que está a 0.
 * - Placar: vitória se **ambos** os factores ganham; derrota se **ambos** perdem **ou** **0**.
 * - **Recuperação:** até {@link DOIS_FATORES_MAX_RECOVERY_BEFORE_DEFEAT} perdas duplas absorvidas antes de **L**.
 */

import {
  heightOf,
  parityOf,
  colorOf,
  type Color,
  type Height,
  type Parity,
} from "@/lib/roulette/streetPairTrigger";
import type { StreetPlacarEvolutionSeries } from "@/lib/roulette/streetStrategy";

/** Pos. 1 — grelha [0][0] (newest-first índice 0). */
export const DOIS_FATORES_TRIGGER_A_INDEX = 0;
/** Pos. 5 — base do alerta, grelha [0][4]. */
export const DOIS_FATORES_REFERENCE_INDEX = 4;
/** Pos. 6 — grelha [1][0] (newest-first índice 5). */
export const DOIS_FATORES_TRIGGER_B_INDEX = 5;
export const DOIS_FATORES_MIN_HISTORY = 6;

export const DOIS_FATORES_STRATEGY_DISPLAY_NAME = "Fatores 3,2%";

export const DOIS_FATORES_MAX_RECOVERY_BEFORE_DEFEAT = 5;

export type DoisFatoresPlacarSimulation = {
  outcomes: ("W" | "L")[];
  recoveryAfterRound: number[];
  currentRecovery: number;
};

export type DoisFatoresLiveSnapshot = {
  active: DoisFatoresActive | null;
  /** Overlay «Aguardando Nova Entrada» — só após derrota registada no placar. */
  awaitingNewEntryAfterDefeat: boolean;
};

/** Giros mínimos após derrota antes de novo alerta (ref. pos. 5 reposta — como grelha limpa no paridadealtura). */
const POST_DEFEAT_REARM_SPIN_COUNT = DOIS_FATORES_REFERENCE_INDEX + 1;

export type DoisFatoresPairKind = "cor-paridade" | "cor-altura" | "altura-paridade";

export type DoisFatoresFactor =
  | { kind: "cor"; value: Exclude<Color, "Zero"> }
  | { kind: "paridade"; value: Exclude<Parity, "Zero"> }
  | { kind: "altura"; value: Exclude<Height, "Zero"> };

export type DoisFatoresPatternMode = "convergence" | "divergence";

export type DoisFatoresPatternStats = {
  convergence: number;
  divergence: number;
  alternation: number;
  safetyMode: boolean;
};

export type DoisFatoresActive = {
  pairKind: DoisFatoresPairKind;
  pairKindLabel: string;
  patternMode: DoisFatoresPatternMode;
  patternStats: DoisFatoresPatternStats;
  referenceNumber: number;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  triggerNumbers: readonly [number, number];
  armingDescription: string;
};

export type DoisFatoresRoundOutcome = "W" | "L" | "continue";

type InternalPatternStats = DoisFatoresPatternStats & {
  lastResult?: DoisFatoresPatternMode;
};

const INITIAL_PATTERN: InternalPatternStats = {
  convergence: 0,
  divergence: 0,
  alternation: 0,
  safetyMode: false,
};

function pairKindLabel(kind: DoisFatoresPairKind): string {
  switch (kind) {
    case "cor-paridade":
      return "Cor · Paridade";
    case "cor-altura":
      return "Cor · Altura";
    case "altura-paridade":
      return "Paridade · Altura";
  }
}

function factorDisplayLabel(f: DoisFatoresFactor): string {
  switch (f.kind) {
    case "cor":
      return f.value === "Vermelho" ? "Vermelho" : "Preto";
    case "paridade":
      return f.value === "Par" ? "Par" : "Ímpar";
    case "altura":
      return f.value === "Baixo" ? "Baixo 1–18" : "Alto 19–36";
  }
}

export function doisFatoresFactorLabel(f: DoisFatoresFactor): string {
  return factorDisplayLabel(f);
}

/** Grupo do factor para UI / extensão (paridade, cor, altura). */
export function doisFatoresFactorKindLabel(f: DoisFatoresFactor): "Paridade" | "Cor" | "Altura" {
  switch (f.kind) {
    case "cor":
      return "Cor";
    case "paridade":
      return "Paridade";
    case "altura":
      return "Altura";
  }
}

/** Cores vermelho/preto reservadas só ao factor «cor». */
export function doisFatoresFactorButtonClass(f: DoisFatoresFactor): string {
  switch (f.kind) {
    case "cor":
      return f.value === "Vermelho"
        ? "border-red-400/50 bg-gradient-to-t from-red-950 to-red-600/90 text-red-50 shadow-[0_0_28px_rgba(248,113,113,0.35)]"
        : "border-slate-500/50 bg-gradient-to-t from-slate-950 to-slate-700 text-slate-100 shadow-[0_0_24px_rgba(100,116,139,0.3)]";
    case "paridade":
      return f.value === "Par"
        ? "border-violet-400/50 bg-gradient-to-t from-violet-950 to-violet-600/85 text-violet-50 shadow-[0_0_28px_rgba(167,139,250,0.35)]"
        : "border-fuchsia-400/45 bg-gradient-to-t from-fuchsia-950 to-fuchsia-700/80 text-fuchsia-50 shadow-[0_0_24px_rgba(217,70,239,0.28)]";
    case "altura":
      return f.value === "Baixo"
        ? "border-sky-400/50 bg-gradient-to-t from-sky-950 to-sky-600/85 text-sky-50 shadow-[0_0_28px_rgba(56,189,248,0.32)]"
        : "border-emerald-400/50 bg-gradient-to-t from-emerald-950 to-emerald-600/85 text-emerald-50 shadow-[0_0_28px_rgba(52,211,153,0.32)]";
  }
}

export function doisFatoresPatternModeLabel(mode: DoisFatoresPatternMode): string {
  return mode === "convergence" ? "Convergência" : "Divergência";
}

function oppositeHeight(h: Exclude<Height, "Zero">): Exclude<Height, "Zero"> {
  return h === "Baixo" ? "Alto" : "Baixo";
}

function oppositeParity(p: Exclude<Parity, "Zero">): Exclude<Parity, "Zero"> {
  return p === "Par" ? "Ímpar" : "Par";
}

function isHighNumber(n: number): boolean {
  return n >= 19 && n <= 36;
}

function isEvenNumber(n: number): boolean {
  return n !== 0 && n % 2 === 0;
}

function toPublicPatternStats(s: InternalPatternStats): DoisFatoresPatternStats {
  return {
    convergence: s.convergence,
    divergence: s.divergence,
    alternation: s.alternation,
    safetyMode: s.safetyMode,
  };
}

/** Actualiza contadores após comparar pos. 1 vs pos. 6 (paridade + altura). */
function stepPatternStats(prev: InternalPatternStats, n1: number, n2: number): InternalPatternStats {
  const parityMatch = isEvenNumber(n1) === isEvenNumber(n2);
  const heightMatch = isHighNumber(n1) === isHighNumber(n2);

  const next: InternalPatternStats = { ...prev };

  if (parityMatch && heightMatch) {
    next.convergence += 1;
    next.divergence = 0;
    if (prev.lastResult === "divergence") next.alternation += 1;
    next.lastResult = "convergence";
  } else if (!parityMatch && !heightMatch) {
    next.divergence += 1;
    next.convergence = 0;
    if (prev.lastResult === "convergence") next.alternation += 1;
    next.lastResult = "divergence";
  }

  if (next.alternation >= 2) {
    next.safetyMode = true;
  } else if (next.alternation === 0) {
    next.safetyMode = false;
  }

  if (next.convergence >= 2 || next.divergence >= 2) {
    next.alternation = 0;
    next.safetyMode = false;
  }

  return next;
}

function resolveUseConvergence(
  stats: InternalPatternStats,
  hasFirstComparison: boolean,
): DoisFatoresPatternMode | null {
  if (!hasFirstComparison) return null;

  if (stats.alternation >= 2) {
    if (stats.convergence === 0) return "convergence";
    if (stats.divergence === 0) return "divergence";
    return null;
  }

  if (stats.convergence > 0) return "convergence";
  if (stats.divergence > 0) return "divergence";
  return null;
}

function parityAlturaFactorsFromReference(
  nRef: number,
  useConvergence: boolean,
): readonly [DoisFatoresFactor, DoisFatoresFactor] | null {
  if (nRef === 0) return null;
  const par = parityOf(nRef);
  const alt = heightOf(nRef);
  if (par === "Zero" || alt === "Zero") return null;

  const parValue = useConvergence ? par : oppositeParity(par);
  const altValue = useConvergence ? alt : oppositeHeight(alt);

  return [
    { kind: "paridade", value: parValue },
    { kind: "altura", value: altValue },
  ] as const;
}

function buildActiveFromState(
  historyNewestFirst: readonly number[],
  stats: InternalPatternStats,
  hasFirstComparison: boolean,
): DoisFatoresActive | null {
  if (historyNewestFirst.length < DOIS_FATORES_MIN_HISTORY) return null;

  const n1 = historyNewestFirst[DOIS_FATORES_TRIGGER_A_INDEX]!;
  const nRef = historyNewestFirst[DOIS_FATORES_REFERENCE_INDEX]!;
  const n6 = historyNewestFirst[DOIS_FATORES_TRIGGER_B_INDEX]!;

  const patternMode = resolveUseConvergence(stats, hasFirstComparison);
  if (!patternMode) return null;

  const factors = parityAlturaFactorsFromReference(nRef, patternMode === "convergence");
  if (!factors) return null;

  const [factor1, factor2] = factors;
  const pairKind: DoisFatoresPairKind = "altura-paridade";
  const modeLabel = doisFatoresPatternModeLabel(patternMode);
  const safety = stats.safetyMode ? " · modo segurança" : "";

  return {
    pairKind,
    pairKindLabel: pairKindLabel(pairKind),
    patternMode,
    patternStats: toPublicPatternStats(stats),
    referenceNumber: nRef,
    factor1,
    factor2,
    triggerNumbers: [n1, n6] as const,
    armingDescription: `${DOIS_FATORES_STRATEGY_DISPLAY_NAME}: ${modeLabel}${safety} (pos. 1 e 6) · ref. nº ${nRef} (${factorDisplayLabel(factor1)} + ${factorDisplayLabel(factor2)}).`,
  };
}

/** Reproduz contadores de padrão após cada giro cronológico (para placar). */
function replayPatternState(chronological: readonly number[]): {
  stats: InternalPatternStats;
  hasFirstComparison: boolean;
}[] {
  let stats = { ...INITIAL_PATTERN };
  let hasFirstComparison = false;
  const beforeSpin: { stats: InternalPatternStats; hasFirstComparison: boolean }[] = [];

  for (let k = 1; k < chronological.length; k++) {
    beforeSpin.push({
      stats: { ...stats },
      hasFirstComparison,
    });

    const hnfAfterAdd = chronological.slice(0, k + 1).reverse();
    if (hnfAfterAdd.length >= DOIS_FATORES_MIN_HISTORY) {
      const a = hnfAfterAdd[DOIS_FATORES_TRIGGER_A_INDEX]!;
      const b = hnfAfterAdd[DOIS_FATORES_TRIGGER_B_INDEX]!;
      if (a !== 0 && b !== 0) {
        stats = stepPatternStats(stats, a, b);
        hasFirstComparison = true;
      }
    }
  }

  return beforeSpin;
}

function patternStateAtEnd(chronological: readonly number[]): {
  stats: InternalPatternStats;
  hasFirstComparison: boolean;
} {
  let stats = { ...INITIAL_PATTERN };
  let hasFirstComparison = false;

  for (let k = 1; k < chronological.length; k++) {
    const hnfAfterAdd = chronological.slice(0, k + 1).reverse();
    if (hnfAfterAdd.length >= DOIS_FATORES_MIN_HISTORY) {
      const a = hnfAfterAdd[DOIS_FATORES_TRIGGER_A_INDEX]!;
      const b = hnfAfterAdd[DOIS_FATORES_TRIGGER_B_INDEX]!;
      if (a !== 0 && b !== 0) {
        stats = stepPatternStats(stats, a, b);
        hasFirstComparison = true;
      }
    }
  }

  return { stats, hasFirstComparison };
}

type ChronologicalRunState = {
  outcomes: ("W" | "L")[];
  recoveryAfterRound: number[];
  currentRecovery: number;
  active: DoisFatoresActive | null;
  awaitingNewEntryAfterDefeat: boolean;
};

/** Percorre o histórico aplicando ciclo de sinal, recuperação e bloqueio pós-derrota. */
function runDoisFatoresChronologicalState(
  chronological: readonly number[],
): ChronologicalRunState {
  const outcomes: ("W" | "L")[] = [];
  const recoveryAfterRound: number[] = [];
  let recovery = 0;
  let postDefeatLock = 0;
  let cycleActive: DoisFatoresActive | null = null;

  if (chronological.length < 2) {
    return {
      outcomes,
      recoveryAfterRound,
      currentRecovery: recovery,
      active: null,
      awaitingNewEntryAfterDefeat: false,
    };
  }

  const states = replayPatternState(chronological);

  for (let k = 1; k < chronological.length; k++) {
    if (postDefeatLock > 0) postDefeatLock -= 1;

    const prefixNewestFirst = chronological.slice(0, k).reverse();
    if (prefixNewestFirst.length < DOIS_FATORES_MIN_HISTORY) continue;

    const state = states[k - 1];
    if (!state) continue;

    const potentialActive = buildActiveFromState(
      prefixNewestFirst,
      state.stats,
      state.hasFirstComparison,
    );

    if (!cycleActive && postDefeatLock === 0 && potentialActive) {
      cycleActive = potentialActive;
    }

    if (!cycleActive) continue;

    const r = evaluateDoisFatoresRound(chronological[k]!, cycleActive);
    if (r === "W") {
      recovery = 0;
      outcomes.push("W");
      recoveryAfterRound.push(0);
      cycleActive = null;
    } else if (r === "L") {
      recovery += 1;
      if (recovery > DOIS_FATORES_MAX_RECOVERY_BEFORE_DEFEAT) {
        outcomes.push("L");
        recovery = 0;
        recoveryAfterRound.push(0);
        cycleActive = null;
        postDefeatLock = POST_DEFEAT_REARM_SPIN_COUNT;
      } else {
        recoveryAfterRound.push(recovery);
      }
    }
  }

  let active: DoisFatoresActive | null = cycleActive;
  let awaitingNewEntryAfterDefeat = postDefeatLock > 0;

  if (!active && !awaitingNewEntryAfterDefeat && historyNewestFirstLengthOk(chronological)) {
    const historyNewestFirst = [...chronological].reverse();
    const { stats, hasFirstComparison } = patternStateAtEnd(chronological);
    active = buildActiveFromState(historyNewestFirst, stats, hasFirstComparison);
  }

  return {
    outcomes,
    recoveryAfterRound,
    currentRecovery: recovery,
    active,
    awaitingNewEntryAfterDefeat,
  };
}

function historyNewestFirstLengthOk(chronological: readonly number[]): boolean {
  return chronological.length >= DOIS_FATORES_MIN_HISTORY;
}

/** Estado ao vivo: sinal + overlay pós-derrota. */
export function doisFatoresLiveSnapshotFromHistory(
  historyNewestFirst: readonly number[],
): DoisFatoresLiveSnapshot {
  if (historyNewestFirst.length < DOIS_FATORES_MIN_HISTORY) {
    return { active: null, awaitingNewEntryAfterDefeat: false };
  }

  const chronological = [...historyNewestFirst].reverse();
  const run = runDoisFatoresChronologicalState(chronological);
  return {
    active: run.active,
    awaitingNewEntryAfterDefeat: run.awaitingNewEntryAfterDefeat,
  };
}

/** Estado activo a partir do histórico actual (newest-first). */
export function doisFatoresActiveFromSnapshot(
  historyNewestFirst: readonly number[],
): DoisFatoresActive | null {
  return doisFatoresLiveSnapshotFromHistory(historyNewestFirst).active;
}

function factorWins(num: number, factor: DoisFatoresFactor): boolean {
  switch (factor.kind) {
    case "cor":
      return colorOf(num) === factor.value;
    case "paridade":
      return parityOf(num) === factor.value;
    case "altura":
      return heightOf(num) === factor.value;
  }
}

export function evaluateDoisFatoresRound(
  num: number,
  active: DoisFatoresActive,
): DoisFatoresRoundOutcome {
  if (num === 0) return "L";

  const f1Win = factorWins(num, active.factor1);
  const f2Win = factorWins(num, active.factor2);
  const f1Lose = !f1Win;
  const f2Lose = !f2Win;

  if (f1Win && f2Win) return "W";
  if (f1Lose && f2Lose) return "L";
  return "continue";
}

export function simulateDoisFatoresPlacar(
  historyNewestFirst: readonly number[],
): DoisFatoresPlacarSimulation {
  if (historyNewestFirst.length < 2) {
    return { outcomes: [], recoveryAfterRound: [], currentRecovery: 0 };
  }

  const chronological = [...historyNewestFirst].reverse();
  const run = runDoisFatoresChronologicalState(chronological);
  return {
    outcomes: run.outcomes,
    recoveryAfterRound: run.recoveryAfterRound,
    currentRecovery: run.currentRecovery,
  };
}

export function doisFatoresPlacarOutcomes(historyNewestFirst: readonly number[]): ("W" | "L")[] {
  return simulateDoisFatoresPlacar(historyNewestFirst).outcomes;
}

export function doisFatoresCurrentRecoveryCount(historyNewestFirst: readonly number[]): number {
  return simulateDoisFatoresPlacar(historyNewestFirst).currentRecovery;
}

export function doisFatoresRecoveryEvolutionSeries(
  historyNewestFirst: readonly number[],
): number[] | null {
  const { recoveryAfterRound } = simulateDoisFatoresPlacar(historyNewestFirst);
  return recoveryAfterRound.length > 0 ? recoveryAfterRound : null;
}

export function doisFatoresAproveitamentoPctFromHistory(historyNewestFirst: readonly number[]): number {
  const outcomes = doisFatoresPlacarOutcomes(historyNewestFirst);
  const decided = outcomes.length;
  if (decided === 0) return 0;
  const wins = outcomes.filter((x) => x === "W").length;
  return (100 * wins) / decided;
}

export function doisFatoresPlacarEvolutionSeries(
  historyNewestFirst: readonly number[],
): StreetPlacarEvolutionSeries | null {
  const outcomes = doisFatoresPlacarOutcomes(historyNewestFirst);
  if (outcomes.length === 0) return null;

  let w = 0;
  let l = 0;
  let run = 0;
  let best = 0;
  const cumulativeWins: number[] = [];
  const cumulativeLosses: number[] = [];
  const aproveitamentoPct: number[] = [];
  const streakCurrent: number[] = [];
  const streakMax: number[] = [];

  for (const x of outcomes) {
    if (x === "W") {
      w += 1;
      run += 1;
      best = Math.max(best, run);
    } else {
      l += 1;
      run = 0;
    }
    cumulativeWins.push(w);
    cumulativeLosses.push(l);
    aproveitamentoPct.push(w + l > 0 ? (100 * w) / (w + l) : 0);
    streakCurrent.push(run);
    streakMax.push(best);
  }

  return {
    cumulativeWins,
    cumulativeLosses,
    aproveitamentoPct,
    streakCurrent,
    streakMax,
  };
}

export function doisFatoresExteriorCellKey(
  factor: DoisFatoresFactor,
): "low" | "high" | "even" | "odd" | "red" | "black" {
  switch (factor.kind) {
    case "cor":
      return factor.value === "Vermelho" ? "red" : "black";
    case "paridade":
      return factor.value === "Par" ? "even" : "odd";
    case "altura":
      return factor.value === "Baixo" ? "low" : "high";
  }
}
