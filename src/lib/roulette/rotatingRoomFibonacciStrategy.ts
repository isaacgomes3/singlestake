/**
 * Sala rotativa — Fibonacci em dúzias/colunas.
 * - Gatilho: ausência de 14 giros consecutivos numa dúzia ou coluna
 * - Indicação: uma rodada (sem persistência do sinal)
 * - Recuperação Fibonacci 1-1-2-3-5-8-13-21 após derrota (2:1)
 */

import type { BetKey } from "@/lib/roulette/betSimulator";
import { payoutMultiplier } from "@/lib/roulette/betSimulator";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { tableAcceptableForRotatingRoomEntry } from "@/lib/roulette/liveTableBettingWindow";
import {
  recordRotatingRoomSessionWin,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionFinalLoss,
} from "@/lib/roulette/entryWinBreakdown";

export const FIBONACCI_LEVELS = [1, 1, 2, 3, 5, 8, 13, 21] as const;

export const ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS = 14;

export const ROTATING_ROOM_FIBONACCI_MAX_RECOVERY = FIBONACCI_LEVELS.length - 1;

export type FibonacciZoneKind = "dozen" | "column";

export type FibonacciZone = {
  kind: FibonacciZoneKind;
  id: 1 | 2 | 3;
};

export type RotatingRoomFibonacciPick = {
  tableId: number;
  zone: FibonacciZone;
  absenceGap: number;
};

export type RotatingRoomFibonacciActive = {
  zone: FibonacciZone;
  zoneLabel: string;
  betKey: BetKey;
  absenceGap: number;
  stakeUnits: number;
  profitUnits: number;
  recoveryIndex: number;
  tableId: number;
  armingDescription: string;
};

export type RotatingRoomFibonacciTableStatus = "idle" | "alert" | "active";

export type RotatingRoomFibonacciTableScan = {
  tableId: number;
  zoneLabel: string | null;
  zoneKind: FibonacciZoneKind | null;
  absenceGap: number;
  status: RotatingRoomFibonacciTableStatus;
  isAlertTable: boolean;
};

export type RotatingRoomFibonacciMachineState = {
  recovery: number;
  cycleTableId: number | null;
  cycleZone: FibonacciZone | null;
  armedAtHead: string | null;
  lastEvaluatedHead: string | null;
  lastSpinHeadByTable: Record<string, string>;
  tablePlacarLosses: Record<string, number>;
  lastLostTableId: number | null;
  awaitSwitchNoTable: boolean;
};

export type RotatingRoomFibonacciPlacarFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
  zoneLabel?: string;
  stakeUnits?: number;
  profitUnits?: number;
} | null;

export type RotatingRoomFibonacciLiveView = {
  globalPick: RotatingRoomFibonacciPick | null;
  fibonacciScan: RotatingRoomFibonacciTableScan[];
};

