/**
 * Classificação de números do Pragmatic **24D Spin** (1–24).
 *
 * Tapete (colunas top→bottom):
 * - Col 1: 1–4  vermelho · Col 2: 5–8  preto
 * - Col 3: 9–12 vermelho · Col 4: 13–16 preto
 * - Col 5: 17–20 vermelho · Col 6: 21–24 preto
 *
 * Altura: **Baixo** 1–12 · **Alto** 13–24.
 * Paridade: mesmo critério (par/ímpar); sem zero.
 */

import type { CrossingAxisKind } from "@/lib/roulette/liveTableColdStats";
import type { DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";

export type Spin24dColor = "Vermelho" | "Preto";
export type Spin24dHeight = "Baixo" | "Alto";
export type Spin24dParity = "Par" | "Impar";

/** Vermelho: colunas 1, 3, 5. */
const RED_24D = new Set([
  1, 2, 3, 4, 9, 10, 11, 12, 17, 18, 19, 20,
]);

export function isSpin24dNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 24;
}

export function spin24dColorOf(n: number): Spin24dColor | null {
  if (!isSpin24dNumber(n)) return null;
  return RED_24D.has(n) ? "Vermelho" : "Preto";
}

export function spin24dHeightOf(n: number): Spin24dHeight | null {
  if (!isSpin24dNumber(n)) return null;
  return n <= 12 ? "Baixo" : "Alto";
}

export function spin24dParityOf(n: number): Spin24dParity | null {
  if (!isSpin24dNumber(n)) return null;
  return n % 2 === 0 ? "Par" : "Impar";
}

export function factorsFor24dNumberOnAxis(
  n: number,
  axis: CrossingAxisKind,
): readonly [DoisFatoresFactor, DoisFatoresFactor] | null {
  const col = spin24dColorOf(n);
  const alt = spin24dHeightOf(n);
  const par = spin24dParityOf(n);
  if (!col || !alt || !par) return null;
  if (axis === "cor-altura") {
    return [{ kind: "cor", value: col }, { kind: "altura", value: alt }] as const;
  }
  if (axis === "cor-paridade") {
    return [{ kind: "cor", value: col }, { kind: "paridade", value: par }] as const;
  }
  if (axis === "altura-paridade") {
    return [{ kind: "altura", value: alt }, { kind: "paridade", value: par }] as const;
  }
  return null;
}

export function spin24dFactorLabel(f: DoisFatoresFactor): string {
  switch (f.kind) {
    case "cor":
      return f.value === "Vermelho" ? "Vermelho" : "Preto";
    case "paridade":
      return f.value === "Par" ? "Par" : "Ímpar";
    case "altura":
      return f.value === "Baixo" ? "Baixo 1–12" : "Alto 13–24";
  }
}

export function spin24dFactorWins(num: number, factor: DoisFatoresFactor): boolean {
  switch (factor.kind) {
    case "cor":
      return spin24dColorOf(num) === factor.value;
    case "paridade":
      return spin24dParityOf(num) === factor.value;
    case "altura":
      return spin24dHeightOf(num) === factor.value;
  }
}

export function spin24dTripleFactors(n: number): DoisFatoresFactor[] | null {
  const col = spin24dColorOf(n);
  const alt = spin24dHeightOf(n);
  const par = spin24dParityOf(n);
  if (!col || !alt || !par) return null;
  return [
    { kind: "cor", value: col },
    { kind: "altura", value: alt },
    { kind: "paridade", value: par },
  ];
}

export function spin24dSharedFactorsBetween(a: number, b: number): DoisFatoresFactor[] {
  const triple = spin24dTripleFactors(a);
  if (!triple) return [];
  return triple.filter((f) => spin24dFactorWins(b, f));
}

export function spin24dTriggerMatchCount(a: number, b: number): number {
  return spin24dSharedFactorsBetween(a, b).length;
}

/** Mesma regra do tapete 2F: W (2), L (0), continue/empate (1). */
export function spin24dEvaluateRound(
  num: number,
  factor1: DoisFatoresFactor,
  factor2: DoisFatoresFactor,
): "W" | "L" | "continue" {
  if (!isSpin24dNumber(num)) return "L";
  const f1Win = spin24dFactorWins(num, factor1);
  const f2Win = spin24dFactorWins(num, factor2);
  if (f1Win && f2Win) return "W";
  if (!f1Win && !f2Win) return "L";
  return "continue";
}
