/**
 * 2 Fatores — cruzamento cor/altura ou paridade/altura **por mesa** (lógica da sala rotativa, sem fila nem troca).
 */

import {
  buildRotatingRoomCrossingLiveView,
  seedRotatingRoomCrossingMachineAfterPlacarReset,
  tickRotatingRoomCrossingPlacar,
  type RotatingRoomCrossingMachineState,
  type RotatingRoomCrossingPlacarFlash,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  emptyRecoveryLevelCounts,
  emptyRotatingRoomSessionStats,
  entryWinBreakdownFromRecoveryCounts,
  parseRotatingRoomSessionStats,
  type EntryWinBreakdown,
} from "@/lib/roulette/entryWinBreakdown";

export const DOIS_FATORES_CROSSING_MAX_RECOVERY = 5;

export const DOIS_FATORES_CROSSING_MIN_ABSENCE_SPINS = 18;

/** @deprecated Use {@link DOIS_FATORES_CROSSING_MIN_ABSENCE_SPINS}. */
export const DOIS_FATORES_CROSSING_ALERT_ABSENCE = DOIS_FATORES_CROSSING_MIN_ABSENCE_SPINS;

const STATS_KEY_PREFIX = "roulette.doisFatoresCrossing.stats.";
const MACHINE_KEY_PREFIX = "roulette.doisFatoresCrossing.machine.v1.";
const PLACAR_ANCHOR_KEY_PREFIX = "roulette.doisFatoresCrossing.placarAnchor.";

export const DOIS_FATORES_CROSSING_CHANGED_EVENT = "dois-fatores-crossing-changed";
export const DOIS_FATORES_CROSSING_RESET_EVENT = "dois-fatores-crossing-reset";

function statsStorageKey(tableId: number): string {
  return `${STATS_KEY_PREFIX}${tableId}`;
}

function machineStorageKey(tableId: number): string {
  return `${MACHINE_KEY_PREFIX}${tableId}`;
}

function placarAnchorStorageKey(tableId: number): string {
  return `${PLACAR_ANCHOR_KEY_PREFIX}${tableId}`;
}

function readPlacarAnchorLength(tableId: number): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(placarAnchorStorageKey(tableId));
    if (!raw) return 0;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writePlacarAnchorLength(tableId: number, historyLength: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(placarAnchorStorageKey(tableId), JSON.stringify(Math.max(0, historyLength)));
}

function simulateDoisFatoresCrossingPlacarFromHistory(
  tableId: number,
  historyNewestFirst: readonly number[],
  maxRecovery: number = DOIS_FATORES_CROSSING_MAX_RECOVERY,
): {
  winsAtRecovery: number[];
  lossesAtRecovery: number[];
  cycleWins: number;
  cycleLosses: number;
} {
  const winsAtRecovery = emptyRecoveryLevelCounts(maxRecovery);
  const lossesAtRecovery = emptyRecoveryLevelCounts(maxRecovery);
  const chronological = [...historyNewestFirst].reverse();
  let machine = defaultDoisFatoresCrossingMachineState();
  let stats: RotatingRoomSessionStats = emptyRotatingRoomSessionStats(maxRecovery);
  let cycleWins = 0;
  let cycleLosses = 0;

  for (let i = 0; i < chronological.length; i++) {
    const prefixNewestFirst = chronological.slice(0, i + 1).reverse();
    const recoveryBefore = machine.recovery;
    const result = tickDoisFatoresCrossingPlacar(tableId, prefixNewestFirst, machine, stats);
    machine = result.nextMachine;
    stats = result.stats;
    if (result.flash?.kind === "win") {
      const idx = Math.min(Math.max(0, recoveryBefore), maxRecovery);
      winsAtRecovery[idx]! += 1;
      cycleWins += 1;
    } else if (result.flash?.kind === "loss") {
      const idx = Math.min(Math.max(0, recoveryBefore), maxRecovery);
      lossesAtRecovery[idx]! += 1;
      cycleLosses += 1;
    } else if (result.flash?.kind === "recovery") {
      const idx = Math.min(Math.max(0, recoveryBefore), maxRecovery);
      lossesAtRecovery[idx]! += 1;
    }
  }

  return { winsAtRecovery, lossesAtRecovery, cycleWins, cycleLosses };
}

export function doisFatoresCrossingEntryWinBreakdownFromHistory(
  tableId: number,
  historyNewestFirst: readonly number[],
  maxRecovery: number = DOIS_FATORES_CROSSING_MAX_RECOVERY,
): EntryWinBreakdown {
  if (historyNewestFirst.length === 0) {
    return entryWinBreakdownFromRecoveryCounts(
      emptyRecoveryLevelCounts(maxRecovery),
      emptyRecoveryLevelCounts(maxRecovery),
      0,
      0,
    );
  }
  const sim = simulateDoisFatoresCrossingPlacarFromHistory(
    tableId,
    historyNewestFirst,
    maxRecovery,
  );
  return entryWinBreakdownFromRecoveryCounts(
    sim.winsAtRecovery,
    sim.lossesAtRecovery,
    sim.cycleWins,
    sim.cycleLosses,
  );
}

