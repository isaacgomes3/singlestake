/**
 * Sala rotativa — Fibonacci em dúzias/colunas.
 * - Gatilho: mesa com ausência exactamente N numa dúzia ou numa coluna
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
  recordFibonacciZoneKindWin,
  recordFibonacciZoneKindLoss,
} from "@/lib/roulette/entryWinBreakdown";
import type { FibonacciZoneAbsenceSpins } from "@/lib/roulette/fibonacciAbsencePrefs";
import { uniformFibonacciAbsenceSpins } from "@/lib/roulette/fibonacciAbsencePrefs";

export const FIBONACCI_LEVELS = [1, 1, 2, 3, 5, 8, 13, 21] as const;

/** Posiciona iframe na mesa quando alguma dúzia ou coluna tem ausência ≥N. */
export const ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS = 12;
/** Indicação / entrada com ausência ≥N numa dúzia ou coluna. */
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
  /** Incrementa a cada nova entrada activa — evita signalId duplicado após vitória. */
  cycleSeq: number;
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

export function fibonacciCategoryLabel(zone: FibonacciZone): string {
  return zone.kind === "dozen" ? `Dúzia ${zone.id}` : `Coluna ${zone.id}`;
}

export function fibonacciSignalId(
  tableId: number,
  zone: FibonacciZone,
  recovery: number,
  cycleSeq: number,
): string {
  return `${tableId}:${zone.kind}:${zone.id}:${Math.max(0, Math.floor(recovery))}:c${Math.max(0, Math.floor(cycleSeq))}`;
}

export function parseFibonacciSignalId(signalId: string): {
  tableId: number;
  zone: FibonacciZone;
  recovery: number;
  cycleSeq: number;
} | null {
  const parts = signalId.trim().split(":");
  if (parts.length < 4) return null;
  const tableId = Number(parts[0]);
  const zoneKind = parts[1];
  const zoneId = Number(parts[2]);
  if (!Number.isFinite(tableId) || (zoneKind !== "dozen" && zoneKind !== "column")) return null;
  if (!Number.isFinite(zoneId) || zoneId < 1 || zoneId > 3) return null;
  const recoveryRaw = Number(parts[3]);
  const recovery = Number.isFinite(recoveryRaw) ? Math.max(0, Math.floor(recoveryRaw)) : 0;
  const cyclePart = parts[4];
  const cycleSeq =
    typeof cyclePart === "string" && cyclePart.startsWith("c")
      ? Math.max(0, Math.floor(Number(cyclePart.slice(1))))
      : 0;
  return {
    tableId,
    zone: { kind: zoneKind, id: zoneId as 1 | 2 | 3 },
    recovery,
    cycleSeq,
  };
}

export function fibonacciActiveFromSignalId(
  signalId: string,
  absenceGap = 0,
): RotatingRoomFibonacciActive | null {
  const parsed = parseFibonacciSignalId(signalId);
  if (!parsed) return null;
  return buildFibonacciActiveFromPick(
    { tableId: parsed.tableId, zone: parsed.zone, absenceGap },
    parsed.recovery,
  );
}

export function stakeUnitsAtRecovery(recovery: number): number {
  const idx = Math.max(0, Math.min(recovery, FIBONACCI_LEVELS.length - 1));
  return FIBONACCI_LEVELS[idx]!;
}

/** Lucro líquido em 2:1 (paga 2× a aposta). */
export function profitUnitsAtRecovery(recovery: number): number {
  return 2 * stakeUnitsAtRecovery(recovery);
}

