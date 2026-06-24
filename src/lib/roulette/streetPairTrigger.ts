/**
 * Par de gatilho (metade + cor **ou** metade + paridade) partilhado por `streetStrategy` e `criticalHeightGatilho`.
 * Mantido num módulo folha para evitar divergência entre o par nas pos. 11/22 e o par de continuação.
 */

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/** Metade do tapete: **Baixo** = 1–18, **Alto** = 19–36, **Zero** = 0. */
export type Height = "Baixo" | "Alto" | "Zero";
export type Color = "Vermelho" | "Preto" | "Zero";
export type Parity = "Par" | "Impar" | "Zero";

export function colorOf(n: number): Color {
  if (n === 0) return "Zero";
  return RED.has(n) ? "Vermelho" : "Preto";
}

export function heightOf(n: number): Height {
  if (n === 0) return "Zero";
  return n <= 18 ? "Baixo" : "Alto";
}

export function parityOf(n: number): Parity {
  if (n === 0) return "Zero";
  return n % 2 === 0 ? "Par" : "Impar";
}

/** Mesma metade Baixo/Alto e mesma cor (zero não dispara). */
export function sameHeightSameColor(older: number, newer: number): boolean {
  if (older === 0 || newer === 0) return false;
  const h1 = heightOf(older);
  const h2 = heightOf(newer);
  if (h1 === "Zero" || h2 === "Zero" || h1 !== h2) return false;
  const c1 = colorOf(older);
  const c2 = colorOf(newer);
  if (c1 === "Zero" || c2 === "Zero" || c1 !== c2) return false;
  return true;
}

/** Mesma metade Baixo/Alto e mesma paridade (zero não dispara). */
export function sameHeightSameParity(older: number, newer: number): boolean {
  if (older === 0 || newer === 0) return false;
  const h1 = heightOf(older);
  const h2 = heightOf(newer);
  if (h1 === "Zero" || h2 === "Zero" || h1 !== h2) return false;
  const p1 = parityOf(older);
  const p2 = parityOf(newer);
  if (p1 === "Zero" || p2 === "Zero" || p1 !== p2) return false;
  return true;
}

/**
 * Dois giros em ordem **cronológica** (mais antigo → mais recente): mesma metade (1–18 ou 19–36)
 * e (mesma cor **ou** mesma paridade).
 */
export function isStreetPairTrigger(older: number, newer: number): boolean {
  return sameHeightSameColor(older, newer) || sameHeightSameParity(older, newer);
}
