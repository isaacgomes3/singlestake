/**
 * Sala rotativa — Fibonacci em dúzias/colunas.
 * - Gatilho: mesa com ausência ≥12 em dúzia E coluna na mesma mesa
 * - Persiste na mesma roleta até vitória (sequência 1-1-2-3-5-8-13-21)
 * - Após vitória: nova oportunidade; sem oportunidade → lobby
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

/** Posiciona iframe na mesa quando a mesa qualifica (ausência ≥12 em dúzia e coluna). */
export const ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS = 12;
/** Indicação / entrada com ausência ≥12 em dúzia e coluna na mesma mesa. */
export const ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS = 12;

/** @deprecated Use {@link ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS}. */
export const ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS = ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS;

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

export type RotatingRoomFibonacciTableStatus = "idle" | "prepare" | "alert" | "active";

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
  /** Mesa em preparação (ausência ≥12) — aguarda o próximo giro para indicar. */
  prepareTableId: number | null;
  prepareZone: FibonacciZone | null;
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

/** Crédito/débito no extrato — vitória 2:1 devolve aposta + lucro (ex.: R$ 50 → +R$ 150). */
export function fibonacciSettlementNet(won: boolean, stake: number): number {
  return won ? stake * 3 : -stake;
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

/** Mesa qualifica só com ausência mínima em pelo menos uma dúzia E uma coluna. */
export function tableQualifiesForFibonacci(
  historyNewestFirst: readonly number[],
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
): boolean {
  let hasDozen = false;
  let hasColumn = false;
  for (const zone of allZones()) {
    const gap = consecutiveZoneAbsence(historyNewestFirst, zone);
    if (gap < minAbsenceSpins) continue;
    if (zone.kind === "dozen") hasDozen = true;
    else hasColumn = true;
    if (hasDozen && hasColumn) return true;
  }
  return false;
}

export function bestPickForTable(
  tableId: number,
  historyNewestFirst: readonly number[],
  minAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
): RotatingRoomFibonacciPick | null {
  if (!tableQualifiesForFibonacci(historyNewestFirst, ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS)) {
    return null;
  }
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
  if (!tableQualifiesForFibonacci(historyNewestFirst, ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS)) {
    return null;
  }
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

export function pickGlobalFibonacciPrepare(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
): RotatingRoomFibonacciPick | null {
  return listAllFibonacciAlertPicks(
    tableIds,
    histories,
    excludeTableIds,
    ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS,
  )[0] ?? null;
}

export function pickGlobalFibonacciAlert(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
): RotatingRoomFibonacciPick | null {
  return listAllFibonacciAlertPicks(
    tableIds,
    histories,
    excludeTableIds,
    ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
  )[0] ?? null;
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
    prepareTableId: null,
    prepareZone: null,
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
    ...clearPrepareState(clearCycle(machine)),
    recovery: 0,
    tablePlacarLosses: {},
    lastLostTableId: null,
    awaitSwitchNoTable: false,
  };
}

function clearPrepareState(
  machine: RotatingRoomFibonacciMachineState,
): RotatingRoomFibonacciMachineState {
  return {
    ...machine,
    prepareTableId: null,
    prepareZone: null,
  };
}

function beginFibonacciPrepare(
  machine: RotatingRoomFibonacciMachineState,
  pick: RotatingRoomFibonacciPick,
  histories: Record<number, readonly number[]>,
): RotatingRoomFibonacciMachineState {
  const head = spinHeadFromHistory(histories[pick.tableId] ?? []);
  return {
    ...clearCycle(clearPrepareState(machine)),
    prepareTableId: pick.tableId,
    prepareZone: pick.zone,
    armedAtHead: head,
    lastEvaluatedHead: head,
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
    ...clearPrepareState(machine),
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
    machine.cycleTableId ??
    machine.prepareTableId ??
    (tableIds.length === 1 ? tableIds[0]! : null);

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
    return clearPrepareState(clearCycle(machine));
  }
  if (machine.prepareTableId != null && !allowed.has(machine.prepareTableId)) {
    return clearPrepareState(machine);
  }
  return machine;
}

export function scanRotatingRoomFibonacciTables(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  activePick: RotatingRoomFibonacciPick | null,
  prepareAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS,
  alertAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
): RotatingRoomFibonacciTableScan[] {
  return tableIds.map((tableId) => {
    const history = histories[tableId] ?? [];
    const pickPrepare = bestPickForTable(tableId, history, prepareAbsenceSpins);
    if (!pickPrepare) {
      return {
        tableId,
        zoneLabel: null,
        zoneKind: null,
        absenceGap: 0,
        status: "idle" as const,
        isAlertTable: false,
      };
    }

    const pickAlert = bestPickForTable(tableId, history, alertAbsenceSpins);
    const isActive =
      activePick != null &&
      activePick.tableId === pickPrepare.tableId &&
      activePick.zone.kind === pickPrepare.zone.kind &&
      activePick.zone.id === pickPrepare.zone.id;

    const status: RotatingRoomFibonacciTableStatus = isActive
      ? "active"
      : pickAlert
        ? "alert"
        : "prepare";

    return {
      tableId,
      zoneLabel: fibonacciZoneLabel(pickPrepare.zone),
      zoneKind: pickPrepare.zone.kind,
      absenceGap: pickPrepare.absenceGap,
      status,
      isAlertTable: isActive,
    };
  });
}

export function buildRotatingRoomFibonacciLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomFibonacciMachineState,
  prepareAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS,
  alertAbsenceSpins: number = ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
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
    relaxed.recovery > 0 && relaxed.cycleTableId == null
      ? tablesExcludedFromRotation(relaxed)
      : undefined;
  const globalPick = pickGlobalFibonacciAlert(tableIds, histories, excluded);

  return {
    globalPick,
    fibonacciScan: scanRotatingRoomFibonacciTables(
      tableIds,
      histories,
      activePick,
      prepareAbsenceSpins,
      alertAbsenceSpins,
    ),
  };
}

