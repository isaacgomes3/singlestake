/**
 * Sala Rotativa — sessão global 2 Fatores (cruzamento ausente) em todas as mesas do rodízio.
 */

import {
  ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
  buildRotatingRoomCrossingLiveView,
  sanitizeRotatingRoomCrossingMachineForTableIds,
  seedRotatingRoomCrossingMachineAfterPlacarReset,
  tickRotatingRoomCrossingPlacar,
  type RotatingRoomCrossingMachineState,
  type RotatingRoomCrossingPlacarFlash,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  reclassifyOneFinalLossAsWin,
} from "@/lib/roulette/entryWinBreakdown";
import {
  isStrategyGlobalEnabled,
} from "@/lib/roulette/strategyGlobalClient";

export {
  ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
  ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  sanitizeRotatingRoomCrossingMachineForTableIds,
};

const STATS_KEY = "roulette.rotatingRoomCrossing.stats.v1";
const MACHINE_KEY = "roulette.rotatingRoomCrossing.machine.v1";

export const ROTATING_ROOM_CROSSING_STATS_STORAGE_KEY = STATS_KEY;
export const ROTATING_ROOM_CROSSING_MACHINE_STORAGE_KEY = MACHINE_KEY;

export const ROTATING_ROOM_CROSSING_CHANGED_EVENT = "rotating-room-crossing-changed";
export const ROTATING_ROOM_CROSSING_RESET_EVENT = "rotating-room-crossing-reset";
export const ROTATING_ROOM_CROSSING_STATS_CORRECTED_EVENT = "rotating-room-crossing-stats-corrected";

export function defaultRotatingRoomCrossingMachineState(): RotatingRoomCrossingMachineState {
  return {
    cycleTableId: null,
    cycleFingerprint: null,
    cycleActive: null,
    recovery: 0,
    cycleSpinsWithoutWin: 0,
    armedAtHead: null,
    lastEvaluatedHead: null,
    lastSpinHeadByTable: {},
    signalQueue: [],
    awaitingQueueTableId: null,
    awaitingQueueHead: null,
    tablePlacarLosses: {},
    lastLostTableId: null,
    awaitSwitchNoTable: false,
    prepareFingerprint: null,
    prepareTableId: null,
    prepareActive: null,
    pendingQueueEntry: null,
    cycleMetricCategory: null,
    cyclePatternKind: null,
    cycleAbsenceAxis: null,
    cycleSeq: 0,
    postResultHoldUntilMs: null,
    postResultHoldTableId: null,
    postResultHoldReason: null,
    prepareSpinsWithoutPattern: 0,
  };
}

export function readRotatingRoomCrossingSessionStats(): RotatingRoomSessionStats {
  if (typeof window === "undefined") {
    return emptyRotatingRoomSessionStats(ROTATING_ROOM_CROSSING_MAX_RECOVERY);
  }
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyRotatingRoomSessionStats(ROTATING_ROOM_CROSSING_MAX_RECOVERY);
    return parseRotatingRoomSessionStats(JSON.parse(raw), ROTATING_ROOM_CROSSING_MAX_RECOVERY);
  } catch {
    return emptyRotatingRoomSessionStats(ROTATING_ROOM_CROSSING_MAX_RECOVERY);
  }
}

export function writeRotatingRoomCrossingSessionStats(stats: RotatingRoomSessionStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function readRotatingRoomCrossingMachineState(
  tableIds: readonly number[] = [],
): RotatingRoomCrossingMachineState {
  if (typeof window === "undefined") return defaultRotatingRoomCrossingMachineState();
  try {
    const raw = localStorage.getItem(MACHINE_KEY);
    if (!raw) return defaultRotatingRoomCrossingMachineState();
    const o = JSON.parse(raw) as Partial<RotatingRoomCrossingMachineState>;
    const merged = { ...defaultRotatingRoomCrossingMachineState(), ...o };
    return tableIds.length > 0
      ? sanitizeRotatingRoomCrossingMachineForTableIds(merged, tableIds)
      : merged;
  } catch {
    return defaultRotatingRoomCrossingMachineState();
  }
}

export function writeRotatingRoomCrossingMachineState(
  state: RotatingRoomCrossingMachineState,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MACHINE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_CROSSING_CHANGED_EVENT));
}

export function resetRotatingRoomCrossingSession(
  tableIds: readonly number[] = [],
  histories: Record<number, readonly number[]> = {},
): void {
  if (typeof window !== "undefined" && isStrategyGlobalEnabled()) {
    return;
  }
  writeRotatingRoomCrossingSessionStats(
    emptyRotatingRoomSessionStats(ROTATING_ROOM_CROSSING_MAX_RECOVERY),
  );
  const seeded = seedRotatingRoomCrossingMachineAfterPlacarReset(
    defaultRotatingRoomCrossingMachineState(),
    tableIds,
    histories,
  );
  writeRotatingRoomCrossingMachineState(seeded);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROTATING_ROOM_CROSSING_RESET_EVENT));
  }
}

/** Converte 1 derrota do placar em vitória (sem zerar sessão nem máquina). */
export function correctRotatingRoomCrossingLastLossAsWin(): boolean {
  if (typeof window === "undefined") return false;
  const stats = readRotatingRoomCrossingSessionStats();
  const next = reclassifyOneFinalLossAsWin(stats, ROTATING_ROOM_CROSSING_MAX_RECOVERY);
  if (!next) return false;
  writeRotatingRoomCrossingSessionStats(next);
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_CROSSING_STATS_CORRECTED_EVENT));
  return true;
}

export function buildRotatingRoomCrossingSessionLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomCrossingMachineState,
) {
  return buildRotatingRoomCrossingLiveView(tableIds, histories, machine);
}

export function tickRotatingRoomCrossingSessionPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomCrossingMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: RotatingRoomCrossingMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomCrossingPlacarFlash;
} {
  return tickRotatingRoomCrossingPlacar(
    tableIds,
    histories,
    machine,
    stats,
    ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  );
}
