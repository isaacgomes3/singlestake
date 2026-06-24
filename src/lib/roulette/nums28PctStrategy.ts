/**
 * Números 2,8% — gatilho e exclusão (giro a giro):
 *
 * 1. **Gatilho:** dois giros seguidos com **cor, paridade e altura iguais** (ex.: 21 e 23 → vermelho · ímpar · alto).
 * 2. **Exclusão:** dois números **totalmente opostos**; preferência aos que **saíram nos últimos 12 giros**;
 *    se houver menos de 2 nessa janela, escolhem-se os 2 mais frios no pool oposto completo.
 *
 * Placar: **W** se o giro não for um dos exclusivos; **L** se cair num exclusivo. Zero → **W**.
 */

import { twoColdestNumbersInNumberSet } from "@/lib/roulette/liveTableColdStats";
import {
  colorOf,
  heightOf,
  parityOf,
  type Color,
  type Height,
  type Parity,
} from "@/lib/roulette/streetPairTrigger";
import type { StreetPlacarEvolutionSeries, ZoneIndication } from "@/lib/roulette/streetStrategy";

export const NUMS_28_OPPOSITE_RECENT_SPINS = 12;

/** @deprecated Variante cilindro removida — alias do placar principal. */
export const NUMS_28_CILINDRO_EXCLUSAO_MIN_GIROS = 15;

export type Nums28CrossAxisKind = "cor-altura";
export type Nums28ExclusionCrossKind = "cor-paridade-altura";

export type Nums28PctActive = {
  excludedNumbers: readonly [number, number];
  crossingAxis: Nums28CrossAxisKind;
  /** Rótulo do oposto total (ex.: «Preto · Par · Baixo»). */
  crossingCategoryLabel: string;
  /** Números 1–36 com o oposto total dos dois giros do gatilho. */
  crossingPool: readonly number[];
  indicationZone: ZoneIndication;
  exclusionCrossKind: Nums28ExclusionCrossKind;
  criticalTriple: readonly [number, number, number];
  armingDescription: string;
};

export type Nums28PctResult = {
  active: Nums28PctActive | null;
  log: string[];
};

export type Nums28PctExclusionTieBreak = "recency" | "legacy";

export type Nums28PctPlacarOptions = {
  exclusionTieBreak?: Nums28PctExclusionTieBreak;
};

function oppositeColor(c: Exclude<Color, "Zero">): Exclude<Color, "Zero"> {
  return c === "Vermelho" ? "Preto" : "Vermelho";
}

function oppositeParity(p: Exclude<Parity, "Zero">): Exclude<Parity, "Zero"> {
  return p === "Par" ? "Impar" : "Par";
}

function oppositeHeight(h: Exclude<Height, "Zero">): Exclude<Height, "Zero"> {
  return h === "Baixo" ? "Alto" : "Baixo";
}

function traitLabel(c: Exclude<Color, "Zero">, p: Exclude<Parity, "Zero">, h: Exclude<Height, "Zero">): string {
  const col = c === "Vermelho" ? "Vermelho" : "Preto";
  const par = p === "Par" ? "Par" : "Ímpar";
  const alt = h === "Baixo" ? "Baixo" : "Alto";
  return `${col} · ${par} · ${alt}`;
}

function heightToZone(h: Exclude<Height, "Zero">): ZoneIndication {
  return h === "Baixo" ? "1-18" : "19-36";
}

/** Dois giros seguidos (newest-first) com cor, paridade e altura iguais. */
export function hasConsecutiveEqualFullTraitsAtHead(historyNewestFirst: readonly number[]): boolean {
  if (historyNewestFirst.length < 2) return false;
  const newer = historyNewestFirst[0]!;
  const older = historyNewestFirst[1]!;
  if (newer === 0 || older === 0) return false;
  const cN = colorOf(newer);
  const cO = colorOf(older);
  const pN = parityOf(newer);
  const pO = parityOf(older);
  const hN = heightOf(newer);
  const hO = heightOf(older);
  if (cN === "Zero" || cO === "Zero" || pN === "Zero" || pO === "Zero" || hN === "Zero" || hO === "Zero") {
    return false;
  }
  return cN === cO && pN === pO && hN === hO;
}

