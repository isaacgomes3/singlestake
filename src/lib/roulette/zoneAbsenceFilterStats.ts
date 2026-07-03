/**
 * Estatísticas por filtro de giros de ausência (Fibonacci / Repetição).
 * Independente do gatilho activo — analisa sempre os últimos N números por mesa.
 * Helpers locais (sem importar strategies completas — evita ciclos no SSR).
 */
import {
  FIBONACCI_ABSENCE_SPINS_MIN,
  DEFAULT_FIBONACCI_ABSENCE_SPINS,
} from "@/lib/roulette/fibonacciAbsencePrefs";

export const ABSENCE_FILTER_STATS_SPIN_WINDOW = 50;
export const ABSENCE_FILTER_STATS_MAX_EVENTS = 50;
export const ABSENCE_FILTER_STATS_MAX_WIN_LOOKAHEAD = 15;
export const ABSENCE_FILTER_STATS_FILTER_MAX = DEFAULT_FIBONACCI_ABSENCE_SPINS;

export type AbsenceFilterStatRow = {
  filterSpins: number;
  sampleSize: number;
  winsBySpin: Record<number, number>;
  unresolved: number;
  maxAbsenceAtTrigger: number;
};

export type ZoneAbsenceFilterStatsBlock = {
  spinWindow: number;
  maxEvents: number;
  maxAbsenceInWindow: number;
  filters: AbsenceFilterStatRow[];
};

export type ZoneAbsenceFilterStats = {
  fibonacci: ZoneAbsenceFilterStatsBlock;
  repeticao: ZoneAbsenceFilterStatsBlock;
};

type FibonacciZoneKind = "dozen" | "column";
type FibonacciZone = { kind: FibonacciZoneKind; id: 1 | 2 | 3 };

type TriggerEvent = {
  tableId: number;
  spinIndex: number;
  filterSpins: number;
  absenceAtTrigger: number;
  winAfterSpins: number | null;
};

const ALL_ZONES: FibonacciZone[] = [
  { kind: "dozen", id: 1 },
  { kind: "dozen", id: 2 },
  { kind: "dozen", id: 3 },
  { kind: "column", id: 1 },
  { kind: "column", id: 2 },
  { kind: "column", id: 3 },
];

const ZONE_KINDS: FibonacciZoneKind[] = ["dozen", "column"];

function dozenOf(n: number): 1 | 2 | 3 | null {
  if (n === 0) return null;
  if (n <= 12) return 1;
  if (n <= 24) return 2;
  return 3;
}

function columnOf(n: number): 1 | 2 | 3 | null {
  if (n === 0) return null;
  return (((n - 1) % 3) + 1) as 1 | 2 | 3;
}

function zoneValue(n: number, kind: FibonacciZoneKind): 1 | 2 | 3 | null {
  return kind === "dozen" ? dozenOf(n) : columnOf(n);
}

function zoneHitOnSpin(spin: number, zone: FibonacciZone): boolean {
  if (spin === 0) return false;
  if (zone.kind === "dozen") return dozenOf(spin) === zone.id;
  return columnOf(spin) === zone.id;
}

function consecutiveZoneAbsence(historyNewestFirst: readonly number[], zone: FibonacciZone): number {
  let count = 0;
  for (const n of historyNewestFirst) {
    if (zoneHitOnSpin(n, zone)) break;
    count++;
  }
  return count;
}

function consecutiveNoRepeatStreak(
  historyNewestFirst: readonly number[],
  kind: FibonacciZoneKind,
): number {
  if (historyNewestFirst.length < 2) return 0;
  let count = 0;
  for (let i = 0; i < historyNewestFirst.length - 1; i++) {
    const a = historyNewestFirst[i]!;
    const b = historyNewestFirst[i + 1]!;
    if (a === 0 || b === 0) break;
    const za = zoneValue(a, kind);
    const zb = zoneValue(b, kind);
    if (za == null || zb == null) break;
    if (za === zb) break;
    count++;
  }
  return count;
}

function zoneFromHeadNumber(
  historyNewestFirst: readonly number[],
  kind: FibonacciZoneKind,
): FibonacciZone | null {
  const head = historyNewestFirst[0];
  if (head == null || head === 0) return null;
  const id = zoneValue(head, kind);
  if (id == null) return null;
  return { kind, id };
}

function chronologicalSlice(newestFirst: readonly number[], maxLen: number): number[] {
  return [...newestFirst.slice(0, maxLen)].reverse();
}

function historyNewestFirstAt(chronological: readonly number[], endIndex: number): number[] {
  return chronological.slice(0, endIndex + 1).reverse();
}

function bestFibonacciCrossing(
  historyPrev: readonly number[],
  historyNow: readonly number[],
  minAbsence: number,
): { zone: FibonacciZone; absence: number } | null {
  let best: { zone: FibonacciZone; absence: number } | null = null;
  for (const zone of ALL_ZONES) {
    const absenceNow = consecutiveZoneAbsence(historyNow, zone);
    if (absenceNow < minAbsence) continue;
    const absencePrev = consecutiveZoneAbsence(historyPrev, zone);
    if (absencePrev >= minAbsence) continue;
    if (!best || absenceNow > best.absence) {
      best = { zone, absence: absenceNow };
    }
  }
  return best;
}

