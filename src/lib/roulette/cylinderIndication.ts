import { streetStrategyActiveAfterEachChronologicalPrefix } from "./streetStrategy";

export const EUROPEAN_WHEEL_PHYSICAL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const LEN = EUROPEAN_WHEEL_PHYSICAL.length;

export function wheelPhysicalIndex(n: number): number | null {
  const i = EUROPEAN_WHEEL_PHYSICAL.indexOf(n as (typeof EUROPEAN_WHEEL_PHYSICAL)[number]);
  return i === -1 ? null : i;
}

/**
 * Arco contíguo no cilindro europeu de `from` até `to` (sentido horário, inclusivo).
 * Exclui o zero do resultado.
 */
export function wheelArcNumbersClockwise(from: number, to: number): readonly number[] {
  const iFrom = wheelPhysicalIndex(from);
  const iTo = wheelPhysicalIndex(to);
  if (iFrom === null || iTo === null) return [];
  const out: number[] = [];
  let i = iFrom;
  for (let guard = 0; guard < LEN; guard++) {
    const n = EUROPEAN_WHEEL_PHYSICAL[i]!;
    if (n !== 0) out.push(n);
    if (i === iTo) break;
    i = (i + 1) % LEN;
  }
  return out;
}

export function cylinderNeighborPair(lastDrawn: number): [number, number] | null {
  const idx = wheelPhysicalIndex(lastDrawn);
  if (idx === null) return null;
  const left = EUROPEAN_WHEEL_PHYSICAL[(idx - 1 + LEN) % LEN]!;
  const right = EUROPEAN_WHEEL_PHYSICAL[(idx + 1) % LEN]!;
  return [left, right];
}

/**
 * Menor número de casas ao longo do **anel físico europeu** entre dois números (0–36).
 * Ex.: giro anterior **15** e a seguir **10** → mede-se o caminho mais curto na ordem do cilindro de 15 até 10
 * (não é a diferença numérica no tapete).
 * `0` = mesmo número em giros consecutivos; `1` = vizinhos directos na roda; no máximo 18 (37 casas).
 */
export function wheelRingMinStepDistance(from: number, to: number): number | null {
  const ia = wheelPhysicalIndex(from);
  const ib = wheelPhysicalIndex(to);
  if (ia === null || ib === null) return null;
  const d = Math.abs(ib - ia);
  return Math.min(d, LEN - d);
}

/**
 * Números no anel físico europeu a **no máximo** `steps` casas do centro (inclui o próprio `center`),
 * na **ordem do cilindro** (sequência contígua de `EUROPEAN_WHEEL_PHYSICAL`, de um extremo do arco ao outro;
 * o centro fica no meio da lista).
 * Com `steps = 9` obtém-se o centro mais 9 casas de cada lado = **19 números**.
 */
export function numbersWithinWheelRingSteps(center: number, steps: number): number[] {
  const idx = wheelPhysicalIndex(center);
  if (idx === null || steps < 0) return [];
  const s = Math.min(steps, Math.floor(LEN / 2));
  const out: number[] = [];
  for (let delta = -s; delta <= s; delta++) {
    const j = (((idx + delta) % LEN) + LEN) % LEN;
    out.push(EUROPEAN_WHEEL_PHYSICAL[j]!);
  }
  return out;
}

export type WheelSpinDistanceDatum = {
  /** Índice da transição no tempo (1 = primeiro par cronológico: 2.º giro vs 1.º mais antigo). */
  jogada: number;
  /** Menor distância em casas no anel físico entre `from` (anterior no tempo) e `to` (seguinte). */
  distance: number;
  /** Número que saiu **antes** (no tempo). */
  from: number;
  /** Número que saiu **a seguir** (no tempo). */
  to: number;
};

/**
 * Histórico **newest-first** (`[0]` = mais recente). Devolve pares consecutivos em **ordem cronológica**
 * (mais antigo → mais recente): em cada passo, `from` = giro anterior, `to` = próximo giro, e `distance` = menor
 * número de casas no cilindro físico europeu entre `from` e `to`.
 */
