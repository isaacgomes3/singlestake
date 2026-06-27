/**

 * Sala rotativa / mesa — motor 1 Fator (t1/t2 nos 3 factores; confirmação com 2 no giro actual).

 */



import {

  detectUmFatorActiveFromHistory,

  evaluateUmFatorRound,

  umFatorAlertLabel,

  umFatorTriggerMatchCount,

  umFatorTriggerMatchTierFromActive,

  UM_FATOR_MAX_RECOVERY,

  type UmFatorActive,

} from "@/lib/roulette/umFatorStrategy";

import { doisFatoresFactorLabel, type DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";

import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";
import {
  liveTableBettingRemainingSec,
  tableAcceptableForRotatingRoomEntry,
  tableArmableForUmFatorFormation,
} from "@/lib/roulette/liveTableBettingWindow";
import {
  isRotatingRoomLobbyCooldownActive,
  rotatingRoomLobbyCooldownUntilMs,
} from "@/lib/roulette/rotatingRoomLobbySignal";

import {

  recordRotatingRoomSessionWin,

  recordRotatingRoomSessionPartialLoss,

  recordRotatingRoomSessionFinalLoss,

  recordUmFatorMatchTierWin,

  recordUmFatorMatchTierLoss,

} from "@/lib/roulette/entryWinBreakdown";



export { UM_FATOR_MAX_RECOVERY };



function spinHead(history: readonly number[]): string {

  if (history.length === 0) return "0";

  return `${history.length}:${history[0]}`;

}



export type UmFatorPendingEntry = {

  active: UmFatorActive;

  /** Cabeçalho do histórico no giro em que o alerta foi formado. */

  armedHead: string;

};



export type UmFatorMachineState = {

  recovery: number;

  lastEvaluatedHead: string | null;

  lastSpinHeadByTable: Record<string, string>;

  /** Alerta armado à espera do giro de resultado. */

  pendingByTable: Record<string, UmFatorPendingEntry>;

  /** Giro de resultado já liquidado no placar. */

  settledSpinHeadByTable: Record<string, string>;

  /** Mesa(s) com derrota final — não rearmar até vitória noutra mesa. */

  tablePlacarLosses: Record<string, number>;

  /** Última mesa que perdeu — durante gale, próxima entrada noutra roleta. */

  lastLostTableId: number | null;

  lastActive: UmFatorActive | null;

  lastActiveTableId: number | null;

  /** Mesa com entrada pendente — evita trocar indicação antes do resultado. */
  focusLockTableId: number | null;

  /**
   * Cabeçalho do histórico por mesa após o último resultado liquidado.
   * Enquanto o head for igual, não arma gatinhos já visíveis na fila — aguarda giro novo.
   */
  staleFormationHeadByTable: Record<string, string>;

  /** Bloqueia nova entrada até passar o cooldown pós-lobby (vitória ou derrota final). */
  lobbyCooldownUntilMs: number | null;

  /**
   * Head por mesa quando o lobby ficou pronto — só arma após giro novo (head diferente).
   * Ignora gatilhos que já estavam na fila antes/durante o retorno ao lobby.
   */
  lobbyArmingGateByTable: Record<string, string>;

};



export type UmFatorPlacarFlash = {

  resultNumber: number;

  won: boolean;

  tableId: number;

  kind: "win" | "loss" | "recovery";

  factor1?: DoisFatoresFactor;

  triggerNumbers?: number[];

} | null;



export type UmFatorTableScan = {

  tableId: number;

  hasTriggerPair: boolean;

  alertLabel: string | null;

  status: "idle" | "formation" | "alert";

};



export type UmFatorLiveView = {

  globalTableId: number | null;

  globalActive: UmFatorActive | null;

  tableScan: UmFatorTableScan[];

};



export function defaultUmFatorMachineState(): UmFatorMachineState {

  return {

    recovery: 0,

    lastEvaluatedHead: null,

    lastSpinHeadByTable: {},

    pendingByTable: {},

    settledSpinHeadByTable: {},

    tablePlacarLosses: {},

    lastLostTableId: null,

    lastActive: null,

    lastActiveTableId: null,

    focusLockTableId: null,

    staleFormationHeadByTable: {},

    lobbyCooldownUntilMs: null,

    lobbyArmingGateByTable: {},

  };

}



function snapshotSpinHeadsByTable(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): Record<string, string> {
  const heads: Record<string, string> = {};
  for (const tableId of tableIds) {
    heads[String(tableId)] = spinHead(histories[tableId] ?? []);
  }
  return heads;
}

/** Gatilho já visível quando o lobby abriu — aguarda giro novo nesta mesa. */
function isBlockedByLobbyArmingGate(
  machine: UmFatorMachineState,
  tableId: number,
  head: string,
): boolean {
  const gate = machine.lobbyArmingGateByTable?.[String(tableId)];
  return gate != null && gate === head;
}

function refreshLobbyArmingGateIfReady(
  machine: UmFatorMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): UmFatorMachineState {
  if (machine.lobbyCooldownUntilMs == null) return machine;
  if (isRotatingRoomLobbyCooldownActive(machine.lobbyCooldownUntilMs)) return machine;
  return {
    ...machine,
    lobbyCooldownUntilMs: null,
    lobbyArmingGateByTable: snapshotSpinHeadsByTable(tableIds, histories),
  };
}



function isResultAlreadySettled(

  machine: UmFatorMachineState,

  tableId: number,

  head: string,

): boolean {

  return machine.settledSpinHeadByTable[String(tableId)] === head;

}

function sameUmFatorTriggerPair(
  a: readonly [number, number],
  b: readonly [number, number],
): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Evita rearmar na mesa/gatilho que acabou de perder. */
function shouldSkipTableForFormation(
  machine: UmFatorMachineState,
  tableId: number,
  formation: UmFatorActive,
): boolean {
  if (machine.recovery > 0 && machine.lastLostTableId === tableId) return true;
  if ((machine.tablePlacarLosses[String(tableId)] ?? 0) >= 1) return true;
  if (
    machine.lastActiveTableId === tableId &&
    machine.lastActive != null &&
    sameUmFatorTriggerPair(formation.triggerNumbers, machine.lastActive.triggerNumbers)
  ) {
    return true;
  }
  return false;
}

/** Gatinho já estava na fila quando o último resultado foi liquidado. */
function isStaleQueuedFormation(
  machine: UmFatorMachineState,
  tableId: number,
  head: string,
): boolean {
  const blocked = machine.staleFormationHeadByTable[String(tableId)];
  return blocked != null && blocked === head;
}

function snapshotStaleFormationHeads(
  machine: UmFatorMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): Record<string, string> {
  const stale: Record<string, string> = { ...machine.staleFormationHeadByTable };
  for (const tableId of tableIds) {
    stale[String(tableId)] = spinHead(histories[tableId] ?? []);
  }
  return stale;
}



function pendingForTable(

  machine: UmFatorMachineState,

  tableId: number,

): UmFatorPendingEntry | null {

  return machine.pendingByTable[String(tableId)] ?? null;

}



/** Entrada pendente ainda não liquidada neste giro (aguarda resultado ou avaliação). */
function isPendingEntryOpen(
  machine: UmFatorMachineState,
  tableId: number,
  history: readonly number[],
): boolean {
  const pending = pendingForTable(machine, tableId);
  if (!pending) return false;
  const head = spinHead(history);
  return !isResultAlreadySettled(machine, tableId, head);
}

function anyTablePendingEntryOpen(
  machine: UmFatorMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): boolean {
  return findLockedPendingTable(machine, tableIds, histories) != null;
}

/** Mesa com entrada pendente ainda à espera do giro de resultado. */
function findLockedPendingTable(
  machine: UmFatorMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): number | null {
  if (machine.focusLockTableId != null && tableIds.includes(machine.focusLockTableId)) {
    const history = histories[machine.focusLockTableId] ?? [];
    if (isPendingEntryOpen(machine, machine.focusLockTableId, history)) {
      return machine.focusLockTableId;
    }
  }
  for (const tableId of tableIds) {
    if (isPendingEntryOpen(machine, tableId, histories[tableId] ?? [])) {
      return tableId;
    }
  }
  return null;
}

/** Pending órfão (sem focus lock) — estado inconsistente após reload. */
function pruneOrphanUmFatorPending(machine: UmFatorMachineState): UmFatorMachineState {
  const lock = machine.focusLockTableId;
  if (lock == null) {
    if (Object.keys(machine.pendingByTable).length === 0) return machine;
    return { ...machine, pendingByTable: {} };
  }
  const pendingByTable = { ...machine.pendingByTable };
  let changed = false;
  for (const k of Object.keys(pendingByTable)) {
    if (Number(k) !== lock) {
      delete pendingByTable[k];
      changed = true;
    }
  }
  return changed ? { ...machine, pendingByTable } : machine;
}



function pendingReadyToEvaluate(

  machine: UmFatorMachineState,

  tableId: number,

  head: string,

): boolean {

  const pending = pendingForTable(machine, tableId);

  return pending != null && pending.armedHead !== head;

}



function orderTableIdsForTick(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  machine: UmFatorMachineState,

): number[] {

  const needsEval: number[] = [];

  const withPending: number[] = [];

  const withFormation: number[] = [];

  const rest: number[] = [];



  for (const tableId of tableIds) {

    const history = histories[tableId] ?? [];

    const head = spinHead(history);

    if (pendingReadyToEvaluate(machine, tableId, head)) {

      needsEval.push(tableId);

    } else if (pendingForTable(machine, tableId) != null) {

      withPending.push(tableId);

    } else if (

      !isResultAlreadySettled(machine, tableId, head) &&

      !isStaleQueuedFormation(machine, tableId, head) &&

      !isBlockedByLobbyArmingGate(machine, tableId, head) &&

      detectUmFatorActiveFromHistory(history) != null &&

      tableArmableForUmFatorFormation(tableId, history)

    ) {

      withFormation.push(tableId);

    } else {

      rest.push(tableId);

    }

  }



  const sortIds = (ids: number[]) => ids.sort((a, b) => a - b);

  return [

    ...sortIds(needsEval),

    ...sortIds(withPending),

    ...sortIds(withFormation),

    ...sortIds(rest),

  ];

}



function activeForDisplay(

  machine: UmFatorMachineState,

  tableId: number,

  history: readonly number[],

): UmFatorActive | null {

  const head = spinHead(history);

  const pending = pendingForTable(machine, tableId);

  if (!pending) return null;
  if (isResultAlreadySettled(machine, tableId, head)) return null;
  return pending.active;

}



function scanUmFatorTables(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  machine: UmFatorMachineState,

): UmFatorTableScan[] {

  const lockedTable = findLockedPendingTable(machine, tableIds, histories);

  return tableIds.map((tableId) => {

    const h = histories[tableId] ?? [];

    const active = activeForDisplay(machine, tableId, h);
    const formation =
      lockedTable != null
        ? null
        : h.length >= 3 && !active && !isStaleQueuedFormation(machine, tableId, spinHead(h))
          ? detectUmFatorActiveFromHistory(h)
          : null;

    return {

      tableId,

      hasTriggerPair: h.length >= 3 && umFatorTriggerMatchCount(h[1]!, h[2]!) >= 2,

      alertLabel: active
        ? umFatorAlertLabel(active)
        : formation
          ? umFatorAlertLabel(formation)
          : null,

      status: active
        ? ("alert" as const)
        : formation
          ? ("formation" as const)
          : ("idle" as const),

    };

  });

}



function pickGlobalUmFatorAlert(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  machine: UmFatorMachineState,

): { tableId: number; active: UmFatorActive } | null {

  const lockedTable = findLockedPendingTable(machine, tableIds, histories);
  if (lockedTable != null) {
    const active = activeForDisplay(machine, lockedTable, histories[lockedTable] ?? []);
    if (active) return { tableId: lockedTable, active };
    return null;
  }

  const picks: { tableId: number; active: UmFatorActive }[] = [];

  for (const tableId of tableIds) {

    const history = histories[tableId] ?? [];

    const active = activeForDisplay(machine, tableId, history);

    if (active) picks.push({ tableId, active });

  }

  if (picks.length === 0) return null;

  if (machine.lastActiveTableId != null) {
    const sticky = picks.find((p) => p.tableId === machine.lastActiveTableId);
    if (sticky) return sticky;
  }

  picks.sort((a, b) => a.tableId - b.tableId);
  return picks[0]!;
}



export function buildUmFatorLiveView(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  machine: UmFatorMachineState,

): UmFatorLiveView {

  const pick = pickGlobalUmFatorAlert(tableIds, histories, machine);

  return {

    globalTableId: pick?.tableId ?? null,

    globalActive: pick?.active ?? null,

    tableScan: scanUmFatorTables(tableIds, histories, machine),

  };

}



export function tickUmFatorPlacar(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  machine: UmFatorMachineState,

  stats: RotatingRoomSessionStats,

  maxRecovery: number = UM_FATOR_MAX_RECOVERY,

): {

  nextMachine: UmFatorMachineState;

  stats: RotatingRoomSessionStats;

  statsChanged: boolean;

  flash: UmFatorPlacarFlash;

} {

  let nextMachine: UmFatorMachineState = pruneOrphanUmFatorPending(machine);
  nextMachine = refreshLobbyArmingGateIfReady(nextMachine, tableIds, histories);
  nextMachine = {

    ...nextMachine,

    lastSpinHeadByTable: { ...nextMachine.lastSpinHeadByTable },

    pendingByTable: { ...nextMachine.pendingByTable },

    settledSpinHeadByTable: { ...(nextMachine.settledSpinHeadByTable ?? {}) },

  };

  let nextStats = stats;

  let statsChanged = false;

  let flash: UmFatorPlacarFlash = null;



  const globalHead = tableIds

    .map((id) => `${id}:${spinHead(histories[id] ?? [])}`)

    .join("|");



  const lobbyCooldownActive = isRotatingRoomLobbyCooldownActive(nextMachine.lobbyCooldownUntilMs);

  const hasWork = tableIds.some((tableId) => {

    const history = histories[tableId] ?? [];

    const head = spinHead(history);

    if (pendingReadyToEvaluate(nextMachine, tableId, head)) return true;

    if (pendingForTable(nextMachine, tableId) != null) return false;

    if (isResultAlreadySettled(nextMachine, tableId, head)) return false;

    if (lobbyCooldownActive) return false;

    if (isBlockedByLobbyArmingGate(nextMachine, tableId, head)) return false;

    return (

      !isStaleQueuedFormation(nextMachine, tableId, head) &&

      detectUmFatorActiveFromHistory(history) != null &&

      tableArmableForUmFatorFormation(tableId, history)

    );

  });



  if (globalHead === machine.lastEvaluatedHead && !hasWork) {

    return { nextMachine, stats: nextStats, statsChanged, flash };

  }



  const orderedIds = orderTableIdsForTick(tableIds, histories, nextMachine);



  for (const tableId of orderedIds) {

    const history = histories[tableId] ?? [];

    const head = spinHead(history);

    const prevHead = machine.lastSpinHeadByTable[String(tableId)];

    const headChanged = head !== prevHead;

    if (headChanged) {

      nextMachine.lastSpinHeadByTable[String(tableId)] = head;

    }



    const pending = pendingForTable(nextMachine, tableId);



    if (pending && pending.armedHead !== head) {

      const resultNumber = history[0]!;

      const outcome = evaluateUmFatorRound(resultNumber, pending.active);

      const recoveryBefore = nextMachine.recovery;

      const matchTier = umFatorTriggerMatchTierFromActive(pending.active);

      const pendingByTable = { ...nextMachine.pendingByTable };

      delete pendingByTable[String(tableId)];



      nextMachine = {

        ...nextMachine,

        pendingByTable,

        lastActive: pending.active,

        lastActiveTableId: tableId,

        focusLockTableId: null,

        settledSpinHeadByTable: {

          ...nextMachine.settledSpinHeadByTable,

          [String(tableId)]: head,

        },

        staleFormationHeadByTable: snapshotStaleFormationHeads(nextMachine, tableIds, histories),

      };



      if (outcome === "W") {

        nextStats = recordRotatingRoomSessionWin(nextStats, recoveryBefore, maxRecovery);

        if (matchTier != null) nextStats = recordUmFatorMatchTierWin(nextStats, matchTier);

        statsChanged = true;

        nextMachine.recovery = 0;

        nextMachine.tablePlacarLosses = {};

        nextMachine.lastLostTableId = null;

        nextMachine.lobbyCooldownUntilMs = rotatingRoomLobbyCooldownUntilMs();
        nextMachine.lobbyArmingGateByTable = {};

        flash = {
          resultNumber,
          won: true,
          tableId,
          kind: "win",
          factor1: pending.active.alertFactor,
          triggerNumbers: history.slice(0, 4),
        };

      } else {

        const nextRecovery = recoveryBefore + 1;

        if (matchTier != null) nextStats = recordUmFatorMatchTierLoss(nextStats, matchTier);

        if (nextRecovery > maxRecovery) {

          nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);

          statsChanged = true;

          nextMachine.recovery = 0;

          nextMachine.tablePlacarLosses = { [String(tableId)]: 1 };

          nextMachine.lastLostTableId = tableId;

          nextMachine.lobbyCooldownUntilMs = rotatingRoomLobbyCooldownUntilMs();
          nextMachine.lobbyArmingGateByTable = {};

          flash = {
            resultNumber,
            won: false,
            tableId,
            kind: "loss",
            factor1: pending.active.alertFactor,
            triggerNumbers: history.slice(0, 4),
          };

        } else {

          nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recoveryBefore, maxRecovery);

          statsChanged = true;

          nextMachine.recovery = nextRecovery;

          nextMachine.lastLostTableId = tableId;

          flash = { resultNumber, won: false, tableId, kind: "recovery" };

        }

      }

      break;

    }



    if (pending) continue;

    if (isResultAlreadySettled(nextMachine, tableId, head)) continue;

    if (anyTablePendingEntryOpen(nextMachine, tableIds, histories)) continue;

    if (lobbyCooldownActive) continue;

    const formation = detectUmFatorActiveFromHistory(history);

    if (!formation) continue;

    if (shouldSkipTableForFormation(nextMachine, tableId, formation)) continue;

    if (isStaleQueuedFormation(nextMachine, tableId, head)) continue;

    if (isBlockedByLobbyArmingGate(nextMachine, tableId, head)) continue;

    if (!headChanged) continue;

    if (!tableAcceptableForRotatingRoomEntry(tableId, history)) continue;

    if (!tableArmableForUmFatorFormation(tableId, history)) continue;



    nextMachine = {

      ...nextMachine,

      pendingByTable: {

        ...nextMachine.pendingByTable,

        [String(tableId)]: { active: formation, armedHead: head },

      },

      lastActive: formation,

      lastActiveTableId: tableId,

      focusLockTableId: tableId,

      lobbyArmingGateByTable: {},

    };

    break;

  }



  nextMachine.lastEvaluatedHead = globalHead;

  return { nextMachine, stats: nextStats, statsChanged, flash };

}



