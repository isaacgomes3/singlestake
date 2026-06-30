/**
 * Sala rotativa 2 Fatores — gatilhos por padrões de cruzamento.
 * Eixos: cor/altura, paridade/altura, cor/paridade.
 * Padrões: primário x-x-x, secundário x-x-y-x, terciário x-y-x-x.
 */

import {
  CROSSING_BUCKET_DEFINITIONS,
  type CrossingAxisKind,
} from "@/lib/roulette/liveTableColdStats";
import type { DoisFatoresFactor, DoisFatoresPairKind } from "@/lib/roulette/doisFatoresStrategy";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";

export const ROTATING_ROOM_CROSSING_ZERO_EXCLUDE_SPINS = 12;
export const ROTATING_ROOM_CROSSING_SWITCH_WITHOUT_PATTERN_SPINS = 2;

export const ROTATING_ROOM_CROSSING_PATTERN_AXES: readonly CrossingAxisKind[] = [
  "cor-altura",
  "altura-paridade",
  "cor-paridade",
];

export type CrossingPatternKind = "primary" | "secondary" | "tertiary";

export const CROSSING_PATTERN_PRIORITY: Record<CrossingPatternKind, number> = {
  primary: 3,
  secondary: 2,
  tertiary: 1,
};

export type CrossingPatternMatch = {
  axis: CrossingAxisKind;
  patternKind: CrossingPatternKind;
  category: string;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  triggerNumbers: readonly number[];
  patternPriority: number;
};

const AXIS_ORDER: readonly CrossingAxisKind[] = ROTATING_ROOM_CROSSING_PATTERN_AXES;

export function tableHasZeroInLastSpins(
  historyNewestFirst: readonly number[],
  window = ROTATING_ROOM_CROSSING_ZERO_EXCLUDE_SPINS,
): boolean {
  for (let i = 0; i < Math.min(window, historyNewestFirst.length); i++) {
    if (historyNewestFirst[i] === 0) return true;
  }
  return false;
}

export function pairKindFromCrossingAxis(axis: CrossingAxisKind): DoisFatoresPairKind {
  return axis;
}

export function factorsForNumberOnAxis(
  n: number,
  axis: CrossingAxisKind,
): readonly [DoisFatoresFactor, DoisFatoresFactor] | null {
  if (n === 0) return null;
  const col = colorOf(n);
  const alt = heightOf(n);
  const par = parityOf(n);
  if (axis === "cor-altura") {
    if (col === "Zero" || alt === "Zero") return null;
    return [{ kind: "cor", value: col }, { kind: "altura", value: alt }] as const;
  }
  if (axis === "cor-paridade") {
    if (col === "Zero" || par === "Zero") return null;
    return [{ kind: "cor", value: col }, { kind: "paridade", value: par }] as const;
  }
  if (axis === "altura-paridade") {
    if (alt === "Zero" || par === "Zero") return null;
    return [{ kind: "altura", value: alt }, { kind: "paridade", value: par }] as const;
  }
  return null;
}

export function crossingCategoryForNumber(
  n: number,
  axis: CrossingAxisKind,
): string | null {
  if (n === 0) return null;
  const def = CROSSING_BUCKET_DEFINITIONS.find((d) => d.axis === axis && d.nums.includes(n));
  return def?.category ?? null;
}

function sigAt(
  historyNewestFirst: readonly number[],
  index: number,
  axis: CrossingAxisKind,
): string | null {
  const n = historyNewestFirst[index];
  if (n === undefined) return null;
  return crossingCategoryForNumber(n, axis);
}

function buildMatch(
  axis: CrossingAxisKind,
  patternKind: CrossingPatternKind,
  category: string,
  historyNewestFirst: readonly number[],
  triggerIndices: readonly number[],
): CrossingPatternMatch | null {
  const refIndex = triggerIndices[0];
  if (refIndex === undefined) return null;
  const refNum = historyNewestFirst[refIndex];
  if (refNum === undefined) return null;
  const factors = factorsForNumberOnAxis(refNum, axis);
  if (!factors) return null;
  const triggerNumbers = triggerIndices.map((i) => historyNewestFirst[i]!).filter((n) => n !== undefined);
  return {
    axis,
    patternKind,
    category,
    factor1: factors[0],
    factor2: factors[1],
    triggerNumbers,
    patternPriority: CROSSING_PATTERN_PRIORITY[patternKind],
  };
}

