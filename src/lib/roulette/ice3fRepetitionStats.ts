/**
 * Estatística de **repetição** (mesmo número em giros consecutivos) — mesa 201.
 *
 * Para cada número 0–36, as três últimas vezes em que ele saiu em sequência
 * (ex. …, X, N, N) e o número à **esquerda** do início dessa repetição
 * (`history[i-1]` no buffer newest-first).
 */

import {
  ICE3F_OCCURRENCE_MAX_PER_NUMBER,
  ICE3F_OCCURRENCE_NUMBERS,
  ICE3F_OCCURRENCE_TABLE_ID,
  emptyIce3fOccurrenceStats,
  type Ice3fNumberOccurrence,
  type Ice3fOccurrenceStats,
} from "@/lib/roulette/ice3fOccurrenceStats";

export {
  ICE3F_OCCURRENCE_TABLE_ID as ICE3F_REPETITION_TABLE_ID,
  ICE3F_OCCURRENCE_MAX_PER_NUMBER as ICE3F_REPETITION_MAX_PER_NUMBER,
};

export type Ice3fRepetitionStats = Ice3fOccurrenceStats;

export function emptyIce3fRepetitionStats(
  tableId: number = ICE3F_OCCURRENCE_TABLE_ID,
): Ice3fRepetitionStats {
  return emptyIce3fOccurrenceStats(tableId);
}

/**
 * Detecta o início de cada streak consecutivo (newest-first):
 * `history[i] === history[i+1]` e (i === 0 ou history[i-1] !== history[i]).
 * Esquerda = `history[i-1]` (vizinho mais recente que a repetição).
 */
export function buildIce3fRepetitionStats(
  historyNewestFirst: readonly number[],
  options?: { tableId?: number; maxPerNumber?: number },
): Ice3fRepetitionStats {
  const tableId = options?.tableId ?? ICE3F_OCCURRENCE_TABLE_ID;
  const maxPerNumber = Math.max(
    1,
    Math.floor(options?.maxPerNumber ?? ICE3F_OCCURRENCE_MAX_PER_NUMBER),
  );
  const history = historyNewestFirst.filter((n) => Number.isFinite(n));
  const buckets = new Map<number, Ice3fNumberOccurrence[]>();

  for (let i = 0; i < history.length - 1; i++) {
    const number = history[i]!;
    if (number < 0 || number > 36) continue;
    if (history[i + 1] !== number) continue;
    // Só o início do bloco consecutivo (evita contar 5,5,5 três vezes).
    if (i > 0 && history[i - 1] === number) continue;

    const list = buckets.get(number) ?? [];
    if (list.length >= maxPerNumber) continue;

    const left = i > 0 ? history[i - 1]! : null;
    list.push({
      index: i,
      position: i + 1,
      precededBy: left != null && Number.isFinite(left) ? left : null,
    });
    buckets.set(number, list);
  }

  return {
    tableId,
    historyLength: history.length,
    rows: ICE3F_OCCURRENCE_NUMBERS.map((number) => ({
      number,
      occurrences: buckets.get(number) ?? [],
    })),
  };
}
