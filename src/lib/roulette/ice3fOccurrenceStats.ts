/**
 * Estatística ICE 3F — para cada número 0–36, as duas últimas ocorrências
 * no histórico (newest-first) e o número à **esquerda** de cada uma
 * (`history[i-1]`), o mesmo vizinho que o eco usa como sinal cor/altura.
 */

/** Mesa Roulette 2 Extra Time — literal para evitar ciclo de init. */
export const ICE3F_OCCURRENCE_TABLE_ID = 201 as const;

export const ICE3F_OCCURRENCE_NUMBERS = Array.from({ length: 37 }, (_, n) => n);

export type Ice3fNumberOccurrence = {
  /** Índice 0-based no histórico newest-first. */
  index: number;
  /** Posição 1-based (1 = giro mais recente). */
  position: number;
  /**
   * Número imediatamente à esquerda desta ocorrência (`history[i-1]`).
   * Null se for o giro mais recente do buffer (não há esquerda).
   */
  precededBy: number | null;
};

export type Ice3fNumberOccurrenceRow = {
  number: number;
  occurrences: Ice3fNumberOccurrence[];
};

export type Ice3fOccurrenceStats = {
  tableId: number;
  historyLength: number;
  rows: Ice3fNumberOccurrenceRow[];
};

export function emptyIce3fOccurrenceStats(
  tableId: number = ICE3F_OCCURRENCE_TABLE_ID,
): Ice3fOccurrenceStats {
  return {
    tableId,
    historyLength: 0,
    rows: ICE3F_OCCURRENCE_NUMBERS.map((number) => ({ number, occurrences: [] })),
  };
}

/**
 * @param historyNewestFirst histórico da mesa (mais recente primeiro)
 * @param maxPerNumber quantas ocorrências recentes guardar (default 2)
 */
export function buildIce3fOccurrenceStats(
  historyNewestFirst: readonly number[],
  options?: { tableId?: number; maxPerNumber?: number },
): Ice3fOccurrenceStats {
  const tableId = options?.tableId ?? ICE3F_OCCURRENCE_TABLE_ID;
  const maxPerNumber = Math.max(1, Math.floor(options?.maxPerNumber ?? 2));
  const history = historyNewestFirst.filter((n) => Number.isFinite(n));
  const buckets = new Map<number, Ice3fNumberOccurrence[]>();

  for (let i = 0; i < history.length; i++) {
    const number = history[i]!;
    if (number < 0 || number > 36) continue;
    const list = buckets.get(number) ?? [];
    if (list.length >= maxPerNumber) continue;
    // Esquerda no histórico newest-first (= sinal do eco ICE 3F), não a direita.
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
