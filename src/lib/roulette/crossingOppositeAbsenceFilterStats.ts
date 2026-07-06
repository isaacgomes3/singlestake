/**
 * Estatísticas por filtro de ausência — cruzamento 2 fatores apostando no **oposto** da ausência.
 */
import {
  type CrossingAbsenceAxisKind,
  absenceKeyToCrossingAxis,
} from "@/lib/roulette/crossingAbsencePrefs";
import { evaluateDoisFatoresRound, type DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import { factorsForNumberOnAxis } from "@/lib/roulette/doisFatoresPatternCrossing";
import {
  CROSSING_BUCKET_DEFINITIONS,
  crossingBucketAbsenceGap,
  crossingOppositeBucketDef,
  type CrossingAxisKind,
} from "@/lib/roulette/liveTableColdStats";
import { ROTATING_ROOM_CROSSING_MAX_RECOVERY } from "@/lib/roulette/rotatingRoomCrossingStrategy";
import {
  CROSSING_ABSENCE_FILTER_STATS_FILTER_MAX,
  CROSSING_ABSENCE_FILTER_STATS_FILTER_MIN,
} from "@/lib/roulette/crossingAbsenceFilterStats";
import type {
  AbsenceFilterStatRow,
  ZoneAbsenceFilterStatsBlock,
} from "@/lib/roulette/zoneAbsenceFilterStats";
import {
  ABSENCE_FILTER_STATS_MAX_EVENTS,
  ABSENCE_FILTER_STATS_MAX_WIN_LOOKAHEAD,
  ABSENCE_FILTER_STATS_SPIN_WINDOW,
} from "@/lib/roulette/zoneAbsenceFilterStats";

export type CrossingOppositeAbsenceFilterStats = {
  corAltura: ZoneAbsenceFilterStatsBlock;
  alturaParidade: ZoneAbsenceFilterStatsBlock;
};

type TriggerEvent = {
  tableId: number;
  spinIndex: number;
  filterSpins: number;
  absenceAtTrigger: number;
  winAfterSpins: number | null;
};

function chronologicalSlice(newestFirst: readonly number[], maxLen: number): number[] {
  return [...newestFirst.slice(0, maxLen)].reverse();
}

function historyNewestFirstAt(chronological: readonly number[], endIndex: number): number[] {
  return chronological.slice(0, endIndex + 1).reverse();
}

function buildActiveFromOppositeCategory(category: string, axis: CrossingAxisKind): DoisFatoresActive | null {
  const def = CROSSING_BUCKET_DEFINITIONS.find((d) => d.axis === axis && d.category === category);
  if (!def) return null;
  const refNum = def.nums[0];
  if (refNum == null) return null;
  const factors = factorsForNumberOnAxis(refNum, axis);
  if (!factors) return null;
  return {
    pairKind: axis,
    pairKindLabel: axis === "cor-altura" ? "Cor · Altura" : "Paridade · Altura",
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: refNum,
    factor1: factors[0],
    factor2: factors[1],
    triggerNumbers: [refNum, refNum] as const,
    armingDescription: `Ausência oposta · ${category}`,
  };
}

function bestExactAbsentBucketAtSpin(
  historyNow: readonly number[],
  axis: CrossingAxisKind,
  exactAbsence: number,
): { absentCategory: string; oppositeCategory: string; absence: number } | null {
  let best: { absentCategory: string; oppositeCategory: string; absence: number } | null = null;
  for (const def of CROSSING_BUCKET_DEFINITIONS) {
    if (def.axis !== axis) continue;
    const absenceNow = crossingBucketAbsenceGap(historyNow, def);
    if (absenceNow !== exactAbsence) continue;
    const opposite = crossingOppositeBucketDef(def);
    if (!opposite) continue;
    if (!best || def.category < best.absentCategory) {
      best = {
        absentCategory: def.category,
        oppositeCategory: opposite.category,
        absence: absenceNow,
      };
    }
  }
  return best;
}

function winAfterSpinsForCrossingOppositeAbsence(
  chronological: readonly number[],
  triggerIndex: number,
  active: DoisFatoresActive,
): number | null {
  let recovery = 0;
  const maxIndex = Math.min(
    chronological.length - 1,
    triggerIndex + ABSENCE_FILTER_STATS_MAX_WIN_LOOKAHEAD,
  );
  for (let j = triggerIndex + 1; j <= maxIndex; j++) {
    const outcome = evaluateDoisFatoresRound(chronological[j]!, active);
    if (outcome === "W") return j - triggerIndex;
    if (outcome === "L") {
      recovery++;
      if (recovery > ROTATING_ROOM_CROSSING_MAX_RECOVERY) return null;
    }
  }
  return null;
}

function scanCrossingOppositeAbsenceTable(
  tableId: number,
  chronological: readonly number[],
  axis: CrossingAxisKind,
  exactAbsence: number,
): TriggerEvent[] {
  const events: TriggerEvent[] = [];
  if (chronological.length < 1) return events;

  let cursor = 0;
  while (cursor < chronological.length) {
    const now = historyNewestFirstAt(chronological, cursor);
    const match = bestExactAbsentBucketAtSpin(now, axis, exactAbsence);
    if (!match) {
      cursor++;
      continue;
    }

    const active = buildActiveFromOppositeCategory(match.oppositeCategory, axis);
    if (!active) {
      cursor++;
      continue;
    }

    const triggerIndex = cursor;
    const winAfter = winAfterSpinsForCrossingOppositeAbsence(chronological, triggerIndex, active);
    if (winAfter == null) cursor = chronological.length;
    else cursor = triggerIndex + winAfter + 1;

    events.push({
      tableId,
      spinIndex: triggerIndex,
      filterSpins: exactAbsence,
      absenceAtTrigger: match.absence,
      winAfterSpins: winAfter,
    });

    if (winAfter == null) break;
    if (events.length >= ABSENCE_FILTER_STATS_MAX_EVENTS) break;
  }

  return events;
}

/** Máx. ausência na janela (últimos N giros) para uma mesa e eixo de cruzamento oposto. */
export function maxCrossingOppositeAbsenceInWindowForTable(
  historyNewestFirst: readonly number[],
  axisKind: CrossingAbsenceAxisKind,
): number {
  const axis = absenceKeyToCrossingAxis(axisKind);
  const chronological = chronologicalSlice(historyNewestFirst, ABSENCE_FILTER_STATS_SPIN_WINDOW);
  if (chronological.length === 0) return 0;
  return maxAbsenceInChronological(chronological, axis);
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

function aggregateFilterRow(filterSpins: number, events: TriggerEvent[]): AbsenceFilterStatRow {
  const winsBySpin: Record<number, number> = {};
  let unresolved = 0;
  let maxAbsenceAtTrigger = 0;

  for (const ev of events) {
    maxAbsenceAtTrigger = Math.max(maxAbsenceAtTrigger, ev.absenceAtTrigger);
    if (ev.winAfterSpins == null) {
      unresolved++;
      continue;
    }
    const k = ev.winAfterSpins;
    if (k >= 1 && k <= ABSENCE_FILTER_STATS_MAX_WIN_LOOKAHEAD) {
      winsBySpin[k] = (winsBySpin[k] ?? 0) + 1;
    }
  }

  return {
    filterSpins,
    sampleSize: events.length,
    winsBySpin,
    unresolved,
    maxAbsenceAtTrigger,
  };
}

function buildBlockForAxis(
  histories: Record<number, readonly number[]>,
  axisKind: CrossingAbsenceAxisKind,
): ZoneAbsenceFilterStatsBlock {
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

  const filters: AbsenceFilterStatRow[] = [];
  for (
    let filterSpins = CROSSING_ABSENCE_FILTER_STATS_FILTER_MIN;
    filterSpins <= CROSSING_ABSENCE_FILTER_STATS_FILTER_MAX;
    filterSpins++
  ) {
    const events: TriggerEvent[] = [];
    for (const { tableId, chronological } of tables) {
      events.push(...scanCrossingOppositeAbsenceTable(tableId, chronological, axis, filterSpins));
      if (events.length >= ABSENCE_FILTER_STATS_MAX_EVENTS) break;
    }
    filters.push(aggregateFilterRow(filterSpins, events.slice(0, ABSENCE_FILTER_STATS_MAX_EVENTS)));
  }

  return {
    spinWindow: ABSENCE_FILTER_STATS_SPIN_WINDOW,
    maxEvents: ABSENCE_FILTER_STATS_MAX_EVENTS,
    maxAbsenceInWindow,
    filters,
  };
}

export function buildCrossingOppositeAbsenceFilterStats(
  histories: Record<number, readonly number[]>,
): CrossingOppositeAbsenceFilterStats {
  return {
    corAltura: buildBlockForAxis(histories, "corAltura"),
    alturaParidade: buildBlockForAxis(histories, "alturaParidade"),
  };
}

export function emptyCrossingOppositeAbsenceFilterStats(): CrossingOppositeAbsenceFilterStats {
  const block: ZoneAbsenceFilterStatsBlock = {
    spinWindow: ABSENCE_FILTER_STATS_SPIN_WINDOW,
    maxEvents: ABSENCE_FILTER_STATS_MAX_EVENTS,
    maxAbsenceInWindow: 0,
    filters: [],
  };
  return { corAltura: { ...block, filters: [] }, alturaParidade: { ...block, filters: [] } };
}
