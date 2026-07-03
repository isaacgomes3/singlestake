/**
 * Sala Rotativa — sessão global Repetição (variação Fibonacci).
 */

import {
  ROTATING_ROOM_REPETICAO_MAX_RECOVERY,
  ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ROTATING_ROOM_REPETICAO_PREPARE_ABSENCE_SPINS,
  buildRotatingRoomRepeticaoLiveView,
  defaultRotatingRoomRepeticaoMachineState,
  sanitizeRotatingRoomRepeticaoMachineForTableIds,
  seedRotatingRoomRepeticaoMachineAfterPlacarReset,
  tickRotatingRoomRepeticaoPlacar,
  type RotatingRoomRepeticaoMachineState,
  type RotatingRoomRepeticaoPlacarFlash,
} from "@/lib/roulette/rotatingRoomRepeticaoStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  reclassifyOneFinalLossAsWin,
} from "@/lib/roulette/entryWinBreakdown";
import { isStrategyGlobalEnabled } from "@/lib/roulette/strategyGlobalClient";
import { readEffectiveRepeticaoZoneAbsenceSpins } from "@/lib/roulette/repeticaoAbsencePrefs";
import {
  isRepeticaoGatilhoEnabled,
  getEnabledRepeticaoZoneKinds,
} from "@/lib/roulette/umFatorTriggerEnable";

export {
  ROTATING_ROOM_REPETICAO_PREPARE_ABSENCE_SPINS,
  ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ROTATING_ROOM_REPETICAO_MAX_RECOVERY,
  sanitizeRotatingRoomRepeticaoMachineForTableIds,
};

const STATS_KEY = "roulette.rotatingRoomRepeticao.stats.v1";
const MACHINE_KEY = "roulette.rotatingRoomRepeticao.machine.v1";

export const ROTATING_ROOM_REPETICAO_CHANGED_EVENT = "rotating-room-repeticao-changed";
export const ROTATING_ROOM_REPETICAO_RESET_EVENT = "rotating-room-repeticao-reset";
export const ROTATING_ROOM_REPETICAO_STATS_CORRECTED_EVENT = "rotating-room-repeticao-stats-corrected";

export function readRotatingRoomRepeticaoSessionStats(): RotatingRoomSessionStats {
  if (typeof window === "undefined") {
    return emptyRotatingRoomSessionStats(ROTATING_ROOM_REPETICAO_MAX_RECOVERY);
  }
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyRotatingRoomSessionStats(ROTATING_ROOM_REPETICAO_MAX_RECOVERY);
    return parseRotatingRoomSessionStats(JSON.parse(raw), ROTATING_ROOM_REPETICAO_MAX_RECOVERY);
  } catch {
    return emptyRotatingRoomSessionStats(ROTATING_ROOM_REPETICAO_MAX_RECOVERY);
  }
}

export function writeRotatingRoomRepeticaoSessionStats(stats: RotatingRoomSessionStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function readRotatingRoomRepeticaoMachineState(
  tableIds: readonly number[] = [],
): RotatingRoomRepeticaoMachineState {
  if (typeof window === "undefined") return defaultRotatingRoomRepeticaoMachineState();
  try {
    const raw = localStorage.getItem(MACHINE_KEY);
    if (!raw) return defaultRotatingRoomRepeticaoMachineState();
    const o = JSON.parse(raw) as Partial<RotatingRoomRepeticaoMachineState>;
    const merged = { ...defaultRotatingRoomRepeticaoMachineState(), ...o };
    return tableIds.length > 0
      ? sanitizeRotatingRoomRepeticaoMachineForTableIds(merged, tableIds)
      : merged;
  } catch {
    return defaultRotatingRoomRepeticaoMachineState();
  }
}

export function writeRotatingRoomRepeticaoMachineState(
  state: RotatingRoomRepeticaoMachineState,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MACHINE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_REPETICAO_CHANGED_EVENT));
}

export function resetRotatingRoomRepeticaoSession(
  tableIds: readonly number[] = [],
  histories: Record<number, readonly number[]> = {},
): void {
  if (typeof window !== "undefined" && isStrategyGlobalEnabled()) {
    return;
  }
  writeRotatingRoomRepeticaoSessionStats(
    emptyRotatingRoomSessionStats(ROTATING_ROOM_REPETICAO_MAX_RECOVERY),
  );
  const seeded = seedRotatingRoomRepeticaoMachineAfterPlacarReset(
    defaultRotatingRoomRepeticaoMachineState(),
    tableIds,
    histories,
  );
  writeRotatingRoomRepeticaoMachineState(seeded);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROTATING_ROOM_REPETICAO_RESET_EVENT));
  }
}

export function correctRotatingRoomRepeticaoLastLossAsWin(): boolean {
  if (typeof window === "undefined") return false;
  const stats = readRotatingRoomRepeticaoSessionStats();
  const next = reclassifyOneFinalLossAsWin(stats, ROTATING_ROOM_REPETICAO_MAX_RECOVERY);
  if (!next) return false;
  writeRotatingRoomRepeticaoSessionStats(next);
  window.dispatchEvent(new CustomEvent(ROTATING_ROOM_REPETICAO_STATS_CORRECTED_EVENT));
  return true;
}

export function buildRotatingRoomRepeticaoSessionLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomRepeticaoMachineState,
  options?: { suppressNewAlerts?: boolean },
) {
  const absenceByKind = readEffectiveRepeticaoZoneAbsenceSpins();
  const enabledZoneKinds = getEnabledRepeticaoZoneKinds();
  return buildRotatingRoomRepeticaoLiveView(
    tableIds,
    histories,
    machine,
    absenceByKind,
    enabledZoneKinds,
    options,
  );
}

export function tickRotatingRoomRepeticaoSessionPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomRepeticaoMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: RotatingRoomRepeticaoMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomRepeticaoPlacarFlash;
} {
  const absenceByKind = readEffectiveRepeticaoZoneAbsenceSpins();
  const allowNewArming = isRepeticaoGatilhoEnabled();
  const enabledZoneKinds = getEnabledRepeticaoZoneKinds();
  return tickRotatingRoomRepeticaoPlacar(
    tableIds,
    histories,
    machine,
    stats,
    ROTATING_ROOM_REPETICAO_MAX_RECOVERY,
    allowNewArming,
    absenceByKind,
    enabledZoneKinds,
  );
}
