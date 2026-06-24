/**
 * Aprendizado observacional para 2 Fatores crossing — buckets por gatilho, gap e sequência.
 * Não altera o motor; apenas pontua padrões históricos.
 */

import { doisFatoresFactorLabel, type DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import {
  umFatorSpinFactorToken,
  type UmFatorLearningBucket,
} from "@/lib/roulette/umFatorPatternLearning";

export const DOIS_FATORES_LEARNING_STORAGE_KEY = "roulette.doisFatores.patternLearning.v1";
export const DOIS_FATORES_LEARNING_CHANGED_EVENT = "dois-fatores-learning-changed";

export const DOIS_FATORES_LEARNING_DEFAULT_MIN_SAMPLES = 8;
export const DOIS_FATORES_LEARNING_DEFAULT_MIN_WIN_PCT = 55;
export const DOIS_FATORES_LEARNING_PREFIX_SPINS = 4;
export const DOIS_FATORES_LEARNING_MAX_BUCKETS = 400;

export type DoisFatoresLearningSettings = {
  enabled: boolean;
  minSamples: number;
  minWinRatePct: number;
  prefixSpins: number;
};

export type DoisFatoresPatternLearningState = {
  version: 1;
  settings: DoisFatoresLearningSettings;
  buckets: Record<string, UmFatorLearningBucket>;
  periodBuckets: Record<string, UmFatorLearningBucket>;
  lastRebuildAt: number;
  totalResolved: number;
};

export type DoisFatoresLearningScore = {
  key: string;
  winPct: number | null;
  samples: number;
  confidenceScore: number;
  recommended: boolean;
};

export type DoisFatoresLearnedPattern = {
  key: string;
  label: string;
  wins: number;
  losses: number;
  winPct: number;
  samples: number;
};

const DEFAULT_SETTINGS: DoisFatoresLearningSettings = {
  enabled: true,
  minSamples: DOIS_FATORES_LEARNING_DEFAULT_MIN_SAMPLES,
  minWinRatePct: DOIS_FATORES_LEARNING_DEFAULT_MIN_WIN_PCT,
  prefixSpins: DOIS_FATORES_LEARNING_PREFIX_SPINS,
};

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function prefixSequenceKey(historyNewestFirst: readonly number[], prefixSpins: number): string {
  const tokens: string[] = [];
  for (let i = 0; i < prefixSpins && i < historyNewestFirst.length; i++) {
    tokens.push(umFatorSpinFactorToken(historyNewestFirst[i]!));
  }
  return tokens.join(">");
}

export function bucketGapBand(gap: number): string {
  if (gap >= 22) return "22+";
  if (gap >= 18) return "18-21";
  if (gap >= 14) return "14-17";
  return "<14";
}

export function recoveryPeriodKey(recovery: number): string {
  return `rec:${Math.max(0, Math.min(5, recovery))}`;
}

export function buildDoisFatoresLearningKey(
  active: DoisFatoresActive,
  historyAtFormation: readonly number[],
  bucketGap: number,
  recoveryAtEntry: number,
  prefixSpins = DOIS_FATORES_LEARNING_PREFIX_SPINS,
): string {
  const f1 = doisFatoresFactorLabel(active.factor1);
  const f2 = doisFatoresFactorLabel(active.factor2);
  const seq = prefixSequenceKey(historyAtFormation, prefixSpins);
  const gap = bucketGapBand(bucketGap);
  const rec = recoveryPeriodKey(recoveryAtEntry);
  return `${active.pairKind}|${f1}+${f2}|gap:${gap}|${rec}|${seq}`;
}

export function humanLabelForDoisFatoresLearningKey(key: string): string {
  const parts = key.split("|");
  if (parts.length < 5) return key;
  const [axis, factors, gap, rec, seq] = parts;
  const seqShort = seq ? seq.replace(/>/g, "·") : "—";
  return `${axis} · ${factors} · ${gap} · ${rec} · ${seqShort}`;
}

export function defaultDoisFatoresPatternLearningState(): DoisFatoresPatternLearningState {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    buckets: {},
    periodBuckets: {},
    lastRebuildAt: 0,
    totalResolved: 0,
  };
}

