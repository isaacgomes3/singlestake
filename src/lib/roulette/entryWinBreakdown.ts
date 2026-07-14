import type {
  CrossingAbsenceAxisStats,
  CrossingOppositeAbsenceAxisStats,
  CrossingPatternKindStats,
  FibonacciZoneKindStats,
  RotatingRoomSessionStats,
  UmFatorMatchTierStats,
} from "@/lib/roulette/rotatingRoomStrategy";
import type { CrossingPatternKind } from "@/lib/roulette/doisFatoresPatternCrossing";
import type { CrossingAxisKind } from "@/lib/roulette/liveTableColdStats";
import { crossingAxisKindToAbsenceKey } from "@/lib/roulette/crossingAbsencePrefs";
import type { UmFatorTriggerMatchTier } from "@/lib/roulette/umFatorStrategy";
import type { FibonacciZoneKind } from "@/lib/roulette/rotatingRoomFibonacciStrategy";

export type EntryWinBreakdown = {
  totalEntries: number;
  overallWinPct: number;
  /** Distribuição das vitórias: coluna N = vitórias no nível N ÷ total de vitórias (ex.: 4 vitórias, 3 sem rec. → 75% / 25%). */
  winPctAtRecovery: readonly number[];
};

export function emptyRecoveryLevelCounts(maxRecovery: number): number[] {
  return Array.from({ length: maxRecovery + 1 }, () => 0);
}

export function emptyFibonacciZoneKindStats(): FibonacciZoneKindStats {
  return {
    dozen: { wins: 0, losses: 0 },
    column: { wins: 0, losses: 0 },
  };
}

export function parseFibonacciZoneKindStats(raw: unknown): FibonacciZoneKindStats {
  const o = (raw ?? {}) as { dozen?: unknown; column?: unknown };
  return {
    dozen: parseUmFatorMatchTierBucket(o.dozen),
    column: parseUmFatorMatchTierBucket(o.column),
  };
}

export function normalizeFibonacciZoneKindStats(
  stats: FibonacciZoneKindStats | undefined,
): FibonacciZoneKindStats {
  if (!stats) return emptyFibonacciZoneKindStats();
  return parseFibonacciZoneKindStats(stats);
}

export function emptyCrossingPatternKindStats(): CrossingPatternKindStats {
  return {
    primary: { wins: 0, losses: 0 },
    secondary: { wins: 0, losses: 0 },
    tertiary: { wins: 0, losses: 0 },
  };
}

export function parseCrossingPatternKindStats(raw: unknown): CrossingPatternKindStats {
  const o = (raw ?? {}) as {
    primary?: unknown;
    secondary?: unknown;
    tertiary?: unknown;
  };
  return {
    primary: parseUmFatorMatchTierBucket(o.primary),
    secondary: parseUmFatorMatchTierBucket(o.secondary),
    tertiary: parseUmFatorMatchTierBucket(o.tertiary),
  };
}

export function normalizeCrossingPatternKindStats(
  stats: CrossingPatternKindStats | undefined,
): CrossingPatternKindStats {
  if (!stats) return emptyCrossingPatternKindStats();
  return parseCrossingPatternKindStats(stats);
}

export function emptyCrossingAbsenceAxisStats(): CrossingAbsenceAxisStats {
  return {
    corAltura: { wins: 0, losses: 0 },
    alturaParidade: { wins: 0, losses: 0 },
  };
}

export function parseCrossingAbsenceAxisStats(raw: unknown): CrossingAbsenceAxisStats {
  const o = (raw ?? {}) as { corAltura?: unknown; alturaParidade?: unknown };
  return {
    corAltura: parseUmFatorMatchTierBucket(o.corAltura),
    alturaParidade: parseUmFatorMatchTierBucket(o.alturaParidade),
  };
}

export function normalizeCrossingAbsenceAxisStats(
  stats: CrossingAbsenceAxisStats | undefined,
): CrossingAbsenceAxisStats {
  if (!stats) return emptyCrossingAbsenceAxisStats();
  return parseCrossingAbsenceAxisStats(stats);
}

