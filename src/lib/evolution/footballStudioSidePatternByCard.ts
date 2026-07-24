/**
 * Padrão de lado por carta — Football Studio (Top Card / Dinhutech).
 * Mesma lógica do Blitz: após a carta aparecer, a ronda seguinte manteve ou
 * mudou o lado vencedor. Alerta quando as duas cartas do encontro são ambas
 * 100% manter ou ambas 100% mudar.
 */

import type { TopCardRound, TopCardSide } from "@/lib/evolution/topCardEvoParser";

export type FootballStudioSidePatternCardStat = {
  card: number;
  rank: string;
  label: string;
  hits: number;
  samples: number;
  rate: number;
};

export type FootballStudioSidePatternAnalysis = {
  maintainSide: FootballStudioSidePatternCardStat[];
  changeSide: FootballStudioSidePatternCardStat[];
  transitions: number;
};

export type FootballStudioSidePatternAlert = {
  triggerGameId: string;
  triggerWinner: "home" | "away";
  homeRank: string;
  homeLabel: string;
  awayRank: string;
  awayLabel: string;
  homeSamples: number;
  awaySamples: number;
  mode: "maintain" | "change";
  indication: "home" | "away";
};

const RANK_VALUE: Record<string, number> = {
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

function normalizeRank(rank: string | null | undefined): string | null {
  const value = String(rank ?? "")
    .trim()
    .toUpperCase();
  if (!value) return null;
  if (value === "T") return "10";
  if (value in RANK_VALUE) return value;
  return null;
}

function rankToCard(rank: string): number {
  return RANK_VALUE[normalizeRank(rank) ?? ""] ?? 0;
}

function isColored(winner: TopCardSide | null | undefined): winner is "home" | "away" {
  return winner === "home" || winner === "away";
}

function resolveWinner(round: TopCardRound): TopCardSide | null {
  if (isColored(round.winner) || round.winner === "draw") return round.winner;
  const homeScore = Number(round.homeScore ?? round.home?.score);
  const awayScore = Number(round.awayScore ?? round.away?.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  if (homeScore === awayScore) return "draw";
  return null;
}

function roundRanks(round: TopCardRound): { home: string; away: string } | null {
  const home = normalizeRank(round.home?.rank);
  const away = normalizeRank(round.away?.rank);
  if (!home || !away) return null;
  return { home, away };
}

function collectMaps(historyNewestFirst: readonly TopCardRound[]): {
  maintain: Map<string, { hits: number; samples: number }>;
  change: Map<string, { hits: number; samples: number }>;
  transitions: number;
} {
  const maintain = new Map<string, { hits: number; samples: number }>();
  const change = new Map<string, { hits: number; samples: number }>();
  let transitions = 0;

  const bump = (
    map: Map<string, { hits: number; samples: number }>,
    rank: string,
    hit: boolean,
  ) => {
    const cur = map.get(rank) ?? { hits: 0, samples: 0 };
    cur.samples += 1;
    if (hit) cur.hits += 1;
    map.set(rank, cur);
  };

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const round = historyNewestFirst[index];
    const next = historyNewestFirst[index - 1];
    if (!round || !next) continue;
    const winner = resolveWinner(round);
    const nextWinner = resolveWinner(next);
    if (!isColored(winner) || !isColored(nextWinner)) continue;
    const ranks = roundRanks(round);
    if (!ranks) continue;

    const kept = nextWinner === winner;
    transitions += 1;
    for (const rank of [ranks.home, ranks.away]) {
      bump(maintain, rank, kept);
      bump(change, rank, !kept);
    }
  }

  return { maintain, change, transitions };
}

function perfectRanks(
  map: Map<string, { hits: number; samples: number }>,
  minSamples: number,
): Map<string, { hits: number; samples: number }> {
  const out = new Map<string, { hits: number; samples: number }>();
  for (const [rank, stat] of map) {
    if (stat.samples >= minSamples && stat.hits === stat.samples) out.set(rank, stat);
  }
  return out;
}

function formatMap(
  map: Map<string, { hits: number; samples: number }>,
  topN: number,
  minSamples: number,
): FootballStudioSidePatternCardStat[] {
  return [...map.entries()]
    .map(([rank, stat]) => ({
      card: rankToCard(rank),
      rank,
      label: rank,
      hits: stat.hits,
      samples: stat.samples,
      rate: Math.round((stat.hits / stat.samples) * 1000) / 10,
    }))
    .filter((row) => row.samples >= minSamples && row.card > 0)
    .sort((a, b) => b.rate - a.rate || b.samples - a.samples || a.card - b.card)
    .slice(0, topN);
}

export function analyzeFootballStudioSidePatternByCard(
  historyNewestFirst: readonly TopCardRound[],
  options?: { top?: number; minSamples?: number },
): FootballStudioSidePatternAnalysis {
  const topN = Math.max(1, Math.floor(Number(options?.top) || 6));
  const minSamples = Math.max(1, Math.floor(Number(options?.minSamples) || 1));
  const { maintain, change, transitions } = collectMaps(historyNewestFirst);
  return {
    maintainSide: formatMap(maintain, topN, minSamples),
    changeSide: formatMap(change, topN, minSamples),
    transitions,
  };
}

/**
 * Alerta quando a última ronda colorida junta duas cartas com o mesmo padrão
 * a 100% (ambas mantêm ou ambas mudam).
 */
export function findFootballStudioSidePatternAlert(
  historyNewestFirst: readonly TopCardRound[],
  options?: { minSamples?: number },
): FootballStudioSidePatternAlert | null {
  const minSamples = Math.max(1, Math.floor(Number(options?.minSamples) || 2));
  const trigger = historyNewestFirst[0];
  if (!trigger) return null;
  const triggerWinner = resolveWinner(trigger);
  if (!isColored(triggerWinner)) return null;
  const ranks = roundRanks(trigger);
  if (!ranks || ranks.home === ranks.away) return null;

  const { maintain, change } = collectMaps(historyNewestFirst);
  const perfectMaintain = perfectRanks(maintain, minSamples);
  const perfectChange = perfectRanks(change, minSamples);

  const homeMaintain = perfectMaintain.get(ranks.home);
  const awayMaintain = perfectMaintain.get(ranks.away);
  const homeChange = perfectChange.get(ranks.home);
  const awayChange = perfectChange.get(ranks.away);

  let mode: "maintain" | "change";
  let homeSamples: number;
  let awaySamples: number;

  if (homeMaintain && awayMaintain) {
    mode = "maintain";
    homeSamples = homeMaintain.samples;
    awaySamples = awayMaintain.samples;
  } else if (homeChange && awayChange) {
    mode = "change";
    homeSamples = homeChange.samples;
    awaySamples = awayChange.samples;
  } else {
    return null;
  }

  const opposite: "home" | "away" = triggerWinner === "home" ? "away" : "home";
  return {
    triggerGameId: trigger.gameId,
    triggerWinner,
    homeRank: ranks.home,
    homeLabel: ranks.home,
    awayRank: ranks.away,
    awayLabel: ranks.away,
    homeSamples,
    awaySamples,
    mode,
    indication: mode === "maintain" ? triggerWinner : opposite,
  };
}

export function footballStudioRoundHasAce(round: TopCardRound): boolean {
  return normalizeRank(round.home?.rank) === "A" || normalizeRank(round.away?.rank) === "A";
}

export type FootballStudioEncounterNeighbor = {
  gameId: string;
  winner: TopCardSide;
  homeLabel: string;
  awayLabel: string;
  pairLabel: string;
};

export type FootballStudioEncounterCoincidence = {
  /** Índice no histórico newest-first. */
  index: number;
  match: FootballStudioEncounterNeighbor;
  /** Vizinho à esquerda (mais recente que o match). */
  left: FootballStudioEncounterNeighbor | null;
  /** Vizinho à direita (mais antigo que o match). */
  right: FootballStudioEncounterNeighbor | null;
};

export type FootballStudioEncounterCoincidenceAnalysis = {
  trigger: FootballStudioEncounterNeighbor | null;
  coincidences: FootballStudioEncounterCoincidence[];
  /** Quantas ocorrências anteriores exactas existem (mesmo par + cor). */
  totalMatches: number;
};

function toNeighbor(round: TopCardRound | undefined): FootballStudioEncounterNeighbor | null {
  if (!round?.gameId) return null;
  const winner = resolveWinner(round);
  if (!winner) return null;
  const ranks = roundRanks(round);
  const homeLabel = ranks?.home ?? round.home?.label ?? "?";
  const awayLabel = ranks?.away ?? round.away?.label ?? "?";
  return {
    gameId: String(round.gameId),
    winner,
    homeLabel,
    awayLabel,
    pairLabel: `${homeLabel}/${awayLabel}`,
  };
}

function sameEncounter(a: TopCardRound, b: TopCardRound): boolean {
  const wa = resolveWinner(a);
  const wb = resolveWinner(b);
  if (!wa || !wb || wa !== wb) return false;
  const ra = roundRanks(a);
  const rb = roundRanks(b);
  if (!ra || !rb) return false;
  return ra.home === rb.home && ra.away === rb.away;
}

/**
 * Para o último encontro (cartas + cor), devolve as N coincidências anteriores
 * mais recentes com vizinhos à esquerda e à direita no histórico.
 */
export function findFootballStudioEncounterCoincidences(
  historyNewestFirst: readonly TopCardRound[],
  options?: { limit?: number },
): FootballStudioEncounterCoincidenceAnalysis {
  const limit = Math.max(1, Math.floor(Number(options?.limit) || 2));
  const newest = historyNewestFirst[0];
  const trigger = toNeighbor(newest);
  if (!newest || !trigger) {
    return { trigger: null, coincidences: [], totalMatches: 0 };
  }

  const coincidences: FootballStudioEncounterCoincidence[] = [];
  let totalMatches = 0;

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const matchRound = historyNewestFirst[index];
    if (!matchRound || !sameEncounter(matchRound, newest)) continue;
    totalMatches += 1;
    if (coincidences.length >= limit) continue;

    const match = toNeighbor(matchRound);
    if (!match) continue;
    coincidences.push({
      index,
      match,
      left: toNeighbor(historyNewestFirst[index - 1]),
      right: toNeighbor(historyNewestFirst[index + 1]),
    });
  }

  return { trigger, coincidences, totalMatches };
}

