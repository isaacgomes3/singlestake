import { streetStrategyPlacarOutcomesByExcludedStreets } from "@/lib/roulette/streetStrategy";

/**
 * Opções da estratégia Ruas 20% (espelho / lobby «30%»). Alinhado com a rota `/ruas`.
 * Transversais com ficha contam como empate no placar (`D`), não como vitória.
 */
export const RUAS_20_PCT_STREET_OPTS = {
  exclusionStreetCount: 2 as const,
  mirrorHeightIndication: true,
  placarBetStreetsAsDraws: true,
} as const;

/** Aproveitamento % do placar Ruas 20% (W / (W+L); empates não entram). */
export function ruas20AproveitamentoPctFromHistory(history: readonly number[]): number {
  const outcomes = streetStrategyPlacarOutcomesByExcludedStreets(
    [...history],
    RUAS_20_PCT_STREET_OPTS,
  );
  let wins = 0;
  let losses = 0;
  for (const x of outcomes) {
    if (x === "W") wins += 1;
    else if (x === "L") losses += 1;
  }
  const total = wins + losses;
  return total > 0 ? (wins / total) * 100 : 0;
}
