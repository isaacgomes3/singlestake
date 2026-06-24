/**
 * Sala rotativa 2 Fatores+ â€” gatilho pos. 1 vs 12 (cor/altura opostos), alerta pela pos. 11.
 * Fluxo: gatilho armado â†’ posicionar â†’ alerta activo â†’ recuperaÃ§Ã£o com troca de mesa.
 */

import {
  evaluateDoisFatoresRound,
  doisFatoresFactorLabel,
  type DoisFatoresActive,
} from "@/lib/roulette/doisFatoresStrategy";
import {
  buildDoisFatoresPlusActive,
  buildDoisFatoresPlusRoundIndication,
  isDoisFatoresPlusGatilhoArmed,
  isZeroAtDoisFatoresPlusIndicationPosition,
} from "@/lib/roulette/doisFatoresPlusStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { recordRotatingRoomSessionWin, recordRotatingRoomSessionPartialLoss, recordRotatingRoomSessionFinalLoss } from "@/lib/roulette/entryWinBreakdown";

function spinHeadFromHistory(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

export const ROTATING_ROOM_PLUS_MAX_RECOVERY = 4;

const PLUS_AXIS = "cor-altura" as const;
const PLUS_CATEGORY = "cor-altura";

export type RotatingRoomPlusPick = {
  tableId: number;
  axis: typeof PLUS_AXIS;
  category: string;
  absentCategory: string;
  bucketGap: number;
  absenceGap: number;
  excludedPair: readonly [number, number];
};

export type RotatingRoomPlusQueueEntry = {
  tableId: number;
  axis: typeof PLUS_AXIS;
  category: string;
  bucketGap: number;
};

export type RotatingRoomPlusTableStatus = "idle" | "prepare" | "alert" | "active";

export type RotatingRoomPlusTableScan = {
  tableId: number;
  category: string | null;
  axis: typeof PLUS_AXIS | null;
  bucketGap: number;
  factor1Label: string | null;
  factor2Label: string | null;
  status: RotatingRoomPlusTableStatus;
  isAlertTable: boolean;
};

export type RotatingRoomSessionMode =
  | "scanning"
  | "prepare"
  | "active"
  | "awaiting_queue"
  | "await_switch";

export type RotatingRoomPlusMachineState = {
  cycleTableId: number | null;
  cycleFingerprint: string | null;
  cycleActive: DoisFatoresActive | null;
  recovery: number;
  cycleSpinsWithoutWin: number;
  armedAtHead: string | null;
  lastEvaluatedHead: string | null;
  lastSpinHeadByTable: Record<string, string>;
  signalQueue: RotatingRoomPlusQueueEntry[];
  awaitingQueueTableId: number | null;
  awaitingQueueHead: string | null;
  tablePlacarLosses: Record<string, number>;
  awaitSwitchNoTable: boolean;
  prepareFingerprint: string | null;
  prepareTableId: number | null;
  /** Indicação cor/altura vigente ao entrar em «posicionar». */
  prepareActive: DoisFatoresActive | null;
  pendingQueueEntry: RotatingRoomPlusQueueEntry | null;
  cycleMetricCategory: string | null;
};

export type RotatingRoomPlusPlacarFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  switchedTable?: boolean;
  kind: "win" | "loss" | "recovery";
} | null;

export type RotatingRoomPlusLiveView = {
  mode: RotatingRoomSessionMode;
  globalPick: RotatingRoomPlusPick | null;
  preparePick: RotatingRoomPlusPick | null;
  signalQueue: RotatingRoomPlusQueueEntry[];
  crossingScan: RotatingRoomPlusTableScan[];
};

function plusPrepareKey(tableId: number): string {
  return `${tableId}:${PLUS_AXIS}`;
}

function plusFingerprint(tableId: number): string {
  return `${tableId}:${PLUS_AXIS}:${PLUS_CATEGORY}`;
}

