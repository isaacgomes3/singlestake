/**
 * Eco coincidência Football Studio (cartas):
 * - gatilho = última rodada colorida com cartas;
 * - procura ocorrências anteriores exactas (mesmas ranks Casa/Visitante + mesmo vencedor);
 * - cor à esquerda = vencedor colorido imediatamente à esquerda (salta empates);
 * - padrão 100%: as duas últimas ocorrências com a mesma cor à esquerda → indica.
 */

import type { FootballStudioSide } from "@/lib/evolution/footballStudioSidePatterns";
import type { TopCardParsedCard } from "@/lib/evolution/topCardEvoParser";

export type FootballStudioEcoColor = Exclude<FootballStudioSide, "draw">;

export type FootballStudioEcoRound = {
  gameId: string;
  winner: FootballStudioSide;
  home?: TopCardParsedCard | null;
  away?: TopCardParsedCard | null;
};

export type FootballStudioEcoSignal = {
  signalId: string;
  triggerGameId: string;
  triggerWinner: FootballStudioEcoColor;
  triggerHomeRank: string;
  triggerAwayRank: string;
  indication: FootballStudioEcoColor;
  referenceGameIds: string[];
  referenceIndexes: number[];
};

function normalizeRank(rank: string | null | undefined): string {
  const value = String(rank ?? "")
    .trim()
    .toUpperCase();
  if (value === "T") return "10";
  return value;
}

function isColored(round: FootballStudioEcoRound | undefined): round is FootballStudioEcoRound & {
  winner: FootballStudioEcoColor;
} {
  return round != null && (round.winner === "home" || round.winner === "away");
}

function hasRanks(round: FootballStudioEcoRound | undefined): boolean {
  return Boolean(normalizeRank(round?.home?.rank) && normalizeRank(round?.away?.rank));
}

function sameExactResult(a: FootballStudioEcoRound, b: FootballStudioEcoRound): boolean {
  if (!isColored(a) || !isColored(b)) return false;
  if (!hasRanks(a) || !hasRanks(b)) return false;
  return (
    a.winner === b.winner &&
    normalizeRank(a.home?.rank) === normalizeRank(b.home?.rank) &&
    normalizeRank(a.away?.rank) === normalizeRank(b.away?.rank)
  );
}

/**
 * Histórico newest-first (displayRounds / cardHistory com cartas).
 */
export function findFootballStudioEcoSignal(
  historyNewestFirst: readonly FootballStudioEcoRound[],
): FootballStudioEcoSignal | null {
  const newest = historyNewestFirst[0];
  if (!isColored(newest) || !hasRanks(newest)) return null;

  const occurrences: Array<{
    match: FootballStudioEcoRound & { winner: FootballStudioEcoColor };
    index: number;
    left: FootballStudioEcoColor;
  }> = [];

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const match = historyNewestFirst[index];
    if (!match || !sameExactResult(match, newest) || !isColored(match)) continue;

    let leftIndex = index - 1;
    while (leftIndex >= 1) {
      const left = historyNewestFirst[leftIndex];
      if (!left) break;
      if (isColored(left)) {
        occurrences.push({ match, index, left: left.winner });
        break;
      }
      leftIndex -= 1;
    }
  }

  for (let i = 0; i < occurrences.length - 1; i += 1) {
    const first = occurrences[i];
    const second = occurrences[i + 1];
    if (!first || !second) continue;
    if (first.left !== second.left) continue;
    return {
      signalId: `football-studio-eco:${newest.gameId}`,
      triggerGameId: newest.gameId,
      triggerWinner: newest.winner,
      triggerHomeRank: normalizeRank(newest.home?.rank),
      triggerAwayRank: normalizeRank(newest.away?.rank),
      indication: first.left,
      referenceGameIds: [first.match.gameId, second.match.gameId],
      referenceIndexes: [first.index, second.index],
    };
  }

  return null;
}