export function emptyUmFatorMatchTierStats(): UmFatorMatchTierStats {
  return {
    twoEqualFactors: { wins: 0, losses: 0 },
    threeEqualFactors: { wins: 0, losses: 0 },
  };
}

function parseUmFatorMatchTierBucket(raw: unknown): { wins: number; losses: number } {
  const o = (raw ?? {}) as { wins?: number; losses?: number };
  return {
    wins: Math.max(0, Number(o.wins) || 0),
    losses: Math.max(0, Number(o.losses) || 0),
  };
}

export function parseUmFatorMatchTierStats(raw: unknown): UmFatorMatchTierStats {
  const o = (raw ?? {}) as {
    twoEqualFactors?: unknown;
    threeEqualFactors?: unknown;
  };
  return {
    twoEqualFactors: parseUmFatorMatchTierBucket(o.twoEqualFactors),
    threeEqualFactors: parseUmFatorMatchTierBucket(o.threeEqualFactors),
  };
}

export function normalizeUmFatorMatchTierStats(
  stats: UmFatorMatchTierStats | undefined,
): UmFatorMatchTierStats {
  if (!stats) return emptyUmFatorMatchTierStats();
  return parseUmFatorMatchTierStats(stats);
}

export function parseRecoveryLevelCounts(raw: unknown, maxRecovery: number): number[] {
  const base = emptyRecoveryLevelCounts(maxRecovery);
  if (!Array.isArray(raw)) return base;
  for (let i = 0; i <= maxRecovery; i++) {
    const n = Number(raw[i]);
    if (Number.isFinite(n) && n >= 0) base[i] = n;
  }
  return base;
}

function parsePairIndicationStats(
  raw: unknown,
): Record<string, { wins: number; losses: number }> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, { wins: number; losses: number }> = {};
  for (const [id, slot] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || !slot || typeof slot !== "object") continue;
    const o = slot as { wins?: number; losses?: number };
    out[id] = {
      wins: Math.max(0, Number(o.wins) || 0),
      losses: Math.max(0, Number(o.losses) || 0),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseOutcomeHistory(raw: unknown): Array<"W" | "L"> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<"W" | "L"> = [];
  for (const item of raw) {
    if (item === "W" || item === "L") out.push(item);
  }
  return out.length > 0 ? out.slice(-200) : undefined;
}

export function parseRotatingRoomSessionStats(raw: unknown, maxRecovery = 5): RotatingRoomSessionStats {
  const o = (raw ?? {}) as {
    wins?: number;
    losses?: number;
    winsAtRecovery?: unknown;
    lossesAtRecovery?: unknown;
    umFatorMatchTier?: unknown;
    crossingPatternKind?: unknown;
    crossingAbsenceAxis?: unknown;
    fibonacciZoneKind?: unknown;
    pairIndication?: unknown;
    outcomeHistory?: unknown;
    indicationOutcomeHistory?: unknown;
  };
  const pairIndication = parsePairIndicationStats(o.pairIndication);
  const outcomeHistory = parseOutcomeHistory(o.outcomeHistory);
  const indicationOutcomeHistory = parseOutcomeHistory(o.indicationOutcomeHistory);
  const base = {
    wins: Number(o.wins) || 0,
    losses: Number(o.losses) || 0,
    winsAtRecovery: parseRecoveryLevelCounts(o.winsAtRecovery, maxRecovery),
    lossesAtRecovery: parseRecoveryLevelCounts(o.lossesAtRecovery, maxRecovery),
    ...(pairIndication ? { pairIndication } : {}),
    ...(outcomeHistory ? { outcomeHistory } : {}),
    ...(indicationOutcomeHistory ? { indicationOutcomeHistory } : {}),
  };
  const withUm =
    o.umFatorMatchTier != null
      ? { ...base, umFatorMatchTier: parseUmFatorMatchTierStats(o.umFatorMatchTier) }
      : base;
  if (o.crossingPatternKind != null) {
    return {
      ...withUm,
      crossingPatternKind: parseCrossingPatternKindStats(o.crossingPatternKind),
      ...(o.fibonacciZoneKind != null
        ? { fibonacciZoneKind: parseFibonacciZoneKindStats(o.fibonacciZoneKind) }
        : {}),
    };
  }
  if (o.fibonacciZoneKind != null) {
    return {
      ...withUm,
      fibonacciZoneKind: parseFibonacciZoneKindStats(o.fibonacciZoneKind),
    };
  }
  return withUm;
}

