/**
 * Sala rotativa — Repetição (variação Fibonacci).
 * - Gatilho: ausência de repetição consecutiva de dúzia ou coluna ≥ N
 * - Indicação: repetir a dúzia/coluna do número mais recente
 * - Após derrota parcial: segue a dúzia/coluna do novo número (head)
 * - Recuperação Fibonacci 1-1-2-3-5-8-13-21 (2:1)
 */

import type { BetKey } from "@/lib/roulette/betSimulator";
import { payoutMultiplier } from "@/lib/roulette/betSimulator";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { tableAcceptableForRotatingRoomEntry } from "@/lib/roulette/liveTableBettingWindow";
import {
  recordRotatingRoomSessionWin,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionFinalLoss,
  recordRepeticaoZoneKindWin,
  recordRepeticaoZoneKindLoss,
} from "@/lib/roulette/entryWinBreakdown";
import type { RepeticaoZoneAbsenceSpins } from "@/lib/roulette/repeticaoAbsencePrefs";
import { uniformRepeticaoAbsenceSpins } from "@/lib/roulette/repeticaoAbsencePrefs";
import {
  FIBONACCI_LEVELS,
  fibonacciCategoryLabel,
  fibonacciZoneLabel,
  profitUnitsAtRecovery,
  stakeUnitsAtRecovery,
  type FibonacciZone,
  type FibonacciZoneKind,
} from "@/lib/roulette/rotatingRoomFibonacciStrategy";

export {
  FIBONACCI_LEVELS,
  fibonacciZoneLabel,
  fibonacciCategoryLabel,
  stakeUnitsAtRecovery,
  profitUnitsAtRecovery,
};

export const ROTATING_ROOM_REPETICAO_PREPARE_ABSENCE_SPINS = 12;
export const ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS = 12;
export const ROTATING_ROOM_REPETICAO_MAX_RECOVERY = FIBONACCI_LEVELS.length - 1;

export type RotatingRoomRepeticaoPick = {
  tableId: number;
  zoneKind: FibonacciZoneKind;
  streakGap: number;
};

export type RotatingRoomRepeticaoActive = {
  zone: FibonacciZone;
  zoneLabel: string;
  betKey: BetKey;
  streakGap: number;
  stakeUnits: number;
  profitUnits: number;
  recoveryIndex: number;
  tableId: number;
  armingDescription: string;
};

export type RotatingRoomRepeticaoTableStatus = "idle" | "prepare" | "alert" | "active";

export type RotatingRoomRepeticaoTableScan = {
  tableId: number;
  zoneLabel: string | null;
  zoneKind: FibonacciZoneKind | null;
  streakGap: number;
  status: RotatingRoomRepeticaoTableStatus;
  isAlertTable: boolean;
};

export type RotatingRoomRepeticaoMachineState = {
  recovery: number;
  cycleSeq: number;
  cycleTableId: number | null;
  cycleZoneKind: FibonacciZoneKind | null;
  cycleZone: FibonacciZone | null;
  prepareTableId: number | null;
  prepareZoneKind: FibonacciZoneKind | null;
  armedAtHead: string | null;
  lastEvaluatedHead: string | null;
  lastSpinHeadByTable: Record<string, string>;
  tablePlacarLosses: Record<string, number>;
  lastLostTableId: number | null;
  awaitSwitchNoTable: boolean;
};

export type RotatingRoomRepeticaoPlacarFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
  zoneLabel?: string;
  stakeUnits?: number;
  profitUnits?: number;
} | null;