function numbersWithFullTraits(
  c: Exclude<Color, "Zero">,
  p: Exclude<Parity, "Zero">,
  h: Exclude<Height, "Zero">,
): readonly number[] {
  const out: number[] = [];
  for (let n = 1; n <= 36; n++) {
    if (colorOf(n) === c && parityOf(n) === p && heightOf(n) === h) out.push(n);
  }
  return out;
}

function oppositeNumbersSeenInRecentSpins(
  historyNewestFirst: readonly number[],
  oppositePool: readonly number[],
  recentCount: number,
): number[] {
  const poolSet = new Set(oppositePool);
  const seen = new Set<number>();
  const nTake = Math.min(recentCount, historyNewestFirst.length);
  for (let i = 0; i < nTake; i++) {
    const n = historyNewestFirst[i]!;
    if (n !== 0 && poolSet.has(n)) seen.add(n);
  }
  return [...seen];
}

function criticalTripleFromHnf(hnf: readonly number[]): readonly [number, number, number] {
  const a = hnf.length >= 3 ? hnf[2]! : hnf.length >= 1 ? hnf[hnf.length - 1]! : 0;
  const b = hnf.length >= 2 ? hnf[1]! : a;
  const c = hnf.length >= 1 ? hnf[0]! : a;
  return [a, b, c] as const;
}

function activeFromHnf(hnf: readonly number[]): Nums28PctActive | null {
  if (!hasConsecutiveEqualFullTraitsAtHead(hnf)) return null;

  const ref = hnf[0]!;
  const c = colorOf(ref);
  const p = parityOf(ref);
  const h = heightOf(ref);
  if (c === "Zero" || p === "Zero" || h === "Zero") return null;

  const oppC = oppositeColor(c);
  const oppP = oppositeParity(p);
  const oppH = oppositeHeight(h);
  const oppositePool = numbersWithFullTraits(oppC, oppP, oppH);
  if (oppositePool.length < 2) return null;

  const seenInRecent = oppositeNumbersSeenInRecentSpins(hnf, oppositePool, NUMS_28_OPPOSITE_RECENT_SPINS);
  const exclusionPool = seenInRecent.length >= 2 ? seenInRecent : [...oppositePool];

  const [e0, e1] = twoColdestNumbersInNumberSet(hnf, exclusionPool);
  const label = traitLabel(oppC, oppP, oppH);
  const triggerPair = `${hnf[1]} → ${hnf[0]}`;

  return {
    excludedNumbers: [e0, e1] as const,
    crossingAxis: "cor-altura",
    crossingCategoryLabel: label,
    crossingPool: oppositePool,
    indicationZone: heightToZone(oppH),
    exclusionCrossKind: "cor-paridade-altura",
    criticalTriple: criticalTripleFromHnf(hnf),
    armingDescription: `Números 2,8%: ${triggerPair} (${traitLabel(c, p, h)}) → exclusão ${label}: ${e0} e ${e1}.`,
  };
}

function runNums28Chronological(
  chronological: number[],
  captureSnapshots: boolean,
): {
  finalActive: Nums28PctActive | null;
  log: string[];
  activeAfterPrefix: (Nums28PctActive | null)[] | null;
} {
  const log: string[] = [];
  const n = chronological.length;
  const activeAfterPrefix: (Nums28PctActive | null)[] | null = captureSnapshots ? new Array(n) : null;

  let lastLogMsg = "";

  for (let i = 0; i < n; i++) {
    const hnf = chronological.slice(0, i + 1).reverse();
    const active = activeFromHnf(hnf);
    if (active && active.armingDescription !== lastLogMsg) {
      log.push(active.armingDescription);
      lastLogMsg = active.armingDescription;
    }
    if (activeAfterPrefix) activeAfterPrefix[i] = active;
  }

  const finalActive = activeAfterPrefix
    ? (activeAfterPrefix[n - 1] ?? null)
    : n > 0
      ? activeFromHnf([...chronological].reverse())
      : null;

  return { finalActive, log, activeAfterPrefix };
}

export function nums28PctActiveAfterEachChronologicalPrefix(
  chronological: number[],
  _tieBreak?: Nums28PctExclusionTieBreak,
): (Nums28PctActive | null)[] {
  const { activeAfterPrefix } = runNums28Chronological(chronological, true);
  return activeAfterPrefix ?? [];
}

