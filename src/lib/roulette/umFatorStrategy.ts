/**
 * Estratégia **1 Fator** (dois gatilhos em paralelo):
 *
 * **Gatilho A (3 factores):** t1 e t2 coincidem nos 3 factores (cor, altura, paridade).
 * **Confirmação A:** t0 bate em exactamente 2 dos 3 → alerta = factor em falta.
 * **Modo adaptativo (3f):** após derrota parcial, a próxima indicação usa o factor oposto;
 *    se essa invertida falhar, volta à leitura normal — alterna assim até vitória ou derrota final.
 *
 * **Gatilho B (2 factores):** t1 e t2 coincidem em exactamente 2 factores (exclui 3).
 * **Confirmação B:** t0 bate em exactamente 1 desses 2 partilhados e só coincide
 * esse factor com t1 → alerta = **oposto** do factor partilhado em falta em t0.
 *
 * Zeros descartam. Bate nos 3 ou em nenhum (A) / ambos ou nenhum dos 2 (B) → descarta.
 * **Placar:** no giro após a formação, vitória se o factor alertado acerta; derrota se zero ou oposto.
 */

import {
  doisFatoresFactorLabel,
  type DoisFatoresActive,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";
import { isUmFatorTriggerTierEnabled } from "@/lib/roulette/umFatorTriggerEnable";

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
  /** Quantos factores coincidem entre t1 e t2 no gatilho. */
  triggerMatchTier: UmFatorTriggerMatchTier;
  /** Indicação invertida (modo adaptativo — só gatilho 3 factores). */
  adaptiveInverted?: boolean;
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

function oppositeFactor(f: DoisFatoresFactor): DoisFatoresFactor {
  switch (f.kind) {
    case "cor":
      return { kind: "cor", value: f.value === "Vermelho" ? "Preto" : "Vermelho" };
    case "paridade":
      return { kind: "paridade", value: f.value === "Par" ? "Impar" : "Par" };
    case "altura":
      return { kind: "altura", value: f.value === "Baixo" ? "Alto" : "Baixo" };
  }
}

/** Factor oposto (cor, altura ou paridade). */
export function umFatorOppositeFactor(f: DoisFatoresFactor): DoisFatoresFactor {
  return oppositeFactor(f);
}

/**
 * Aplica modo adaptativo ao gatilho 3 factores: inverte o factor alertado em relação à leitura base.
 */
export function applyUmFatorThreeTierAdaptiveAlert(
  active: UmFatorActive,
  invert: boolean,
): UmFatorActive {
  if (!invert || active.triggerMatchTier !== "three") return active;
  const baseAlert = active.alertFactor;
  const alertFactor = oppositeFactor(baseAlert);
  const sharedLabel = [active.triggerFactor1, active.triggerFactor2, active.triggerFactor3]
    .map(doisFatoresFactorLabel)
    .join(" · ");
  const [n2, n1] = active.triggerNumbers;
  return {
    ...active,
    alertFactor,
    adaptiveInverted: true,
    armingDescription: `1 Fator (3g adapt.): gatilho ${sharedLabel} (${n2}, ${n1}) → alerta ${doisFatoresFactorLabel(alertFactor)} (invertido de ${doisFatoresFactorLabel(baseAlert)}; aguarda próximo giro)`,
  };
}

/** Factores em que dois números coincidem (cor, altura, paridade). */
export function umFatorSharedFactorsBetween(a: number, b: number): DoisFatoresFactor[] {
  if (a === 0 || b === 0) return [];
  const triple = umFatorTripleFactorsForNumber(a);
  if (!triple) return [];
  return triple.filter((f) => factorWins(b, f));
}

/** Quantos dos 3 factores de referência o número actual possui. */
export function umFatorMatchCountOnTriple(num: number, triple: UmFatorTriggerTriple): number {
  if (num === 0) return 0;
  return triple.filter((f) => factorWins(num, f)).length;
}

/** Quantos factores (cor, altura, paridade) coincidem entre num e ref. */
function umFatorMatchCountWithReference(num: number, ref: number): number {
  if (num === 0 || ref === 0) return 0;
  const triple = umFatorTripleFactorsForNumber(ref);
  if (!triple) return 0;
  return triple.filter((f) => factorWins(num, f)).length;
}

function buildUmFatorActive(
  n0: number,
  n1: number,
  n2: number,
  trigger: UmFatorTriggerTriple,
  shared: readonly DoisFatoresFactor[],
  alertFactor: DoisFatoresFactor,
  triggerMatchTier: UmFatorTriggerMatchTier,
): UmFatorActive {
  const sharedLabel = shared.map(doisFatoresFactorLabel).join(" · ");
  const tierTag = triggerMatchTier === "three" ? "3g" : "2g";
  return {
    pairKind: "cor-altura",
    pairKindLabel: "Cor · Altura · Paridade",
    triggerFactor1: trigger[0],
    triggerFactor2: trigger[1],
    triggerFactor3: trigger[2],
    alertFactor,
    triggerNumbers: [n2, n1],
    resultNumber: n0,
    triggerMatchTier,
    armingDescription: `1 Fator (${tierTag}): gatilho ${sharedLabel} (${n2}, ${n1}) → alerta ${doisFatoresFactorLabel(alertFactor)} (aguarda próximo giro)`,
  };
}

/** Gatilho 3 factores: t1/t2 alinhados + t0 com exactamente 2 factores. */
function detectUmFatorThreeTierActive(
  n0: number,
  n1: number,
  n2: number,
): UmFatorActive | null {
  if (umFatorTriggerMatchCount(n1, n2) !== 3) return null;

  const trigger = umFatorTripleFactorsForNumber(n1);
  if (!trigger) return null;

  const matchOnCurrent = umFatorMatchCountOnTriple(n0, trigger);
  if (matchOnCurrent !== 2) return null;

  const alertFactor = trigger.find((f) => !factorWins(n0, f));
  if (!alertFactor) return null;

  return buildUmFatorActive(n0, n1, n2, trigger, trigger, alertFactor, "three");
}

/**
 * Gatilho 2 factores: t1/t2 com exactamente 2 em comum; t0 com 1 desses 2 e só
 * esse factor em comum com t1 → alerta = oposto do factor partilhado em falta em t0.
 */
function detectUmFatorTwoTierActive(n0: number, n1: number, n2: number): UmFatorActive | null {
  if (umFatorTriggerMatchCount(n1, n2) !== 2) return null;

  const trigger = umFatorTripleFactorsForNumber(n1);
  if (!trigger) return null;

  const shared = umFatorSharedFactorsBetween(n1, n2);
  if (shared.length !== 2) return null;

  const matchOnShared = shared.filter((f) => factorWins(n0, f)).length;
  if (matchOnShared !== 1) return null;

  if (umFatorMatchCountWithReference(n0, n1) !== 1) return null;

  const missingOnT0 = shared.find((f) => !factorWins(n0, f));
  if (!missingOnT0) return null;

  const alertFactor = oppositeFactor(missingOnT0);

  return buildUmFatorActive(n0, n1, n2, trigger, shared, alertFactor, "two");
}

/** Detecta formação de alerta (gatilho 3f ou 2f + confirmação em t0). */
export function detectUmFatorActiveFromHistory(
  historyNewestFirst: readonly number[],
  isTierEnabled: (tier: UmFatorTriggerMatchTier) => boolean = isUmFatorTriggerTierEnabled,
): UmFatorActive | null {
  if (historyNewestFirst.length < UM_FATOR_MIN_HISTORY) return null;

  const n0 = historyNewestFirst[0]!;
  const n1 = historyNewestFirst[1]!;
  const n2 = historyNewestFirst[2]!;
  if (n0 === 0 || n1 === 0 || n2 === 0) return null;

  const three = detectUmFatorThreeTierActive(n0, n1, n2);
  if (three && isTierEnabled("three")) return three;
  const two = detectUmFatorTwoTierActive(n0, n1, n2);
  if (two && isTierEnabled("two")) return two;
  return null;
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
