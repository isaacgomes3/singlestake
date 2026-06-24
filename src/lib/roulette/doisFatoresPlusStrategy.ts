/**
 * 2 Fatores+ — cor/altura:
 * - Compara **pos. 1** e **pos. 12** (grelha 11×3, newest-first).
 * - Gatilho armado quando **cor e altura são opostas** entre as duas posições.
 * - Alerta **cor · altura** com base no número da **pos. 11**.
 */

import {
  evaluateDoisFatoresRound,
  type DoisFatoresActive,
  type DoisFatoresFactor,
  type DoisFatoresPlacarSimulation,
} from "@/lib/roulette/doisFatoresStrategy";
import { colorOf, heightOf } from "@/lib/roulette/streetPairTrigger";
import type { StreetPlacarEvolutionSeries } from "@/lib/roulette/streetStrategy";
import {
  entryWinBreakdownFromOutcomes,
  entryWinBreakdownFromRecoveryCounts,
  emptyRecoveryLevelCounts,
  type EntryWinBreakdown,
} from "@/lib/roulette/entryWinBreakdown";

/** Pos. 1 — índice 0 (newest-first). */
export const DOIS_FATORES_PLUS_POS_1_INDEX = 0;
/** Pos. 11 — base do alerta cor/altura. */
export const DOIS_FATORES_PLUS_POS_11_INDEX = 10;
/** Pos. 12 — comparação com pos. 1. */
export const DOIS_FATORES_PLUS_POS_12_INDEX = 11;
export const DOIS_FATORES_PLUS_MIN_HISTORY = 12;
export const DOIS_FATORES_PLUS_MAX_RECOVERY = 5;

export type DoisFatoresPlusLiveSnapshot = {
  active: DoisFatoresActive | null;
  gatilhoArmed: boolean;
};

function isValidCompareNumber(n: number): boolean {
  if (n === 0) return false;
  return colorOf(n) !== "Zero" && heightOf(n) !== "Zero";
}

/** Pos. 1 vs pos. 12 — ambos os factores cor e altura opostos. */
export function isDoisFatoresPlusGatilhoArmed(historyNewestFirst: readonly number[]): boolean {
  if (historyNewestFirst.length < DOIS_FATORES_PLUS_MIN_HISTORY) return false;
  const n1 = historyNewestFirst[DOIS_FATORES_PLUS_POS_1_INDEX]!;
  const n12 = historyNewestFirst[DOIS_FATORES_PLUS_POS_12_INDEX]!;
  if (!isValidCompareNumber(n1) || !isValidCompareNumber(n12)) return false;
  return colorOf(n1) !== colorOf(n12) && heightOf(n1) !== heightOf(n12);
}

function corAlturaFactorsFromNumber(n: number): readonly [DoisFatoresFactor, DoisFatoresFactor] | null {
  if (!isValidCompareNumber(n)) return null;
  const col = colorOf(n);
  const alt = heightOf(n);
  if (col === "Zero" || alt === "Zero") return null;
  return [
    { kind: "cor", value: col },
    { kind: "altura", value: alt },
  ] as const;
}

/** Zero na pos. de indicação (pos. 11) — sala rotativa troca de mesa. */
export function isZeroAtDoisFatoresPlusIndicationPosition(
  historyNewestFirst: readonly number[],
): boolean {
  if (historyNewestFirst.length <= DOIS_FATORES_PLUS_POS_11_INDEX) return false;
  return historyNewestFirst[DOIS_FATORES_PLUS_POS_11_INDEX] === 0;
}

