import { CASINO_STREETS } from "@/lib/roulette/streetStrategy";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";

/** Giros desde o último giro cujo número pertence a `targets` (0 = saiu no giro mais recente). Histórico newest-first. */
export function spinsSinceHit(
  historyNewestFirst: readonly number[],
  targets: ReadonlySet<number>,
): number {
  for (let i = 0; i < historyNewestFirst.length; i++) {
    if (targets.has(historyNewestFirst[i]!)) return i;
  }
  return historyNewestFirst.length;
}

export type ColdStreetRow = {
  streetId: number;
  numbers: readonly [number, number, number];
  gap: number;
};

export type ColdNumberRow = { n: number; gap: number };

export type ColdDoubleStreetRow = {
  /** Índice 0-based do primeiro `streetId` do par (1–11 → pares de ruas consecutivas). */
  firstStreetId: number;
  numbers: readonly number[];
  gap: number;
};

export function coldStreets(historyNewestFirst: readonly number[], topN = 4): ColdStreetRow[] {
  const rows = CASINO_STREETS.map((s) => ({
    streetId: s.id,
    numbers: s.numbers as readonly [number, number, number],
    gap: spinsSinceHit(historyNewestFirst, new Set(s.numbers)),
  }));
  rows.sort((a, b) => b.gap - a.gap || a.streetId - b.streetId);
  return rows.slice(0, topN);
}

export function coldNumbers(historyNewestFirst: readonly number[], topN = 10): ColdNumberRow[] {
  const rows: ColdNumberRow[] = [];
  for (let n = 0; n <= 36; n++) {
    rows.push({ n, gap: spinsSinceHit(historyNewestFirst, new Set([n])) });
  }
  rows.sort((a, b) => b.gap - a.gap || a.n - b.n);
  return rows.slice(0, topN);
}

/** Dupla rua = duas transversais consecutivas (6 números), como linha de apostas 1–6, 4–9, …, 31–36. */
export function coldDoubleStreets(
  historyNewestFirst: readonly number[],
  topN = 4,
): ColdDoubleStreetRow[] {
  const rows: ColdDoubleStreetRow[] = [];
  for (let k = 0; k < CASINO_STREETS.length - 1; k++) {
    const a = CASINO_STREETS[k]!.numbers;
    const b = CASINO_STREETS[k + 1]!.numbers;
    const numbers = [...a, ...b] as readonly number[];
    rows.push({
      firstStreetId: CASINO_STREETS[k]!.id,
      numbers,
      gap: spinsSinceHit(historyNewestFirst, new Set(numbers)),
    });
  }
  rows.sort((a, b) => b.gap - a.gap || a.firstStreetId - b.firstStreetId);
  return rows.slice(0, topN);
}

export type ColdNumberGap = { n: number; gap: number };

/** Dois números mais «frios» num cruzamento de parâmetros (1–36; zero não entra). */
export type TwoColdestInBucket = {
  category: string;
  items: readonly [ColdNumberGap, ColdNumberGap];
};

export type CrossingAxisKind = "cor-altura" | "cor-paridade" | "altura-paridade";

export type CrossingBucketDef = {
  axis: CrossingAxisKind;
  category: string;
  nums: readonly number[];
};

function numbers1to36Where(pred: (n: number) => boolean): number[] {
  const r: number[] = [];
  for (let n = 1; n <= 36; n++) {
    if (pred(n)) r.push(n);
  }
  return r;
}

