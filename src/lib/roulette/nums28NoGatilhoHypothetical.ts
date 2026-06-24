/**
 * Hipótese de simulação (não é a regra da app): **sem** gatilho de altura 11–12, **sem** continuação em metade,
 * **sem** cruzamento oposto nem confirmação de espelho — só cobertura 1–36 com **dois exclusivos** escolhidos pela
 * mesma janela de frieza que `pickTwoColdestNumbersInPool` em **todo** o tapete 1–36.
 *
 * - **0** → vitória W (não é exclusivo entre 1–36).
 * - Após **W**: recalcular os **dois** mais frios em 1–36 no prefixo até ao giro actual.
 * - Após **L** (saiu num dos dois exclusivos): manter o exclusivo **não** atingido e substituir o atingido pelo
 *   **mais frio** entre os números de 1–36 que **não** estão no par actual (o mesmo critério de frieza; se o pool
 *   tiver menos de 2 elegíveis, `resolveFriezaWindowNums` reduz `recentCap` como na estratégia real).
 */

import {
  pickTwoColdestNumbersInPool,
  type Nums28PctExclusionTieBreak,
} from "@/lib/roulette/nums28PctStrategy";
import { resolveFriezaWindowNums } from "@/lib/roulette/streetStrategy";

const ALL36 = Object.freeze([...Array.from({ length: 36 }, (_, i) => i + 1)]) as readonly number[];

export type Nums28NoGatilhoHypotheticalOptions = {
  exclusionTieBreak?: Nums28PctExclusionTieBreak;
  /**
   * Comprimento mínimo do prefixo cronológico (em giros) antes do primeiro giro avaliado no placar.
   * Omisso = 20 (alinhado à janela inicial de frieza).
   */
  minPrefixBeforeFirstEval?: number;
};

function pickTwoColdestFullTapeteAtChronIdx(
  chronological: readonly number[],
  chronIdx: number,
  tieBreak: Nums28PctExclusionTieBreak,
): readonly [number, number] {
  const histAtNewestFirst = [...chronological.slice(0, chronIdx + 1)].reverse();
  const { windowNums, recentCap } = resolveFriezaWindowNums(chronological, chronIdx, histAtNewestFirst, {
    pool: ALL36,
    minEligible: 2,
    mode: "numbers",
  });
  return pickTwoColdestNumbersInPool(ALL36, windowNums, histAtNewestFirst);
}

/** Mais frio num `pool` já filtrado (ex.: 1–36 menos o par actual), mesma frieza que `pickTwoColdestNumbersInPool`. */
function pickColdestInPoolAtChronIdx(
  pool: readonly number[],
  chronological: readonly number[],
  chronIdx: number,
  tieBreak: Nums28PctExclusionTieBreak,
): number {
  const histAtNewestFirst = [...chronological.slice(0, chronIdx + 1)].reverse();
  const { windowNums, recentCap } = resolveFriezaWindowNums(chronological, chronIdx, histAtNewestFirst, {
    pool,
    minEligible: 2,
    mode: "numbers",
  });
  const [a] = pickTwoColdestNumbersInPool(pool, windowNums, histAtNewestFirst);
  return a;
}

/**
 * Placar W/L da hipótese «sem gatilho + após L substitui só o número atingido pelo mais frio fora do par».
 */
export function nums28HypotheticalNoGatilhoSubstituteOnLossPlacarOutcomes(
  historyNewestFirst: number[],
  options?: Nums28NoGatilhoHypotheticalOptions,
): ("W" | "L")[] {
  const tieBreak = options?.exclusionTieBreak ?? "recency";
  const minPrefix = options?.minPrefixBeforeFirstEval ?? 20;
  const chronological = [...historyNewestFirst].reverse();
  const n = chronological.length;
  if (n <= minPrefix) return [];

  let excluded = pickTwoColdestFullTapeteAtChronIdx(chronological, minPrefix - 1, tieBreak);
  const out: ("W" | "L")[] = [];

  for (let k = minPrefix; k < n; k++) {
    const num = chronological[k]!;
    const isL = num !== 0 && (num === excluded[0] || num === excluded[1]);
    out.push(isL ? "L" : "W");

    if (isL) {
      const other = num === excluded[0] ? excluded[1]! : excluded[0]!;
      const pool = ALL36.filter((x) => x !== num && x !== other);
      const replacement = pickColdestInPoolAtChronIdx(pool, chronological, k, tieBreak);
      const a = Math.min(other, replacement);
      const b = Math.max(other, replacement);
      excluded = [a, b] as const;
    } else {
      excluded = pickTwoColdestFullTapeteAtChronIdx(chronological, k, tieBreak);
    }
  }
  return out;
}

/**
 * Controlo: mesma base (sem gatilho, pool 1–36), mas após **cada** giro recalcula sempre os dois mais frios
 * (não há substituição parcial após L).
 */
export function nums28HypotheticalNoGatilhoAlwaysFreshPairPlacarOutcomes(
  historyNewestFirst: number[],
  options?: Nums28NoGatilhoHypotheticalOptions,
): ("W" | "L")[] {
  const tieBreak = options?.exclusionTieBreak ?? "recency";
  const minPrefix = options?.minPrefixBeforeFirstEval ?? 20;
  const chronological = [...historyNewestFirst].reverse();
  const n = chronological.length;
  if (n <= minPrefix) return [];

  let excluded = pickTwoColdestFullTapeteAtChronIdx(chronological, minPrefix - 1, tieBreak);
  const out: ("W" | "L")[] = [];

  for (let k = minPrefix; k < n; k++) {
    const num = chronological[k]!;
    const isL = num !== 0 && (num === excluded[0] || num === excluded[1]);
    out.push(isL ? "L" : "W");
    excluded = pickTwoColdestFullTapeteAtChronIdx(chronological, k, tieBreak);
  }
  return out;
}
