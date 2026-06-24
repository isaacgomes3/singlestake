/**
 * Sala Rotativa 2 Fatores+ — sessão global.
 */

import {
  ROTATING_ROOM_PLUS_MAX_RECOVERY,
  buildRotatingRoomPlusLiveView,
  tickRotatingRoomPlusPlacar,
  type RotatingRoomPlusMachineState,
  type RotatingRoomPlusPlacarFlash,
} from "@/lib/roulette/rotatingRoomPlusStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";

export { ROTATING_ROOM_PLUS_MAX_RECOVERY };

const STATS_KEY = "roulette.rotatingRoomPlus.stats.v1";
const MACHINE_KEY = "roulette.rotatingRoomPlus.machine.v1";

export const ROTATING_ROOM_PLUS_CHANGED_EVENT = "rotating-room-plus-changed";
export const ROTATING_ROOM_PLUS_RESET_EVENT = "rotating-room-plus-reset";

export function defaultRotatingRoomPlusMachineState(): RotatingRoomPlusMachineState {
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
    awaitSwitchNoTable: false,
    prepareFingerprint: null,
    prepareTableId: null,
    prepareActive: null,
    pendingQueueEntry: null,
    cycleMetricCategory: null,
  };
}

export function readRotatingRoomPlusSessionStats(): RotatingRoomSessionStats {
  if (typeof window === "undefined") return { wins: 0, losses: 0 };
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { wins: 0, losses: 0 };
    const o = JSON.parse(raw) as { wins?: number; losses?: number };
    return { wins: Number(o.wins) || 0, losses: Number(o.losses) || 0 };
  } catch {
    return { wins: 0, losses: 0 };
  }
}

export function writeRotatingRoomPlusSessionStats(stats: RotatingRoomSessionStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function readRotatingRoomPlusMachineState(): RotatingRoomPlusMachineState {
  if (typeof window === "undefined") return defaultRotatingRoomPlusMachineState();
  try {
    const raw = localStorage.getItem(MACHINE_KEY);
    if (!raw) return defaultRotatingRoomPlusMachineState();
    const o = JSON.parse(raw) as Partial<RotatingRoomPlusMachineState>;
    return { ...defaultRotatingRoomPlusMachineState(), ...o };
  } catch {
    return defaultRotatingRoomPlusMachineState();
  }
}

export function writeRotatingRoomPlusMachineState(state: RotatingRoomPlusMachineState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MACHINE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_PLUS_CHANGED_EVENT));
}

export function resetRotatingRoomPlusSession(): void {
  writeRotatingRoomPlusSessionStats({ wins: 0, losses: 0 });
  writeRotatingRoomPlusMachineState(defaultRotatingRoomPlusMachineState());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROTATING_ROOM_PLUS_RESET_EVENT));
  }
}

export function buildRotatingRoomPlusSessionLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomPlusMachineState,
) {
  return buildRotatingRoomPlusLiveView(tableIds, histories, machine);
}

export function tickRotatingRoomPlusSessionPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomPlusMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: RotatingRoomPlusMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomPlusPlacarFlash;
} {
  return tickRotatingRoomPlusPlacar(tableIds, histories, machine, stats);
}
