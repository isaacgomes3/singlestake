export type HistoryMutationKind = "init" | "prepend" | "pop" | "replace";

/** Exposto para testes / consumidores que precisam do mesmo critério de `tailEqual`. */
export function tailEqual(
  a: readonly number[],
  aStart: number,
  b: readonly number[],
  bStart: number,
): boolean {
  const al = a.length - aStart;
  const bl = b.length - bStart;
  if (al !== bl) return false;
  for (let i = 0; i < al; i++) {
    if (a[aStart + i] !== b[bStart + i]) return false;
  }
  return true;
}

/**
 * Detecta como o histórico (newest-first) mudou entre dois snapshots.
 */
export function detectHistoryMutation(
  prev: readonly number[],
  next: readonly number[],
): HistoryMutationKind {
  if (prev.length === 0 && next.length > 0) return "init";
  if (next.length === prev.length + 1 && tailEqual(next, 1, prev, 0)) return "prepend";
  if (prev.length === next.length + 1 && tailEqual(prev, 1, next, 0)) return "pop";
  return "replace";
}

/**
 * Quantos números novos foram colocados à cabeça (newest-first), mantendo o sufixo igual a `prev`.
 * `0` se não for um prepend puro (ex.: `replace`, `pop`, ou primeiro carregamento com `prev` vazio).
 */
export function countPrependedNumbers(prev: readonly number[], next: readonly number[]): number {
  if (prev.length === 0 || next.length <= prev.length) return 0;
  const added = next.length - prev.length;
  if (!tailEqual(next, added, prev, 0)) return 0;
  return added;
}