/** Definições estáveis dos 12 cruzamentos (cor×metade, cor×paridade, metade×paridade). */
export const CROSSING_BUCKET_DEFINITIONS: readonly CrossingBucketDef[] = Object.freeze([
  {
    axis: "cor-altura",
    category: "Vermelho · Baixo (1–18)",
    nums: numbers1to36Where((n) => colorOf(n) === "Vermelho" && heightOf(n) === "Baixo"),
  },
  {
    axis: "cor-altura",
    category: "Vermelho · Alto (19–36)",
    nums: numbers1to36Where((n) => colorOf(n) === "Vermelho" && heightOf(n) === "Alto"),
  },
  {
    axis: "cor-altura",
    category: "Preto · Baixo (1–18)",
    nums: numbers1to36Where((n) => colorOf(n) === "Preto" && heightOf(n) === "Baixo"),
  },
  {
    axis: "cor-altura",
    category: "Preto · Alto (19–36)",
    nums: numbers1to36Where((n) => colorOf(n) === "Preto" && heightOf(n) === "Alto"),
  },
  {
    axis: "cor-paridade",
    category: "Vermelho · Par",
    nums: numbers1to36Where((n) => colorOf(n) === "Vermelho" && parityOf(n) === "Par"),
  },
  {
    axis: "cor-paridade",
    category: "Vermelho · Ímpar",
    nums: numbers1to36Where((n) => colorOf(n) === "Vermelho" && parityOf(n) === "Impar"),
  },
  {
    axis: "cor-paridade",
    category: "Preto · Par",
    nums: numbers1to36Where((n) => colorOf(n) === "Preto" && parityOf(n) === "Par"),
  },
  {
    axis: "cor-paridade",
    category: "Preto · Ímpar",
    nums: numbers1to36Where((n) => colorOf(n) === "Preto" && parityOf(n) === "Impar"),
  },
  {
    axis: "altura-paridade",
    category: "Baixo (1–18) · Par",
    nums: numbers1to36Where((n) => heightOf(n) === "Baixo" && parityOf(n) === "Par"),
  },
  {
    axis: "altura-paridade",
    category: "Baixo (1–18) · Ímpar",
    nums: numbers1to36Where((n) => heightOf(n) === "Baixo" && parityOf(n) === "Impar"),
  },
  {
    axis: "altura-paridade",
    category: "Alto (19–36) · Par",
    nums: numbers1to36Where((n) => heightOf(n) === "Alto" && parityOf(n) === "Par"),
  },
  {
    axis: "altura-paridade",
    category: "Alto (19–36) · Ímpar",
    nums: numbers1to36Where((n) => heightOf(n) === "Alto" && parityOf(n) === "Impar"),
  },
]);

const CROSSING_OPPOSITE_CATEGORY: Record<string, string> = {
  "Vermelho · Baixo (1–18)": "Preto · Alto (19–36)",
  "Preto · Alto (19–36)": "Vermelho · Baixo (1–18)",
  "Vermelho · Alto (19–36)": "Preto · Baixo (1–18)",
  "Preto · Baixo (1–18)": "Vermelho · Alto (19–36)",
  "Baixo (1–18) · Par": "Alto (19–36) · Ímpar",
  "Alto (19–36) · Ímpar": "Baixo (1–18) · Par",
  "Baixo (1–18) · Ímpar": "Alto (19–36) · Par",
  "Alto (19–36) · Par": "Baixo (1–18) · Ímpar",
};

/** Par oposto no mesmo eixo (cor×altura ou altura×paridade). */
export function crossingOppositeBucketDef(def: CrossingBucketDef): CrossingBucketDef | null {
  const cat = CROSSING_OPPOSITE_CATEGORY[def.category];
  if (!cat) return null;
  return CROSSING_BUCKET_DEFINITIONS.find((d) => d.category === cat) ?? null;
}

/**
 * Trava de segurança (ausência): não armar indicação enquanto o giro mais recente
 * pertencer ao cruzamento oposto do alvo (ex.: alvo Par·Baixo, último Ímpar·Alto → aguarda).
 */
export function crossingAbsenceIndicationBlockedByOppositeSpin(
  historyNewestFirst: readonly number[],
  target: CrossingBucketDef,
): boolean {
  if (historyNewestFirst.length === 0) return false;
  const last = historyNewestFirst[0]!;
  if (last === 0) return false;
  const opposite = crossingOppositeBucketDef(target);
  if (!opposite) return false;
  return opposite.nums.includes(last);
}

