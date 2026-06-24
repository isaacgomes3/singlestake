/**
 * 1 Fator — por mesa (lógica da sala rotativa, sem fila nem troca).
 */

import {
  buildUmFatorLiveView,
  defaultUmFatorMachineState,
  normalizeUmFatorMachineOnLoad,
  seedUmFatorMachineAfterPlacarReset,
  tickUmFatorPlacar,
  UM_FATOR_MAX_RECOVERY,
  type UmFatorMachineState,
  type UmFatorPlacarFlash,
} from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import { umFatorMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomUmFatorPlacarDrive";
import { drainPlacarSteps } from "@/lib/roulette/strategySessionDrive";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";

export { UM_FATOR_MAX_RECOVERY };

const STATS_KEY_PREFIX = "roulette.umFator.stats.";
const MACHINE_KEY_PREFIX = "roulette.umFator.machine.v1.";
const PLACAR_ANCHOR_KEY_PREFIX = "roulette.umFator.placarAnchor.";

export const UM_FATOR_CHANGED_EVENT = "um-fator-changed";
export const UM_FATOR_RESET_EVENT = "um-fator-reset";

function statsStorageKey(tableId: number): string {
  return `${STATS_KEY_PREFIX}${tableId}`;
}

function machineStorageKey(tableId: number): string {
  return `${MACHINE_KEY_PREFIX}${tableId}`;
}

function placarAnchorStorageKey(tableId: number): string {
  return `${PLACAR_ANCHOR_KEY_PREFIX}${tableId}`;
}

function writePlacarAnchorLength(tableId: number, historyLength: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(placarAnchorStorageKey(tableId), JSON.stringify(Math.max(0, historyLength)));
}

export function readUmFatorSessionStats(tableId: number): RotatingRoomSessionStats {
  if (typeof window === "undefined") return emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
  try {
    const raw = localStorage.getItem(statsStorageKey(tableId));
    if (!raw) return emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
    return parseRotatingRoomSessionStats(JSON.parse(raw), UM_FATOR_MAX_RECOVERY);
  } catch {
    return emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
  }
}

export function writeUmFatorSessionStats(tableId: number, stats: RotatingRoomSessionStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(statsStorageKey(tableId), JSON.stringify(stats));
}

export function readUmFatorMachineState(tableId: number): UmFatorMachineState {
  if (typeof window === "undefined") return defaultUmFatorMachineState();
  try {
    const raw = localStorage.getItem(machineStorageKey(tableId));
    if (!raw) return defaultUmFatorMachineState();
    const o = JSON.parse(raw) as Partial<UmFatorMachineState>;
    const machine = { ...defaultUmFatorMachineState(), ...o, pendingByTable: o.pendingByTable ?? {} };
    return normalizeUmFatorMachineOnLoad(machine, readUmFatorSessionStats(tableId));
  } catch {
    return defaultUmFatorMachineState();
  }
}

export function writeUmFatorMachineState(tableId: number, state: UmFatorMachineState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(machineStorageKey(tableId), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(UM_FATOR_CHANGED_EVENT, { detail: { tableId } }));
}

export function resetUmFatorSession(
  tableId: number,
  historyNewestFirst: readonly number[] = [],
): void {
  writeUmFatorSessionStats(tableId, emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY));
  const seeded = seedUmFatorMachineAfterPlacarReset(
    defaultUmFatorMachineState(),
    [tableId],
    { [tableId]: historyNewestFirst },
  );
  writeUmFatorMachineState(tableId, seeded);
  writePlacarAnchorLength(tableId, historyNewestFirst.length);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(UM_FATOR_RESET_EVENT, { detail: { tableId } }));
  }
}

export function resetAllUmFatorSessions(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]> = {},
): void {
  for (const tableId of tableIds) {
    resetUmFatorSession(tableId, histories[tableId] ?? []);
  }
}

export function buildUmFatorLiveViewForTable(
  tableId: number,
  history: readonly number[],
  machine: UmFatorMachineState,
) {
  return buildUmFatorLiveView([tableId], { [tableId]: history }, machine);
}

export function tickUmFatorPlacarForTable(
  tableId: number,
  history: readonly number[],
  machine: UmFatorMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: UmFatorMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: UmFatorPlacarFlash;
} {
  return tickUmFatorPlacar([tableId], { [tableId]: history }, machine, stats, UM_FATOR_MAX_RECOVERY);
}

/** Tick único a partir do storage — mesma mesa. */
export function driveUmFatorPlacarForTable(
  tableId: number,
  history: readonly number[],
): {
  nextMachine: UmFatorMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: UmFatorPlacarFlash;
} {
  const machine = readUmFatorMachineState(tableId);
  const stats = readUmFatorSessionStats(tableId);
  const result = drainPlacarSteps(
    machine,
    stats,
    (currentMachine, currentStats) =>
      tickUmFatorPlacar([tableId], { [tableId]: history }, currentMachine, currentStats, UM_FATOR_MAX_RECOVERY),
    umFatorMachinePlacarStepProgressed,
  );

  const statsJson = JSON.stringify(result.stats);
  if (result.statsChanged || statsJson !== JSON.stringify(stats)) {
    writeUmFatorSessionStats(tableId, result.stats);
  }
  const machineJson = JSON.stringify(result.nextMachine);
  if (machineJson !== JSON.stringify(machine) || result.statsChanged) {
    writeUmFatorMachineState(tableId, result.nextMachine);
  }

  return result;
}
