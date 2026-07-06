/**
 * Estatísticas de sequência de vitórias após retorno do cruzamento ausente.
 * Mede: após ausência ≥ filtro, quando o bucket reaparece, quantas vitórias consecutivas
 * (2F) antes da primeira derrota — até 5 recuperações no lookahead.
 */
import { evaluateDoisFatoresRound, type DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import { factorsForNumberOnAxis } from "@/lib/roulette/doisFatoresPatternCrossing";
import {
  CROSSING_BUCKET_DEFINITIONS,
  crossingBucketAbsenceGap,
  crossingBucketForNumber,
  type CrossingAxisKind,
  type CrossingBucketDef,
} from "@/lib/roulette/liveTableColdStats";
import {
  absenceKeyToCrossingAxis,
  type CrossingAbsenceAxisKind,
} from "@/lib/roulette/crossingAbsencePrefs";
import { ROTATING_ROOM_CROSSING_MAX_RECOVERY } from "@/lib/roulette/rotatingRoomCrossingStrategy";
import {
  ABSENCE_FILTER_STATS_MAX_EVENTS,
  ABSENCE_FILTER_STATS_MAX_WIN_LOOKAHEAD,
  ABSENCE_FILTER_STATS_SPIN_WINDOW,
} from "@/lib/roulette/zoneAbsenceFilterStats";
import {
  CROSSING_ABSENCE_FILTER_STATS_FILTER_MAX,
  CROSSING_ABSENCE_FILTER_STATS_FILTER_MIN,
} from "@/lib/roulette/crossingAbsenceFilterStats";

export type ReturnStreakStatRow = {
  filterSpins: number;
  sampleSize: number;
  /** Maior sequência de vitórias consecutivas observada nos eventos. */
  maxStreakAtTrigger: number;
  /** Contagem de eventos por sequência (0, 1, 2, …). */
  streakCounts: Record<number, number>;
  unresolved: number;
};

export type CrossingReturnStreakStatsBlock = {
  spinWindow: number;
  maxEvents: number;
  maxAbsenceInWindow: number;
  filters: ReturnStreakStatRow[];
};

export type CrossingReturnStreakStats = {
  corAltura: CrossingReturnStreakStatsBlock;
  alturaParidade: CrossingReturnStreakStatsBlock;
};

type ReturnEvent = {
  filterSpins: number;
  absenceBeforeReturn: number;
  maxWinStreak: number;
  unresolved: boolean;
};

function chronologicalSlice(newestFirst: readonly number[], maxLen: number): number[] {
  return [...newestFirst.slice(0, maxLen)].reverse();
}

function historyNewestFirstAt(chronological: readonly number[], endIndex: number): number[] {
  return chronological.slice(0, endIndex + 1).reverse();
}

function buildActiveFromBucket(def: CrossingBucketDef): DoisFatoresActive | null {
  const refNum = def.nums[0];
  if (refNum == null) return null;
  const factors = factorsForNumberOnAxis(refNum, def.axis);
  if (!factors) return null;
  return {
    pairKind: def.axis,
    pairKindLabel: def.axis === "cor-altura" ? "Cor · Altura" : "Paridade · Altura",
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: refNum,
    factor1: factors[0],
    factor2: factors[1],
    triggerNumbers: [refNum, refNum] as const,
    armingDescription: `Retorno · ${def.category}`,
  };
}

/** Vitórias consecutivas a partir do giro de retorno até à primeira derrota (empate não interrompe). */
function consecutiveWinsFromReturn(
  chronological: readonly number[],
  returnIndex: number,
  active: DoisFatoresActive,
): { streak: number; unresolved: boolean } {
  let streak = 0;
  let recovery = 0;
  const maxIndex = Math.min(
    chronological.length - 1,
    returnIndex + ABSENCE_FILTER_STATS_MAX_WIN_LOOKAHEAD,
  );

  for (let j = returnIndex; j <= maxIndex; j++) {
    const outcome = evaluateDoisFatoresRound(chronological[j]!, active);
    if (outcome === "W") {
      streak++;
    } else if (outcome === "L") {
      recovery++;
      if (recovery > ROTATING_ROOM_CROSSING_MAX_RECOVERY) {
        return { streak, unresolved: false };
      }
      return { streak, unresolved: false };
    }
  }

  return { streak, unresolved: true };
}

function scanReturnStreakTable(
  tableId: number,
  chronological: readonly number[],
  axis: CrossingAxisKind,
  minAbsence: number,
): ReturnEvent[] {
  const events: ReturnEvent[] = [];
  if (chronological.length < 2) return events;

  let cursor = 1;
  while (cursor < chronological.length) {
    const spin = chronological[cursor]!;
    if (spin === 0) {
      cursor++;
      continue;
    }

    const bucket = crossingBucketForNumber(axis, spin);
    if (!bucket) {
      cursor++;
      continue;
    }

    const historyBefore = historyNewestFirstAt(chronological, cursor - 1);
    const absenceBefore = crossingBucketAbsenceGap(historyBefore, bucket);
    if (absenceBefore < minAbsence) {
      cursor++;
      continue;
    }

    const active = buildActiveFromBucket(bucket);
    if (!active) {
      cursor++;
      continue;
    }

    const { streak, unresolved } = consecutiveWinsFromReturn(chronological, cursor, active);
    events.push({
      filterSpins: minAbsence,
      absenceBeforeReturn: absenceBefore,
      maxWinStreak: streak,
      unresolved,
    });

    cursor++;
    if (events.length >= ABSENCE_FILTER_STATS_MAX_EVENTS) break;
  }

  return events;
}

function maxAbsenceInChronological(chronological: readonly number[], axis: CrossingAxisKind): number {
  let max = 0;
  for (let i = 0; i < chronological.length; i++) {
    const history = historyNewestFirstAt(chronological, i);
    for (const def of CROSSING_BUCKET_DEFINITIONS) {
      if (def.axis !== axis) continue;
      max = Math.max(max, crossingBucketAbsenceGap(history, def));
    }
  }
  return max;
}

function aggregateReturnStreakRow(filterSpins: number, events: ReturnEvent[]): ReturnStreakStatRow {
  const streakCounts: Record<number, number> = {};
  let maxStreakAtTrigger = 0;
  let unresolved = 0;

  for (const ev of events) {
    maxStreakAtTrigger = Math.max(maxStreakAtTrigger, ev.maxWinStreak);
    const k = ev.maxWinStreak;
    streakCounts[k] = (streakCounts[k] ?? 0) + 1;
    if (ev.unresolved) unresolved++;
  }

  return {
    filterSpins,
    sampleSize: events.length,
    maxStreakAtTrigger,
    streakCounts,
    unresolved,
  };
}

function buildBlockForAxis(
  histories: Record<number, readonly number[]>,
  axisKind: CrossingAbsenceAxisKind,
): CrossingReturnStreakStatsBlock {
  const axis = absenceKeyToCrossingAxis(axisKind);
  const tables: { tableId: number; chronological: number[] }[] = [];
  let maxAbsenceInWindow = 0;

  for (const [tableIdRaw, newestFirst] of Object.entries(histories)) {
    const tableId = Number(tableIdRaw);
    if (!Number.isFinite(tableId) || newestFirst.length === 0) continue;
    const chronological = chronologicalSlice(newestFirst, ABSENCE_FILTER_STATS_SPIN_WINDOW);
    if (chronological.length === 0) continue;
    maxAbsenceInWindow = Math.max(maxAbsenceInWindow, maxAbsenceInChronological(chronological, axis));
    tables.push({ tableId, chronological });
  }

  const filters: ReturnStreakStatRow[] = [];
  for (
    let filterSpins = CROSSING_ABSENCE_FILTER_STATS_FILTER_MIN;
    filterSpins <= CROSSING_ABSENCE_FILTER_STATS_FILTER_MAX;
    filterSpins++
  ) {
    const events: ReturnEvent[] = [];
    for (const { tableId, chronological } of tables) {
      events.push(...scanReturnStreakTable(tableId, chronological, axis, filterSpins));
      if (events.length >= ABSENCE_FILTER_STATS_MAX_EVENTS) break;
    }
    filters.push(aggregateReturnStreakRow(filterSpins, events.slice(0, ABSENCE_FILTER_STATS_MAX_EVENTS)));
  }

  return {
    spinWindow: ABSENCE_FILTER_STATS_SPIN_WINDOW,
    maxEvents: ABSENCE_FILTER_STATS_MAX_EVENTS,
    maxAbsenceInWindow,
    filters,
  };
}

export function buildCrossingReturnStreakStats(
  histories: Record<number, readonly number[]>,
): CrossingReturnStreakStats {
  return {
    corAltura: buildBlockForAxis(histories, "corAltura"),
    alturaParidade: buildBlockForAxis(histories, "alturaParidade"),
  };
}

export function emptyCrossingReturnStreakStats(): CrossingReturnStreakStats {
  const emptyBlock = (): CrossingReturnStreakStatsBlock => ({
    spinWindow: ABSENCE_FILTER_STATS_SPIN_WINDOW,
    maxEvents: ABSENCE_FILTER_STATS_MAX_EVENTS,
    maxAbsenceInWindow: 0,
    filters: [],
  });
  return { corAltura: emptyBlock(), alturaParidade: emptyBlock() };
}

/**
 * Menor filtro (giros) em que a máx. sequência de vitórias após retorno é 1.
 * Prefere amostra ≥ 2; se não houver, usa amostra ≥ 1.
 */
export function lowestReturnStreakFilterWithMaxWinsOne(
  block: CrossingReturnStreakStatsBlock,
): number | null {
  let fallback: number | null = null;
  for (const row of block.filters) {
    if (row.sampleSize === 0 || row.maxStreakAtTrigger !== 1) continue;
    if (row.sampleSize >= 2) return row.filterSpins;
    if (fallback == null) fallback = row.filterSpins;
  }
  return fallback;
}