/** Breakdown simulado só com giros após o último «zerar» (histórico ao vivo). */
export function doisFatoresCrossingLobbyEntryWinBreakdown(
  tableId: number,
  historyNewestFirst: readonly number[],
): EntryWinBreakdown {
  const anchor = readPlacarAnchorLength(tableId);
  const sliceLen = Math.max(0, historyNewestFirst.length - anchor);
  if (sliceLen === 0) {
    return doisFatoresCrossingEntryWinBreakdownFromHistory(tableId, []);
  }
  return doisFatoresCrossingEntryWinBreakdownFromHistory(
    tableId,
    historyNewestFirst.slice(0, sliceLen),
  );
}

export function defaultDoisFatoresCrossingMachineState(): RotatingRoomCrossingMachineState {
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
    lastLostTableId: null,
    prepareSpinsWithoutPattern: 0,
  };
}

export function readDoisFatoresCrossingSessionStats(tableId: number): RotatingRoomSessionStats {
  if (typeof window === "undefined") return emptyRotatingRoomSessionStats(DOIS_FATORES_CROSSING_MAX_RECOVERY);
  try {
    const raw = localStorage.getItem(statsStorageKey(tableId));
    if (!raw) return emptyRotatingRoomSessionStats(DOIS_FATORES_CROSSING_MAX_RECOVERY);
    return parseRotatingRoomSessionStats(JSON.parse(raw), DOIS_FATORES_CROSSING_MAX_RECOVERY);
  } catch {
    return emptyRotatingRoomSessionStats(DOIS_FATORES_CROSSING_MAX_RECOVERY);
  }
}

export function writeDoisFatoresCrossingSessionStats(
  tableId: number,
  stats: RotatingRoomSessionStats,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(statsStorageKey(tableId), JSON.stringify(stats));
}

export function readDoisFatoresCrossingMachineState(tableId: number): RotatingRoomCrossingMachineState {
  if (typeof window === "undefined") return defaultDoisFatoresCrossingMachineState();
  try {
    const raw = localStorage.getItem(machineStorageKey(tableId));
    if (!raw) return defaultDoisFatoresCrossingMachineState();
    const o = JSON.parse(raw) as Partial<RotatingRoomCrossingMachineState>;
    return { ...defaultDoisFatoresCrossingMachineState(), ...o };
  } catch {
    return defaultDoisFatoresCrossingMachineState();
  }
}

export function writeDoisFatoresCrossingMachineState(
  tableId: number,
  state: RotatingRoomCrossingMachineState,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(machineStorageKey(tableId), JSON.stringify(state));
  window.dispatchEvent(
    new CustomEvent(DOIS_FATORES_CROSSING_CHANGED_EVENT, { detail: { tableId } }),
  );
}

export function resetDoisFatoresCrossingSession(
  tableId: number,
  historyNewestFirst: readonly number[] = [],
): void {
  writeDoisFatoresCrossingSessionStats(
    tableId,
    emptyRotatingRoomSessionStats(DOIS_FATORES_CROSSING_MAX_RECOVERY),
  );
  const seeded = seedRotatingRoomCrossingMachineAfterPlacarReset(
    defaultDoisFatoresCrossingMachineState(),
    [tableId],
    { [tableId]: historyNewestFirst },
  );
  writeDoisFatoresCrossingMachineState(tableId, seeded);
  writePlacarAnchorLength(tableId, historyNewestFirst.length);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(DOIS_FATORES_CROSSING_RESET_EVENT, { detail: { tableId } }),
    );
  }
}

export function resetAllDoisFatoresCrossingSessions(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]> = {},
): void {
  for (const tableId of tableIds) {
    resetDoisFatoresCrossingSession(tableId, histories[tableId] ?? []);
  }
}

export function buildDoisFatoresCrossingLiveView(
  tableId: number,
  history: readonly number[],
  machine: RotatingRoomCrossingMachineState,
) {
  return buildRotatingRoomCrossingLiveView(
    [tableId],
    { [tableId]: history },
    machine,
    DOIS_FATORES_CROSSING_MIN_ABSENCE_SPINS,
  );
}

export function tickDoisFatoresCrossingPlacar(
  tableId: number,
  history: readonly number[],
  machine: RotatingRoomCrossingMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: RotatingRoomCrossingMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomCrossingPlacarFlash;
} {
  return tickRotatingRoomCrossingPlacar(
    [tableId],
    { [tableId]: history },
    machine,
    stats,
    DOIS_FATORES_CROSSING_MAX_RECOVERY,
    DOIS_FATORES_CROSSING_MIN_ABSENCE_SPINS,
  );
}