export function emptyRotatingRoomSessionStats(maxRecovery = 5): RotatingRoomSessionStats {
  return {
    wins: 0,
    losses: 0,
    winsAtRecovery: emptyRecoveryLevelCounts(maxRecovery),
    lossesAtRecovery: emptyRecoveryLevelCounts(maxRecovery),
  };
}

export function normalizeRecoveryLevelCounts(
  counts: readonly number[] | undefined,
  maxRecovery: number,
): number[] {
  return parseRecoveryLevelCounts(counts, maxRecovery);
}

function recoveryIndex(recoveryAtEvent: number, maxRecovery: number): number {
  return Math.min(Math.max(0, recoveryAtEvent), maxRecovery);
}

export function recordRotatingRoomSessionWin(
  stats: RotatingRoomSessionStats,
  recoveryAtWin: number,
  maxRecovery: number,
): RotatingRoomSessionStats {
  const idx = recoveryIndex(recoveryAtWin, maxRecovery);
  const winsAtRecovery = normalizeRecoveryLevelCounts(stats.winsAtRecovery, maxRecovery);
  winsAtRecovery[idx]! += 1;
  return { ...stats, wins: stats.wins + 1, winsAtRecovery };
}

/** Derrota parcial no nível actual — avança recuperação (não fecha o ciclo). */
export function recordRotatingRoomSessionPartialLoss(
  stats: RotatingRoomSessionStats,
  recoveryAtLoss: number,
  maxRecovery: number,
): RotatingRoomSessionStats {
  const idx = recoveryIndex(recoveryAtLoss, maxRecovery);
  const lossesAtRecovery = normalizeRecoveryLevelCounts(stats.lossesAtRecovery, maxRecovery);
  lossesAtRecovery[idx]! += 1;
  return { ...stats, lossesAtRecovery };
}

/** Derrota final no nível actual — fecha o ciclo (placar L). */
export function recordRotatingRoomSessionFinalLoss(
  stats: RotatingRoomSessionStats,
  recoveryAtLoss: number,
  maxRecovery: number,
): RotatingRoomSessionStats {
  const withPartial = recordRotatingRoomSessionPartialLoss(stats, recoveryAtLoss, maxRecovery);
  return { ...withPartial, losses: withPartial.losses + 1 };
}

/**
 * Corrige placar: remove 1 derrota final e regista 1 vitória no mesmo nível de recuperação
 * (ex.: crash do sistema registou L indevidamente).
 */
export function reclassifyOneFinalLossAsWin(
  stats: RotatingRoomSessionStats,
  maxRecovery: number,
): RotatingRoomSessionStats | null {
  if (stats.losses <= 0) return null;

  const lossesAtRecovery = normalizeRecoveryLevelCounts(stats.lossesAtRecovery, maxRecovery);
  const winsAtRecovery = normalizeRecoveryLevelCounts(stats.winsAtRecovery, maxRecovery);

  let lossIdx = -1;
  for (let i = maxRecovery; i >= 0; i--) {
    if (lossesAtRecovery[i]! > 0) {
      lossIdx = i;
      break;
    }
  }

  if (lossIdx >= 0) {
    lossesAtRecovery[lossIdx]! -= 1;
    winsAtRecovery[lossIdx]! += 1;
  } else {
    winsAtRecovery[0]! += 1;
  }

  return {
    ...stats,
    losses: stats.losses - 1,
    wins: stats.wins + 1,
    lossesAtRecovery,
    winsAtRecovery,
  };
}

export function recordUmFatorMatchTierWin(
  stats: RotatingRoomSessionStats,
  tier: UmFatorTriggerMatchTier,
): RotatingRoomSessionStats {
  const umFatorMatchTier = normalizeUmFatorMatchTierStats(stats.umFatorMatchTier);
  const key = tier === "two" ? "twoEqualFactors" : "threeEqualFactors";
  return {
    ...stats,
    umFatorMatchTier: {
      ...umFatorMatchTier,
      [key]: {
        wins: umFatorMatchTier[key].wins + 1,
        losses: umFatorMatchTier[key].losses,
      },
    },
  };
}