export function buildWheelSpinDistanceSeriesFromNewestFirst(
  historyNewestFirst: readonly number[],
): WheelSpinDistanceDatum[] {
  if (historyNewestFirst.length < 2) return [];
  const chrono = [...historyNewestFirst].reverse();
  const out: WheelSpinDistanceDatum[] = [];
  for (let i = 1; i < chrono.length; i++) {
    const from = chrono[i - 1]!;
    const to = chrono[i]!;
    const d = wheelRingMinStepDistance(from, to);
    if (d === null) continue;
    out.push({ jogada: i, distance: d, from, to });
  }
  return out;
}

/**
 * Distâncias no anel **0–18** que **não ocorreram** nenhuma vez na fatia de transições dada (ordenadas).
 */
export function missingWheelSpinDistancesInSlice(
  slice: readonly WheelSpinDistanceDatum[],
): number[] {
  const counts = Array.from({ length: 19 }, () => 0);
  for (const r of slice) {
    const d = r.distance;
    if (d >= 0 && d <= 18) counts[d]! += 1;
  }
  const out: number[] = [];
  for (let d = 0; d <= 18; d++) {
    if (counts[d] === 0) out.push(d);
  }
  return out;
}

/** Números 0–36 cuja distância no anel físico a `center` está em `distances` (cada valor 0–18). */
export function numbersAtWheelDistancesFromCenter(
  center: number,
  distances: readonly number[],
): number[] {
  const want = new Set(distances.filter((d) => Number.isInteger(d) && d >= 0 && d <= 18));
  if (want.size === 0) return [];
  const out: number[] = [];
  for (let n = 0; n <= 36; n++) {
    const d = wheelRingMinStepDistance(center, n);
    if (d !== null && want.has(d)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** 1–18 ou 19–36 (exclui zero). */
export type RouletteHeightHalf = "1-18" | "19-36";

function numbersInHeightHalf(nums: readonly number[], half: RouletteHeightHalf): number[] {
  return nums.filter((n) => {
    if (!Number.isInteger(n) || n < 1 || n > 36) return false;
    return half === "1-18" ? n <= 18 : n >= 19;
  });
}

/** Menor número do anel a `distance` do `center` que caia na metade indicada; `null` se não houver. */
export function smallestNumberAtWheelDistanceInHalf(
  center: number,
  distance: number,
  half: RouletteHeightHalf,
): number | null {
  const at = numbersAtWheelDistancesFromCenter(center, [distance]);
  const filtered = numbersInHeightHalf(at, half);
  return filtered.length > 0 ? filtered[0]! : null;
}

export type MissingDistanceExclusionPick = {
  center: number;
  /** Todas as distâncias 0–18 sem ocorrência na janela (ordenadas). */
  missingDistances: number[];
  /** As duas maiores em `missingDistances` usadas para o par no tapete (maior primeiro), ou `null` se houver menos de duas distâncias em falta. */
  longestMissingDistances: [number, number] | null;
  /** Números no cilindro exactamente às distâncias `longestMissingDistances` do centro (união ordenada). */
  candidates: number[];
  /** Um número por distância em `longestMissingDistances`: em cada distância, o **menor** número do anel a essa distância (empate no anel). */
  excludedPair: [number, number] | null;
};

/**
 * Das distâncias **sem ocorrência** na janela, ficam as **duas maiores** (mais longas no anel). Para cada uma,
 * o número excluído no tapete é o **menor** entre os que estão a essa distância física do **último giro**
 * (opcionalmente restrito à metade Baixo/Alto — Números 2,8%: metade **oposta** à indicação).
 */
export function pickExclusionFromMissingWheelDistances(params: {
  historyNewestFirst: readonly number[];
  last15Transitions: readonly WheelSpinDistanceDatum[];
  /** Se definido, só entram números 1–18 ou só 19–36 (nunca o zero). */
  exclusionNumbersHalf?: RouletteHeightHalf;
}): MissingDistanceExclusionPick | null {
  if (params.historyNewestFirst.length < 2) return null;
  const center = params.historyNewestFirst[0]!;
  const half = params.exclusionNumbersHalf;
  const missingDistances = missingWheelSpinDistancesInSlice(params.last15Transitions);
  if (missingDistances.length < 2) {
    return {
      center,
      missingDistances,
      longestMissingDistances: null,
      candidates: [],
      excludedPair: null,
    };
  }
  const dLong = missingDistances[missingDistances.length - 1]!;
  const dSecond = missingDistances[missingDistances.length - 2]!;
  const longestMissingDistances: [number, number] = [dLong, dSecond];
  const candidates = numbersAtWheelDistancesFromCenter(center, longestMissingDistances);
  const atLong = numbersAtWheelDistancesFromCenter(center, [dLong]);
  const atSecond = numbersAtWheelDistancesFromCenter(center, [dSecond]);

  let excludedPair: [number, number] | null;
  if (half != null) {
    const nLong = smallestNumberAtWheelDistanceInHalf(center, dLong, half);
    const nSecond = smallestNumberAtWheelDistanceInHalf(center, dSecond, half);
    excludedPair = nLong != null && nSecond != null ? [nLong, nSecond] : null;
  } else {
    const nLong = atLong[0]!;
    const nSecond = atSecond[0]!;
    excludedPair = [nLong, nSecond];
  }

  return { center, missingDistances, longestMissingDistances, candidates, excludedPair };
}

export function computeCylinderPlacarAfterStreetTrigger(historyNewestFirst: number[]): {
  wins: number;
  losses: number;
} {
  if (historyNewestFirst.length < 2) return { wins: 0, losses: 0 };

  const chronological = [...historyNewestFirst].reverse();
  let wins = 0;
  let losses = 0;
  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(chronological, undefined);

  for (let k = 1; k < chronological.length; k++) {
    const active = snapshots[k - 1];
    if (!active) continue;

    const histBeforeNewestFirst = [...chronological.slice(0, k)].reverse();

    const lastRef = histBeforeNewestFirst[0]!;
    const pair = cylinderNeighborPair(lastRef);
    if (!pair) continue;
    const [c1, c2] = pair;

    const num = chronological[k]!;
    if (num === 0) {
      losses += 1;
      continue;
    }
    const hit = num === c1 || num === c2;
    if (hit) losses += 1;
    else wins += 1;
  }

  return { wins, losses };
}

/** Serie cumulativa do placar do cilindro (alinhada ao mesmo criterio que `computeCylinderPlacarAfterStreetTrigger`). */
export function computeCylinderPlacarCumulativeSeries(historyNewestFirst: number[]): {
  cumulativeWins: number[];
  cumulativeLosses: number[];
  aproveitamentoPct: number[];
} {
  if (historyNewestFirst.length < 2) {
    return { cumulativeWins: [], cumulativeLosses: [], aproveitamentoPct: [] };
  }
  const chronological = [...historyNewestFirst].reverse();
  const snapshots = streetStrategyActiveAfterEachChronologicalPrefix(chronological, undefined);
  let wins = 0;
  let losses = 0;
  const cumulativeWins: number[] = [];
  const cumulativeLosses: number[] = [];
  const aproveitamentoPct: number[] = [];

  for (let k = 1; k < chronological.length; k++) {
    const active = snapshots[k - 1];
    if (!active) {
      cumulativeWins.push(wins);
      cumulativeLosses.push(losses);
      aproveitamentoPct.push(wins + losses > 0 ? (100 * wins) / (wins + losses) : 0);
      continue;
    }

    const histBeforeNewestFirst = [...chronological.slice(0, k)].reverse();

    const lastRef = histBeforeNewestFirst[0]!;
    const pair = cylinderNeighborPair(lastRef);
    if (!pair) {
      cumulativeWins.push(wins);
      cumulativeLosses.push(losses);
      aproveitamentoPct.push(wins + losses > 0 ? (100 * wins) / (wins + losses) : 0);
      continue;
    }
    const [c1, c2] = pair;

    const num = chronological[k]!;
    if (num === 0) {
      losses += 1;
    } else {
      const hit = num === c1 || num === c2;
      if (hit) losses += 1;
      else wins += 1;
    }
    cumulativeWins.push(wins);
    cumulativeLosses.push(losses);
    aproveitamentoPct.push(wins + losses > 0 ? (100 * wins) / (wins + losses) : 0);
  }

  return { cumulativeWins, cumulativeLosses, aproveitamentoPct };
}