function scanFibonacciTable(
  tableId: number,
  chronological: readonly number[],
  minAbsence: number,
): TriggerEvent[] {
  const events: TriggerEvent[] = [];
  if (chronological.length < 2) return events;

  let cursor = 1;
  while (cursor < chronological.length) {
    const prev = historyNewestFirstAt(chronological, cursor - 1);
    const now = historyNewestFirstAt(chronological, cursor);
    const crossing = bestFibonacciCrossing(prev, now, minAbsence);
    if (!crossing) {
      cursor++;
      continue;
    }

    const triggerIndex = cursor;
    let winAfter: number | null = null;
    for (let j = cursor + 1; j < chronological.length; j++) {
      if (zoneHitOnSpin(chronological[j]!, crossing.zone)) {
        winAfter = j - triggerIndex;
        cursor = j + 1;
        break;
      }
    }
    if (winAfter == null) cursor = chronological.length;

    events.push({
      tableId,
      spinIndex: triggerIndex,
      filterSpins: minAbsence,
      absenceAtTrigger: crossing.absence,
      winAfterSpins: winAfter,
    });

    if (winAfter == null) break;
  }

  return events;
}

function scanRepeticaoTable(
  tableId: number,
  chronological: readonly number[],
  minAbsence: number,
): TriggerEvent[] {
  const events: TriggerEvent[] = [];
  if (chronological.length < 2) return events;

  let cursor = 1;
  while (cursor < chronological.length) {
    const prev = historyNewestFirstAt(chronological, cursor - 1);
    const now = historyNewestFirstAt(chronological, cursor);

    let bestKind: FibonacciZoneKind | null = null;
    let bestStreak = 0;
    for (const kind of ZONE_KINDS) {
      const streakNow = consecutiveNoRepeatStreak(now, kind);
      if (streakNow < minAbsence) continue;
      const streakPrev = consecutiveNoRepeatStreak(prev, kind);
      if (streakPrev >= minAbsence) continue;
      if (!bestKind || streakNow > bestStreak) {
        bestKind = kind;
        bestStreak = streakNow;
      }
    }

    if (!bestKind) {
      cursor++;
      continue;
    }

    const zone = zoneFromHeadNumber(now, bestKind);
    if (!zone) {
      cursor++;
      continue;
    }

    const triggerIndex = cursor;
    let winAfter: number | null = null;
    for (let j = cursor + 1; j < chronological.length; j++) {
      if (zoneHitOnSpin(chronological[j]!, zone)) {
        winAfter = j - triggerIndex;
        cursor = j + 1;
        break;
      }
    }
    if (winAfter == null) cursor = chronological.length;

    events.push({
      tableId,
      spinIndex: triggerIndex,
      filterSpins: minAbsence,
      absenceAtTrigger: bestStreak,
      winAfterSpins: winAfter,
    });

    if (winAfter == null) break;
  }

  return events;
}

function maxAbsenceInChronological(
  chronological: readonly number[],
  mode: "fibonacci" | "repeticao",
): number {
  let max = 0;
  for (let i = 0; i < chronological.length; i++) {
    const history = historyNewestFirstAt(chronological, i);
    if (mode === "fibonacci") {
      for (const zone of ALL_ZONES) {
        max = Math.max(max, consecutiveZoneAbsence(history, zone));
      }
    } else {
      for (const kind of ZONE_KINDS) {
        max = Math.max(max, consecutiveNoRepeatStreak(history, kind));
      }
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

function buildBlockForMode(
  histories: Record<number, readonly number[]>,
  mode: "fibonacci" | "repeticao",
): ZoneAbsenceFilterStatsBlock {
  const tables: { tableId: number; chronological: number[] }[] = [];
  let maxAbsenceInWindow = 0;

  for (const [idRaw, history] of Object.entries(histories)) {
    const tableId = Number(idRaw);
    if (!Number.isFinite(tableId) || !history?.length) continue;
    const chronological = chronologicalSlice(history, ABSENCE_FILTER_STATS_SPIN_WINDOW);
    if (chronological.length === 0) continue;
    tables.push({ tableId, chronological });
    maxAbsenceInWindow = Math.max(maxAbsenceInWindow, maxAbsenceInChronological(chronological, mode));
  }

  const filters: AbsenceFilterStatRow[] = [];
  for (
    let filter = FIBONACCI_ABSENCE_SPINS_MIN;
    filter <= ABSENCE_FILTER_STATS_FILTER_MAX;
    filter++
  ) {
    const allEvents: TriggerEvent[] = [];
    for (const { tableId, chronological } of tables) {
      allEvents.push(
        ...(mode === "fibonacci"
          ? scanFibonacciTable(tableId, chronological, filter)
          : scanRepeticaoTable(tableId, chronological, filter)),
      );
    }
    allEvents.sort((a, b) => a.spinIndex - b.spinIndex || a.tableId - b.tableId);
    filters.push(aggregateFilterRow(filter, allEvents.slice(-ABSENCE_FILTER_STATS_MAX_EVENTS)));
  }

  return {
    spinWindow: ABSENCE_FILTER_STATS_SPIN_WINDOW,
    maxEvents: ABSENCE_FILTER_STATS_MAX_EVENTS,
    maxAbsenceInWindow,
    filters,
  };
}

export function buildZoneAbsenceFilterStats(
  histories: Record<number, readonly number[]>,
): ZoneAbsenceFilterStats {
  return {
    fibonacci: buildBlockForMode(histories, "fibonacci"),
    repeticao: buildBlockForMode(histories, "repeticao"),
  };
}
