/**
 * Gatilho Ruas 9% — grelha **11×2** (newest-first, leitura em linhas).
 *
 * - **Comparação:** pos. **1** e **12** (índices 0 e 11) — metade Baixo 1–18 vs Alto 19–36.
 * - **Base:** pos. **11** (índice 10) — grupo de referência.
 * - Pos. 1 e 12 **mesmo grupo** → metade alvo = **igual** à pos. 11.
 * - Pos. 1 e 12 **grupos diferentes** → metade alvo = **oposta** à pos. 11.
 * - **0** em pos. 1 ou 12 → sem indicação.
 * - Exclusão de ruas e continuação seguem o pipeline `mirrorHeightIndication` com a `zone` resultante.
 */

import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";

import type { CriticalGatilhoArm, ZoneIndicationFromHeight } from "@/lib/roulette/criticalHeightGatilho";

/** Pos. 1 — comparação (col. 1, linha 1). */
export const RUAS_9_GRID_POS_COMPARE_1 = 1 as const;
/** Pos. 11 — base da indicação (col. 11, linha 1). */
export const RUAS_9_GRID_POS_BASE_11 = 11 as const;
/** Pos. 12 — comparação (col. 1, linha 2). */
export const RUAS_9_GRID_POS_COMPARE_12 = 12 as const;

export const RUAS_9_GRID_COMPARE_INDEX_1 = RUAS_9_GRID_POS_COMPARE_1 - 1;
export const RUAS_9_GRID_BASE_INDEX_11 = RUAS_9_GRID_POS_BASE_11 - 1;
export const RUAS_9_GRID_COMPARE_INDEX_12 = RUAS_9_GRID_POS_COMPARE_12 - 1;

export const RUAS_9_GRID_MIN_HISTORY = RUAS_9_GRID_POS_COMPARE_12;

function heightToZone(h: "Baixo" | "Alto"): ZoneIndicationFromHeight {
  return h === "Baixo" ? "1-18" : "19-36";
}

function oppositeHeightZone(h: "Baixo" | "Alto"): ZoneIndicationFromHeight {
  return h === "Baixo" ? "19-36" : "1-18";
}

export type Ruas9NeighborGatilhoArm = CriticalGatilhoArm & {
  pos1: number;
  pos11: number;
  pos12: number;
  /** Pos. 1 e 12 na mesma metade. */
  sameComparisonGroup: boolean;
};

export function evaluateRuas9NeighborGatilho(
  historyNewestFirst: readonly number[],
): Ruas9NeighborGatilhoArm | null {
  if (historyNewestFirst.length < RUAS_9_GRID_MIN_HISTORY) return null;

  const pos1 = historyNewestFirst[RUAS_9_GRID_COMPARE_INDEX_1];
  const pos11 = historyNewestFirst[RUAS_9_GRID_BASE_INDEX_11];
  const pos12 = historyNewestFirst[RUAS_9_GRID_COMPARE_INDEX_12];

  if (pos1 === undefined || pos11 === undefined || pos12 === undefined) return null;
  if (pos1 === 0 || pos12 === 0) return null;

  const h1 = heightOf(pos1);
  const h11 = heightOf(pos11);
  const h12 = heightOf(pos12);

  if (h1 === "Zero" || h12 === "Zero" || h11 === "Zero") return null;

  const sameComparisonGroup = h1 === h12;
  const zone: ZoneIndicationFromHeight = sameComparisonGroup
    ? heightToZone(h11)
    : oppositeHeightZone(h11);

  const dominantColor: "Vermelho" | "Preto" =
    colorOf(pos11) === "Vermelho" ? "Vermelho" : "Preto";
  const dominantParity: "Par" | "Impar" = parityOf(pos11) === "Par" ? "Par" : "Impar";
  const indicationLabel = zone === "1-18" ? "BAIXO (1–18)" : "ALTO (19–36)";

  return {
    n11: pos1,
    n22: pos12,
    tripleChrono: [pos12, pos11, pos1] as const,
    zone,
    dominantColor,
    dominantParity,
    indicationLabel,
    criticalTriggerKind: "pair",
    pos1,
    pos11,
    pos12,
    sameComparisonGroup,
  };
}

/** Continuação: o gatilho ainda activo e a mesma metade alvo. */
export function ruas9NeighborSupportsZone(
  historyNewestFirst: readonly number[],
  zone: ZoneIndicationFromHeight,
): boolean {
  const g = evaluateRuas9NeighborGatilho(historyNewestFirst);
  return g !== null && g.zone === zone;
}
