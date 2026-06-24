import {
  numbersWithinWheelRingSteps,
  type WheelSpinDistanceDatum,
} from "@/lib/roulette/cylinderIndication";

/** Distância no anel ≤ a este valor = «giro curto». */
export const WHEEL_SHORT_CHAIN_SHORT_MAX = 4;
/** Distância no anel ≥ a este valor = «giro longo». */
export const WHEEL_SHORT_CHAIN_LONG_MIN = 9;
/** ± casas no cilindro em torno do último número (9+1+9 = 19 números). */
export const WHEEL_SHORT_CHAIN_NEIGHBOR_STEPS = 9;
/** Mínimo de transições na série para emitir o gatilho (evita ruído). */
export const WHEEL_SHORT_CHAIN_MIN_TRANSITIONS = 45;
/**
 * Vantagem mínima de P(próximo curto | anterior curto) sobre P(próximo curto | anterior não curto)
 * para armar o alerta (com base na amostra).
 */
export const WHEEL_SHORT_CHAIN_PROB_MARGIN = 0.04;

export type WheelShortAfterBucket = "short" | "mid" | "long";

function bucketDistance(d: number, shortMax: number, longMin: number): WheelShortAfterBucket {
  if (d <= shortMax) return "short";
  if (d >= longMin) return "long";
  return "mid";
}

export type WheelShortChainStats = {
  transitionsUsed: number;
  /** Distribuição do giro seguinte quando o anterior foi curto. */
  afterShort: { short: number; mid: number; long: number };
  /** Distribuição do giro seguinte quando o anterior não foi curto (médio ou longo). */
  afterNotShort: { short: number; mid: number; long: number };
  /** P(próximo curto | anterior curto). */
  pNextShortAfterShort: number | null;
  /** P(próximo longo | anterior curto) */
  pNextLongAfterShort: number | null;
  /** P(próximo curto | anterior não curto) */
  pNextShortAfterNotShort: number | null;
  /** P(próximo longo | anterior não curto) */
  pNextLongAfterNotShort: number | null;
};

export function analyzeWheelShortChain(
  series: readonly WheelSpinDistanceDatum[],
  shortMax: number = WHEEL_SHORT_CHAIN_SHORT_MAX,
  longMin: number = WHEEL_SHORT_CHAIN_LONG_MIN,
): WheelShortChainStats {
  const afterShort = { short: 0, mid: 0, long: 0 };
  const afterNotShort = { short: 0, mid: 0, long: 0 };

  for (let i = 1; i < series.length; i++) {
    const prevD = series[i - 1]!.distance;
    const nextD = series[i]!.distance;
    const b = bucketDistance(nextD, shortMax, longMin);
    if (prevD <= shortMax) afterShort[b]++;
    else afterNotShort[b]++;
  }

  const denomShort = afterShort.short + afterShort.mid + afterShort.long;
  const denomNotShort = afterNotShort.short + afterNotShort.mid + afterNotShort.long;

  return {
    transitionsUsed: series.length,
    afterShort: { ...afterShort },
    afterNotShort: { ...afterNotShort },
    pNextShortAfterShort: denomShort > 0 ? afterShort.short / denomShort : null,
    pNextLongAfterShort: denomShort > 0 ? afterShort.long / denomShort : null,
    pNextShortAfterNotShort: denomNotShort > 0 ? afterNotShort.short / denomNotShort : null,
    pNextLongAfterNotShort: denomNotShort > 0 ? afterNotShort.long / denomNotShort : null,
  };
}

export type ShortNeighborGatilhoResult = {
  active: boolean;
  center: number;
  zoneNumbers: number[];
  lastDistance: number;
  stats: WheelShortChainStats;
  summary: string;
};

function pct(n: number): string {
  return n.toLocaleString("pt-PT", { style: "percent", maximumFractionDigits: 1 });
}

export function computeShortNeighborGatilho(
  series: readonly WheelSpinDistanceDatum[],
  opts?: {
    shortMax?: number;
    longMin?: number;
    neighborSteps?: number;
    minTransitions?: number;
    probMargin?: number;
  },
): ShortNeighborGatilhoResult | null {
  if (series.length < 2) return null;

  const shortMax = opts?.shortMax ?? WHEEL_SHORT_CHAIN_SHORT_MAX;
  const longMin = opts?.longMin ?? WHEEL_SHORT_CHAIN_LONG_MIN;
  const neighborSteps = opts?.neighborSteps ?? WHEEL_SHORT_CHAIN_NEIGHBOR_STEPS;
  const minTransitions = opts?.minTransitions ?? WHEEL_SHORT_CHAIN_MIN_TRANSITIONS;
  const probMargin = opts?.probMargin ?? WHEEL_SHORT_CHAIN_PROB_MARGIN;

  const last = series[series.length - 1]!;
  const lastDistance = last.distance;
  const center = last.to;

  const zoneNumbers = numbersWithinWheelRingSteps(center, neighborSteps);
  const stats = analyzeWheelShortChain(series, shortMax, longMin);

  let active = false;
  let summary = "";

  if (series.length < minTransitions) {
    summary = `São precisas pelo menos ${minTransitions} transições na série para o gatilho (tem ${series.length}).`;
  } else if (lastDistance > shortMax) {
    summary = `Última distância no anel = ${lastDistance} (não é «curta» ≤ ${shortMax}). O alerta de zona ±${neighborSteps} casas só arma após um giro curto.`;
  } else {
    const pS = stats.pNextShortAfterShort;
    const pN = stats.pNextShortAfterNotShort;
    const pLongAfterShort = stats.pNextLongAfterShort;

    if (pS != null && pN != null) {
      if (pS >= pN + probMargin) {
        active = true;
        summary = `Última transição foi curta (${lastDistance} casas no anel). Na amostra: P(próximo curto | anterior curto) = ${pct(pS)} vs P(próximo curto | anterior não curto) = ${pct(pN)}. Longo após curto: ${pLongAfterShort != null ? pct(pLongAfterShort) : "—"}.`;
      } else {
        summary = `Última transição curta (${lastDistance}), mas P(próximo curto|curto) = ${pct(pS)} não supera P(próximo curto|não curto) = ${pct(pN)} por uma margem mínima de ${(probMargin * 100).toFixed(0)} p.p. para armar.`;
      }
    } else {
      summary =
        "Não há contagens suficientes nas categorias «após curto» / «após não curto» para estimar as probabilidades.";
    }
  }

  return { active, center, zoneNumbers, lastDistance, stats, summary };
}