export function seedUmFatorMachineAfterPlacarReset(

  machine: UmFatorMachineState,

  tableIds: readonly number[],

  histories: Record<number, readonly number[]> = {},

): UmFatorMachineState {

  const lastSpinHeadByTable: Record<string, string> = {};

  for (const tableId of tableIds) {

    lastSpinHeadByTable[String(tableId)] = spinHead(histories[tableId] ?? []);

  }

  const globalHead = tableIds

    .map((id) => `${id}:${spinHead(histories[id] ?? [])}`)

    .join("|");

  return {

    ...machine,

    recovery: 0,

    lastEvaluatedHead: globalHead,

    lastSpinHeadByTable,

    pendingByTable: {},

    settledSpinHeadByTable: {},

    tablePlacarLosses: {},

    lastLostTableId: null,

    lastActive: null,

    lastActiveTableId: null,

    focusLockTableId: null,

    staleFormationHeadByTable: {},

    lobbyCooldownUntilMs: null,

    lobbyArmingGateByTable: {},

  };

}



export function sanitizeUmFatorMachineForTableIds(

  machine: UmFatorMachineState,

  tableIds: readonly number[],

): UmFatorMachineState {

  const allowed = new Set(tableIds.map(String));

  const lastSpinHeadByTable: Record<string, string> = {};

  for (const [k, v] of Object.entries(machine.lastSpinHeadByTable)) {

    if (allowed.has(k)) lastSpinHeadByTable[k] = v;

  }

  const settledSpinHeadByTable: Record<string, string> = {};

  for (const [k, v] of Object.entries(machine.settledSpinHeadByTable ?? {})) {

    if (allowed.has(k)) settledSpinHeadByTable[k] = v;

  }

  const pendingByTable: Record<string, UmFatorPendingEntry> = {};

  for (const [k, v] of Object.entries(machine.pendingByTable ?? {})) {

    if (allowed.has(k)) pendingByTable[k] = v;

  }

  const staleFormationHeadByTable: Record<string, string> = {};

  for (const [k, v] of Object.entries(machine.staleFormationHeadByTable ?? {})) {

    if (allowed.has(k)) staleFormationHeadByTable[k] = v;

  }

  const lobbyArmingGateByTable: Record<string, string> = {};

  for (const [k, v] of Object.entries(machine.lobbyArmingGateByTable ?? {})) {

    if (allowed.has(k)) lobbyArmingGateByTable[k] = v;

  }

  const lastActiveTableId =

    machine.lastActiveTableId != null && tableIds.includes(machine.lastActiveTableId)

      ? machine.lastActiveTableId

      : null;

  const focusLockTableId =

    machine.focusLockTableId != null && tableIds.includes(machine.focusLockTableId)

      ? machine.focusLockTableId

      : null;

  return {

    ...machine,

    lastSpinHeadByTable,

    pendingByTable,

    settledSpinHeadByTable,

    staleFormationHeadByTable,

    lobbyArmingGateByTable,

    tablePlacarLosses: {},

    lastLostTableId: null,

    lastActiveTableId,

    focusLockTableId,

  };

}



