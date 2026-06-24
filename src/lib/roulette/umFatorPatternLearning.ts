/**
 * Aprendizado local (IA heurística) para 1 Fator — buckets por assinatura de sequência.
 * Reconstrói padrões a partir do histórico e pontua gatilhos mais acertivos.
 */

import { doisFatoresFactorLabel } from "@/lib/roulette/doisFatoresStrategy";
import type { UmFatorActive } from "@/lib/roulette/umFatorStrategy";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";

export const UM_FATOR_LEARNING_STORAGE_KEY = "roulette.umFator.patternLearning.v1";
export const UM_FATOR_LEARNING_CHANGED_EVENT = "um-fator-learning-changed";

export const UM_FATOR_LEARNING_DEFAULT_MIN_SAMPLES = 8;
export const UM_FATOR_LEARNING_DEFAULT_MIN_WIN_PCT = 55;
export const UM_FATOR_LEARNING_PREFIX_SPINS = 4;
export const UM_FATOR_LEARNING_MAX_BUCKETS = 400;

export type UmFatorLearningBucket = {
  wins: number;
  losses: number;
};

export type UmFatorLearningSettings = {
  enabled: boolean;
  /** Quando true, o learning pode reordenar/filtrar entradas no motor (opt-in). */
  motorInfluence: boolean;
  /** Bloqueia armar entradas abaixo do limiar (após amostras mínimas). Só com motorInfluence. */
  filterWeakEntries: boolean;
  minSamples: number;
  minWinRatePct: number;
  prefixSpins: number;
};

export type UmFatorPatternLearningState = {
  version: 1;
  settings: UmFatorLearningSettings;
  buckets: Record<string, UmFatorLearningBucket>;
  /** Períodos por nível de recuperação no momento da entrada. */
  periodBuckets: Record<string, UmFatorLearningBucket>;
  lastRebuildAt: number;
  totalResolved: number;
};

export type UmFatorLearningScore = {
  key: string;
  winPct: number | null;
  samples: number;
  /** 0–100 — taxa ajustada por confiança (amostras baixas puxam para 50%). */
  confidenceScore: number;
  recommended: boolean;
};

export type UmFatorLearnedPattern = {
  key: string;
  label: string;
  wins: number;
  losses: number;
  winPct: number;
  samples: number;
};

const DEFAULT_SETTINGS: UmFatorLearningSettings = {
  enabled: true,
  motorInfluence: false,
  filterWeakEntries: false,
  minSamples: UM_FATOR_LEARNING_DEFAULT_MIN_SAMPLES,
  minWinRatePct: UM_FATOR_LEARNING_DEFAULT_MIN_WIN_PCT,
  prefixSpins: UM_FATOR_LEARNING_PREFIX_SPINS,
};

export function defaultUmFatorPatternLearningState(): UmFatorPatternLearningState {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    buckets: {},
    periodBuckets: {},
    lastRebuildAt: 0,
    totalResolved: 0,
  };
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function colorToken(n: number): string {
  const c = colorOf(n);
  if (c === "Vermelho") return "V";
  if (c === "Preto") return "P";
  return "0";
}

function heightToken(n: number): string {
  const h = heightOf(n);
  if (h === "Baixo") return "B";
  if (h === "Alto") return "A";
  return "0";
}

function parityToken(n: number): string {
  const p = parityOf(n);
  if (p === "Par") return "E";
  if (p === "Ímpar") return "I";
  return "0";
}

/** Token compacto cor·altura·paridade por giro. */
export function umFatorSpinFactorToken(n: number): string {
  if (n === 0) return "000";
  return `${colorToken(n)}${heightToken(n)}${parityToken(n)}`;
}

function prefixSequenceKey(historyNewestFirst: readonly number[], prefixSpins: number): string {
  const tokens: string[] = [];
  for (let i = 3; i < 3 + prefixSpins && i < historyNewestFirst.length; i++) {
    tokens.push(umFatorSpinFactorToken(historyNewestFirst[i]!));
  }
  return tokens.join(">");
}