function buildDoisFatoresPlusIndicationFromPos11(
  historyNewestFirst: readonly number[],
): DoisFatoresActive | null {
  if (historyNewestFirst.length < DOIS_FATORES_PLUS_MIN_HISTORY) return null;
  if (isZeroAtDoisFatoresPlusIndicationPosition(historyNewestFirst)) return null;
  const n1 = historyNewestFirst[DOIS_FATORES_PLUS_POS_1_INDEX]!;
  const n11 = historyNewestFirst[DOIS_FATORES_PLUS_POS_11_INDEX]!;
  const n12 = historyNewestFirst[DOIS_FATORES_PLUS_POS_12_INDEX]!;
  const factors = corAlturaFactorsFromNumber(n11);
  if (!factors) return null;
  const [factor1, factor2] = factors;
  return {
    pairKind: "cor-altura",
    pairKindLabel: "Cor · Altura",
    patternMode: "divergence",
    patternStats: { convergence: 0, divergence: 1, alternation: 0, safetyMode: false },
    referenceNumber: n11,
    factor1,
    factor2,
    triggerNumbers: [n1, n12] as const,
    armingDescription: "",
  };
}

/** Indicação da rodada — cor/altura do número actual na pos. 11 (sem exigir gatilho). */
export function buildDoisFatoresPlusRoundIndication(
  historyNewestFirst: readonly number[],
): DoisFatoresActive | null {
  return buildDoisFatoresPlusIndicationFromPos11(historyNewestFirst);
}

export function buildDoisFatoresPlusActive(
  historyNewestFirst: readonly number[],
): DoisFatoresActive | null {
  if (!isDoisFatoresPlusGatilhoArmed(historyNewestFirst)) return null;
  return buildDoisFatoresPlusIndicationFromPos11(historyNewestFirst);
}

export function doisFatoresPlusLiveSnapshotFromHistory(
  historyNewestFirst: readonly number[],
): DoisFatoresPlusLiveSnapshot {
  const gatilhoArmed = isDoisFatoresPlusGatilhoArmed(historyNewestFirst);
  return {
    gatilhoArmed,
    active: buildDoisFatoresPlusActive(historyNewestFirst),
  };
}

export { evaluateDoisFatoresRound as evaluateDoisFatoresPlusRound };

type ChronologicalRun = {
  outcomes: ("W" | "L")[];
  recoveryAfterRound: number[];
  recoveryAtOutcome: number[];
  winsAtRecovery: number[];
  lossesAtRecovery: number[];
  currentRecovery: number;
  active: DoisFatoresActive | null;
};

function runDoisFatoresPlusChronological(chronological: readonly number[]): ChronologicalRun {
  const outcomes: ("W" | "L")[] = [];
  const recoveryAfterRound: number[] = [];
  const recoveryAtOutcome: number[] = [];
  const winsAtRecovery = emptyRecoveryLevelCounts(DOIS_FATORES_PLUS_MAX_RECOVERY);
  const lossesAtRecovery = emptyRecoveryLevelCounts(DOIS_FATORES_PLUS_MAX_RECOVERY);
  let recovery = 0;
  let cycleActive: DoisFatoresActive | null = null;

  for (let k = 0; k < chronological.length; k++) {
    const hnf = chronological.slice(0, k + 1).reverse();
    if (!cycleActive && isDoisFatoresPlusGatilhoArmed(hnf)) {
      cycleActive = buildDoisFatoresPlusActive(hnf);
    }
    if (!cycleActive) continue;

    const r = evaluateDoisFatoresRound(chronological[k]!, cycleActive);
    if (r === "W") {
      const idx = Math.min(recovery, DOIS_FATORES_PLUS_MAX_RECOVERY);
      winsAtRecovery[idx]! += 1;
      outcomes.push("W");
      recoveryAtOutcome.push(recovery);
      recoveryAfterRound.push(recovery);
      recovery = 0;
      cycleActive = null;
    } else if (r === "L") {
      const recoveryBefore = recovery;
      const idx = Math.min(recoveryBefore, DOIS_FATORES_PLUS_MAX_RECOVERY);
      lossesAtRecovery[idx]! += 1;
      recovery += 1;
      if (recovery > DOIS_FATORES_PLUS_MAX_RECOVERY) {
        outcomes.push("L");
        recoveryAtOutcome.push(recoveryBefore);
        recovery = 0;
        recoveryAfterRound.push(0);
        cycleActive = null;
      } else {
        recoveryAfterRound.push(recovery);
        cycleActive = buildDoisFatoresPlusIndicationFromPos11(hnf) ?? cycleActive;
      }
    } else {
      cycleActive = buildDoisFatoresPlusIndicationFromPos11(hnf) ?? cycleActive;
    }
  }

  let active: DoisFatoresActive | null = cycleActive;
  if (!active && chronological.length >= DOIS_FATORES_PLUS_MIN_HISTORY) {
    const hnf = [...chronological].reverse();
    active = buildDoisFatoresPlusActive(hnf);
  } else if (active && chronological.length >= DOIS_FATORES_PLUS_MIN_HISTORY) {
    const hnf = [...chronological].reverse();
    active = buildDoisFatoresPlusIndicationFromPos11(hnf) ?? active;
  }

  return {
    outcomes,
    recoveryAfterRound,
    recoveryAtOutcome,
    winsAtRecovery,
    lossesAtRecovery,
    currentRecovery: recovery,
    active,
  };
}