function buildPlusPick(tableId: number, historyNewestFirst: readonly number[]): RotatingRoomPlusPick | null {
  const active = buildDoisFatoresPlusActive(historyNewestFirst);
  if (!active) return null;
  return {
    tableId,
    axis: PLUS_AXIS,
    category: PLUS_CATEGORY,
    absentCategory: PLUS_CATEGORY,
    bucketGap: 1,
    absenceGap: 1,
    excludedPair: active.triggerNumbers,
  };
}

function buildPlusActiveFromHistory(historyNewestFirst: readonly number[]): DoisFatoresActive | null {
  return buildDoisFatoresPlusActive(historyNewestFirst);
}

function buildPlusRoundIndication(historyNewestFirst: readonly number[]): DoisFatoresActive | null {
  return buildDoisFatoresPlusRoundIndication(historyNewestFirst);
}

function gatilhoMeetsThreshold(historyNewestFirst: readonly number[]): boolean {
  return isDoisFatoresPlusGatilhoArmed(historyNewestFirst);
}

function clearPrepareState(machine: RotatingRoomPlusMachineState): RotatingRoomPlusMachineState {
  return {
    ...machine,
    prepareFingerprint: null,
    prepareTableId: null,
    prepareActive: null,
    pendingQueueEntry: null,
    armedAtHead: null,
  };
}

function bestPickForTable(tableId: number, historyNewestFirst: readonly number[]): RotatingRoomPlusPick | null {
  return buildPlusPick(tableId, historyNewestFirst);
}

function pickForTableByCategory(
  tableId: number,
  historyNewestFirst: readonly number[],
  _axis: typeof PLUS_AXIS,
  _category: string,
): RotatingRoomPlusPick | null {
  return buildPlusPick(tableId, historyNewestFirst);
}

function comparePicks(a: RotatingRoomPlusPick, b: RotatingRoomPlusPick): number {
  return a.tableId - b.tableId;
}

export function listAllAlertPicks(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
): RotatingRoomPlusPick[] {
  const out: RotatingRoomPlusPick[] = [];
  for (const tableId of tableIds) {
    if (excludeTableIds?.has(tableId)) continue;
    const pick = bestPickForTable(tableId, histories[tableId] ?? []);
    if (pick) out.push(pick);
  }
  out.sort(comparePicks);
  return out;
}

export function pickGlobalPlusAlert(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
): RotatingRoomPlusPick | null {
  return listAllAlertPicks(tableIds, histories, excludeTableIds)[0] ?? null;
}

function pickToQueueEntry(pick: RotatingRoomPlusPick): RotatingRoomPlusQueueEntry {
  return { tableId: pick.tableId, axis: pick.axis, category: pick.category, bucketGap: pick.bucketGap };
}

function armCycleFromPick(
  machine: RotatingRoomPlusMachineState,
  pick: RotatingRoomPlusPick,
  histories: Record<number, readonly number[]>,
  recovery: number,
): RotatingRoomPlusMachineState {
  const active = buildPlusActiveFromHistory(histories[pick.tableId] ?? []);
  if (!active) return machine;
  return armCycleFromActive(machine, pick.tableId, active, histories, recovery);
}

