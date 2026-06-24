/**
 * 2 Fatores+ — sessão por mesa (sinal directo, sem fase posicionar).
 */

import {
  ROTATING_ROOM_PLUS_MAX_RECOVERY,
  buildRotatingRoomPlusLiveView,
  tickRotatingRoomPlusPlacar,
  type RotatingRoomPlusMachineState,
  type RotatingRoomPlusPlacarFlash,
} from "@/lib/roulette/rotatingRoomPlusStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  recordRotatingRoomSessionFinalLoss,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionWin,
} from "@/lib/roulette/entryWinBreakdown";
import {
  buildDoisFatoresPlusActive,
  buildDoisFatoresPlusRoundIndication,
  doisFatoresPlusAproveitamentoPctFromHistory,
  doisFatoresPlusEntryWinBreakdownFromHistory,
  evaluateDoisFatoresPlusRound,
  isDoisFatoresPlusGatilhoArmed,
  type DoisFatoresPlusEntryWinBreakdown,
} from "@/lib/roulette/doisFatoresPlusStrategy";

export const DOIS_FATORES_PLUS_MAX_RECOVERY = 5;

const STATS_KEY_PREFIX = "roulette.doisFatoresPlus.stats.";
const MACHINE_KEY_PREFIX = "roulette.doisFatoresPlus.machine.v1.";
const PLACAR_ANCHOR_KEY_PREFIX = "roulette.doisFatoresPlus.placarAnchor.";

export const DOIS_FATORES_PLUS_CHANGED_EVENT = "dois-fatores-plus-changed";
export const DOIS_FATORES_PLUS_RESET_EVENT = "dois-fatores-plus-reset";

function statsStorageKey(tableId: number): string {
  return `${STATS_KEY_PREFIX}${tableId}`;
}

function machineStorageKey(tableId: number): string {
  return `${MACHINE_KEY_PREFIX}${tableId}`;
}

export function defaultDoisFatoresPlusMachineState(): RotatingRoomPlusMachineState {
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

/** Aproveitamento simulado só com giros após o último «zerar» (histórico ao vivo). */
export function doisFatoresPlusLobbyAproveitamentoPct(
  tableId: number,
  historyNewestFirst: readonly number[],
): number {
  const anchor = readPlacarAnchorLength(tableId);
  const sliceLen = Math.max(0, historyNewestFirst.length - anchor);
  if (sliceLen === 0) return 0;
  return doisFatoresPlusAproveitamentoPctFromHistory(historyNewestFirst.slice(0, sliceLen));
}

export function doisFatoresPlusLobbyEntryWinBreakdown(
  tableId: number,
  historyNewestFirst: readonly number[],
): DoisFatoresPlusEntryWinBreakdown {
  const anchor = readPlacarAnchorLength(tableId);
  const sliceLen = Math.max(0, historyNewestFirst.length - anchor);
  if (sliceLen === 0) {
    return doisFatoresPlusEntryWinBreakdownFromHistory([]);
  }
  return doisFatoresPlusEntryWinBreakdownFromHistory(historyNewestFirst.slice(0, sliceLen));
}

function spinHeadFromHistory(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function clearCycle(machine: RotatingRoomPlusMachineState): RotatingRoomPlusMachineState {
  return {
    ...machine,
    cycleTableId: null,
    cycleFingerprint: null,
    cycleActive: null,
    cycleMetricCategory: null,
    cycleSpinsWithoutWin: 0,
    armedAtHead: null,
    lastEvaluatedHead: null,
  };
}

function finishCycle(machine: RotatingRoomPlusMachineState): RotatingRoomPlusMachineState {
  return { ...clearCycle(machine), recovery: 0 };
}

function refreshIndicationFromPos11(
  machine: RotatingRoomPlusMachineState,
  history: readonly number[],
): RotatingRoomPlusMachineState {
  if (!machine.cycleActive) return machine;
  const indication = buildDoisFatoresPlusRoundIndication(history);
  if (!indication) return machine;
  return { ...machine, cycleActive: indication };
}

export function readDoisFatoresPlusSessionStats(tableId: number): RotatingRoomSessionStats {
  if (typeof window === "undefined") return emptyRotatingRoomSessionStats(DOIS_FATORES_PLUS_MAX_RECOVERY);
  try {
    const raw = localStorage.getItem(statsStorageKey(tableId));
    if (!raw) return emptyRotatingRoomSessionStats(DOIS_FATORES_PLUS_MAX_RECOVERY);
    return parseRotatingRoomSessionStats(JSON.parse(raw), DOIS_FATORES_PLUS_MAX_RECOVERY);
  } catch {
    return emptyRotatingRoomSessionStats(DOIS_FATORES_PLUS_MAX_RECOVERY);
  }
}

export function writeDoisFatoresPlusSessionStats(tableId: number, stats: RotatingRoomSessionStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(statsStorageKey(tableId), JSON.stringify(stats));
}

export function readDoisFatoresPlusMachineState(tableId: number): RotatingRoomPlusMachineState {
  if (typeof window === "undefined") return defaultDoisFatoresPlusMachineState();
  try {
    const raw = localStorage.getItem(machineStorageKey(tableId));
    if (!raw) return defaultDoisFatoresPlusMachineState();
    const o = JSON.parse(raw) as Partial<RotatingRoomPlusMachineState>;
    return { ...defaultDoisFatoresPlusMachineState(), ...o };
  } catch {
    return defaultDoisFatoresPlusMachineState();
  }
}

export function writeDoisFatoresPlusMachineState(
  tableId: number,
  state: RotatingRoomPlusMachineState,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(machineStorageKey(tableId), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DOIS_FATORES_PLUS_CHANGED_EVENT, { detail: { tableId } }));
}

export function resetDoisFatoresPlusSession(tableId: number, historyLengthAtReset = 0): void {
  writeDoisFatoresPlusSessionStats(
    tableId,
    emptyRotatingRoomSessionStats(DOIS_FATORES_PLUS_MAX_RECOVERY),
  );
  writeDoisFatoresPlusMachineState(tableId, defaultDoisFatoresPlusMachineState());
  writePlacarAnchorLength(tableId, historyLengthAtReset);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DOIS_FATORES_PLUS_RESET_EVENT, { detail: { tableId } }));
  }
}