/** Assinatura do gatilho + contexto de sequência anterior. */
export function buildUmFatorLearningKey(
  active: UmFatorActive,
  historyAtFormation: readonly number[],
  prefixSpins = UM_FATOR_LEARNING_PREFIX_SPINS,
): string {
  const t1 = doisFatoresFactorLabel(active.triggerFactor1);
  const t2 = doisFatoresFactorLabel(active.triggerFactor2);
  const t3 = doisFatoresFactorLabel(active.triggerFactor3);
  const alert = doisFatoresFactorLabel(active.alertFactor);
  const seq = prefixSequenceKey(historyAtFormation, prefixSpins);
  return `${active.pairKind}|${active.triggerMatchTier}|${t1}+${t2}+${t3}|${alert}|${seq}`;
}

export function humanLabelForLearningKey(key: string): string {
  const parts = key.split("|");
  if (parts.length < 5) return key;
  const [axis, tier, triggers, alert, seq] = parts;
  const tierLabel = tier === "three" ? "3F" : "2F";
  const seqShort = seq ? seq.replace(/>/g, "·") : "—";
  return `${axis} · ${tierLabel} · ${triggers} → ${alert} · ${seqShort}`;
}

function parseSettings(raw: unknown): UmFatorLearningSettings {
  const o = (raw ?? {}) as Partial<UmFatorLearningSettings>;
  return {
    enabled: o.enabled !== false,
    motorInfluence: o.motorInfluence === true,
    filterWeakEntries: o.filterWeakEntries === true,
    minSamples: clampInt(
      o.minSamples ?? UM_FATOR_LEARNING_DEFAULT_MIN_SAMPLES,
      3,
      50,
    ),
    minWinRatePct: clampPct(o.minWinRatePct ?? UM_FATOR_LEARNING_DEFAULT_MIN_WIN_PCT),
    prefixSpins: clampInt(o.prefixSpins ?? UM_FATOR_LEARNING_PREFIX_SPINS, 0, 8),
  };
}

function parseBucket(raw: unknown): UmFatorLearningBucket {
  const o = (raw ?? {}) as { wins?: number; losses?: number };
  return {
    wins: Math.max(0, Number(o.wins) || 0),
    losses: Math.max(0, Number(o.losses) || 0),
  };
}

export function parseUmFatorPatternLearningState(raw: unknown): UmFatorPatternLearningState {
  const base = defaultUmFatorPatternLearningState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<UmFatorPatternLearningState>;
  const buckets: Record<string, UmFatorLearningBucket> = {};
  if (o.buckets && typeof o.buckets === "object") {
    for (const [k, v] of Object.entries(o.buckets)) {
      buckets[k] = parseBucket(v);
    }
  }
  return {
    version: 1,
    settings: parseSettings(o.settings),
    buckets,
    periodBuckets:
      o.periodBuckets && typeof o.periodBuckets === "object"
        ? Object.fromEntries(
            Object.entries(o.periodBuckets).map(([k, v]) => [k, parseBucket(v)]),
          )
        : {},
    lastRebuildAt: Number(o.lastRebuildAt) || 0,
    totalResolved: Math.max(0, Number(o.totalResolved) || 0),
  };
}

export function readUmFatorPatternLearningState(): UmFatorPatternLearningState {
  if (typeof window === "undefined") return defaultUmFatorPatternLearningState();
  try {
    const raw = localStorage.getItem(UM_FATOR_LEARNING_STORAGE_KEY);
    if (!raw) return defaultUmFatorPatternLearningState();
    return parseUmFatorPatternLearningState(JSON.parse(raw));
  } catch {
    return defaultUmFatorPatternLearningState();
  }
}

export function writeUmFatorPatternLearningState(state: UmFatorPatternLearningState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UM_FATOR_LEARNING_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(UM_FATOR_LEARNING_CHANGED_EVENT));
  } catch {
    /* quota */
  }
}

function trimBuckets(
  buckets: Record<string, UmFatorLearningBucket>,
  maxBuckets: number,
): Record<string, UmFatorLearningBucket> {
  const entries = Object.entries(buckets);
  if (entries.length <= maxBuckets) return buckets;
  entries.sort((a, b) => {
    const sa = a[1].wins + a[1].losses;
    const sb = b[1].wins + b[1].losses;
    return sb - sa;
  });
  return Object.fromEntries(entries.slice(0, maxBuckets));
}