function rearmSameTableAfterPartialLoss(
  machine: RotatingRoomFibonacciMachineState,
  tableId: number,
  zone: FibonacciZone,
  histories: Record<number, readonly number[]>,
  recovery: number,
): RotatingRoomFibonacciMachineState {
  const history = histories[tableId] ?? [];
  return armCycleFromPick(
    machine,
    {
      tableId,
      zone,
      absenceGap: consecutiveZoneAbsence(history, zone),
    },
    histories,
    recovery,
  );
}

export function tickRotatingRoomFibonacciPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomFibonacciMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  allowNewArming = true,
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
      if (allowNewArming) {
        const prepare = pickGlobalFibonacciPrepare(tableIds, histories, undefined);
        if (prepare) {
          nextMachine = beginFibonacciPrepare(nextMachine, prepare, histories);
        }
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
        nextMachine = rearmSameTableAfterPartialLoss(
          { ...nextMachine, recovery },
          tableId,
          zone,
          histories,
          recovery,
        );
      }
    }

    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  nextMachine = relaxTableExclusionsIfAllBlocked(nextMachine, tableIds);

  if (
    !nextMachine.cycleZone &&
    nextMachine.prepareTableId != null &&
    nextMachine.prepareZone != null
  ) {
    const pt = nextMachine.prepareTableId;
    const zone = nextMachine.prepareZone;
    const hist = histories[pt] ?? [];
    if (hist.length === 0) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }

    const head = spinHeadFromHistory(hist);
    if (head === nextMachine.armedAtHead || head === nextMachine.lastEvaluatedHead) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }

    nextMachine = { ...nextMachine, lastEvaluatedHead: head };
    const absenceGap = consecutiveZoneAbsence(hist, zone);
    if (absenceGap < ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS) {
      return {
        nextMachine: clearPrepareState(nextMachine),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }

    if (allowNewArming && absenceGap >= ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS) {
      const alertPick = pickForTableZone(
        pt,
        hist,
        zone,
        ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
      );
      if (alertPick) {
        return {
          nextMachine: armCycleFromPick(nextMachine, alertPick, histories),
          stats: nextStats,
          statsChanged,
          flash,
        };
      }
    }

    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  if (allowNewArming) {
    const excluded =
      nextMachine.recovery > 0 ? tablesExcludedFromRotation(nextMachine) : undefined;

    const prepare = pickGlobalFibonacciPrepare(tableIds, histories, excluded);
    if (prepare) {
      return {
        nextMachine: beginFibonacciPrepare(nextMachine, prepare, histories),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }
  }

  return { nextMachine, stats: nextStats, statsChanged, flash };
}