export function simulateNums28PctStrategy(historyNewestFirst: number[]): Nums28PctResult {
  if (historyNewestFirst.length === 0) {
    return { active: null, log: ["Sem histórico ainda."] };
  }
  const chronological = [...historyNewestFirst].reverse();
  const { finalActive: active, log } = runNums28Chronological(chronological, false);
  return { active, log: log.slice(-24) };
}

export function nums28PctActiveFromMirrorSnapshot(historyNewestFirst: number[]): Nums28PctActive | null {
  if (historyNewestFirst.length === 0) return null;
  return activeFromHnf(historyNewestFirst);
}

export function nums28PctPlacarSummary(outcomes: readonly ("W" | "L")[]): {
  wins: number;
  losses: number;
  total: number;
  aproveitamentoPct: number;
} {
  let wins = 0;
  for (const x of outcomes) if (x === "W") wins += 1;
  const losses = outcomes.length - wins;
  const total = outcomes.length;
  return {
    wins,
    losses,
    total,
    aproveitamentoPct: total > 0 ? (100 * wins) / total : 0,
  };
}

export function nums28AproveitamentoPctFromHistory(historyNewestFirst: readonly number[]): number {
  const o = nums28PctPlacarOutcomes([...historyNewestFirst]);
  if (o.length === 0) return 0;
  return nums28PctPlacarSummary(o).aproveitamentoPct;
}

export function nums28PctPlacarOutcomes(
  historyNewestFirst: number[],
  _options?: Nums28PctPlacarOptions,
): ("W" | "L")[] {
  if (historyNewestFirst.length < 2) return [];
  const chronological = [...historyNewestFirst].reverse();
  const snapshots = nums28PctActiveAfterEachChronologicalPrefix(chronological);
  const out: ("W" | "L")[] = [];

  for (let k = 1; k < chronological.length; k++) {
    const snap = snapshots[k - 1];
    if (!snap) continue;
    const num = chronological[k]!;
    const onExcluded = num === snap.excludedNumbers[0] || num === snap.excludedNumbers[1];
    out.push(onExcluded ? "L" : "W");
  }
  return out;
}

/** @deprecated Variante cilindro removida. */
export function nums28PctPlacarOutcomesWithCylinderSpinExclusion(
  historyNewestFirst: number[],
  _options?: Nums28PctPlacarOptions,
  _minGiros?: number,
): ("W" | "L")[] {
  return nums28PctPlacarOutcomes(historyNewestFirst);
}

/** @deprecated Variante cilindro removida. */
export function nums28PctPlacarEvolutionSeriesWithCylinderSpinExclusion(
  historyNewestFirst: number[],
  options?: Nums28PctPlacarOptions,
  _minGiros?: number,
): StreetPlacarEvolutionSeries | null {
  return nums28PctPlacarEvolutionSeries(historyNewestFirst, options);
}

export function nums28PctPlacarEvolutionSeries(
  historyNewestFirst: number[],
  options?: Nums28PctPlacarOptions,
): StreetPlacarEvolutionSeries | null {
  const outcomes = nums28PctPlacarOutcomes(historyNewestFirst, options);
  if (outcomes.length === 0) return null;
  return buildEvolutionSeries(outcomes);
}

/** Mantido para scripts de hipótese — usa frieza simples no pool dado. */
export function pickTwoColdestNumbersInPool(
  pool: readonly number[],
  _windowNums: readonly number[],
  historyNewestFirst: readonly number[],
): readonly [number, number] {
  return twoColdestNumbersInNumberSet(historyNewestFirst, pool);
}

function buildEvolutionSeries(outcomes: readonly ("W" | "L")[]): StreetPlacarEvolutionSeries {
  let w = 0;
  let l = 0;
  let run = 0;
  let best = 0;
  const cumulativeWins: number[] = [];
  const cumulativeLosses: number[] = [];
  const aproveitamentoPct: number[] = [];
  const streakCurrent: number[] = [];
  const streakMax: number[] = [];
  for (const x of outcomes) {
    if (x === "W") {
      w += 1;
      run += 1;
      best = Math.max(best, run);
    } else {
      l += 1;
      run = 0;
    }
    cumulativeWins.push(w);
    cumulativeLosses.push(l);
    aproveitamentoPct.push(w + l > 0 ? (100 * w) / (w + l) : 0);
    streakCurrent.push(run);
    streakMax.push(best);
  }
  return {
    cumulativeWins,
    cumulativeLosses,
    aproveitamentoPct,
    streakCurrent,
    streakMax,
  };
}
