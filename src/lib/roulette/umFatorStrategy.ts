/**
 * Estratégia **1 Fator**:
 * - **Gatilho (t1, t2):** os dois giros anteriores coincidem nos **3** factores (cor, altura, paridade).
 * - **Confirmação (giro actual t0):** bate em **exactamente 2** dos 3 → formação válida; alerta = factor em falta.
 * - Bate nos **3** ou em **nenhum** → descarta.
 * - **Placar:** no giro após a formação, vitória se o factor alertado acerta; derrota se zero ou oposto.
 */

import {
  doisFatoresFactorLabel,
  type DoisFatoresActive,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";

export const UM_FATOR_MIN_HISTORY = 3;
export const UM_FATOR_MAX_RECOVERY = 5;

export type UmFatorTriggerTriple = readonly [
  DoisFatoresFactor,
  DoisFatoresFactor,
  DoisFatoresFactor,
];

export type UmFatorActive = {
  pairKind: "cor-altura";
  pairKindLabel: string;
  triggerFactor1: DoisFatoresFactor;
  triggerFactor2: DoisFatoresFactor;
  triggerFactor3: DoisFatoresFactor;
  alertFactor: DoisFatoresFactor;
  triggerNumbers: readonly [number, number];
  /** Número do giro em que o alerta foi formado (pos. 0 na detecção). */
  resultNumber: number;
  /** Gatilho t1/t2: sempre 3 factores iguais quando há formação. */
  triggerMatchTier: "three";
  armingDescription: string;
};

export type UmFatorRoundOutcome = "W" | "L";

export type UmFatorTriggerMatchTier = "two" | "three";

/** Quantos dos 3 factores (cor, altura, paridade) coincidem entre dois números. */
export function umFatorTriggerMatchCount(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  let count = 0;
  const colA = colorOf(a);
  const colB = colorOf(b);
  if (colA !== "Zero" && colA === colB) count += 1;
  const altA = heightOf(a);
  const altB = heightOf(b);
  if (altA !== "Zero" && altA === altB) count += 1;
  const parA = parityOf(a);
  const parB = parityOf(b);
  if (parA !== "Zero" && parA === parB) count += 1;
  return count;
}

/** Classifica o par de gatilho (estatísticas / aprendizado). */
export function umFatorTriggerMatchTier(a: number, b: number): UmFatorTriggerMatchTier | null {
  const count = umFatorTriggerMatchCount(a, b);
  if (count === 2) return "two";
  if (count === 3) return "three";
  return null;
}

export function umFatorTriggerMatchTierFromActive(
  active: Pick<UmFatorActive, "triggerNumbers" | "triggerMatchTier">,
): UmFatorTriggerMatchTier | null {
  if (active.triggerMatchTier != null) return active.triggerMatchTier;
  const [nOlder, nNewer] = active.triggerNumbers;
  return umFatorTriggerMatchTier(nOlder, nNewer);
}

function umFatorTripleFactorsForNumber(n: number): UmFatorTriggerTriple | null {
  if (n === 0) return null;
  const col = colorOf(n);
  const alt = heightOf(n);
  const par = parityOf(n);
  if (col === "Zero" || alt === "Zero" || par === "Zero") return null;
  return [
    { kind: "cor", value: col },
    { kind: "altura", value: alt },
    { kind: "paridade", value: par },
  ] as const;
}

function factorWins(num: number, factor: DoisFatoresFactor): boolean {
  if (num === 0) return false;
  switch (factor.kind) {
    case "cor":
      return colorOf(num) === factor.value;
    case "paridade":
      return parityOf(num) === factor.value;
    case "altura":
      return heightOf(num) === factor.value;
  }
}

/** Quantos dos 3 factores de referência o número actual possui. */
export function umFatorMatchCountOnTriple(num: number, triple: UmFatorTriggerTriple): number {
  if (num === 0) return 0;
  return triple.filter((f) => factorWins(num, f)).length;
}

/** Detecta formação de alerta (t1/t2 alinhados + t0 com exactamente 2 factores). */
export function detectUmFatorActiveFromHistory(
  historyNewestFirst: readonly number[],
): UmFatorActive | null {
  if (historyNewestFirst.length < UM_FATOR_MIN_HISTORY) return null;

  const n0 = historyNewestFirst[0]!;
  const n1 = historyNewestFirst[1]!;
  const n2 = historyNewestFirst[2]!;
  if (n0 === 0 || n1 === 0 || n2 === 0) return null;

  if (umFatorTriggerMatchCount(n1, n2) !== 3) return null;

  const trigger = umFatorTripleFactorsForNumber(n1);
  if (!trigger) return null;

  const matchOnCurrent = umFatorMatchCountOnTriple(n0, trigger);
  if (matchOnCurrent !== 2) return null;

  const alertFactor = trigger.find((f) => !factorWins(n0, f));
  if (!alertFactor) return null;

  const triggerLabel = `${doisFatoresFactorLabel(trigger[0])} · ${doisFatoresFactorLabel(trigger[1])} · ${doisFatoresFactorLabel(trigger[2])}`;

  return {
    pairKind: "cor-altura",
    pairKindLabel: "Cor · Altura · Paridade",
    triggerFactor1: trigger[0],
    triggerFactor2: trigger[1],
    triggerFactor3: trigger[2],
    alertFactor,
    triggerNumbers: [n2, n1],
    resultNumber: n0,
    triggerMatchTier: "three",
    armingDescription: `1 Fator: gatilho ${triggerLabel} (${n2}, ${n1}) → alerta ${doisFatoresFactorLabel(alertFactor)} (aguarda próximo giro)`,
  };
}

/** Avalia o giro de resultado contra o factor alertado (giro seguinte à formação). */
export function evaluateUmFatorRound(num: number, active: UmFatorActive): UmFatorRoundOutcome {
  if (num === 0) return "L";
  return factorWins(num, active.alertFactor) ? "W" : "L";
}

export function umFatorAlertLabel(active: UmFatorActive): string {
  return doisFatoresFactorLabel(active.alertFactor);
}

/** Adapta para componentes que usam `DoisFatoresActive` (só factor1 é o alerta). */
export function umFatorToTapeteActive(active: UmFatorActive): DoisFatoresActive {
  return {
    pairKind: active.pairKind,
    pairKindLabel: active.pairKindLabel,
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: active.resultNumber,
    factor1: active.alertFactor,
    factor2: active.triggerFactor1,
    triggerNumbers: active.triggerNumbers,
    armingDescription: active.armingDescription,
  };
}