export function recordUmFatorMatchTierLoss(
  stats: RotatingRoomSessionStats,
  tier: UmFatorTriggerMatchTier,
): RotatingRoomSessionStats {
  const umFatorMatchTier = normalizeUmFatorMatchTierStats(stats.umFatorMatchTier);
  const key = tier === "two" ? "twoEqualFactors" : "threeEqualFactors";
  return {
    ...stats,
    umFatorMatchTier: {
      ...umFatorMatchTier,
      [key]: {
        wins: umFatorMatchTier[key].wins,
        losses: umFatorMatchTier[key].losses + 1,
      },
    },
  };
}

function crossingPatternKindStatsKey(
  kind: CrossingPatternKind,
): keyof CrossingPatternKindStats {
  return kind;
}

export function recordCrossingPatternKindWin(
  stats: RotatingRoomSessionStats,
  kind: CrossingPatternKind,
): RotatingRoomSessionStats {
  const crossingPatternKind = normalizeCrossingPatternKindStats(stats.crossingPatternKind);
  const key = crossingPatternKindStatsKey(kind);
  return {
    ...stats,
    crossingPatternKind: {
      ...crossingPatternKind,
      [key]: {
        wins: crossingPatternKind[key].wins + 1,
        losses: crossingPatternKind[key].losses,
      },
    },
  };
}

export function recordCrossingPatternKindLoss(
  stats: RotatingRoomSessionStats,
  kind: CrossingPatternKind,
): RotatingRoomSessionStats {
  const crossingPatternKind = normalizeCrossingPatternKindStats(stats.crossingPatternKind);
  const key = crossingPatternKindStatsKey(kind);
  return {
    ...stats,
    crossingPatternKind: {
      ...crossingPatternKind,
      [key]: {
        wins: crossingPatternKind[key].wins,
        losses: crossingPatternKind[key].losses + 1,
      },
    },
  };
}

function crossingAbsenceAxisStatsKey(
  axis: CrossingAxisKind,
): keyof CrossingAbsenceAxisStats | null {
  const key = crossingAxisKindToAbsenceKey(axis);
  return key;
}

export function recordCrossingAbsenceAxisWin(
  stats: RotatingRoomSessionStats,
  axis: CrossingAxisKind,
): RotatingRoomSessionStats {
  const key = crossingAbsenceAxisStatsKey(axis);
  if (!key) return stats;
  const crossingAbsenceAxis = normalizeCrossingAbsenceAxisStats(stats.crossingAbsenceAxis);
  return {
    ...stats,
    crossingAbsenceAxis: {
      ...crossingAbsenceAxis,
      [key]: {
        wins: crossingAbsenceAxis[key].wins + 1,
        losses: crossingAbsenceAxis[key].losses,
      },
    },
  };
}

export function recordCrossingAbsenceAxisLoss(
  stats: RotatingRoomSessionStats,
  axis: CrossingAxisKind,
): RotatingRoomSessionStats {
  const key = crossingAbsenceAxisStatsKey(axis);
  if (!key) return stats;
  const crossingAbsenceAxis = normalizeCrossingAbsenceAxisStats(stats.crossingAbsenceAxis);
  return {
    ...stats,
    crossingAbsenceAxis: {
      ...crossingAbsenceAxis,
      [key]: {
        wins: crossingAbsenceAxis[key].wins,
        losses: crossingAbsenceAxis[key].losses + 1,
      },
    },
  };
}

export function emptyCrossingOppositeAbsenceAxisStats(): CrossingOppositeAbsenceAxisStats {
  return {
    corAltura: { wins: 0, losses: 0 },
    alturaParidade: { wins: 0, losses: 0 },
  };
}

export function parseCrossingOppositeAbsenceAxisStats(raw: unknown): CrossingOppositeAbsenceAxisStats {
  const o = (raw ?? {}) as { corAltura?: unknown; alturaParidade?: unknown };
  return {
    corAltura: parseUmFatorMatchTierBucket(o.corAltura),
    alturaParidade: parseUmFatorMatchTierBucket(o.alturaParidade),
  };
}