/** Irmão no mesmo eixo: mesma cor ou paridade, altura oposta. */
export function crossingHeightSiblingBucketDef(def: CrossingBucketDef): CrossingBucketDef | null {
  const sample = def.nums[0];
  if (sample == null) return null;

  if (def.axis === "cor-altura") {
    const col = colorOf(sample);
    const alt = heightOf(sample);
    if (col === "Zero" || alt === "Zero") return null;
    const oppositeAlt = alt === "Alto" ? "Baixo" : "Alto";
    return (
      CROSSING_BUCKET_DEFINITIONS.find(
        (d) =>
          d.axis === "cor-altura" &&
          d.nums.some((n) => colorOf(n) === col && heightOf(n) === oppositeAlt),
      ) ?? null
    );
  }

  if (def.axis === "altura-paridade") {
    const alt = heightOf(sample);
    const par = parityOf(sample);
    if (alt === "Zero" || par === "Zero") return null;
    const oppositeAlt = alt === "Alto" ? "Baixo" : "Alto";
    return (
      CROSSING_BUCKET_DEFINITIONS.find(
        (d) =>
          d.axis === "altura-paridade" &&
          d.nums.some((n) => heightOf(n) === oppositeAlt && parityOf(n) === par),
      ) ?? null
    );
  }

  return null;
}

/** Cruzamento do número num eixo (cor×altura ou altura×paridade). */
export function crossingBucketForNumber(
  axis: CrossingAxisKind,
  n: number,
): CrossingBucketDef | null {
  if (n === 0) return null;
  return CROSSING_BUCKET_DEFINITIONS.find((d) => d.axis === axis && d.nums.includes(n)) ?? null;
}

/** Giros consecutivos (do mais recente para trás) em que o cruzamento **não se repete** em sequência. */
export function consecutiveNonRepeatCrossingStreak(
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
): number {
  if (historyNewestFirst.length === 0) return 0;

  let streak = 1;
  for (let i = 0; i < historyNewestFirst.length - 1; i++) {
    const newer = historyNewestFirst[i]!;
    const older = historyNewestFirst[i + 1]!;
    if (newer === 0 || older === 0) break;

    const cNewer = crossingBucketForNumber(axis, newer);
    const cOlder = crossingBucketForNumber(axis, older);
    if (!cNewer || !cOlder || cNewer.category === cOlder.category) break;

    streak++;
  }
  return streak;
}

/** Dois giros seguidos com o mesmo cruzamento no eixo (padrão de repetição). */
export function hasConsecutiveCrossingRepeatOnAxis(
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
): boolean {
  if (historyNewestFirst.length < 2) return false;
  const n0 = historyNewestFirst[0]!;
  const n1 = historyNewestFirst[1]!;
  if (n0 === 0 || n1 === 0) return false;
  const c0 = crossingBucketForNumber(axis, n0);
  const c1 = crossingBucketForNumber(axis, n1);
  return c0 != null && c1 != null && c0.category === c1.category;
}

/** Melhor alerta: eixo com sequência sem repetição ≥ limiar; indica cruzamento do último número. */
export function bestNonRepeatStreakAlert(
  historyNewestFirst: readonly number[],
  axes: readonly CrossingAxisKind[],
  minStreak: number,
): { def: CrossingBucketDef; streak: number } | null {
  if (historyNewestFirst.length === 0) return null;
  const last = historyNewestFirst[0]!;
  if (last === 0) return null;

  let best: { def: CrossingBucketDef; streak: number } | null = null;
  for (const axis of axes) {
    const streak = consecutiveNonRepeatCrossingStreak(historyNewestFirst, axis);
    if (streak < minStreak) continue;
    const def = crossingBucketForNumber(axis, last);
    if (!def) continue;
    if (
      best == null ||
      streak > best.streak ||
      (streak === best.streak && def.category < best.def.category)
    ) {
      best = { def, streak };
    }
  }
  return best;
}

