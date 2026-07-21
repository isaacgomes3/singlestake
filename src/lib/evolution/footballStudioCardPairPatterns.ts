/**
 * Confrontos carta-a-carta no Football Studio (Top Card / Evolution).
 * Mesma lógica do Blitz Eco: para cada encontro (foco vs oponente), mede se o
 * lado da carta foco venceu ou perdeu a rodada seguinte. O painel 100% só
 * mostra pares com taxa 100% e ≥ minSamples.
 *
 * Empates e rodadas sem cartas são ignorados. O naipe não entra na chave —
 * compara-se só o rank (A, 2–10, J, Q, K).
 */

import type { TopCardParsedCard, TopCardRound, TopCardSide } from "./topCardEvoParser";

export type FootballStudioCardPairPatternStat = {
  focusRank: string;
  focusLabel: string;
  opponentRank: string;
  opponentLabel: string;
  hits: number;
  samples: number;
  rate: number;
  nextOutcome: "wins" | "loses";
};

export type FootballStudioCardPairPatternAnalysis = {
  perfectWinsNext: FootballStudioCardPairPatternStat[];
  perfectLosesNext: FootballStudioCardPairPatternStat[];
  transitions: number;
  pairsTracked: number;
  roundsWithCards: number;
};

export type FootballStudioCardPairPatternOptions = {
  minSamples?: number;
};

const RANK_SORT: Record<string, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

function normalizeRank(rank: string): string {
  const value = String(rank ?? "")
    .trim()
    .toUpperCase();
  if (value === "T") return "10";
  return value;
}

function rankSortValue(rank: string): number {
  return RANK_SORT[normalizeRank(rank)] ?? 99;
}

function isColoredWinner(winner: TopCardSide | null | undefined): winner is "home" | "away" {
  return winner === "home" || winner === "away";
}

function resolveWinner(round: TopCardRound): TopCardSide | null {
  if (isColoredWinner(round.winner) || round.winner === "draw") return round.winner;
  const homeScore = Number(round.homeScore ?? round.home?.score);
  const awayScore = Number(round.awayScore ?? round.away?.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  if (homeScore === awayScore) return "draw";
  return null;
}

function extractRanks(
  round: TopCardRound,
): { winningRank: string; losingRank: string; winner: "home" | "away" } | null {
  const winner = resolveWinner(round);
  if (!isColoredWinner(winner)) return null;
  const home = round.home;
  const away = round.away;
  if (!home?.rank || !away?.rank) return null;
  const winningCard: TopCardParsedCard = winner === "home" ? home : away;
  const losingCard: TopCardParsedCard = winner === "home" ? away : home;
  const winningRank = normalizeRank(winningCard.rank);
  const losingRank = normalizeRank(losingCard.rank);
  if (!winningRank || !losingRank || winningRank === losingRank) return null;
  return { winningRank, losingRank, winner };
}

/**
 * Histórico newest-first com cartas (WS Evolution).
 */
export function analyzeFootballStudioCardPairPatterns(
  historyNewestFirst: readonly TopCardRound[],
  options: FootballStudioCardPairPatternOptions = {},
): FootballStudioCardPairPatternAnalysis {
  const minSamples = Math.max(1, Math.floor(options.minSamples ?? 2));
  const winsNext = new Map<
    string,
    { hits: number; samples: number; focus: string; opp: string }
  >();
  let transitions = 0;
  let roundsWithCards = 0;

  const add = (focus: string, opp: string, focusWonNext: boolean) => {
    const key = `${focus}:${opp}`;
    const current = winsNext.get(key) ?? { hits: 0, samples: 0, focus, opp };
    current.samples += 1;
    if (focusWonNext) current.hits += 1;
    winsNext.set(key, current);
  };

  for (const round of historyNewestFirst) {
    if (round.home?.rank && round.away?.rank && isColoredWinner(resolveWinner(round))) {
      roundsWithCards += 1;
    }
  }

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const round = historyNewestFirst[index];
    const next = historyNewestFirst[index - 1];
    if (!round || !next) continue;
    const cards = extractRanks(round);
    const nextWinner = resolveWinner(next);
    if (!cards || !isColoredWinner(nextWinner)) continue;

    const losingSide: "home" | "away" = cards.winner === "home" ? "away" : "home";
    add(cards.winningRank, cards.losingRank, nextWinner === cards.winner);
    add(cards.losingRank, cards.winningRank, nextWinner === losingSide);
    transitions += 1;
  }

  const perfectWinsNext: FootballStudioCardPairPatternStat[] = [];
  const perfectLosesNext: FootballStudioCardPairPatternStat[] = [];

  for (const stat of winsNext.values()) {
    if (stat.samples < minSamples) continue;
    const winRate = Math.round((stat.hits / stat.samples) * 1000) / 10;
    const loseHits = stat.samples - stat.hits;
    const loseRate = Math.round((loseHits / stat.samples) * 1000) / 10;
    const base = {
      focusRank: stat.focus,
      focusLabel: stat.focus,
      opponentRank: stat.opp,
      opponentLabel: stat.opp,
      samples: stat.samples,
    };
    if (winRate === 100) {
      perfectWinsNext.push({
        ...base,
        hits: stat.hits,
        rate: winRate,
        nextOutcome: "wins",
      });
    }
    if (loseRate === 100) {
      perfectLosesNext.push({
        ...base,
        hits: loseHits,
        rate: loseRate,
        nextOutcome: "loses",
      });
    }
  }

  const bySamples = (
    a: FootballStudioCardPairPatternStat,
    b: FootballStudioCardPairPatternStat,
  ) =>
    b.samples - a.samples ||
    rankSortValue(a.focusRank) - rankSortValue(b.focusRank) ||
    rankSortValue(a.opponentRank) - rankSortValue(b.opponentRank);

  perfectWinsNext.sort(bySamples);
  perfectLosesNext.sort(bySamples);

  return {
    perfectWinsNext,
    perfectLosesNext,
    transitions,
    pairsTracked: winsNext.size,
    roundsWithCards,
  };
}