function spinHeadFromHistory(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function dozenOf(n: number): 1 | 2 | 3 | null {
  if (n === 0) return null;
  if (n <= 12) return 1;
  if (n <= 24) return 2;
  return 3;
}

function columnOf(n: number): 1 | 2 | 3 | null {
  if (n === 0) return null;
  return (((n - 1) % 3) + 1) as 1 | 2 | 3;
}

function zoneBetKey(zone: FibonacciZone): BetKey {
  return zone.kind === "dozen" ? `doz:${zone.id}` : `col:${zone.id}`;
}

export function fibonacciZoneLabel(zone: FibonacciZone): string {
  if (zone.kind === "dozen") {
    return `${zone.id}.ª Dúzia`;
  }
  return `Coluna ${zone.id}`;
}

export function stakeUnitsAtRecovery(recovery: number): number {
  const idx = Math.max(0, Math.min(recovery, FIBONACCI_LEVELS.length - 1));
  return FIBONACCI_LEVELS[idx]!;
}

/** Lucro líquido em 2:1 (paga 2× a aposta). */
export function profitUnitsAtRecovery(recovery: number): number {
  return 2 * stakeUnitsAtRecovery(recovery);
}

function zoneHitOnSpin(spin: number, zone: FibonacciZone): boolean {
  if (spin === 0) return false;
  if (zone.kind === "dozen") return dozenOf(spin) === zone.id;
  return columnOf(spin) === zone.id;
}

export function consecutiveZoneAbsence(
  historyNewestFirst: readonly number[],
  zone: FibonacciZone,
): number {
  let count = 0;
  for (const n of historyNewestFirst) {
    if (zoneHitOnSpin(n, zone)) break;
    count++;
  }
  return count;
}

function allZones(): FibonacciZone[] {
  const zones: FibonacciZone[] = [];
  for (const kind of ["dozen", "column"] as const) {
    for (const id of [1, 2, 3] as const) {
      zones.push({ kind, id });
    }
  }
  return zones;
}

export function bestPickForTable(
  tableId: number,
  historyNewestFirst: readonly number[],
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
): RotatingRoomFibonacciPick | null {
  let best: RotatingRoomFibonacciPick | null = null;
  for (const zone of allZones()) {
    const absenceGap = consecutiveZoneAbsence(historyNewestFirst, zone);
    if (absenceGap < minAbsenceSpins) continue;
    if (!best || absenceGap > best.absenceGap || (absenceGap === best.absenceGap && tableId < best.tableId)) {
      best = { tableId, zone, absenceGap };
    }
  }
  return best;
}

function pickForTableZone(
  tableId: number,
  historyNewestFirst: readonly number[],
  zone: FibonacciZone,
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
): RotatingRoomFibonacciPick | null {
  const absenceGap = consecutiveZoneAbsence(historyNewestFirst, zone);
  if (absenceGap < minAbsenceSpins) return null;
  return { tableId, zone, absenceGap };
}

function comparePicks(a: RotatingRoomFibonacciPick, b: RotatingRoomFibonacciPick): number {
  if (a.absenceGap !== b.absenceGap) return b.absenceGap - a.absenceGap;
  return a.tableId - b.tableId;
}

export function listAllFibonacciAlertPicks(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
): RotatingRoomFibonacciPick[] {
  const out: RotatingRoomFibonacciPick[] = [];
  for (const tableId of tableIds) {
    if (excludeTableIds?.has(tableId)) continue;
    const history = histories[tableId] ?? [];
    if (!tableAcceptableForRotatingRoomEntry(tableId, history)) continue;
    const pick = bestPickForTable(tableId, history, minAbsenceSpins);
    if (pick) out.push(pick);
  }
  out.sort(comparePicks);
  return out;
}

export function pickGlobalFibonacciAlert(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
): RotatingRoomFibonacciPick | null {
  return listAllFibonacciAlertPicks(tableIds, histories, excludeTableIds, minAbsenceSpins)[0] ?? null;
}

export function buildFibonacciActiveFromPick(
  pick: RotatingRoomFibonacciPick,
  recovery: number,
): RotatingRoomFibonacciActive {
  const stakeUnits = stakeUnitsAtRecovery(recovery);
  const profitUnits = profitUnitsAtRecovery(recovery);
  const zoneLabel = fibonacciZoneLabel(pick.zone);
  return {
    zone: pick.zone,
    zoneLabel,
    betKey: zoneBetKey(pick.zone),
    absenceGap: pick.absenceGap,
    stakeUnits,
    profitUnits,
    recoveryIndex: recovery,
    tableId: pick.tableId,
    armingDescription: `${zoneLabel} · ausência ${pick.absenceGap} (mesa ${pick.tableId})`,
  };
}

export function evaluateFibonacciRound(resultNumber: number, zone: FibonacciZone): "W" | "L" {
  const key = zoneBetKey(zone);
  return payoutMultiplier(key, resultNumber) > 0 ? "W" : "L";
}

export function defaultRotatingRoomFibonacciMachineState(): RotatingRoomFibonacciMachineState {
  return {
    recovery: 0,
    cycleTableId: null,
    cycleZone: null,
    armedAtHead: null,
    lastEvaluatedHead: null,
    lastSpinHeadByTable: {},
    tablePlacarLosses: {},
    lastLostTableId: null,
    awaitSwitchNoTable: false,
  };
}

function clearCycle(machine: RotatingRoomFibonacciMachineState): RotatingRoomFibonacciMachineState {
  return {
    ...machine,
    cycleTableId: null,
    cycleZone: null,
    armedAtHead: null,
    lastEvaluatedHead: null,
  };
}

function finishCycle(machine: RotatingRoomFibonacciMachineState): RotatingRoomFibonacciMachineState {
  return {
    ...clearCycle(machine),
    recovery: 0,
    tablePlacarLosses: {},
    lastLostTableId: null,
    awaitSwitchNoTable: false,
  };
}

function tablesExcludedFromRotation(machine: RotatingRoomFibonacciMachineState): ReadonlySet<number> {
  const excluded = new Set<number>();
  for (const [key, count] of Object.entries(machine.tablePlacarLosses)) {
    if (Number(count) >= 1) excluded.add(Number(key));
  }
  if (machine.lastLostTableId != null) excluded.add(machine.lastLostTableId);
  return excluded;
}

function relaxTableExclusionsIfAllBlocked(
  machine: RotatingRoomFibonacciMachineState,
  tableIds: readonly number[],
): RotatingRoomFibonacciMachineState {
  if (machine.recovery === 0 || tableIds.length === 0) return machine;
  const excluded = tablesExcludedFromRotation(machine);
  if (!tableIds.every((id) => excluded.has(id))) return machine;
  const last = machine.lastLostTableId;
  return {
    ...machine,
    tablePlacarLosses: last != null ? { [String(last)]: 1 } : {},
  };
}

function markTableSessionLoss(
  machine: RotatingRoomFibonacciMachineState,
  tableId: number,
): RotatingRoomFibonacciMachineState {
  return {
    ...machine,
    tablePlacarLosses: { ...machine.tablePlacarLosses, [String(tableId)]: 1 },
    lastLostTableId: tableId,
  };
}

function armCycleFromPick(
  machine: RotatingRoomFibonacciMachineState,
  pick: RotatingRoomFibonacciPick,
  histories: Record<number, readonly number[]>,
  recovery: number = machine.recovery,
): RotatingRoomFibonacciMachineState {
  const head = spinHeadFromHistory(histories[pick.tableId] ?? []);
  return {
    ...machine,
    cycleTableId: pick.tableId,
    cycleZone: pick.zone,
    recovery,
    armedAtHead: head,
    lastEvaluatedHead: null,
    awaitSwitchNoTable: false,
  };
}

function syncSpinHeads(
  machine: RotatingRoomFibonacciMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomFibonacciMachineState {
  const lastSpinHeadByTable = { ...machine.lastSpinHeadByTable };
  for (const tableId of tableIds) {
    lastSpinHeadByTable[String(tableId)] = spinHeadFromHistory(histories[tableId] ?? []);
  }
  return { ...machine, lastSpinHeadByTable };
}

export function seedRotatingRoomFibonacciMachineAfterPlacarReset(
  machine: RotatingRoomFibonacciMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomFibonacciMachineState {
  const lastSpinHeadByTable = { ...machine.lastSpinHeadByTable };
  for (const tableId of tableIds) {
    lastSpinHeadByTable[String(tableId)] = spinHeadFromHistory(histories[tableId] ?? []);
  }

  const focusTableId =
    machine.cycleTableId ?? (tableIds.length === 1 ? tableIds[0]! : null);

  let lastEvaluatedHead = machine.lastEvaluatedHead;
  let armedAtHead = machine.armedAtHead;
  if (focusTableId != null) {
    const head = spinHeadFromHistory(histories[focusTableId] ?? []);
    lastEvaluatedHead = head;
    armedAtHead = head;
  }

  return { ...machine, lastSpinHeadByTable, lastEvaluatedHead, armedAtHead };
}

export function sanitizeRotatingRoomFibonacciMachineForTableIds(
  machine: RotatingRoomFibonacciMachineState,
  tableIds: readonly number[],
): RotatingRoomFibonacciMachineState {
  if (tableIds.length === 0) return machine;
  const allowed = new Set(tableIds);
  if (machine.cycleTableId != null && !allowed.has(machine.cycleTableId)) {
    return clearCycle(machine);
  }
  return machine;
}

export function scanRotatingRoomFibonacciTables(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  activePick: RotatingRoomFibonacciPick | null,
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
): RotatingRoomFibonacciTableScan[] {
  return tableIds.map((tableId) => {
    const pick = bestPickForTable(tableId, histories[tableId] ?? [], minAbsenceSpins);
    if (!pick) {
      return {
        tableId,
        zoneLabel: null,
        zoneKind: null,
        absenceGap: 0,
        status: "idle" as const,
        isAlertTable: false,
      };
    }

    const isActive =
      activePick != null &&
      activePick.tableId === pick.tableId &&
      activePick.zone.kind === pick.zone.kind &&
      activePick.zone.id === pick.zone.id;

    return {
      tableId,
      zoneLabel: fibonacciZoneLabel(pick.zone),
      zoneKind: pick.zone.kind,
      absenceGap: pick.absenceGap,
      status: isActive ? "active" : "alert",
      isAlertTable: isActive,
    };
  });
}

export function buildRotatingRoomFibonacciLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomFibonacciMachineState,
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
): RotatingRoomFibonacciLiveView {
  let activePick: RotatingRoomFibonacciPick | null = null;
  if (machine.cycleZone && machine.cycleTableId != null) {
    activePick = {
      tableId: machine.cycleTableId,
      zone: machine.cycleZone,
      absenceGap: consecutiveZoneAbsence(
        histories[machine.cycleTableId] ?? [],
        machine.cycleZone,
      ),
    };
  }

  const relaxed = relaxTableExclusionsIfAllBlocked(machine, tableIds);
  const excluded =
    relaxed.recovery > 0 ? tablesExcludedFromRotation(relaxed) : undefined;
  const globalPick = pickGlobalFibonacciAlert(tableIds, histories, excluded, minAbsenceSpins);

  return {
    globalPick,
    fibonacciScan: scanRotatingRoomFibonacciTables(
      tableIds,
      histories,
      activePick,
      minAbsenceSpins,
    ),
  };
}

function tryRearmAfterPartialLoss(
  machine: RotatingRoomFibonacciMachineState,
  lostTableId: number,
  lostZone: FibonacciZone,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  recovery: number,
  minAbsenceSpins: number,
): RotatingRoomFibonacciMachineState {
  const history = histories[lostTableId] ?? [];
  const samePick = pickForTableZone(lostTableId, history, lostZone, minAbsenceSpins);
  if (samePick) {
    return armCycleFromPick(machine, samePick, histories, recovery);
  }

  const excluded = new Set(tablesExcludedFromRotation(machine));
  excluded.add(lostTableId);
  const alert = pickGlobalFibonacciAlert(tableIds, histories, excluded, minAbsenceSpins);
  if (alert) {
    return armCycleFromPick(machine, alert, histories, recovery);
  }

  return { ...machine, recovery, awaitSwitchNoTable: true };
}

export function tickRotatingRoomFibonacciPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomFibonacciMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
): {
  nextMachine: RotatingRoomFibonacciMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomFibonacciPlacarFlash;
} {
  let nextMachine = sanitizeRotatingRoomFibonacciMachineForTableIds(
    syncSpinHeads(machine, tableIds, histories),
    tableIds,
  );
  let nextStats = stats;
  let statsChanged = false;
  let flash: RotatingRoomFibonacciPlacarFlash = null;

  if (nextMachine.cycleZone && nextMachine.cycleTableId != null) {
    const tableId = nextMachine.cycleTableId;
    const zone = nextMachine.cycleZone;
    const history = histories[tableId] ?? [];
    if (history.length === 0) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }

    const head = spinHeadFromHistory(history);
    if (head === nextMachine.armedAtHead || head === nextMachine.lastEvaluatedHead) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }

    const resultNumber = history[0]!;
    const active = buildFibonacciActiveFromPick(
      { tableId, zone, absenceGap: consecutiveZoneAbsence(history, zone) },
      nextMachine.recovery,
    );

    nextMachine = { ...nextMachine, lastEvaluatedHead: head };
    const outcome = evaluateFibonacciRound(resultNumber, zone);

    if (outcome === "W") {
      nextStats = recordRotatingRoomSessionWin(nextStats, nextMachine.recovery, maxRecovery);
      statsChanged = true;
      flash = {
        resultNumber,
        won: true,
        tableId,
        kind: "win",
        zoneLabel: active.zoneLabel,
        stakeUnits: active.stakeUnits,
        profitUnits: active.profitUnits,
      };
      nextMachine = finishCycle(nextMachine);
      const alert = pickGlobalFibonacciAlert(tableIds, histories, undefined, minAbsenceSpins);
      if (alert) {
        nextMachine = armCycleFromPick(nextMachine, alert, histories, 0);
      }
    } else {
      const recoveryBefore = nextMachine.recovery;
      const recovery = recoveryBefore + 1;

      if (recovery > maxRecovery) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);
        statsChanged = true;
        flash = {
          resultNumber,
          won: false,
          tableId,
          kind: "loss",
          zoneLabel: active.zoneLabel,
          stakeUnits: active.stakeUnits,
          profitUnits: active.profitUnits,
        };
        const canRotate = tableIds.length > 1;
        nextMachine = finishCycle(
          canRotate ? markTableSessionLoss(nextMachine, tableId) : nextMachine,
        );
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recoveryBefore, maxRecovery);
        statsChanged = true;
        flash = {
          resultNumber,
          won: false,
          tableId,
          kind: "recovery",
          zoneLabel: active.zoneLabel,
          stakeUnits: active.stakeUnits,
          profitUnits: active.profitUnits,
        };
        nextMachine = clearCycle({ ...nextMachine, recovery });
        nextMachine = tryRearmAfterPartialLoss(
          nextMachine,
          tableId,
          zone,
          tableIds,
          histories,
          recovery,
          minAbsenceSpins,
        );
      }
    }

    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  nextMachine = relaxTableExclusionsIfAllBlocked(nextMachine, tableIds);

  if (nextMachine.awaitSwitchNoTable && nextMachine.recovery > 0) {
    const excluded = tablesExcludedFromRotation(nextMachine);
    const retry = pickGlobalFibonacciAlert(tableIds, histories, excluded, minAbsenceSpins);
    if (retry) {
      return {
        nextMachine: armCycleFromPick(nextMachine, retry, histories),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  const excluded =
    nextMachine.recovery > 0 ? tablesExcludedFromRotation(nextMachine) : undefined;
  const alert = pickGlobalFibonacciAlert(tableIds, histories, excluded, minAbsenceSpins);
  if (alert) {
    return {
      nextMachine: armCycleFromPick(nextMachine, alert, histories),
      stats: nextStats,
      statsChanged,
      flash,
    };
  }

  return { nextMachine, stats: nextStats, statsChanged, flash };
}