/** Giros desde que **qualquer** número do cruzamento saiu (histórico newest-first). */
export function crossingBucketAbsenceGap(
  historyNewestFirst: readonly number[],
  def: CrossingBucketDef,
): number {
  return spinsSinceHit(historyNewestFirst, new Set(def.nums));
}

/**
 * Melhor alerta por **ausência do cruzamento**: escolhe o bucket com maior gap
 * (giros sem aparecer) ≥ limiar, nos eixos indicados.
 * Ex.: «Preto · Baixo» ausente há 14 giros → alerta Preto · Baixo.
 */
export function bestAbsentBucketCrossingAlert(
  historyNewestFirst: readonly number[],
  axes: readonly CrossingAxisKind[],
  minAbsenceSpins: number,
): { def: CrossingBucketDef; bucketGap: number } | null {
  if (historyNewestFirst.length === 0) return null;

  let best: { def: CrossingBucketDef; bucketGap: number } | null = null;

  for (const def of CROSSING_BUCKET_DEFINITIONS) {
    if (!axes.includes(def.axis)) continue;
    const bucketGap = crossingBucketAbsenceGap(historyNewestFirst, def);
    if (bucketGap < minAbsenceSpins) continue;
    if (
      best == null ||
      bucketGap > best.bucketGap ||
      (bucketGap === best.bucketGap && def.category < best.def.category)
    ) {
      best = { def, bucketGap };
    }
  }

  return best;
}

/** @deprecated Use {@link bestAbsentBucketCrossingAlert}. */
export function bestAbsentCrossingOnAxes(
  historyNewestFirst: readonly number[],
  axes: readonly CrossingAxisKind[],
  minAbsenceSpins: number,
): { def: CrossingBucketDef; absenceGap: number } | null {
  const alert = bestAbsentBucketCrossingAlert(historyNewestFirst, axes, minAbsenceSpins);
  if (!alert) return null;
  return { def: alert.def, absenceGap: alert.bucketGap };
}

function hitsSinceMetricLastHit(
  historyNewestFirst: readonly number[],
  metric: CrossingBucketDef,
  counter: CrossingBucketDef,
): number {
  const metricSet = new Set(metric.nums);
  const counterSet = new Set(counter.nums);

  let lastMetricIdx = historyNewestFirst.length;
  for (let i = 0; i < historyNewestFirst.length; i++) {
    const n = historyNewestFirst[i]!;
    if (n === 0) continue;
    if (metricSet.has(n)) {
      lastMetricIdx = i;
      break;
    }
  }

  let count = 0;
  for (let i = 0; i < lastMetricIdx; i++) {
    const n = historyNewestFirst[i]!;
    if (n === 0) continue;
    if (counterSet.has(n)) count++;
  }
  return count;
}

/** Ocorrências do cruzamento oposto desde a última saída do cruzamento alvo (histórico newest-first). */
export function oppositeFactorHitsSinceTargetLastHit(
  historyNewestFirst: readonly number[],
  target: CrossingBucketDef,
): number {
  const opposite = crossingOppositeBucketDef(target);
  if (!opposite) return 0;
  return hitsSinceMetricLastHit(historyNewestFirst, target, opposite);
}

function twoColdestInSet(
  historyNewestFirst: readonly number[],
  numbers: readonly number[],
): readonly [ColdNumberGap, ColdNumberGap] {
  const ranked = numbers.map((n) => ({
    n,
    gap: spinsSinceHit(historyNewestFirst, new Set([n])),
  }));
  ranked.sort((a, b) => b.gap - a.gap || a.n - b.n);
  const a = ranked[0] ?? { n: 0, gap: 0 };
  const b = ranked[1] ?? a;
  return [a, b] as const;
}

