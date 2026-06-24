/**
 * Posições críticas na grelha 11×3 (histórico newest-first): **11.º e 22.º** giros mais recentes —
 * índices `history[10]` e `history[21]` com `history[0]` = mais recente.
 * Se esses giros reforçarem a mesma tendência (metade Baixo/Alto, fila visual do tapete e cor) que o conjunto de
 * números cobertos pela aposta, não se emite o alerta espelho — continuação histórica demasiado alinhada.
 */

import {
  colorOf,
  heightOf,
  matTableRowOf,
  type Color,
  type Height,
} from "@/lib/roulette/streetStrategy";

/** Índices no histórico newest-first (11.º e 22.º giro mais recente). */
export const MIRROR_CONFIRMATION_HISTORY_INDICES = [10, 21] as const;

/** Índices no histórico newest-first usados na confirmação do espelho (por defeito = Ruas: pos. 11 e 22). */
export type MirrorConfirmationCriticalIndices = readonly [number, number];

export function spinsAtMirrorCriticalIndices(
  historyNewestFirst: readonly number[],
  indices: MirrorConfirmationCriticalIndices = MIRROR_CONFIRMATION_HISTORY_INDICES,
): number[] {
  const out: number[] = [];
  for (const idx of indices) {
    if (idx >= historyNewestFirst.length) continue;
    const n = historyNewestFirst[idx]!;
    if (n > 0) out.push(n);
  }
  return out;
}

type MatRow = 1 | 2 | 3;

function strongModeAtLeast2<T extends string | number>(
  spins: readonly number[],
  pick: (n: number) => T | null,
): T | null {
  const picked: T[] = [];
  for (const n of spins) {
    const p = pick(n);
    if (p != null) picked.push(p);
  }
  if (picked.length < 2) return null;
  const counts = new Map<T, number>();
  for (const p of picked) counts.set(p, (counts.get(p) ?? 0) + 1);
  let best: T | null = null;
  let bestc = 0;
  for (const [k, v] of counts) {
    if (v > bestc) {
      best = k;
      bestc = v;
    }
  }
  return bestc >= 2 ? best : null;
}

function pluralityMode<T extends string | number>(values: readonly T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let max = 0;
  for (const v of counts.values()) max = Math.max(max, v);
  const winners = [...counts.entries()].filter(([, c]) => c === max).map(([k]) => k);
  return winners.length === 1 ? winners[0]! : null;
}

function heightPick(n: number): Height | null {
  const h = heightOf(n);
  return h === "Zero" ? null : h;
}

function colorPick(n: number): Color | null {
  const c = colorOf(n);
  return c === "Zero" ? null : c;
}

function rowPick(n: number): MatRow | null {
  return matTableRowOf(n);
}

/**
 * `true` quando há pelo menos dois giros válidos nas posições críticas, todos com modo ≥2 na mesma
 * metade / fila / (cor se a aposta tiver cor dominante), e esses modos coincidem com o perfil majoritário
 * dos números cobertos pela aposta (`betNumbers`).
 */
export function mirrorConfirmationAlignsWithBetNumbers(
  historyNewestFirst: readonly number[],
  betNumbers: readonly number[],
  criticalIndices: MirrorConfirmationCriticalIndices = MIRROR_CONFIRMATION_HISTORY_INDICES,
): boolean {
  const confSpins = spinsAtMirrorCriticalIndices(historyNewestFirst, criticalIndices);
  if (confSpins.length < 2 || betNumbers.length === 0) return false;

  const confH = strongModeAtLeast2(confSpins, heightPick);
  const confR = strongModeAtLeast2(confSpins, rowPick);
  if (confH == null || confR == null) return false;

  const betHeights = betNumbers.map(heightPick).filter((h): h is Height => h != null);
  const betRows = betNumbers.map(rowPick).filter((r): r is MatRow => r != null);
  const betColors = betNumbers.map(colorPick).filter((c): c is Color => c != null);

  const betH = pluralityMode(betHeights);
  const betR = pluralityMode(betRows);
  if (betH == null || betR == null) return false;
  if (confH !== betH || confR !== betR) return false;

  const betC = pluralityMode(betColors);
  if (betC != null) {
    const confC = strongModeAtLeast2(confSpins, colorPick);
    if (confC == null || confC !== betC) return false;
  }

  return true;
}