function armCycleFromActive(
  machine: RotatingRoomPlusMachineState,
  tableId: number,
  active: DoisFatoresActive,
  histories: Record<number, readonly number[]>,
  recovery: number,
  opts?: { lastEvaluatedHead?: string | null },
): RotatingRoomPlusMachineState {
  const head = spinHeadFromHistory(histories[tableId] ?? []);
  return {
    ...machine,
    cycleTableId: tableId,
    cycleFingerprint: plusFingerprint(tableId),
    cycleActive: active,
    recovery,
    cycleSpinsWithoutWin: 0,
    armedAtHead: head,
    lastEvaluatedHead: opts?.lastEvaluatedHead ?? null,
    signalQueue: [],
    awaitingQueueTableId: null,
    awaitingQueueHead: null,
    awaitSwitchNoTable: false,
    prepareFingerprint: null,
    prepareTableId: null,
    prepareActive: null,
    pendingQueueEntry: null,
    cycleMetricCategory: PLUS_CATEGORY,
  };
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

function refreshCycleIndicationFromPos11(
  machine: RotatingRoomPlusMachineState,
  histories: Record<number, readonly number[]>,
): RotatingRoomPlusMachineState {
  if (!machine.cycleActive || machine.cycleTableId == null) return machine;
  const indication = buildPlusRoundIndication(histories[machine.cycleTableId] ?? []);
  if (!indication) return machine;
  return {
    ...machine,
    cycleActive: indication,
    cycleFingerprint: plusFingerprint(machine.cycleTableId),
    cycleMetricCategory: PLUS_CATEGORY,
  };
}

function tablesExcludedFromRotation(machine: RotatingRoomPlusMachineState): ReadonlySet<number> {
  const excluded = new Set<number>();
  for (const [key, count] of Object.entries(machine.tablePlacarLosses)) {
    if (Number(count) >= 1) excluded.add(Number(key));
  }
  return excluded;
}

function markTableSessionLoss(
  machine: RotatingRoomPlusMachineState,
  tableId: number,
): RotatingRoomPlusMachineState {
  return {
    ...machine,
    tablePlacarLosses: { ...machine.tablePlacarLosses, [String(tableId)]: 1 },
  };
}

function beginPrepareOnAlert(
  machine: RotatingRoomPlusMachineState,
  alert: RotatingRoomPlusPick,
  histories: Record<number, readonly number[]>,
): RotatingRoomPlusMachineState {
  const hist = histories[alert.tableId] ?? [];
  return {
    ...machine,
    awaitSwitchNoTable: false,
    prepareFingerprint: plusPrepareKey(alert.tableId),
    prepareTableId: alert.tableId,
    prepareActive: buildPlusRoundIndication(hist),
    pendingQueueEntry: pickToQueueEntry(alert),
    armedAtHead: spinHeadFromHistory(hist),
  };
}

function suspendAndPrepareNextTable(
  machine: RotatingRoomPlusMachineState,
  lostTableId: number,
  recovery: number,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomPlusMachineState {
  const marked = markTableSessionLoss(machine, lostTableId);
  const cleared = { ...clearCycle(marked), recovery };
  const excluded = tablesExcludedFromRotation(cleared);
  const alert = pickGlobalPlusAlert(tableIds, histories, excluded);
  if (!alert) return { ...cleared, awaitSwitchNoTable: true };
  return beginPrepareOnAlert(cleared, alert, histories);
}

/** Zero na pos. 11 — abandona a mesa e posiciona noutra roleta (sem alterar recuperação). */
function rotatePlusTableForZeroIndication(
  machine: RotatingRoomPlusMachineState,
  fromTableId: number,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomPlusMachineState {
  const excluded = new Set(tablesExcludedFromRotation(machine));
  excluded.add(fromTableId);
  const base: RotatingRoomPlusMachineState = {
    ...clearPrepareState(clearCycle(machine)),
    recovery: machine.recovery,
    tablePlacarLosses: machine.tablePlacarLosses,
    awaitSwitchNoTable: false,
  };
  const alert = pickGlobalPlusAlert(tableIds, histories, excluded);
  if (!alert) {
    return { ...base, awaitSwitchNoTable: machine.recovery > 0 };
  }
  return beginPrepareOnAlert(base, alert, histories);
}

/** Vitória em POSICIONAR com recuperação — troca de mesa sem contar W nem zerar recuperação. */
function rotatePrepareAfterWinDuringPrepare(
  machine: RotatingRoomPlusMachineState,
  fromTableId: number,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomPlusMachineState {
  const excluded = new Set(tablesExcludedFromRotation(machine));
  excluded.add(fromTableId);
  const base: RotatingRoomPlusMachineState = {
    ...clearPrepareState(clearCycle(machine)),
    recovery: machine.recovery,
    tablePlacarLosses: machine.tablePlacarLosses,
    awaitSwitchNoTable: false,
  };
  const alert = pickGlobalPlusAlert(tableIds, histories, excluded);
  if (!alert) {
    return { ...base, awaitSwitchNoTable: machine.recovery > 0 };
  }
  return beginPrepareOnAlert(base, alert, histories);
}

function plusZeroIndicationFlash(tableId: number): RotatingRoomPlusPlacarFlash {
  return {
    resultNumber: 0,
    won: false,
    tableId,
    kind: "recovery",
    switchedTable: true,
  };
}

function finishCycle(machine: RotatingRoomPlusMachineState): RotatingRoomPlusMachineState {
  return {
    ...clearCycle(machine),
    recovery: 0,
    tablePlacarLosses: {},
    awaitSwitchNoTable: false,
    signalQueue: [],
    awaitingQueueTableId: null,
    awaitingQueueHead: null,
  };
}

export function scanRotatingRoomPlusTables(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  activePick: RotatingRoomPlusPick | null,
): RotatingRoomPlusTableScan[] {
  return tableIds.map((tableId) => {
    const pick = bestPickForTable(tableId, histories[tableId] ?? []);
    if (!pick) {
      return {
        tableId,
        category: null,
        axis: null,
        bucketGap: 0,
        factor1Label: null,
        factor2Label: null,
        status: "idle" as const,
        isAlertTable: false,
      };
    }
    const isActive = activePick != null && activePick.tableId === tableId;
    const active = buildPlusRoundIndication(histories[tableId] ?? []);
    return {
      tableId,
      category: pick.category,
      axis: pick.axis,
      bucketGap: pick.bucketGap,
      factor1Label: active ? doisFatoresFactorLabel(active.factor1) : null,
      factor2Label: active ? doisFatoresFactorLabel(active.factor2) : null,
      status: isActive ? "active" : "alert",
      isAlertTable: isActive,
    };
  });
}

export function buildRotatingRoomPlusLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomPlusMachineState,
): RotatingRoomPlusLiveView {
  let activePick: RotatingRoomPlusPick | null = null;
  if (machine.cycleActive && machine.cycleTableId != null) {
    const tid = machine.cycleTableId;
    const triggers = machine.cycleActive.triggerNumbers;
    activePick =
      buildPlusPick(tid, histories[tid] ?? []) ?? {
        tableId: tid,
        axis: PLUS_AXIS,
        category: PLUS_CATEGORY,
        absentCategory: PLUS_CATEGORY,
        bucketGap: 1,
        absenceGap: 1,
        excludedPair: triggers,
      };
  }
  const globalPick = activePick ?? pickGlobalPlusAlert(tableIds, histories);
  let preparePick: RotatingRoomPlusPick | null = null;
  if (machine.prepareTableId != null && machine.prepareFingerprint && !machine.cycleActive) {
    const entry = machine.pendingQueueEntry;
    if (entry && entry.tableId === machine.prepareTableId) {
      preparePick = pickForTableByCategory(
        entry.tableId,
        histories[entry.tableId] ?? [],
        entry.axis,
        entry.category,
      );
    }
  }
  let mode: RotatingRoomSessionMode = "scanning";
  if (machine.cycleActive) mode = "active";
  else if (machine.prepareFingerprint || preparePick) mode = "prepare";
  else if (machine.awaitSwitchNoTable && machine.recovery > 0) mode = "awaiting_queue";
  return {
    mode,
    globalPick,
    preparePick,
    signalQueue: [],
    crossingScan: scanRotatingRoomPlusTables(tableIds, histories, activePick),
  };
}

function syncSpinHeads(
  machine: RotatingRoomPlusMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomPlusMachineState {
  const lastSpinHeadByTable = { ...machine.lastSpinHeadByTable };
  for (const tableId of tableIds) {
    lastSpinHeadByTable[String(tableId)] = spinHeadFromHistory(histories[tableId] ?? []);
  }
  return { ...machine, lastSpinHeadByTable };
}

export function tickRotatingRoomPlusPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomPlusMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = ROTATING_ROOM_PLUS_MAX_RECOVERY,
): {
  nextMachine: RotatingRoomPlusMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomPlusPlacarFlash;
} {
  let nextMachine = syncSpinHeads(machine, tableIds, histories);
  let nextStats = stats;
  let statsChanged = false;
  let flash: RotatingRoomPlusPlacarFlash = null;

  if (!nextMachine.cycleActive && nextMachine.prepareFingerprint && nextMachine.prepareTableId != null) {
    const pt = nextMachine.prepareTableId;
    const head = spinHeadFromHistory(histories[pt] ?? []);
    const entry = nextMachine.pendingQueueEntry;
    const hist = histories[pt] ?? [];

    if (isZeroAtDoisFatoresPlusIndicationPosition(hist)) {
      if (tableIds.length > 1) {
        return {
          nextMachine: rotatePlusTableForZeroIndication(nextMachine, pt, tableIds, histories),
          stats: nextStats,
          statsChanged,
          flash: plusZeroIndicationFlash(pt),
        };
      }
      return { nextMachine: clearPrepareState(nextMachine), stats: nextStats, statsChanged, flash };
    }

    if (entry && entry.tableId === pt) {
      if (!gatilhoMeetsThreshold(hist) && head === nextMachine.armedAtHead) {
        return { nextMachine: clearPrepareState(nextMachine), stats: nextStats, statsChanged, flash };
      }
    }

    if (nextMachine.armedAtHead != null && head !== nextMachine.armedAtHead) {
      const resultNumber = hist[0]!;

      if (resultNumber === 0) {
        const afterZero = { ...nextMachine, armedAtHead: head };
        if (isZeroAtDoisFatoresPlusIndicationPosition(hist)) {
          if (tableIds.length > 1) {
            return {
              nextMachine: rotatePlusTableForZeroIndication(afterZero, pt, tableIds, histories),
              stats: nextStats,
              statsChanged,
              flash: plusZeroIndicationFlash(pt),
            };
          }
          return {
            nextMachine: clearPrepareState(afterZero),
            stats: nextStats,
            statsChanged,
            flash,
          };
        }
        return {
          nextMachine: afterZero,
          stats: nextStats,
          statsChanged,
          flash,
        };
      }

      const prepareActive = nextMachine.prepareActive;
      if (prepareActive) {
        const outcome = evaluateDoisFatoresRound(resultNumber, prepareActive);
        if (outcome === "W") {
          if (nextMachine.recovery > 0 && tableIds.length > 1) {
            return {
              nextMachine: rotatePrepareAfterWinDuringPrepare(
                nextMachine,
                pt,
                tableIds,
                histories,
              ),
              stats: nextStats,
              statsChanged,
              flash,
            };
          }
          return {
            nextMachine: clearPrepareState(nextMachine),
            stats: nextStats,
            statsChanged,
            flash,
          };
        }
        return {
          nextMachine: armCycleFromActive(
            { ...nextMachine, pendingQueueEntry: null },
            pt,
            buildPlusRoundIndication(hist) ?? prepareActive,
            histories,
            nextMachine.recovery,
            { lastEvaluatedHead: head },
          ),
          stats: nextStats,
          statsChanged,
          flash,
        };
      }

      if (gatilhoMeetsThreshold(hist)) {
        const live = pickForTableByCategory(pt, hist, entry?.axis ?? PLUS_AXIS, entry?.category ?? PLUS_CATEGORY);
        if (live) {
          return {
            nextMachine: armCycleFromPick(
              { ...nextMachine, pendingQueueEntry: null },
              live,
              histories,
              nextMachine.recovery,
            ),
            stats: nextStats,
            statsChanged,
            flash,
          };
        }
      }
      nextMachine = clearPrepareState(nextMachine);
    }
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  if (!nextMachine.cycleActive) {
    if (nextMachine.awaitSwitchNoTable && nextMachine.recovery > 0) {
      const excluded = tablesExcludedFromRotation(nextMachine);
      const retry = pickGlobalPlusAlert(tableIds, histories, excluded);
      if (retry) {
        return {
          nextMachine: beginPrepareOnAlert(nextMachine, retry, histories),
          stats: nextStats,
          statsChanged,
          flash,
        };
      }
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }

    const excluded =
      nextMachine.recovery > 0 ? tablesExcludedFromRotation(nextMachine) : undefined;
    const alert = pickGlobalPlusAlert(tableIds, histories, excluded);
    if (alert && !nextMachine.prepareFingerprint) {
      nextMachine = beginPrepareOnAlert(nextMachine, alert, histories);
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  const tableId = nextMachine.cycleTableId;
  if (tableId == null || !nextMachine.cycleActive) {
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  const history = histories[tableId] ?? [];
  if (history.length === 0) return { nextMachine, stats: nextStats, statsChanged, flash };

  if (isZeroAtDoisFatoresPlusIndicationPosition(history)) {
    if (tableIds.length > 1) {
      return {
        nextMachine: rotatePlusTableForZeroIndication(nextMachine, tableId, tableIds, histories),
        stats: nextStats,
        statsChanged,
        flash: plusZeroIndicationFlash(tableId),
      };
    }
    return { nextMachine: clearCycle(nextMachine), stats: nextStats, statsChanged, flash };
  }

  const head = spinHeadFromHistory(history);
  if (head === nextMachine.armedAtHead || head === nextMachine.lastEvaluatedHead) {
    return {
      nextMachine: refreshCycleIndicationFromPos11(nextMachine, histories),
      stats: nextStats,
      statsChanged,
      flash,
    };
  }

  const resultNumber = history[0]!;
  const activeForRound = nextMachine.cycleActive;
  nextMachine = { ...nextMachine, lastEvaluatedHead: head };
  const outcome = evaluateDoisFatoresRound(resultNumber, activeForRound);

  if (outcome === "W") {
    nextStats = recordRotatingRoomSessionWin(nextStats, nextMachine.recovery, maxRecovery);
    statsChanged = true;
    flash = { resultNumber, won: true, tableId, kind: "win" };
    nextMachine = finishCycle(nextMachine);
  } else if (outcome === "L") {
    const recoveryBefore = nextMachine.recovery;
    const recovery = recoveryBefore + 1;
    const canRotateTables = tableIds.length > 1;
    if (recovery > maxRecovery) {
      nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);
      statsChanged = true;
      flash = { resultNumber, won: false, tableId, kind: "loss" };
      nextMachine = finishCycle(canRotateTables ? markTableSessionLoss(nextMachine, tableId) : nextMachine);
    } else {
      nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recoveryBefore, maxRecovery);
      statsChanged = true;
      flash = {
        resultNumber,
        won: false,
        tableId,
        kind: "recovery",
        switchedTable: canRotateTables,
      };
      if (canRotateTables) {
        nextMachine = suspendAndPrepareNextTable(nextMachine, tableId, recovery, tableIds, histories);
      } else {
        nextMachine = refreshCycleIndicationFromPos11(
          { ...nextMachine, recovery },
          histories,
        );
      }
    }
  } else {
    nextMachine = { ...nextMachine, cycleSpinsWithoutWin: nextMachine.cycleSpinsWithoutWin + 1 };
    nextMachine = refreshCycleIndicationFromPos11(nextMachine, histories);
  }

  return { nextMachine, stats: nextStats, statsChanged, flash };
}