/** Dois números mais frios num subconjunto de 1–36 (mesma métrica que os painéis de frieza). */
export function twoColdestNumbersInNumberSet(
  historyNewestFirst: readonly number[],
  numbers: readonly number[],
): readonly [number, number] {
  const [x, y] = twoColdestInSet(historyNewestFirst, numbers);
  return [x.n, y.n] as const;
}

export type ColdestTwoCrossGroups = {
  corAltura: TwoColdestInBucket[];
  corParidade: TwoColdestInBucket[];
  alturaParidade: TwoColdestInBucket[];
};

export type WinningColdestCrossingPick = {
  axis: CrossingAxisKind;
  category: string;
  nums: readonly number[];
  /**
   * Giros desde que **qualquer** número deste cruzamento saiu (1–36). Mede ausência do *cruzamento* na mesa;
   * é o critério **principal** para escolher o cruzamento (ex.: se 10 e 18 saíram há pouco, «Baixo·Par» fica com bucketGap baixo).
   */
  bucketGap: number;
  /** Soma dos gaps dos dois números mais frios **dentro** do cruzamento — desempate quando `bucketGap` empata. */
  pairGapSum: number;
  excludedPair: readonly [number, number];
};

/**
 * Entre os 12 cruzamentos (cor×metade, cor×paridade, metade×paridade):
 * 1. **Principal:** maior `bucketGap` — giros desde a última saída de **qualquer** número daquele cruzamento.
 * 2. **Desempate:** maior soma de gaps dos dois números mais frios **no** cruzamento.
 * 3. **Empate residual:** `cor-altura` antes de `cor-paridade` antes de `altura-paridade`; depois `category`.
 *
 * Os **exclusivos** são sempre os dois números mais frios no cruzamento vencedor.
 */
export function pickWinningColdestCrossingBucket(
  historyNewestFirst: readonly number[],
): WinningColdestCrossingPick | null {
  if (historyNewestFirst.length === 0) return null;

  const axisOrder: Record<CrossingAxisKind, number> = {
    "cor-altura": 0,
    "cor-paridade": 1,
    "altura-paridade": 2,
  };

  let best: WinningColdestCrossingPick | null = null;

  for (const def of CROSSING_BUCKET_DEFINITIONS) {
    const bucketGap = spinsSinceHit(historyNewestFirst, new Set(def.nums));
    const [g0, g1] = twoColdestInSet(historyNewestFirst, def.nums);
    const pairGapSum = g0.gap + g1.gap;
    const excludedPair: readonly [number, number] = [g0.n, g1.n];
    if (
      best == null ||
      bucketGap > best.bucketGap ||
      (bucketGap === best.bucketGap &&
        (pairGapSum > best.pairGapSum ||
          (pairGapSum === best.pairGapSum &&
            (axisOrder[def.axis] < axisOrder[best.axis] ||
              (def.axis === best.axis && def.category < best.category)))))
    ) {
      best = {
        axis: def.axis,
        category: def.category,
        nums: def.nums,
        bucketGap,
        pairGapSum,
        excludedPair,
      };
    }
  }
  return best;
}

/**
 * Para cada cruzamento de dois parâmetros (cor×metade, cor×paridade, metade×paridade),
 * os **dois** números de 1–36 com maior ausência (giros desde última saída). O zero não entra.
 */
export function coldestTwoByParameterCrossGrouped(
  historyNewestFirst: readonly number[],
): ColdestTwoCrossGroups {
  const byAxis = (axis: CrossingAxisKind) =>
    CROSSING_BUCKET_DEFINITIONS.filter((d) => d.axis === axis).map((d) => ({
      category: d.category,
      items: twoColdestInSet(historyNewestFirst, d.nums),
    }));

  return {
    corAltura: byAxis("cor-altura"),
    corParidade: byAxis("cor-paridade"),
    alturaParidade: byAxis("altura-paridade"),
  };
}
