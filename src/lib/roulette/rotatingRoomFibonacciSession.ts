/**
 * Sala Rotativa — sessão global Fibonacci (dúzias/colunas) em todas as mesas do rodízio.
 */

import {
  ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
  ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS,
  ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
  buildRotatingRoomFibonacciLiveView,
  defaultRotatingRoomFibonacciMachineState,
  sanitizeRotatingRoomFibonacciMachineForTableIds,
  seedRotatingRoomFibonacciMachineAfterPlacarReset,
  tickRotatingRoomFibonacciPlacar,
  type RotatingRoomFibonacciMachineState,
  type RotatingRoomFibonacciPlacarFlash,
} from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  reclassifyOneFinalLossAsWin,
} from "@/lib/roulette/entryWinBreakdown";
import { isStrategyGlobalEnabled } from "@/lib/roulette/strategyGlobalClient";

export {
  ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
  ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS,
  ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
  ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  sanitizeRotatingRoomFibonacciMachineForTableIds,
};

const STATS_KEY = "roulette.rotatingRoomFibonacci.stats.v1";
const MACHINE_KEY = "roulette.rotatingRoomFibonacci.machine.v1";

export const ROTATING_ROOM_FIBONACCI_STATS_STORAGE_KEY = STATS_KEY;
export const ROTATING_ROOM_FIBONACCI_MACHINE_STORAGE_KEY = MACHINE_KEY;

export const ROTATING_ROOM_FIBONACCI_CHANGED_EVENT = "rotating-room-fibonacci-changed";
export const ROTATING_ROOM_FIBONACCI_RESET_EVENT = "rotating-room-fibonacci-reset";
export const ROTATING_ROOM_FIBONACCI_STATS_CORRECTED_EVENT = "rotating-room-fibonacci-stats-corrected";

export function readRotatingRoomFibonacciSessionStats(): RotatingRoomSessionStats {
  if (typeof window === "undefined") {
    return emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
  }
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
    return parseRotatingRoomSessionStats(JSON.parse(raw), ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
  } catch {
    return emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
  }
}

export function writeRotatingRoomFibonacciSessionStats(stats: RotatingRoomSessionStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function readRotatingRoomFibonacciMachineState(
  tableIds: readonly number[] = [],
): RotatingRoomFibonacciMachineState {
  if (typeof window === "undefined") return defaultRotatingRoomFibonacciMachineState();
  try {
    const raw = localStorage.getItem(MACHINE_KEY);
    if (!raw) return defaultRotatingRoomFibonacciMachineState();
    const o = JSON.parse(raw) as Partial<RotatingRoomFibonacciMachineState>;
    const merged = { ...defaultRotatingRoomFibonacciMachineState(), ...o };
    return tableIds.length > 0
      ? sanitizeRotatingRoomFibonacciMachineForTableIds(merged, tableIds)
      : merged;
  } catch {
    return defaultRotatingRoomFibonacciMachineState();
  }
}

export function writeRotatingRoomFibonacciMachineState(
  state: RotatingRoomFibonacciMachineState,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MACHINE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_FIBONACCI_CHANGED_EVENT));
}

export function resetRotatingRoomFibonacciSession(
  tableIds: readonly number[] = [],
  histories: Record<number, readonly number[]> = {},
): void {
  if (typeof window !== "undefined" && isStrategyGlobalEnabled()) {
    return;
  }
  writeRotatingRoomFibonacciSessionStats(
    emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY),
  );
  const seeded = seedRotatingRoomFibonacciMachineAfterPlacarReset(
    defaultRotatingRoomFibonacciMachineState(),
    tableIds,
    histories,
  );
  writeRotatingRoomFibonacciMachineState(seeded);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROTATING_ROOM_FIBONACCI_RESET_EVENT));
  }
}

export function correctRotatingRoomFibonacciLastLossAsWin(): boolean {
  if (typeof window === "undefined") return false;
  const stats = readRotatingRoomFibonacciSessionStats();
  const next = reclassifyOneFinalLossAsWin(stats, ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
  if (!next) return false;
  writeRotatingRoomFibonacciSessionStats(next);
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_FIBONACCI_STATS_CORRECTED_EVENT));
  return true;
}

export function buildRotatingRoomFibonacciSessionLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomFibonacciMachineState,
) {
  return buildRotatingRoomFibonacciLiveView(tableIds, histories, machine);
}

export function tickRotatingRoomFibonacciSessionPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomFibonacciMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: RotatingRoomFibonacciMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomFibonacciPlacarFlash;
} {
  return tickRotatingRoomFibonacciPlacar(
    tableIds,
    histories,
    machine,
    stats,
    ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  );
}