export function matchPrimaryOnAxis(
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
): CrossingPatternMatch | null {
  if (historyNewestFirst.length < 3) return null;
  const s0 = sigAt(historyNewestFirst, 0, axis);
  const s1 = sigAt(historyNewestFirst, 1, axis);
  const s2 = sigAt(historyNewestFirst, 2, axis);
  if (!s0 || !s1 || !s2) return null;
  if (s0 !== s1 || s1 !== s2) return null;
  return buildMatch(axis, "primary", s0, historyNewestFirst, [0, 1, 2]);
}

export function matchSecondaryOnAxis(
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
): CrossingPatternMatch | null {
  if (historyNewestFirst.length < 4) return null;
  const s = [0, 1, 2, 3].map((i) => sigAt(historyNewestFirst, i, axis));
  if (s.some((x) => !x)) return null;
  const [a, b, c, d] = s as [string, string, string, string];
  if (a === b && a === d && c !== a) {
    return buildMatch(axis, "secondary", a, historyNewestFirst, [0, 1, 2, 3]);
  }
  return null;
}

export function matchTertiaryOnAxis(
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
): CrossingPatternMatch | null {
  if (historyNewestFirst.length < 4) return null;
  const s = [0, 1, 2, 3].map((i) => sigAt(historyNewestFirst, i, axis));
  if (s.some((x) => !x)) return null;
  const [a, b, c, d] = s as [string, string, string, string];
  if (a === c && a === d && b !== a) {
    return buildMatch(axis, "tertiary", a, historyNewestFirst, [0, 1, 2, 3]);
  }
  return null;
}

function matchOnAxisByKind(
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
  patternKind: CrossingPatternKind,
): CrossingPatternMatch | null {
  switch (patternKind) {
    case "primary":
      return matchPrimaryOnAxis(historyNewestFirst, axis);
    case "secondary":
      return matchSecondaryOnAxis(historyNewestFirst, axis);
    case "tertiary":
      return matchTertiaryOnAxis(historyNewestFirst, axis);
  }
}

/** Eixo do padrão mais recente antes do giro actual (preferência em empate). */
export function findPriorPatternAxis(historyNewestFirst: readonly number[]): CrossingAxisKind | null {
  if (historyNewestFirst.length < 4) return null;
  const tail = historyNewestFirst.slice(1);
  for (const kind of ["primary", "secondary", "tertiary"] as const) {
    for (const axis of AXIS_ORDER) {
      if (matchOnAxisByKind(tail, axis, kind)) return axis;
    }
  }
  return null;
}

export function resolveAxisPreference(
  historyNewestFirst: readonly number[],
  candidates: readonly CrossingPatternMatch[],
): CrossingPatternMatch {
  if (candidates.length === 1) return candidates[0]!;
  const priorAxis = findPriorPatternAxis(historyNewestFirst);
  if (priorAxis) {
    const preferred = candidates.find((c) => c.axis === priorAxis);
    if (preferred) return preferred;
  }
  const sorted = [...candidates].sort(
    (a, b) => AXIS_ORDER.indexOf(a.axis) - AXIS_ORDER.indexOf(b.axis),
  );
  return sorted[0]!;
}

export function detectPatternOnTableByKind(
  historyNewestFirst: readonly number[],
  patternKind: CrossingPatternKind,
): CrossingPatternMatch | null {
  const candidates: CrossingPatternMatch[] = [];
  for (const axis of AXIS_ORDER) {
    const m = matchOnAxisByKind(historyNewestFirst, axis, patternKind);
    if (m) candidates.push(m);
  }
  if (candidates.length === 0) return null;
  return resolveAxisPreference(historyNewestFirst, candidates);
}

/** Melhor padrão na mesa: primário → secundário → terciário. */
export function detectBestPatternOnTable(
  historyNewestFirst: readonly number[],
): CrossingPatternMatch | null {
  if (tableHasZeroInLastSpins(historyNewestFirst)) return null;
  for (const kind of ["primary", "secondary", "tertiary"] as const) {
    const m = detectPatternOnTableByKind(historyNewestFirst, kind);
    if (m) return m;
  }
  return null;
}

export function crossingPatternKindLabel(kind: CrossingPatternKind): string {
  switch (kind) {
    case "primary":
      return "Primário x-x-x";
    case "secondary":
      return "Secundário x-x-y-x";
    case "tertiary":
      return "Terciário x-y-x-x";
  }
}