export function normalizeCrossingOppositeAbsenceAxisStats(
  stats: CrossingOppositeAbsenceAxisStats | undefined,
): CrossingOppositeAbsenceAxisStats {
  if (!stats) return emptyCrossingOppositeAbsenceAxisStats();
  return parseCrossingOppositeAbsenceAxisStats(stats);
}

export function recordCrossingOppositeAbsenceAxisWin(
  stats: RotatingRoomSessionStats,
  axis: CrossingAxisKind,
): RotatingRoomSessionStats {
  const key = crossingAbsenceAxisStatsKey(axis);
  if (!key) return stats;
  const crossingOppositeAbsenceAxis = normalizeCrossingOppositeAbsenceAxisStats(
    stats.crossingOppositeAbsenceAxis,
  );
  return {
    ...stats,
    crossingOppositeAbsenceAxis: {
      ...crossingOppositeAbsenceAxis,
      [key]: {
        wins: crossingOppositeAbsenceAxis[key].wins + 1,
        losses: crossingOppositeAbsenceAxis[key].losses,
      },
    },
  };
}

export function recordCrossingOppositeAbsenceAxisLoss(
  stats: RotatingRoomSessionStats,
  axis: CrossingAxisKind,
): RotatingRoomSessionStats {
  const key = crossingAbsenceAxisStatsKey(axis);
  if (!key) return stats;
  const crossingOppositeAbsenceAxis = normalizeCrossingOppositeAbsenceAxisStats(
    stats.crossingOppositeAbsenceAxis,
  );
  return {
    ...stats,
    crossingOppositeAbsenceAxis: {
      ...crossingOppositeAbsenceAxis,
      [key]: {
        wins: crossingOppositeAbsenceAxis[key].wins,
        losses: crossingOppositeAbsenceAxis[key].losses + 1,
      },
    },
  };
}

export function recordFibonacciZoneKindWin(
  stats: RotatingRoomSessionStats,
  kind: FibonacciZoneKind,
): RotatingRoomSessionStats {
  const fibonacciZoneKind = normalizeFibonacciZoneKindStats(stats.fibonacciZoneKind);
  return {
    ...stats,
    fibonacciZoneKind: {
      ...fibonacciZoneKind,
      [kind]: {
        wins: fibonacciZoneKind[kind].wins + 1,
        losses: fibonacciZoneKind[kind].losses,
      },
    },
  };
}

export function recordFibonacciZoneKindLoss(
  stats: RotatingRoomSessionStats,
  kind: FibonacciZoneKind,
): RotatingRoomSessionStats {
  const fibonacciZoneKind = normalizeFibonacciZoneKindStats(stats.fibonacciZoneKind);
  return {
    ...stats,
    fibonacciZoneKind: {
      ...fibonacciZoneKind,
      [kind]: {
        wins: fibonacciZoneKind[kind].wins,
        losses: fibonacciZoneKind[kind].losses + 1,
      },
    },
  };
}

export function recordRepeticaoZoneKindWin(
  stats: RotatingRoomSessionStats,
  kind: FibonacciZoneKind,
): RotatingRoomSessionStats {
  const repeticaoZoneKind = normalizeFibonacciZoneKindStats(stats.repeticaoZoneKind);
  return {
    ...stats,
    repeticaoZoneKind: {
      ...repeticaoZoneKind,
      [kind]: {
        wins: repeticaoZoneKind[kind].wins + 1,
        losses: repeticaoZoneKind[kind].losses,
      },
    },
  };
}

export function recordRepeticaoZoneKindLoss(
  stats: RotatingRoomSessionStats,
  kind: FibonacciZoneKind,
): RotatingRoomSessionStats {
  const repeticaoZoneKind = normalizeFibonacciZoneKindStats(stats.repeticaoZoneKind);
  return {
    ...stats,
    repeticaoZoneKind: {
      ...repeticaoZoneKind,
      [kind]: {
        wins: repeticaoZoneKind[kind].wins,
        losses: repeticaoZoneKind[kind].losses + 1,
      },
    },
  };
}

