import { streetStrategyPlacarOutcomesByExcludedStreets } from "@/lib/roulette/streetStrategy";
import { RUAS_9_PCT_CRITICAL_HEIGHT_GRID_INDICES } from "@/lib/roulette/criticalHeightGatilho";
import { ruas9PctAutoCriticalBundle } from "@/lib/roulette/ruas9PctAutoCritical";

/**
 * Opções da estratégia Ruas 9% (espelho). Mantém-se alinhado com a rota `/ruas-10pct`.
 *
 * Gatilho na grelha **11×2**: compara **pos. 1 e 12** (metade); **pos. 11** é a base.
 * Mesmo grupo nas críticas → metade alvo igual à pos. 11; grupos diferentes → metade oposta.
 * Ver `evaluateRuas9NeighborGatilho` em `ruas9PctNeighborGatilho.ts`.
 */
export const RUAS_9_PCT_STREET_OPTS = {
  exclusionStreetCount: 1 as const,
  mirrorHeightIndication: true,
  criticalHeightGridIndices: RUAS_9_PCT_CRITICAL_HEIGHT_GRID_INDICES,
  ruas9NeighborGatilho: true,
} as const;

/** Aproveitamento % do placar Ruas 9% sobre o histórico espelho (mais recente primeiro). */
export function ruas9AproveitamentoPctFromHistory(history: readonly number[], stickyKey?: string): number {
  const opts = stickyKey
    ? ruas9PctAutoCriticalBundle(history, stickyKey).opts
    : RUAS_9_PCT_STREET_OPTS;
  const outcomes = streetStrategyPlacarOutcomesByExcludedStreets([...history], opts);
  let wins = 0;
  let losses = 0;
  for (const x of outcomes) {
    if (x === "W") wins += 1;
    else if (x === "L") losses += 1;
  }
  const total = wins + losses;
  return total > 0 ? (wins / total) * 100 : 0;
}
