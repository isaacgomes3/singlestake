/**
 * Cruzamento 2F (ICE) — sessão por mesa, sem gale (maxRecovery = 0).
 */

import { drainPlacarSteps } from "@/lib/roulette/strategySessionDrive";
import {
  configureIce2fDefaultComparePairs,
  defaultIce2fMachineState,
  emptyIce2fStats,
  getIce2fSoftMinHistory,
  parseIce2fStats,
  primeIce2fWatchFromHistory,
  tickIce2fPlacar,
  tryArmCycleFromWatch,
  type Ice2fActive,
  type Ice2fFlash,
  type Ice2fMachineState,
} from "@/lib/roulette/iceCruzamento2fStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";

/** Sem gale — uma entrada; L fecha a sequência. */
export const ICE2F_TABLE_MAX_RECOVERY = 0;

const STATS_KEY_PREFIX = "roulette.ice2f.stats.v1.";
const MACHINE_KEY_PREFIX = "roulette.ice2f.machine.v1.";

export const ICE2F_TABLE_CHANGED_EVENT = "ice2f-table-changed";
export const ICE2F_TABLE_RESET_EVENT = "ice2f-table-reset";

function statsStorageKey(tableId: number): string {
  return `${STATS_KEY_PREFIX}${tableId}`;
}

function machineStorageKey(tableId: number): string {
  return `${MACHINE_KEY_PREFIX}${tableId}`;
}

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function ensureIce2fPairsConfigured(): void {
  configureIce2fDefaultComparePairs();
}

export function seedIce2fMachineFromHistory(
  historyNewestFirst: readonly number[],
): Ice2fMachineState {
  ensureIce2fPairsConfigured();
  const head = spinHead(historyNewestFirst);
  const watch = primeIce2fWatchFromHistory(historyNewestFirst);
  let machine: Ice2fMachineState = {
    ...defaultIce2fMachineState(),
    watch,
    lastSpinHead: historyNewestFirst.length > 0 ? head : null,
  };
  if (historyNewestFirst.length >= getIce2fSoftMinHistory()) {
    machine = tryArmCycleFromWatch(machine, historyNewestFirst, head);
  }
  return machine;
}

export function ice2fMachinePlacarStepProgressed(
  before: Ice2fMachineState,
  after: Ice2fMachineState,
  step: { statsChanged: boolean; flash: Ice2fFlash | null },
): boolean {
  return (
    step.statsChanged ||
    step.flash != null ||
    before.lastSpinHead !== after.lastSpinHead ||
    (before.pendingRecovery ?? 0) !== (after.pendingRecovery ?? 0) ||
    before.cycle?.phase !== after.cycle?.phase ||
    before.cycle?.armedHead !== after.cycle?.armedHead
  );
}

export function readIce2fSessionStats(tableId: number): RotatingRoomSessionStats {
  if (typeof window === "undefined") return emptyIce2fStats(ICE2F_TABLE_MAX_RECOVERY);
  try {
    const raw = localStorage.getItem(statsStorageKey(tableId));
    if (!raw) return emptyIce2fStats(ICE2F_TABLE_MAX_RECOVERY);
    return parseIce2fStats(JSON.parse(raw), ICE2F_TABLE_MAX_RECOVERY);
  } catch {
    return emptyIce2fStats(ICE2F_TABLE_MAX_RECOVERY);
  }
}

export function writeIce2fSessionStats(tableId: number, stats: RotatingRoomSessionStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(statsStorageKey(tableId), JSON.stringify(stats));
}

export function readIce2fMachineState(tableId: number): Ice2fMachineState {
  if (typeof window === "undefined") return defaultIce2fMachineState();
  try {
    const raw = localStorage.getItem(machineStorageKey(tableId));
    if (!raw) return defaultIce2fMachineState();
    const o = JSON.parse(raw) as Partial<Ice2fMachineState>;
    return { ...defaultIce2fMachineState(), ...o };
  } catch {
    return defaultIce2fMachineState();
  }
}

export function writeIce2fMachineState(tableId: number, state: Ice2fMachineState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(machineStorageKey(tableId), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(ICE2F_TABLE_CHANGED_EVENT, { detail: { tableId } }));
}

export function resetIce2fSession(
  tableId: number,
  historyNewestFirst: readonly number[] = [],
): void {
  writeIce2fSessionStats(tableId, emptyIce2fStats(ICE2F_TABLE_MAX_RECOVERY));
  writeIce2fMachineState(tableId, seedIce2fMachineFromHistory(historyNewestFirst));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ICE2F_TABLE_RESET_EVENT, { detail: { tableId } }));
  }
}

export function buildIce2fLiveViewForTable(
  history: readonly number[],
  machine: Ice2fMachineState,
): { globalActive: Ice2fActive | null; globalRecovery: number } {
  ensureIce2fPairsConfigured();
  const tick = tickIce2fPlacar(
    history,
    machine,
    emptyIce2fStats(ICE2F_TABLE_MAX_RECOVERY),
    ICE2F_TABLE_MAX_RECOVERY,
    "martingale",
  );
  return {
    globalActive: tick.globalActive,
    globalRecovery: tick.globalRecovery,
  };
}

export function tableHasLocalIce2fSignal(
  tableId: number,
  history: readonly number[],
): boolean {
  const machine = readIce2fMachineState(tableId);
  return buildIce2fLiveViewForTable(history, machine).globalActive != null;
}

/** Tick a partir do storage — mesma mesa, sem gale. */
export function driveIce2fPlacarForTable(
  tableId: number,
  history: readonly number[],
): {
  nextMachine: Ice2fMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: Ice2fFlash | null;
  globalActive: Ice2fActive | null;
  globalRecovery: number;
} {
  ensureIce2fPairsConfigured();
  let machine = readIce2fMachineState(tableId);
  const stats = readIce2fSessionStats(tableId);

  // Primeira carga: ancora o histórico sem liquidar o passado.
  if (machine.lastSpinHead == null && history.length > 0) {
    machine = seedIce2fMachineFromHistory(history);
    writeIce2fMachineState(tableId, machine);
  }

  const drained = drainPlacarSteps(
    machine,
    stats,
    (currentMachine, currentStats) => {
      const tick = tickIce2fPlacar(
        history,
        currentMachine,
        currentStats,
        ICE2F_TABLE_MAX_RECOVERY,
        "martingale",
      );
      return {
        nextMachine: tick.machine,
        stats: tick.stats,
        statsChanged: tick.statsChanged,
        flash: tick.flash,
      };
    },
    ice2fMachinePlacarStepProgressed,
  );

  const statsJson = JSON.stringify(drained.stats);
  if (drained.statsChanged || statsJson !== JSON.stringify(stats)) {
    writeIce2fSessionStats(tableId, drained.stats);
  }
  const machineJson = JSON.stringify(drained.nextMachine);
  if (machineJson !== JSON.stringify(machine) || drained.statsChanged) {
    writeIce2fMachineState(tableId, drained.nextMachine);
  }

  const cycle = drained.nextMachine.cycle;
  const globalActive =
    cycle?.phase === "awaiting_bet" || cycle?.phase === "awaiting_result"
      ? cycle.active
      : null;
  const globalRecovery =
    cycle?.recovery ?? Math.max(0, Math.floor(drained.nextMachine.pendingRecovery ?? 0));

  return {
    nextMachine: drained.nextMachine,
    stats: drained.stats,
    statsChanged: drained.statsChanged,
    flash: drained.flash,
    globalActive,
    globalRecovery,
  };
}