function parseSettings(raw: unknown): DoisFatoresLearningSettings {
  const o = (raw ?? {}) as Partial<DoisFatoresLearningSettings>;
  return {
    enabled: o.enabled !== false,
    minSamples: clampInt(o.minSamples ?? DOIS_FATORES_LEARNING_DEFAULT_MIN_SAMPLES, 3, 50),
    minWinRatePct: clampPct(o.minWinRatePct ?? DOIS_FATORES_LEARNING_DEFAULT_MIN_WIN_PCT),
    prefixSpins: clampInt(o.prefixSpins ?? DOIS_FATORES_LEARNING_PREFIX_SPINS, 0, 8),
  };
}

export function readDoisFatoresPatternLearningState(): DoisFatoresPatternLearningState {
  if (typeof window === "undefined") return defaultDoisFatoresPatternLearningState();
  try {
    const raw = localStorage.getItem(DOIS_FATORES_LEARNING_STORAGE_KEY);
    if (!raw) return defaultDoisFatoresPatternLearningState();
    const o = JSON.parse(raw) as Partial<DoisFatoresPatternLearningState>;
    return {
      version: 1,
      settings: parseSettings(o.settings),
      buckets: (o.buckets as Record<string, UmFatorLearningBucket>) ?? {},
      periodBuckets: (o.periodBuckets as Record<string, UmFatorLearningBucket>) ?? {},
      lastRebuildAt: Number(o.lastRebuildAt) || 0,
      totalResolved: Math.max(0, Number(o.totalResolved) || 0),
    };
  } catch {
    return defaultDoisFatoresPatternLearningState();
  }
}

export function writeDoisFatoresPatternLearningState(state: DoisFatoresPatternLearningState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DOIS_FATORES_LEARNING_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(DOIS_FATORES_LEARNING_CHANGED_EVENT));
  } catch {
    /* quota */
  }
}

function scoreFromBucket(
  bucket: UmFatorLearningBucket | undefined,
  settings: DoisFatoresLearningSettings,
): Omit<DoisFatoresLearningScore, "key"> {
  const wins = bucket?.wins ?? 0;
  const losses = bucket?.losses ?? 0;
  const samples = wins + losses;
  const winPct = samples > 0 ? (100 * wins) / samples : null;
  const confidenceWeight = samples > 0 ? Math.min(1, samples / settings.minSamples) : 0;
  const confidenceScore =
    winPct != null ? confidenceWeight * winPct + (1 - confidenceWeight) * 50 : 50;
  const recommended =
    !settings.enabled ||
    samples < settings.minSamples ||
    (winPct != null && winPct >= settings.minWinRatePct);
  return { winPct, samples, confidenceScore, recommended };
}

export function scoreDoisFatoresFormation(
  active: DoisFatoresActive,
  historyAtFormation: readonly number[],
  bucketGap: number,
  recoveryAtEntry: number,
  state: DoisFatoresPatternLearningState = readDoisFatoresPatternLearningState(),
): DoisFatoresLearningScore {
  const key = buildDoisFatoresLearningKey(
    active,
    historyAtFormation,
    bucketGap,
    recoveryAtEntry,
    state.settings.prefixSpins,
  );
  const bucket = state.buckets[key];
  return { ...scoreFromBucket(bucket, state.settings), key };
}

export function listTopDoisFatoresLearnedPatterns(
  state: DoisFatoresPatternLearningState,
  limit = 6,
  minSamples = 3,
): DoisFatoresLearnedPattern[] {
  const patterns: DoisFatoresLearnedPattern[] = [];
  for (const [key, bucket] of Object.entries(state.buckets)) {
    const samples = bucket.wins + bucket.losses;
    if (samples < minSamples) continue;
    patterns.push({
      key,
      label: humanLabelForDoisFatoresLearningKey(key),
      wins: bucket.wins,
      losses: bucket.losses,
      winPct: (100 * bucket.wins) / samples,
      samples,
    });
  }
  patterns.sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.samples - a.samples;
  });
  return patterns.slice(0, limit);
}

export function listDoisFatoresPeriodInsights(
  state: DoisFatoresPatternLearningState,
  limit = 4,
): DoisFatoresLearnedPattern[] {
  const patterns: DoisFatoresLearnedPattern[] = [];
  for (const [key, bucket] of Object.entries(state.periodBuckets)) {
    const samples = bucket.wins + bucket.losses;
    if (samples < 3) continue;
    patterns.push({
      key,
      label: key.replace("rec:", "Recuperação "),
      wins: bucket.wins,
      losses: bucket.losses,
      winPct: (100 * bucket.wins) / samples,
      samples,
    });
  }
  patterns.sort((a, b) => b.winPct - a.winPct);
  return patterns.slice(0, limit);
}