/** Lucro líquido no extrato/saldo — aposta 2:1 (ex.: R$ 50 apostados → lucro +R$ 100). */
export function fibonacciSettlementNet(won: boolean, stake: number): number {
  return won ? stake * 2 : -stake;
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

const ALL_FIBONACCI_ZONE_KINDS: readonly FibonacciZoneKind[] = ["dozen", "column"];

function resolveEnabledFibonacciZoneKinds(
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): readonly FibonacciZoneKind[] {
  if (!enabledZoneKinds || enabledZoneKinds.length === 0) return ALL_FIBONACCI_ZONE_KINDS;
  return enabledZoneKinds;
}

function allZones(enabledZoneKinds?: readonly FibonacciZoneKind[]): FibonacciZone[] {
  const kinds = resolveEnabledFibonacciZoneKinds(enabledZoneKinds);
  const zones: FibonacciZone[] = [];
  for (const kind of kinds) {
    for (const id of [1, 2, 3] as const) {
      zones.push({ kind, id });
    }
  }
  return zones;
}

/** Mesa qualifica com ausência mínima numa dúzia ou numa coluna. */
export function tableQualifiesForFibonacci(
  historyNewestFirst: readonly number[],
  absenceByKind: FibonacciZoneAbsenceSpins = uniformFibonacciAbsenceSpins(
    ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): boolean {
  for (const zone of allZones(enabledZoneKinds)) {
    if (consecutiveZoneAbsence(historyNewestFirst, zone) === absenceByKind[zone.kind]) {
      return true;
    }
  }
  return false;
}

export function bestPickForTable(
  tableId: number,
  historyNewestFirst: readonly number[],
  absenceByKind: FibonacciZoneAbsenceSpins = uniformFibonacciAbsenceSpins(
    ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomFibonacciPick | null {
  let best: RotatingRoomFibonacciPick | null = null;
  for (const zone of allZones(enabledZoneKinds)) {
    const targetAbsence = absenceByKind[zone.kind];
    const absenceGap = consecutiveZoneAbsence(historyNewestFirst, zone);
    if (absenceGap !== targetAbsence) continue;
    if (!best || tableId < best.tableId) {
      best = { tableId, zone, absenceGap };
    }
  }
  return best;
}

function pickForTableZone(
  tableId: number,
  historyNewestFirst: readonly number[],
  zone: FibonacciZone,
  absenceByKind: FibonacciZoneAbsenceSpins,
): RotatingRoomFibonacciPick | null {
  const absenceGap = consecutiveZoneAbsence(historyNewestFirst, zone);
  if (absenceGap !== absenceByKind[zone.kind]) return null;
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
  absenceByKind: FibonacciZoneAbsenceSpins = uniformFibonacciAbsenceSpins(
    ROTATING_ROOM_FIBONACCI_MIN_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomFibonacciPick[] {
  const out: RotatingRoomFibonacciPick[] = [];
  for (const tableId of tableIds) {
    if (excludeTableIds?.has(tableId)) continue;
    const history = histories[tableId] ?? [];
    if (!tableAcceptableForRotatingRoomEntry(tableId, history)) continue;
    const pick = bestPickForTable(tableId, history, absenceByKind, enabledZoneKinds);
    if (pick) out.push(pick);
  }
  out.sort(comparePicks);
  return out;
}

export function pickGlobalFibonacciPrepare(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  absenceByKind: FibonacciZoneAbsenceSpins = uniformFibonacciAbsenceSpins(
    ROTATING_ROOM_FIBONACCI_PREPARE_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomFibonacciPick | null {
  return listAllFibonacciAlertPicks(
    tableIds,
    histories,
    excludeTableIds,
    absenceByKind,
    enabledZoneKinds,
  )[0] ?? null;
}

export function pickGlobalFibonacciAlert(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  absenceByKind: FibonacciZoneAbsenceSpins = uniformFibonacciAbsenceSpins(
    ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomFibonacciPick | null {
  return listAllFibonacciAlertPicks(
    tableIds,
    histories,
    excludeTableIds,
    absenceByKind,
    enabledZoneKinds,
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
    cycleSeq: 0,
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
    cycleSeq: machine.cycleSeq + 1,
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
  absenceByKind: FibonacciZoneAbsenceSpins = uniformFibonacciAbsenceSpins(
    ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
  alertPick: RotatingRoomFibonacciPick | null = null,
): RotatingRoomFibonacciTableScan[] {
  return tableIds.map((tableId) => {
    const history = histories[tableId] ?? [];
    const pickPrepare = bestPickForTable(tableId, history, absenceByKind, enabledZoneKinds);
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

    const isActive =
      activePick != null &&
      activePick.tableId === pickPrepare.tableId &&
      activePick.zone.kind === pickPrepare.zone.kind &&
      activePick.zone.id === pickPrepare.zone.id;

    const isGlobalAlert =
      !isActive &&
      alertPick != null &&
      alertPick.tableId === pickPrepare.tableId &&
      alertPick.zone.kind === pickPrepare.zone.kind &&
      alertPick.zone.id === pickPrepare.zone.id;

    const status: RotatingRoomFibonacciTableStatus = isActive
      ? "active"
      : isGlobalAlert
        ? "alert"
        : "idle";

    return {
      tableId,
      zoneLabel: fibonacciZoneLabel(pickPrepare.zone),
      zoneKind: pickPrepare.zone.kind,
      absenceGap: pickPrepare.absenceGap,
      status,
      isAlertTable: isActive || isGlobalAlert,
    };
  });
}

export function buildRotatingRoomFibonacciLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomFibonacciMachineState,
  absenceByKind: FibonacciZoneAbsenceSpins = uniformFibonacciAbsenceSpins(
    ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
  options?: { suppressNewAlerts?: boolean },
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
  const globalPick = options?.suppressNewAlerts
    ? activePick
    : pickGlobalFibonacciAlert(
        tableIds,
        histories,
        excluded,
        absenceByKind,
        enabledZoneKinds,
      );

  return {
    globalPick,
    fibonacciScan: scanRotatingRoomFibonacciTables(
      tableIds,
      histories,
      activePick,
      absenceByKind,
      enabledZoneKinds,
      globalPick,
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
  absenceByKind: FibonacciZoneAbsenceSpins = uniformFibonacciAbsenceSpins(
    ROTATING_ROOM_FIBONACCI_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
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
      nextStats = recordFibonacciZoneKindWin(
        recordRotatingRoomSessionWin(nextStats, nextMachine.recovery, maxRecovery),
        zone.kind,
      );
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
        const prepare = pickGlobalFibonacciPrepare(
          tableIds,
          histories,
          undefined,
          absenceByKind,
          enabledZoneKinds,
        );
        if (prepare) {
          nextMachine = armCycleFromPick(nextMachine, prepare, histories);
        }
      }
    } else {
      const recoveryBefore = nextMachine.recovery;
      const recovery = recoveryBefore + 1;

      if (recovery > maxRecovery) {
        nextStats = recordFibonacciZoneKindLoss(
          recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery),
          zone.kind,
        );
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
    if (absenceGap !== absenceByKind[zone.kind]) {
      return {
        nextMachine: clearPrepareState(nextMachine),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }

    if (allowNewArming && absenceGap === absenceByKind[zone.kind]) {
      const alertPick = pickForTableZone(pt, hist, zone, absenceByKind);
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

    const prepare = pickGlobalFibonacciPrepare(
      tableIds,
      histories,
      excluded,
      absenceByKind,
      enabledZoneKinds,
    );
    if (prepare) {
      return {
        nextMachine: armCycleFromPick(nextMachine, prepare, histories),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }
  }

  return { nextMachine, stats: nextStats, statsChanged, flash };
}