export function resetAllDoisFatoresPlusSessions(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]> = {},
): void {
  for (const tableId of tableIds) {
    resetDoisFatoresPlusSession(tableId, histories[tableId]?.length ?? 0);
  }
}

export function buildDoisFatoresPlusLiveView(
  tableId: number,
  history: readonly number[],
  machine: RotatingRoomPlusMachineState,
) {
  return buildRotatingRoomPlusLiveView([tableId], { [tableId]: history }, machine);
}

export function tickDoisFatoresPlusTablePlacar(
  tableId: number,
  history: readonly number[],
  machine: RotatingRoomPlusMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: RotatingRoomPlusMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomPlusPlacarFlash;
} {
  let nextMachine = machine;
  let nextStats = stats;
  let statsChanged = false;
  let flash: RotatingRoomPlusPlacarFlash = null;

  if (!nextMachine.cycleActive) {
    if (isDoisFatoresPlusGatilhoArmed(history)) {
      const active = buildDoisFatoresPlusActive(history);
      if (active) {
        nextMachine = {
          ...nextMachine,
          cycleTableId: tableId,
          cycleActive: active,
          cycleMetricCategory: "cor-altura",
          armedAtHead: spinHeadFromHistory(history),
          lastEvaluatedHead: null,
          cycleSpinsWithoutWin: 0,
        };
      }
    }
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  if (history.length === 0) return { nextMachine, stats: nextStats, statsChanged, flash };
  const head = spinHeadFromHistory(history);
  if (head === nextMachine.armedAtHead || head === nextMachine.lastEvaluatedHead) {
    return {
      nextMachine: refreshIndicationFromPos11(nextMachine, history),
      stats: nextStats,
      statsChanged,
      flash,
    };
  }

  const resultNumber = history[0]!;
  const activeForRound = nextMachine.cycleActive;
  nextMachine = { ...nextMachine, lastEvaluatedHead: head };
  const outcome = evaluateDoisFatoresPlusRound(resultNumber, activeForRound);

  if (outcome === "W") {
    nextStats = recordRotatingRoomSessionWin(
      nextStats,
      nextMachine.recovery,
      DOIS_FATORES_PLUS_MAX_RECOVERY,
    );
    statsChanged = true;
    flash = { resultNumber, won: true, tableId, kind: "win" };
    nextMachine = finishCycle(nextMachine);
  } else if (outcome === "L") {
    const recoveryBefore = nextMachine.recovery;
    const recovery = recoveryBefore + 1;
    if (recovery > DOIS_FATORES_PLUS_MAX_RECOVERY) {
      nextStats = recordRotatingRoomSessionFinalLoss(
        nextStats,
        recoveryBefore,
        DOIS_FATORES_PLUS_MAX_RECOVERY,
      );
      statsChanged = true;
      flash = { resultNumber, won: false, tableId, kind: "loss" };
      nextMachine = finishCycle(nextMachine);
    } else {
      nextStats = recordRotatingRoomSessionPartialLoss(
        nextStats,
        recoveryBefore,
        DOIS_FATORES_PLUS_MAX_RECOVERY,
      );
      statsChanged = true;
      flash = { resultNumber, won: false, tableId, kind: "recovery" };
      nextMachine = refreshIndicationFromPos11({ ...nextMachine, recovery }, history);
    }
  } else {
    nextMachine = { ...nextMachine, cycleSpinsWithoutWin: nextMachine.cycleSpinsWithoutWin + 1 };
    nextMachine = refreshIndicationFromPos11(nextMachine, history);
  }

  return { nextMachine, stats: nextStats, statsChanged, flash };
}