export function umFatorMatchTierAproveitamentoPct(bucket: {
  wins: number;
  losses: number;
}): number | null {
  const total = bucket.wins + bucket.losses;
  if (total <= 0) return null;
  return (100 * bucket.wins) / total;
}

/** Coluna N = (vitórias no nível N ÷ total de vitórias) × 100. Soma das colunas com vitória = 100%. */
export function winPctFromWinCounts(winCounts: readonly number[], totalWins: number): number[] {
  if (totalWins <= 0) return winCounts.map(() => 0);
  return winCounts.map((c) => (100 * c) / totalWins);
}

function reconcileWinCountsWithTotal(
  winCounts: readonly number[],
  totalWins: number,
  maxRecovery: number,
): number[] {
  const reconciled = normalizeRecoveryLevelCounts(winCounts, maxRecovery);
  const tracked = reconciled.reduce((sum, c) => sum + c, 0);
  if (totalWins <= 0) return reconciled;
  if (tracked === totalWins) return reconciled;
  if (tracked === 0) {
    reconciled[0] = totalWins;
    return reconciled;
  }
  if (tracked < totalWins) {
    reconciled[0]! += totalWins - tracked;
    return reconciled;
  }
  return reconciled;
}

/** @deprecated Colunas usam {@link winPctFromWinCounts}; mantido para compatibilidade interna. */
export function winPctFromRecoveryLevelCounts(
  winCounts: readonly number[],
  _lossCounts: readonly number[],
): number[] {
  const totalWins = winCounts.reduce((sum, c) => sum + c, 0);
  return winPctFromWinCounts(winCounts, totalWins);
}

export function entryWinBreakdownFromRecoveryCounts(
  winCounts: readonly number[],
  _lossCounts: readonly number[],
  totalCycleWins: number,
  totalCycleLosses: number,
): EntryWinBreakdown {
  const totalEntries = totalCycleWins + totalCycleLosses;
  return {
    totalEntries,
    overallWinPct: totalEntries > 0 ? (100 * totalCycleWins) / totalEntries : 0,
    winPctAtRecovery: winPctFromWinCounts(winCounts, totalCycleWins),
  };
}

export function entryWinBreakdownFromOutcomes(
  outcomes: readonly ("W" | "L")[],
  recoveryAtOutcome: readonly number[],
  maxRecovery: number,
): EntryWinBreakdown {
  const winCounts = emptyRecoveryLevelCounts(maxRecovery);
  const lossCounts = emptyRecoveryLevelCounts(maxRecovery);
  if (outcomes.length === 0) {
    return entryWinBreakdownFromRecoveryCounts(winCounts, lossCounts, 0, 0);
  }

  for (let i = 0; i < outcomes.length; i++) {
    const rec = recoveryIndex(recoveryAtOutcome[i] ?? 0, maxRecovery);
    if (outcomes[i] === "W") winCounts[rec]! += 1;
    else lossCounts[rec]! += 1;
  }

  const wins = outcomes.filter((x) => x === "W").length;
  const losses = outcomes.filter((x) => x === "L").length;
  return entryWinBreakdownFromRecoveryCounts(winCounts, lossCounts, wins, losses);
}

export function entryWinBreakdownFromSessionStats(
  stats: RotatingRoomSessionStats,
  maxRecovery: number,
): EntryWinBreakdown {
  const winCounts = reconcileWinCountsWithTotal(stats.winsAtRecovery, stats.wins, maxRecovery);
  return entryWinBreakdownFromRecoveryCounts(
    winCounts,
    normalizeRecoveryLevelCounts(stats.lossesAtRecovery, maxRecovery),
    stats.wins,
    stats.losses,
  );
}

/** @deprecated Use {@link emptyRecoveryLevelCounts}. */
export const emptyWinsAtRecovery = emptyRecoveryLevelCounts;

/** @deprecated Use {@link parseRecoveryLevelCounts}. */
export const parseWinsAtRecovery = parseRecoveryLevelCounts;

/** @deprecated Use {@link normalizeRecoveryLevelCounts}. */
export const normalizeWinsAtRecovery = normalizeRecoveryLevelCounts;