function scoreFromBucket(
  bucket: UmFatorLearningBucket | undefined,
  settings: UmFatorLearningSettings,
): UmFatorLearningScore {
  const wins = bucket?.wins ?? 0;
  const losses = bucket?.losses ?? 0;
  const samples = wins + losses;
  const winPct = samples > 0 ? (100 * wins) / samples : null;
  const confidenceWeight = samples > 0 ? Math.min(1, samples / settings.minSamples) : 0;
  const confidenceScore =
    winPct != null ? confidenceWeight * winPct + (1 - confidenceWeight) * 50 : 50;
  const recommended =
    !settings.enabled ||
    !settings.filterWeakEntries ||
    samples < settings.minSamples ||
    (winPct != null && winPct >= settings.minWinRatePct);
  return {
    key: "",
    winPct,
    samples,
    confidenceScore,
    recommended,
  };
}

export function scoreUmFatorFormation(
  active: UmFatorActive,
  historyAtFormation: readonly number[],
  state: UmFatorPatternLearningState = readUmFatorPatternLearningState(),
): UmFatorLearningScore {
  const key = buildUmFatorLearningKey(
    active,
    historyAtFormation,
    state.settings.prefixSpins,
  );
  const bucket = state.buckets[key];
  const scored = scoreFromBucket(bucket, state.settings);
  return { ...scored, key };
}

export function isUmFatorFormationRecommended(
  active: UmFatorActive,
  historyAtFormation: readonly number[],
  state?: UmFatorPatternLearningState,
): boolean {
  const s = state ?? readUmFatorPatternLearningState();
  if (!s.settings.motorInfluence || !s.settings.filterWeakEntries) return true;
  return scoreUmFatorFormation(active, historyAtFormation, s).recommended;
}

export function rankUmFatorPicksByLearning<T extends { active: UmFatorActive }>(
  picks: readonly T[],
  histories: Record<number, readonly number[]>,
  tableIdOf: (pick: T) => number,
  state: UmFatorPatternLearningState = readUmFatorPatternLearningState(),
): T[] {
  if (!state.settings.enabled || !state.settings.motorInfluence || picks.length <= 1) return [...picks];
  return [...picks].sort((a, b) => {
    const scoreA = scoreUmFatorFormation(a.active, histories[tableIdOf(a)] ?? [], state);
    const scoreB = scoreUmFatorFormation(b.active, histories[tableIdOf(b)] ?? [], state);
    if (scoreB.confidenceScore !== scoreA.confidenceScore) {
      return scoreB.confidenceScore - scoreA.confidenceScore;
    }
    if (scoreB.samples !== scoreA.samples) return scoreB.samples - scoreA.samples;
    return tableIdOf(a) - tableIdOf(b);
  });
}

export function listUmFatorPeriodInsights(
  state: UmFatorPatternLearningState,
  limit = 4,
): UmFatorLearnedPattern[] {
  const patterns: UmFatorLearnedPattern[] = [];
  for (const [key, bucket] of Object.entries(state.periodBuckets ?? {})) {
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

export function listTopUmFatorLearnedPatterns(
  state: UmFatorPatternLearningState,
  limit = 6,
  minSamples = 3,
): UmFatorLearnedPattern[] {
  const patterns: UmFatorLearnedPattern[] = [];
  for (const [key, bucket] of Object.entries(state.buckets)) {
    const samples = bucket.wins + bucket.losses;
    if (samples < minSamples) continue;
    patterns.push({
      key,
      label: humanLabelForLearningKey(key),
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

export function updateUmFatorLearningSettings(
  patch: Partial<UmFatorLearningSettings>,
): UmFatorPatternLearningState {
  const prev = readUmFatorPatternLearningState();
  const next: UmFatorPatternLearningState = {
    ...prev,
    settings: {
      ...prev.settings,
      ...patch,
      minSamples: patch.minSamples != null ? clampInt(patch.minSamples, 3, 50) : prev.settings.minSamples,
      minWinRatePct:
        patch.minWinRatePct != null ? clampPct(patch.minWinRatePct) : prev.settings.minWinRatePct,
      prefixSpins:
        patch.prefixSpins != null ? clampInt(patch.prefixSpins, 0, 8) : prev.settings.prefixSpins,
    },
  };
  writeUmFatorPatternLearningState(next);
  return next;
}

export function resetUmFatorPatternLearning(): void {
  writeUmFatorPatternLearningState(defaultUmFatorPatternLearningState());
}
