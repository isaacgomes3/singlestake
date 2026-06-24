import type { FootballBlitzTableVariant } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import type { FootballBlitzRoundStored } from "@/lib/pragmatic/dgaFootballBlitzHistory";
import {
  evaluateSuperTrunfoAlert,
  settleSuperTrunfoSpreadEntry,
  SUPER_TRUNFO_GRID_MIN_ROUNDS,
} from "@/lib/pragmatic/superTrunfoAlert";
import type { StreetPlacarEvolutionSeries } from "@/lib/roulette/streetStrategy";

export type SuperTrunfoPlacarOutcome = "W" | "L";

export type SuperTrunfoPlacarReplayEntry = {
  roundGameId: string;
  /** Ausente em liquidações neutras (proteção vence). */
  outcome?: SuperTrunfoPlacarOutcome;
};

export type SuperTrunfoPlacarSimulation = {
  wins: number;
  losses: number;
  outcomes: SuperTrunfoPlacarOutcome[];
  entries: SuperTrunfoPlacarReplayEntry[];
};

function shouldCountSettlementRound(
  chronoIndex: number,
  chronological: readonly FootballBlitzRoundStored[],
  baselineHeadGameId: string | null,
): boolean {
  if (!baselineHeadGameId) return true;
  const baseIdx = chronological.findIndex((r) => r.gameId === baselineHeadGameId);
  if (baseIdx < 0) return true;
  return chronoIndex > baseIdx;
}

/**
 * Replay do placar — só liquida quando há indicação no prefixo antes da ronda.
 * Proteção vence → neutro (não incrementa W nem L).
 */
export function simulateSuperTrunfoPlacar(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  variant: FootballBlitzTableVariant = "super-trunfo",
  opts?: { baselineHeadGameId?: string | null },
): SuperTrunfoPlacarSimulation {
  const baselineHeadGameId = opts?.baselineHeadGameId ?? null;
  const empty: SuperTrunfoPlacarSimulation = {
    wins: 0,
    losses: 0,
    outcomes: [],
    entries: [],
  };

  if (historyNewestFirst.length < SUPER_TRUNFO_GRID_MIN_ROUNDS + 1) {
    return empty;
  }

  const chronological = [...historyNewestFirst].reverse();
  const outcomes: SuperTrunfoPlacarOutcome[] = [];
  const entries: SuperTrunfoPlacarReplayEntry[] = [];

  for (let k = SUPER_TRUNFO_GRID_MIN_ROUNDS; k < chronological.length; k++) {
    if (!shouldCountSettlementRound(k, chronological, baselineHeadGameId)) {
      continue;
    }

    const prefixBeforeRound = chronological.slice(0, k).reverse();
    const alert = evaluateSuperTrunfoAlert(prefixBeforeRound, variant);
    if (alert.type !== "entry") continue;

    const raw = settleSuperTrunfoSpreadEntry(chronological[k]!, alert.bets);
    if (raw === null) {
      entries.push({ roundGameId: chronological[k]!.gameId });
      continue;
    }

    outcomes.push(raw);
    entries.push({ roundGameId: chronological[k]!.gameId, outcome: raw });
  }

  const wins = outcomes.filter((o) => o === "W").length;
  const losses = outcomes.filter((o) => o === "L").length;

  return { wins, losses, outcomes, entries };
}

export function superTrunfoPlacarReplayEntries(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  variant: FootballBlitzTableVariant = "super-trunfo",
  opts?: { baselineHeadGameId?: string | null },
): SuperTrunfoPlacarReplayEntry[] {
  return simulateSuperTrunfoPlacar(historyNewestFirst, variant, opts).entries;
}

export function superTrunfoPlacarOutcomes(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  variant: FootballBlitzTableVariant = "super-trunfo",
): SuperTrunfoPlacarOutcome[] {
  return simulateSuperTrunfoPlacar(historyNewestFirst, variant).outcomes;
}

export function superTrunfoPlacarSummary(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  variant: FootballBlitzTableVariant = "super-trunfo",
): { wins: number; losses: number; aproveitamentoPct: number } {
  const sim = simulateSuperTrunfoPlacar(historyNewestFirst, variant);
  const total = sim.wins + sim.losses;
  return {
    wins: sim.wins,
    losses: sim.losses,
    aproveitamentoPct: total > 0 ? (100 * sim.wins) / total : 0,
  };
}

export function superTrunfoPlacarEvolutionFromOutcomes(
  outcomes: readonly SuperTrunfoPlacarOutcome[],
): StreetPlacarEvolutionSeries | null {
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

export function superTrunfoPlacarEvolutionSeries(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  variant: FootballBlitzTableVariant = "super-trunfo",
): StreetPlacarEvolutionSeries | null {
  return superTrunfoPlacarEvolutionFromOutcomes(
    simulateSuperTrunfoPlacar(historyNewestFirst, variant).outcomes,
  );
}

/** Agrega vitórias/derrotas a partir de entradas persistidas. */
export function superTrunfoPlacarTotalsFromEntries(
  entries: readonly SuperTrunfoPlacarReplayEntry[],
): { wins: number; losses: number; outcomes: SuperTrunfoPlacarOutcome[] } {
  const outcomes: SuperTrunfoPlacarOutcome[] = [];
  for (const e of entries) {
    if (e.outcome === "W" || e.outcome === "L") outcomes.push(e.outcome);
  }
  return {
    wins: outcomes.filter((o) => o === "W").length,
    losses: outcomes.filter((o) => o === "L").length,
    outcomes,
  };
}