export function umFatorScanFactorLabels(row: UmFatorTableScan): {

  factor1Label: string | null;

  factor2Label: string | null;

} {

  if (!row.alertLabel) return { factor1Label: null, factor2Label: null };

  return { factor1Label: row.alertLabel, factor2Label: null };

}



export function umFatorActiveFactorLabels(active: UmFatorActive): {

  factor1Label: string;

  factor2Label: string | null;

} {

  return {

    factor1Label: doisFatoresFactorLabel(active.alertFactor),

    factor2Label: null,

  };

}



export function normalizeUmFatorMachineOnLoad(

  machine: UmFatorMachineState,

  stats?: RotatingRoomSessionStats,

): UmFatorMachineState {

  const safeStats = parseRotatingRoomSessionStats(stats, UM_FATOR_MAX_RECOVERY);

  const entries = safeStats.wins + safeStats.losses;

  const settled = machine.settledSpinHeadByTable ?? {};

  const pending = machine.pendingByTable ?? {};

  const partialLosses = (safeStats.lossesAtRecovery ?? []).reduce((sum, n) => sum + (Number(n) || 0), 0);

  const orphanSettled =

    Object.keys(settled).length > 0 && entries === 0 && partialLosses === 0 && Object.keys(pending).length === 0;

  const recoveryMismatch = machine.recovery > 0 && machine.recovery > partialLosses;



  if (orphanSettled || recoveryMismatch) {

    return {

      ...machine,

      pendingByTable: {},

      settledSpinHeadByTable: {},

      tablePlacarLosses: {},

      lastLostTableId: null,

      lastEvaluatedHead: null,

      focusLockTableId: null,

      staleFormationHeadByTable: {},

      lobbyCooldownUntilMs: null,

      lobbyArmingGateByTable: {},

      recovery: partialLosses > 0 ? partialLosses : 0,

    };

  }



  const lobbyCooldownUntilMs =
    typeof machine.lobbyCooldownUntilMs === "number" && Number.isFinite(machine.lobbyCooldownUntilMs)
      ? machine.lobbyCooldownUntilMs
      : null;

  return {

    ...machine,

    pendingByTable: pending,

    staleFormationHeadByTable: machine.staleFormationHeadByTable ?? {},

    lobbyArmingGateByTable: machine.lobbyArmingGateByTable ?? {},

    lobbyCooldownUntilMs,

    tablePlacarLosses: {},

    lastLostTableId: null,

    focusLockTableId:

      machine.focusLockTableId != null && pending[String(machine.focusLockTableId)]

        ? machine.focusLockTableId

        : null,

  };

}