export type RotatingRoomRepeticaoLiveView = {
  globalPick: RotatingRoomRepeticaoPick | null;
  repeticaoScan: RotatingRoomRepeticaoTableScan[];
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

function zoneValue(n: number, kind: FibonacciZoneKind): 1 | 2 | 3 | null {
  return kind === "dozen" ? dozenOf(n) : columnOf(n);
}

/** Giros consecutivos (mais recente primeiro) sem repetição de dúzia/coluna entre vizinhos. */
export function consecutiveNoRepeatStreak(
  historyNewestFirst: readonly number[],
  kind: FibonacciZoneKind,
): number {
  if (historyNewestFirst.length < 2) return 0;
  let count = 0;
  for (let i = 0; i < historyNewestFirst.length - 1; i++) {
    const a = historyNewestFirst[i]!;
    const b = historyNewestFirst[i + 1]!;
    if (a === 0 || b === 0) break;
    const za = zoneValue(a, kind);
    const zb = zoneValue(b, kind);
    if (za == null || zb == null) break;
    if (za === zb) break;
    count++;
  }
  return count;
}

export function zoneFromHeadNumber(
  historyNewestFirst: readonly number[],
  kind: FibonacciZoneKind,
): FibonacciZone | null {
  const head = historyNewestFirst[0];
  if (head == null || head === 0) return null;
  const id = zoneValue(head, kind);
  if (id == null) return null;
  return { kind, id };
}

export function repeticaoSignalId(
  tableId: number,
  zone: FibonacciZone,
  recovery: number,
  cycleSeq: number,
): string {
  return `rep:${tableId}:${zone.kind}:${zone.id}:${Math.max(0, Math.floor(recovery))}:c${Math.max(0, Math.floor(cycleSeq))}`;
}

export function parseRepeticaoSignalId(signalId: string): {
  tableId: number;
  zone: FibonacciZone;
  recovery: number;
  cycleSeq: number;
} | null {
  const parts = signalId.trim().split(":");
  if (parts.length < 5 || parts[0] !== "rep") return null;
  const tableId = Number(parts[1]);
  const zoneKind = parts[2];
  const zoneId = Number(parts[3]);
  if (!Number.isFinite(tableId) || (zoneKind !== "dozen" && zoneKind !== "column")) return null;
  if (!Number.isFinite(zoneId) || zoneId < 1 || zoneId > 3) return null;
  const recoveryRaw = Number(parts[4]);
  const recovery = Number.isFinite(recoveryRaw) ? Math.max(0, Math.floor(recoveryRaw)) : 0;
  const cyclePart = parts[5];
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

export function repeticaoActiveFromSignalId(
  signalId: string,
  streakGap = 0,
): RotatingRoomRepeticaoActive | null {
  const parsed = parseRepeticaoSignalId(signalId);
  if (!parsed) return null;
  return buildRepeticaoActiveFromZone(
    parsed.tableId,
    parsed.zone,
    streakGap,
    parsed.recovery,
  );
}

export function evaluateRepeticaoRound(resultNumber: number, zone: FibonacciZone): "W" | "L" {
  const key = zoneBetKey(zone);
  return payoutMultiplier(key, resultNumber) > 0 ? "W" : "L";
}

const ALL_ZONE_KINDS: readonly FibonacciZoneKind[] = ["dozen", "column"];

function resolveEnabledZoneKinds(
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): readonly FibonacciZoneKind[] {
  if (!enabledZoneKinds || enabledZoneKinds.length === 0) return ALL_ZONE_KINDS;
  return enabledZoneKinds;
}

export function tableQualifiesForRepeticao(
  historyNewestFirst: readonly number[],
  absenceByKind: RepeticaoZoneAbsenceSpins = uniformRepeticaoAbsenceSpins(
    ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): boolean {
  for (const kind of resolveEnabledZoneKinds(enabledZoneKinds)) {
    if (consecutiveNoRepeatStreak(historyNewestFirst, kind) >= absenceByKind[kind]) {
      return true;
    }
  }
  return false;
}

export function bestPickForTable(
  tableId: number,
  historyNewestFirst: readonly number[],
  absenceByKind: RepeticaoZoneAbsenceSpins = uniformRepeticaoAbsenceSpins(
    ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomRepeticaoPick | null {
  let best: RotatingRoomRepeticaoPick | null = null;
  for (const kind of resolveEnabledZoneKinds(enabledZoneKinds)) {
    const minStreak = absenceByKind[kind];
    const streakGap = consecutiveNoRepeatStreak(historyNewestFirst, kind);
    if (streakGap < minStreak) continue;
    if (
      !best ||
      streakGap > best.streakGap ||
      (streakGap === best.streakGap && tableId < best.tableId)
    ) {
      best = { tableId, zoneKind: kind, streakGap };
    }
  }
  return best;
}

function comparePicks(a: RotatingRoomRepeticaoPick, b: RotatingRoomRepeticaoPick): number {
  if (a.streakGap !== b.streakGap) return b.streakGap - a.streakGap;
  return a.tableId - b.tableId;
}

export function listAllRepeticaoAlertPicks(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  absenceByKind: RepeticaoZoneAbsenceSpins = uniformRepeticaoAbsenceSpins(
    ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomRepeticaoPick[] {
  const out: RotatingRoomRepeticaoPick[] = [];
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

export function pickGlobalRepeticaoPrepare(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  absenceByKind: RepeticaoZoneAbsenceSpins = uniformRepeticaoAbsenceSpins(
    ROTATING_ROOM_REPETICAO_PREPARE_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomRepeticaoPick | null {
  return listAllRepeticaoAlertPicks(
    tableIds,
    histories,
    excludeTableIds,
    absenceByKind,
    enabledZoneKinds,
  )[0] ?? null;
}

export function pickGlobalRepeticaoAlert(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  absenceByKind: RepeticaoZoneAbsenceSpins = uniformRepeticaoAbsenceSpins(
    ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomRepeticaoPick | null {
  return listAllRepeticaoAlertPicks(
    tableIds,
    histories,
    excludeTableIds,
    absenceByKind,
    enabledZoneKinds,
  )[0] ?? null;
}

export function buildRepeticaoActiveFromZone(
  tableId: number,
  zone: FibonacciZone,
  streakGap: number,
  recovery: number,
): RotatingRoomRepeticaoActive {
  const stakeUnits = stakeUnitsAtRecovery(recovery);
  const profitUnits = profitUnitsAtRecovery(recovery);
  const zoneLabel = fibonacciZoneLabel(zone);
  return {
    zone,
    zoneLabel,
    betKey: zoneBetKey(zone),
    streakGap,
    stakeUnits,
    profitUnits,
    recoveryIndex: recovery,
    tableId,
    armingDescription: `${zoneLabel} · repetição · ausência ${streakGap} (mesa ${tableId})`,
  };
}

export function defaultRotatingRoomRepeticaoMachineState(): RotatingRoomRepeticaoMachineState {
  return {
    recovery: 0,
    cycleSeq: 0,
    cycleTableId: null,
    cycleZoneKind: null,
    cycleZone: null,
    prepareTableId: null,
    prepareZoneKind: null,
    armedAtHead: null,
    lastEvaluatedHead: null,
    lastSpinHeadByTable: {},
    tablePlacarLosses: {},
    lastLostTableId: null,
    awaitSwitchNoTable: false,
  };
}

function clearCycle(machine: RotatingRoomRepeticaoMachineState): RotatingRoomRepeticaoMachineState {
  return {
    ...machine,
    cycleTableId: null,
    cycleZoneKind: null,
    cycleZone: null,
    armedAtHead: null,
    lastEvaluatedHead: null,
  };
}

function finishCycle(machine: RotatingRoomRepeticaoMachineState): RotatingRoomRepeticaoMachineState {
  return {
    ...clearPrepareState(clearCycle(machine)),
    recovery: 0,
    tablePlacarLosses: {},
    lastLostTableId: null,
    awaitSwitchNoTable: false,
  };
}

function clearPrepareState(
  machine: RotatingRoomRepeticaoMachineState,
): RotatingRoomRepeticaoMachineState {
  return {
    ...machine,
    prepareTableId: null,
    prepareZoneKind: null,
  };
}

function beginRepeticaoPrepare(
  machine: RotatingRoomRepeticaoMachineState,
  pick: RotatingRoomRepeticaoPick,
  histories: Record<number, readonly number[]>,
): RotatingRoomRepeticaoMachineState {
  const head = spinHeadFromHistory(histories[pick.tableId] ?? []);
  return {
    ...clearCycle(clearPrepareState(machine)),
    prepareTableId: pick.tableId,
    prepareZoneKind: pick.zoneKind,
    armedAtHead: head,
    lastEvaluatedHead: head,
    awaitSwitchNoTable: false,
  };
}

function tablesExcludedFromRotation(machine: RotatingRoomRepeticaoMachineState): ReadonlySet<number> {
  const excluded = new Set<number>();
  for (const [key, count] of Object.entries(machine.tablePlacarLosses)) {
    if (Number(count) >= 1) excluded.add(Number(key));
  }
  if (machine.lastLostTableId != null) excluded.add(machine.lastLostTableId);
  return excluded;
}

function relaxTableExclusionsIfAllBlocked(
  machine: RotatingRoomRepeticaoMachineState,
  tableIds: readonly number[],
): RotatingRoomRepeticaoMachineState {
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
  machine: RotatingRoomRepeticaoMachineState,
  tableId: number,
): RotatingRoomRepeticaoMachineState {
  return {
    ...machine,
    tablePlacarLosses: { ...machine.tablePlacarLosses, [String(tableId)]: 1 },
    lastLostTableId: tableId,
  };
}

function armCycleFromZone(
  machine: RotatingRoomRepeticaoMachineState,
  tableId: number,
  zone: FibonacciZone,
  histories: Record<number, readonly number[]>,
  recovery: number = machine.recovery,
  streakGap = 0,
): RotatingRoomRepeticaoMachineState {
  const head = spinHeadFromHistory(histories[tableId] ?? []);
  return {
    ...clearPrepareState(machine),
    cycleTableId: tableId,
    cycleZoneKind: zone.kind,
    cycleZone: zone,
    recovery,
    cycleSeq: machine.cycleSeq + 1,
    armedAtHead: head,
    lastEvaluatedHead: null,
    awaitSwitchNoTable: false,
  };
}

function syncSpinHeads(
  machine: RotatingRoomRepeticaoMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomRepeticaoMachineState {
  const lastSpinHeadByTable = { ...machine.lastSpinHeadByTable };
  for (const tableId of tableIds) {
    lastSpinHeadByTable[String(tableId)] = spinHeadFromHistory(histories[tableId] ?? []);
  }
  return { ...machine, lastSpinHeadByTable };
}

export function seedRotatingRoomRepeticaoMachineAfterPlacarReset(
  machine: RotatingRoomRepeticaoMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomRepeticaoMachineState {
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

export function sanitizeRotatingRoomRepeticaoMachineForTableIds(
  machine: RotatingRoomRepeticaoMachineState,
  tableIds: readonly number[],
): RotatingRoomRepeticaoMachineState {
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

export function scanRotatingRoomRepeticaoTables(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  activePick: RotatingRoomRepeticaoPick | null,
  absenceByKind: RepeticaoZoneAbsenceSpins = uniformRepeticaoAbsenceSpins(
    ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomRepeticaoTableScan[] {
  return tableIds.map((tableId) => {
    const history = histories[tableId] ?? [];
    const pickPrepare = bestPickForTable(tableId, history, absenceByKind, enabledZoneKinds);
    if (!pickPrepare) {
      return {
        tableId,
        zoneLabel: null,
        zoneKind: null,
        streakGap: 0,
        status: "idle" as const,
        isAlertTable: false,
      };
    }

    const isActive =
      activePick != null &&
      activePick.tableId === pickPrepare.tableId &&
      activePick.zoneKind === pickPrepare.zoneKind;

    const zone = zoneFromHeadNumber(history, pickPrepare.zoneKind);
    const status: RotatingRoomRepeticaoTableStatus = isActive
      ? "active"
      : pickPrepare.streakGap >= absenceByKind[pickPrepare.zoneKind]
        ? "alert"
        : "prepare";

    return {
      tableId,
      zoneLabel: zone ? fibonacciZoneLabel(zone) : fibonacciCategoryLabel({ kind: pickPrepare.zoneKind, id: 1 }),
      zoneKind: pickPrepare.zoneKind,
      streakGap: pickPrepare.streakGap,
      status,
      isAlertTable: isActive,
    };
  });
}

export function buildRotatingRoomRepeticaoLiveView(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomRepeticaoMachineState,
  absenceByKind: RepeticaoZoneAbsenceSpins = uniformRepeticaoAbsenceSpins(
    ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): RotatingRoomRepeticaoLiveView {
  let activePick: RotatingRoomRepeticaoPick | null = null;
  if (machine.cycleZoneKind && machine.cycleTableId != null) {
    activePick = {
      tableId: machine.cycleTableId,
      zoneKind: machine.cycleZoneKind,
      streakGap: consecutiveNoRepeatStreak(
        histories[machine.cycleTableId] ?? [],
        machine.cycleZoneKind,
      ),
    };
  }

  const relaxed = relaxTableExclusionsIfAllBlocked(machine, tableIds);
  const excluded =
    relaxed.recovery > 0 && relaxed.cycleTableId == null
      ? tablesExcludedFromRotation(relaxed)
      : undefined;
  const globalPick = pickGlobalRepeticaoAlert(
    tableIds,
    histories,
    excluded,
    absenceByKind,
    enabledZoneKinds,
  );

  return {
    globalPick,
    repeticaoScan: scanRotatingRoomRepeticaoTables(
      tableIds,
      histories,
      activePick,
      absenceByKind,
      enabledZoneKinds,
    ),
  };
}

export function tickRotatingRoomRepeticaoPlacar(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: RotatingRoomRepeticaoMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = ROTATING_ROOM_REPETICAO_MAX_RECOVERY,
  allowNewArming = true,
  absenceByKind: RepeticaoZoneAbsenceSpins = uniformRepeticaoAbsenceSpins(
    ROTATING_ROOM_REPETICAO_ALERT_ABSENCE_SPINS,
  ),
  enabledZoneKinds?: readonly FibonacciZoneKind[],
): {
  nextMachine: RotatingRoomRepeticaoMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotatingRoomRepeticaoPlacarFlash;
} {
  let nextMachine = sanitizeRotatingRoomRepeticaoMachineForTableIds(
    syncSpinHeads(machine, tableIds, histories),
    tableIds,
  );
  let nextStats = stats;
  let statsChanged = false;
  let flash: RotatingRoomRepeticaoPlacarFlash = null;

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
    const active = buildRepeticaoActiveFromZone(
      tableId,
      zone,
      consecutiveNoRepeatStreak(history, zone.kind),
      nextMachine.recovery,
    );

    nextMachine = { ...nextMachine, lastEvaluatedHead: head };
    const outcome = evaluateRepeticaoRound(resultNumber, zone);

    if (outcome === "W") {
      nextStats = recordRepeticaoZoneKindWin(
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
        const prepare = pickGlobalRepeticaoPrepare(
          tableIds,
          histories,
          undefined,
          absenceByKind,
          enabledZoneKinds,
        );
        if (prepare) {
          nextMachine = beginRepeticaoPrepare(nextMachine, prepare, histories);
        }
      }
    } else {
      const recoveryBefore = nextMachine.recovery;
      const recovery = recoveryBefore + 1;

      if (recovery > maxRecovery) {
        nextStats = recordRepeticaoZoneKindLoss(
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
        const kind = nextMachine.cycleZoneKind ?? zone.kind;
        const nextZone = zoneFromHeadNumber(history, kind);
        if (!nextZone) {
          nextMachine = finishCycle(nextMachine);
        } else {
          nextMachine = armCycleFromZone(
            { ...nextMachine, recovery },
            tableId,
            nextZone,
            histories,
            recovery,
            consecutiveNoRepeatStreak(history, kind),
          );
        }
      }
    }

    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  nextMachine = relaxTableExclusionsIfAllBlocked(nextMachine, tableIds);

  if (
    !nextMachine.cycleZone &&
    nextMachine.prepareTableId != null &&
    nextMachine.prepareZoneKind != null
  ) {
    const pt = nextMachine.prepareTableId;
    const zoneKind = nextMachine.prepareZoneKind;
    const hist = histories[pt] ?? [];
    if (hist.length === 0) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }

    const head = spinHeadFromHistory(hist);
    if (head === nextMachine.armedAtHead || head === nextMachine.lastEvaluatedHead) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }

    nextMachine = { ...nextMachine, lastEvaluatedHead: head };
    const streakGap = consecutiveNoRepeatStreak(hist, zoneKind);
    if (streakGap < absenceByKind[zoneKind]) {
      return {
        nextMachine: clearPrepareState(nextMachine),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }

    const zone = zoneFromHeadNumber(hist, zoneKind);
    if (allowNewArming && zone && streakGap >= absenceByKind[zoneKind]) {
      return {
        nextMachine: armCycleFromZone(nextMachine, pt, zone, histories, nextMachine.recovery, streakGap),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }

    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  if (allowNewArming) {
    const excluded =
      nextMachine.recovery > 0 ? tablesExcludedFromRotation(nextMachine) : undefined;

    const prepare = pickGlobalRepeticaoPrepare(
      tableIds,
      histories,
      excluded,
      absenceByKind,
      enabledZoneKinds,
    );
    if (prepare) {
      return {
        nextMachine: beginRepeticaoPrepare(nextMachine, prepare, histories),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }
  }

  return { nextMachine, stats: nextStats, statsChanged, flash };
}
