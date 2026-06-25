/**
 * Sala Rotativa — sessão global 1 Fator em todas as mesas do rodízio.
 */

import {
  buildUmFatorLiveView,
  defaultUmFatorMachineState,
  normalizeUmFatorMachineOnLoad,
  sanitizeUmFatorMachineForTableIds,
  seedUmFatorMachineAfterPlacarReset,
  tickUmFatorPlacar,
  UM_FATOR_MAX_RECOVERY,
  type UmFatorMachineState,
  type UmFatorPlacarFlash,
} from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import { readEffectiveUmFatorMaxRecovery } from "@/lib/roulette/rotatingRoomExtensionPrefs";
import { drainPlacarSteps } from "@/lib/roulette/strategySessionDrive";
import { umFatorMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomUmFatorPlacarDrive";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  reclassifyOneFinalLossAsWin,
} from "@/lib/roulette/entryWinBreakdown";
import {
  isStrategyGlobalEnabled,
  requestStrategyGlobalReset,
} from "@/lib/roulette/strategyGlobalClient";

export {
  UM_FATOR_MAX_RECOVERY,
  UM_FATOR_MAX_RECOVERY as ROTATING_ROOM_UM_FATOR_MAX_RECOVERY,
  sanitizeUmFatorMachineForTableIds,
};

const STATS_KEY = "roulette.rotatingRoomUmFator.stats.v1";
const MACHINE_KEY = "roulette.rotatingRoomUmFator.machine.v1";

export const ROTATING_ROOM_UM_FATOR_STATS_STORAGE_KEY = STATS_KEY;
export const ROTATING_ROOM_UM_FATOR_MACHINE_STORAGE_KEY = MACHINE_KEY;

export const ROTATING_ROOM_UM_FATOR_CHANGED_EVENT = "rotating-room-um-fator-changed";
export const ROTATING_ROOM_UM_FATOR_RESET_EVENT = "rotating-room-um-fator-reset";
export const ROTATING_ROOM_UM_FATOR_STATS_CORRECTED_EVENT = "rotating-room-um-fator-stats-corrected";

export function readRotatingRoomUmFatorSessionStats(): RotatingRoomSessionStats {
  if (typeof window === "undefined") {
    return emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
  }
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
    return parseRotatingRoomSessionStats(JSON.parse(raw), UM_FATOR_MAX_RECOVERY);
  } catch {
    return emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
  }
}

export function writeRotatingRoomUmFatorSessionStats(stats: RotatingRoomSessionStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function readRotatingRoomUmFatorMachineState(): UmFatorMachineState {
  if (typeof window === "undefined") return defaultUmFatorMachineState();
  try {
    const raw = localStorage.getItem(MACHINE_KEY);
    if (!raw) return defaultUmFatorMachineState();
    const o = JSON.parse(raw) as Partial<UmFatorMachineState>;
    const machine = {
      ...defaultUmFatorMachineState(),
      ...o,
      pendingByTable: o.pendingByTable ?? {},
    };
    return normalizeUmFatorMachineOnLoad(machine, readRotatingRoomUmFatorSessionStats());
  } catch {
    return defaultUmFatorMachineState();
  }
}

export function writeRotatingRoomUmFatorMachineState(state: UmFatorMachineState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MACHINE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_UM_FATOR_CHANGED_EVENT));
}

export function resetRotatingRoomUmFatorSession(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]> = {},
): void {
  if (typeof window !== "undefined" && isStrategyGlobalEnabled()) {
    void requestStrategyGlobalReset("um1fator");
    return;
  }
  writeRotatingRoomUmFatorSessionStats(emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY));
  const seeded = seedUmFatorMachineAfterPlacarReset(
    defaultUmFatorMachineState(),
    tableIds,
    histories,
  );
  writeRotatingRoomUmFatorMachineState(seeded);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROTATING_ROOM_UM_FATOR_RESET_EVENT));
  }
}

export function correctRotatingRoomUmFatorLastLossAsWin(): void {
  const stats = readRotatingRoomUmFatorSessionStats();
  const next = reclassifyOneFinalLossAsWin(stats, UM_FATOR_MAX_RECOVERY);
  writeRotatingRoomUmFatorSessionStats(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROTATING_ROOM_UM_FATOR_STATS_CORRECTED_EVENT));
  }
}

export function buildRotatingRoomUmFatorSessionLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: UmFatorMachineState,
) {
  return buildUmFatorLiveView(tableIds, histories, machine);
}

export function tickRotatingRoomUmFatorSessionPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: UmFatorMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: UmFatorMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: UmFatorPlacarFlash;
} {
  return tickUmFatorPlacar(
    tableIds,
    histories,
    machine,
    stats,
    readEffectiveUmFatorMaxRecovery(UM_FATOR_MAX_RECOVERY),
  );
}

/** Tick único a partir do storage — evita corridas entre lobby e sala. */
export function driveRotatingRoomUmFatorPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): {
  nextMachine: UmFatorMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: UmFatorPlacarFlash;
} {
  const machine = sanitizeUmFatorMachineForTableIds(
    readRotatingRoomUmFatorMachineState(),
    tableIds,
  );
  const stats = readRotatingRoomUmFatorSessionStats();
  const result = drainPlacarSteps(
    machine,
    stats,
    (currentMachine, currentStats) => {
      const step = tickUmFatorPlacar(
        tableIds,
        histories,
        currentMachine,
        currentStats,
        readEffectiveUmFatorMaxRecovery(UM_FATOR_MAX_RECOVERY),
      );
      return {
        ...step,
        nextMachine: sanitizeUmFatorMachineForTableIds(step.nextMachine, tableIds),
      };
    },
    umFatorMachinePlacarStepProgressed,
  );
  const nextMachine = result.nextMachine;

  const statsJson = JSON.stringify(result.stats);
  if (result.statsChanged || statsJson !== JSON.stringify(stats)) {
    writeRotatingRoomUmFatorSessionStats(result.stats);
  }
  const machineJson = JSON.stringify(nextMachine);
  if (machineJson !== JSON.stringify(machine) || result.statsChanged) {
    writeRotatingRoomUmFatorMachineState(nextMachine);
  }

  return { ...result, nextMachine };
}