export function simulateDoisFatoresPlusPlacar(
  historyNewestFirst: readonly number[],
): DoisFatoresPlacarSimulation {
  if (historyNewestFirst.length < 2) {
    return { outcomes: [], recoveryAfterRound: [], currentRecovery: 0 };
  }
  const run = runDoisFatoresPlusChronological([...historyNewestFirst].reverse());
  return {
    outcomes: run.outcomes,
    recoveryAfterRound: run.recoveryAfterRound,
    currentRecovery: run.currentRecovery,
  };
}

export function doisFatoresPlusPlacarOutcomes(historyNewestFirst: readonly number[]): ("W" | "L")[] {
  return simulateDoisFatoresPlusPlacar(historyNewestFirst).outcomes;
}

export function doisFatoresPlusAproveitamentoPctFromHistory(historyNewestFirst: readonly number[]): number {
  const outcomes = doisFatoresPlusPlacarOutcomes(historyNewestFirst);
  if (outcomes.length === 0) return 0;
  return (100 * outcomes.filter((x) => x === "W").length) / outcomes.length;
}
export type DoisFatoresPlusEntryWinBreakdown = EntryWinBreakdown;

export function doisFatoresPlusEntryWinBreakdownFromHistory(
  historyNewestFirst: readonly number[],
  maxRecovery: number = DOIS_FATORES_PLUS_MAX_RECOVERY,
): DoisFatoresPlusEntryWinBreakdown {
  if (historyNewestFirst.length < 2) {
    return entryWinBreakdownFromRecoveryCounts(
      emptyRecoveryLevelCounts(maxRecovery),
      emptyRecoveryLevelCounts(maxRecovery),
      0,
      0,
    );
  }

  const run = runDoisFatoresPlusChronological([...historyNewestFirst].reverse());
  const wins = run.outcomes.filter((x) => x === "W").length;
  const losses = run.outcomes.filter((x) => x === "L").length;
  return entryWinBreakdownFromRecoveryCounts(
    run.winsAtRecovery,
    run.lossesAtRecovery,
    wins,
    losses,
  );
}

export function doisFatoresPlusPlacarEvolutionSeries(
  historyNewestFirst: readonly number[],
): StreetPlacarEvolutionSeries | null {
  const outcomes = doisFatoresPlusPlacarOutcomes(historyNewestFirst);
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
    const d = w + l;
    aproveitamentoPct.push(d > 0 ? (100 * w) / d : 0);
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

export function doisFatoresPlusCellRoleForIndex(
  index: number,
): "compare" | "base" | undefined {
  if (index === DOIS_FATORES_PLUS_POS_1_INDEX || index === DOIS_FATORES_PLUS_POS_12_INDEX) {
    return "compare";
  }
  if (index === DOIS_FATORES_PLUS_POS_11_INDEX) return "base";
  return undefined;
}
