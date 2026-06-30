import type {
  CrossingPatternKindStats,
  RotatingRoomSessionStats,
  UmFatorMatchTierStats,
} from "@/lib/roulette/rotatingRoomStrategy";
import type { CrossingPatternKind } from "@/lib/roulette/doisFatoresPatternCrossing";
import type { UmFatorTriggerMatchTier } from "@/lib/roulette/umFatorStrategy";

export type EntryWinBreakdown = {
  totalEntries: number;
  overallWinPct: number;
  /** Distribuição das vitórias: coluna N = vitórias no nível N ÷ total de vitórias (ex.: 4 vitórias, 3 sem rec. → 75% / 25%). */
  winPctAtRecovery: readonly number[];
};

export function emptyRecoveryLevelCounts(maxRecovery: number): number[] {
  return Array.from({ length: maxRecovery + 1 }, () => 0);
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

export function parseRotatingRoomSessionStats(raw: unknown, maxRecovery = 5): RotatingRoomSessionStats {
  const o = (raw ?? {}) as {
    wins?: number;
    losses?: number;
    winsAtRecovery?: unknown;
    lossesAtRecovery?: unknown;
    umFatorMatchTier?: unknown;
    crossingPatternKind?: unknown;
  };
  const base = {
    wins: Number(o.wins) || 0,
    losses: Number(o.losses) || 0,
    winsAtRecovery: parseRecoveryLevelCounts(o.winsAtRecovery, maxRecovery),
    lossesAtRecovery: parseRecoveryLevelCounts(o.lossesAtRecovery, maxRecovery),
  };
  const withUm =
    o.umFatorMatchTier != null
      ? { ...base, umFatorMatchTier: parseUmFatorMatchTierStats(o.umFatorMatchTier) }
      : base;
  if (o.crossingPatternKind != null) {
    return {
      ...withUm,
      crossingPatternKind: parseCrossingPatternKindStats(o.crossingPatternKind),
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