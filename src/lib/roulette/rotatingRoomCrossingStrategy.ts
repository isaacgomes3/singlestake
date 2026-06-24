/**
 * Sala rotativa — cruzamentos cor/altura ou paridade/altura.
 * - Detecta cruzamentos **ausentes** (giros desde a última saída de qualquer número do bucket)
 * - Com **14+** giros de ausência → **POSICIONAR** (1 rodada) → **JOGANDO** no cruzamento ausente
 * - **POSICIONAR:** vitória no giro não conta e **não** entra em JOGANDO; L/continue → JOGANDO
 * - Com recuperação activa, vitória em POSICIONAR posiciona noutra roleta (recuperação mantém-se)
 * - Placar (JOGANDO): vitória só com **ambos** os fatores; um factor certo → continua; ambos errados → recuperação
 * - **Zero** com sinal activo: conta como derrota e incrementa recuperação (como ambos os fatores errados)
 * - **Recuperação (sala multi-mesa):** derrota parcial suspende o sinal, marca a mesa (1 perda/sessão)
 *   e posiciona noutra roleta; recuperação mantém-se. Mesa suspensa só volta após vitória ou derrota final da sessão.
 */



import {

  evaluateDoisFatoresRound,

  doisFatoresFactorLabel,

  type DoisFatoresActive,

  type DoisFatoresFactor,

  type DoisFatoresPairKind,

} from "@/lib/roulette/doisFatoresStrategy";

import {
  CROSSING_BUCKET_DEFINITIONS,
  bestAbsentBucketCrossingAlert,
  crossingBucketAbsenceGap,
  twoColdestNumbersInNumberSet,
  type CrossingAxisKind,
  type CrossingBucketDef,
} from "@/lib/roulette/liveTableColdStats";

import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";

import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { tableAcceptableForRotatingRoomEntry } from "@/lib/roulette/liveTableBettingWindow";
import { recordRotatingRoomSessionWin, recordRotatingRoomSessionPartialLoss, recordRotatingRoomSessionFinalLoss } from "@/lib/roulette/entryWinBreakdown";

function spinHeadFromHistory(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}



/** Sequência mínima sem repetição consecutiva do cruzamento → começa a indicar. */
export const ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS = 14;

/** @deprecated Use {@link ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS}. */
export const ROTATING_ROOM_CROSSING_ALERT_OPPOSITE_HITS = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS;

/** @deprecated Use {@link ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS}. */
export const ROTATING_ROOM_CROSSING_ALERT_ABSENCE = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS;

/** @deprecated Use {@link ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS}. */
export const ROTATING_ROOM_CROSSING_PREPARE_ABSENCE = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS;

/** @deprecated Use {@link ROTATING_ROOM_CROSSING_ALERT_ABSENCE}. */
export const ROTATING_ROOM_CROSSING_MIN_ABSENCE = ROTATING_ROOM_CROSSING_ALERT_ABSENCE;

export const ROTATING_ROOM_CROSSING_MAX_RECOVERY = 5;



const ROTATING_ROOM_CROSSING_AXES: readonly CrossingAxisKind[] = ["cor-altura", "altura-paridade"];



export type RotatingRoomCrossingPick = {

  tableId: number;

  axis: CrossingAxisKind;

  /** Cruzamento indicado (cor/altura ou paridade/altura). */
  category: string;

  /** Igual a `category` — cruzamento que está ausente. */
  absentCategory: string;

  /** Giros desde a última saída de qualquer número deste cruzamento. */
  bucketGap: number;

  absenceGap: number;

  excludedPair: readonly [number, number];

};



export type RotatingRoomCrossingQueueEntry = {

  tableId: number;

  axis: CrossingAxisKind;

  category: string;

  bucketGap: number;

};



export type RotatingRoomCrossingTableStatus = "idle" | "prepare" | "alert" | "active";



export type RotatingRoomCrossingTableScan = {

  tableId: number;

  category: string | null;

  axis: CrossingAxisKind | null;

  bucketGap: number;

  factor1Label: string | null;

  factor2Label: string | null;

  status: RotatingRoomCrossingTableStatus;

  isAlertTable: boolean;

};



export type RotatingRoomSessionMode =

  | "scanning"

  | "prepare"

  | "active"

  | "awaiting_queue"

  | "await_switch";



export type RotatingRoomCrossingMachineState = {

  cycleTableId: number | null;

  cycleFingerprint: string | null;

  cycleActive: DoisFatoresActive | null;

  recovery: number;

  /** Giros avaliados no ciclo activo sem vitória (inclui continue e derrota). */
  cycleSpinsWithoutWin: number;

  armedAtHead: string | null;

  lastEvaluatedHead: string | null;

  lastSpinHeadByTable: Record<string, string>;

  signalQueue: RotatingRoomCrossingQueueEntry[];

  awaitingQueueTableId: number | null;

  awaitingQueueHead: string | null;

  tablePlacarLosses: Record<string, number>;

  /** Mesa da derrota parcial mais recente — nunca repetir logo a seguir. */
  lastLostTableId: number | null;

  awaitSwitchNoTable: boolean;

  prepareFingerprint: string | null;

  prepareTableId: number | null;

  /** Indicação vigente ao entrar em «posicionar». */
  prepareActive: DoisFatoresActive | null;

  pendingQueueEntry: RotatingRoomCrossingQueueEntry | null;

  /** Cruzamento alvo/ausente do ciclo activo. */
  cycleMetricCategory: string | null;

};



export type RotatingRoomCrossingPlacarFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  switchedTable?: boolean;
  kind: "win" | "loss" | "recovery";
  factor1?: DoisFatoresFactor;
  factor2?: DoisFatoresFactor;
  triggerNumbers?: number[];
  bucketGap?: number;
} | null;



export type RotatingRoomCrossingLiveView = {

  mode: RotatingRoomSessionMode;

  globalPick: RotatingRoomCrossingPick | null;

  preparePick: RotatingRoomCrossingPick | null;

  signalQueue: RotatingRoomCrossingQueueEntry[];

  crossingScan: RotatingRoomCrossingTableScan[];

};



function defaultMachineState(): RotatingRoomCrossingMachineState {

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

    lastLostTableId: null,

    awaitSwitchNoTable: false,

    prepareFingerprint: null,

    prepareTableId: null,

    prepareActive: null,

    pendingQueueEntry: null,

    cycleMetricCategory: null,

  };

}



function factorsFromBucket(def: CrossingBucketDef): readonly [DoisFatoresFactor, DoisFatoresFactor] | null {

  const sample = def.nums[0];

  if (sample == null) return null;

  const col = colorOf(sample);

  const alt = heightOf(sample);

  const par = parityOf(sample);

  if (def.axis === "cor-altura") {

    if (col === "Zero" || alt === "Zero") return null;

    return [{ kind: "cor", value: col }, { kind: "altura", value: alt }] as const;

  }

  if (def.axis === "altura-paridade") {

    if (alt === "Zero" || par === "Zero") return null;

    return [{ kind: "altura", value: alt }, { kind: "paridade", value: par }] as const;

  }

  return null;

}



function pairKindFromAxis(axis: CrossingAxisKind): DoisFatoresPairKind {

  return axis === "cor-altura" ? "cor-altura" : "altura-paridade";

}



function pairKindLabel(axis: CrossingAxisKind): string {

  return axis === "cor-altura" ? "Cor · Altura" : "Paridade · Altura";

}



function crossingAxisFromActive(active: DoisFatoresActive): CrossingAxisKind {

  return active.pairKind === "cor-altura" ? "cor-altura" : "altura-paridade";

}



export function crossingFingerprint(tableId: number, axis: CrossingAxisKind, category: string): string {

  return `${tableId}:${axis}:${category}`;

}



/** Mesa + eixo na fase POSICIONAR (categoria muda com o último número). */

function crossingPrepareKey(tableId: number, axis: CrossingAxisKind): string {

  return `${tableId}:${axis}`;

}



function parseCrossingPrepareKey(key: string): { tableId: number; axis: CrossingAxisKind } | null {

  const parts = key.split(":");

  if (parts.length < 2) return null;

  const tableId = Number(parts[0]);

  const axis = parts[1] as CrossingAxisKind;

  if (!Number.isFinite(tableId)) return null;

  if (axis !== "cor-altura" && axis !== "altura-paridade") return null;

  return { tableId, axis };

}



export function buildCrossingActiveFromPick(pick: RotatingRoomCrossingPick): DoisFatoresActive | null {

  const def = CROSSING_BUCKET_DEFINITIONS.find((d) => d.axis === pick.axis && d.category === pick.category);

  if (!def) return null;

  const factors = factorsFromBucket(def);

  if (!factors) return null;

  const [factor1, factor2] = factors;

  return {

    pairKind: pairKindFromAxis(pick.axis),

    pairKindLabel: pairKindLabel(pick.axis),

    patternMode: "convergence",

    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },

    referenceNumber: pick.excludedPair[0],

    factor1,

    factor2,

    triggerNumbers: pick.excludedPair,

    armingDescription: `${pick.category} · ${pick.absenceGap} giros sem aparecer (mesa ${pick.tableId})`,

  };

}



function pickFromAbsentBucket(
  tableId: number,
  historyNewestFirst: readonly number[],
  def: CrossingBucketDef,
  bucketGap: number,
): RotatingRoomCrossingPick {
  return {
    tableId,
    axis: def.axis,
    category: def.category,
    absentCategory: def.category,
    bucketGap,
    absenceGap: bucketGap,
    excludedPair: twoColdestNumbersInNumberSet(historyNewestFirst, def.nums),
  };
}

function pickForTableByCategory(
  tableId: number,
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
  category: string,
): RotatingRoomCrossingPick | null {
  const def = CROSSING_BUCKET_DEFINITIONS.find((d) => d.axis === axis && d.category === category);
  if (!def) return null;
  const bucketGap = crossingBucketAbsenceGap(historyNewestFirst, def);
  return pickFromAbsentBucket(tableId, historyNewestFirst, def, bucketGap);
}

function absentPickMeetsAlertThreshold(
  pick: RotatingRoomCrossingPick | null,
  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): boolean {
  return pick != null && pick.bucketGap >= minAbsenceSpins;
}

function crossingFlashSnapshot(
  active: DoisFatoresActive | null,
  history: readonly number[],
  tableId: number,
  machine: RotatingRoomCrossingMachineState,
): Pick<
  NonNullable<RotatingRoomCrossingPlacarFlash>,
  "factor1" | "factor2" | "triggerNumbers" | "bucketGap"
> {
  const triggerNumbers = history.slice(0, 4);
  if (!active) return { triggerNumbers };
  const axis = crossingAxisFromActive(active);
  const category = machine.cycleMetricCategory;
  const live = category ? pickForTableByCategory(tableId, history, axis, category) : null;
  return {
    factor1: active.factor1,
    factor2: active.factor2,
    triggerNumbers,
    bucketGap: live?.bucketGap ?? 0,
  };
}

function clearPrepareState(machine: RotatingRoomCrossingMachineState): RotatingRoomCrossingMachineState {
  return {
    ...machine,
    prepareFingerprint: null,
    prepareTableId: null,
    prepareActive: null,
    pendingQueueEntry: null,
    armedAtHead: null,
  };
}

function bestPickForTable(
  tableId: number,
  historyNewestFirst: readonly number[],
  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingPick | null {
  const best = bestAbsentBucketCrossingAlert(
    historyNewestFirst,
    ROTATING_ROOM_CROSSING_AXES,
    minAbsenceSpins,
  );
  if (!best) return null;
  return pickFromAbsentBucket(tableId, historyNewestFirst, best.def, best.bucketGap);
}

function pickForTableOnAxis(
  tableId: number,
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
  minGap = 1,
  category?: string,
): RotatingRoomCrossingPick | null {
  if (category) {
    const def = CROSSING_BUCKET_DEFINITIONS.find((d) => d.axis === axis && d.category === category);
    if (!def) return null;
    const bucketGap = crossingBucketAbsenceGap(historyNewestFirst, def);
    if (bucketGap < minGap) return null;
    return pickFromAbsentBucket(tableId, historyNewestFirst, def, bucketGap);
  }

  const best = bestAbsentBucketCrossingAlert(historyNewestFirst, [axis], minGap);
  if (!best) return null;
  return pickFromAbsentBucket(tableId, historyNewestFirst, best.def, best.bucketGap);
}



function comparePicks(a: RotatingRoomCrossingPick, b: RotatingRoomCrossingPick): number {

  if (a.absenceGap !== b.absenceGap) return b.absenceGap - a.absenceGap;

  return a.tableId - b.tableId;

}



export function listAllAlertPicks(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  excludeTableIds?: ReadonlySet<number>,

  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,

): RotatingRoomCrossingPick[] {

  const out: RotatingRoomCrossingPick[] = [];

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



export function pickGlobalCrossingAlert(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  excludeTableIds?: ReadonlySet<number>,

  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,

): RotatingRoomCrossingPick | null {

  return listAllAlertPicks(tableIds, histories, excludeTableIds, minAbsenceSpins)[0] ?? null;

}

/** Respeita sempre `excludeTableIds` (mesas com derrota na recuperação não voltam a ser escolhidas). */
export function pickGlobalCrossingAlertWithFallback(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingPick | null {
  return pickGlobalCrossingAlert(tableIds, histories, excludeTableIds, minAbsenceSpins);
}



/** @deprecated Sem fase de posicionar — equivalente a {@link pickGlobalCrossingAlert}. */
export function pickGlobalCrossingPrepare(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  excludeTableIds?: ReadonlySet<number>,

): RotatingRoomCrossingPick | null {

  return pickGlobalCrossingAlert(tableIds, histories, excludeTableIds);

}



/** @deprecated Sem fase de posicionar — equivalente a {@link pickGlobalCrossingAlert}. */
export function pickGlobalCrossingEnterPrepare(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

): RotatingRoomCrossingPick | null {

  return pickGlobalCrossingAlert(tableIds, histories);

}



function pickToQueueEntry(pick: RotatingRoomCrossingPick): RotatingRoomCrossingQueueEntry {

  return { tableId: pick.tableId, axis: pick.axis, category: pick.category, bucketGap: pick.bucketGap };

}



export function buildSignalQueue(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  activeFingerprint: string | null,

): RotatingRoomCrossingQueueEntry[] {

  return listAllAlertPicks(tableIds, histories)

    .filter((p) => crossingFingerprint(p.tableId, p.axis, p.category) !== activeFingerprint)

    .map(pickToQueueEntry);

}



function armCycleFromPick(

  machine: RotatingRoomCrossingMachineState,

  pick: RotatingRoomCrossingPick,

  histories: Record<number, readonly number[]>,

  recovery: number,

): RotatingRoomCrossingMachineState {

  const active = buildCrossingActiveFromPick(pick);

  if (!active) return machine;

  return armCycleFromActive(machine, pick, active, histories, recovery);

}



function armCycleFromActive(

  machine: RotatingRoomCrossingMachineState,

  pick: RotatingRoomCrossingPick,

  active: DoisFatoresActive,

  histories: Record<number, readonly number[]>,

  recovery: number,

  opts?: { lastEvaluatedHead?: string | null },

): RotatingRoomCrossingMachineState {

  const head = spinHeadFromHistory(histories[pick.tableId] ?? []);

  return {

    ...machine,

    cycleTableId: pick.tableId,

    cycleFingerprint: crossingFingerprint(pick.tableId, pick.axis, pick.category),

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

    cycleMetricCategory: pick.absentCategory,

  };

}



function clearCycle(machine: RotatingRoomCrossingMachineState): RotatingRoomCrossingMachineState {

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



function refreshCycleActiveFromLive(

  machine: RotatingRoomCrossingMachineState,

  histories: Record<number, readonly number[]>,

): RotatingRoomCrossingMachineState {

  if (!machine.cycleActive || machine.cycleTableId == null) return machine;

  const axis = crossingAxisFromActive(machine.cycleActive);
  const category = machine.cycleMetricCategory;
  const live =
    category != null
      ? pickForTableByCategory(machine.cycleTableId, histories[machine.cycleTableId] ?? [], axis, category)
      : pickForTableOnAxis(machine.cycleTableId, histories[machine.cycleTableId] ?? [], axis, 0);

  if (!live) return machine;

  const active = buildCrossingActiveFromPick(live);

  if (!active) return machine;

  return {

    ...machine,

    cycleActive: active,

    cycleFingerprint: crossingFingerprint(live.tableId, live.axis, live.category),

    cycleMetricCategory: live.absentCategory,

  };

}



function tablesExcludedFromRotation(machine: RotatingRoomCrossingMachineState): ReadonlySet<number> {
  const excluded = new Set<number>();
  for (const [key, count] of Object.entries(machine.tablePlacarLosses)) {
    if (Number(count) >= 1) excluded.add(Number(key));
  }
  if (machine.lastLostTableId != null) excluded.add(machine.lastLostTableId);
  return excluded;
}

/** Quando todas as mesas estão bloqueadas, liberta as antigas mas mantém só a última derrota. */
function relaxTableExclusionsIfAllBlocked(
  machine: RotatingRoomCrossingMachineState,
  tableIds: readonly number[],
): RotatingRoomCrossingMachineState {
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
  machine: RotatingRoomCrossingMachineState,
  tableId: number,
): RotatingRoomCrossingMachineState {
  return {
    ...machine,
    tablePlacarLosses: { ...machine.tablePlacarLosses, [String(tableId)]: 1 },
    lastLostTableId: tableId,
  };
}

function beginPrepareOnAlert(
  machine: RotatingRoomCrossingMachineState,
  alert: RotatingRoomCrossingPick,
  histories: Record<number, readonly number[]>,
): RotatingRoomCrossingMachineState {
  return {
    ...machine,
    awaitSwitchNoTable: false,
    prepareFingerprint: crossingPrepareKey(alert.tableId, alert.axis),
    prepareTableId: alert.tableId,
    prepareActive: buildCrossingActiveFromPick(alert),
    pendingQueueEntry: pickToQueueEntry(alert),
    armedAtHead: spinHeadFromHistory(histories[alert.tableId] ?? []),
  };
}

/** Suspende ciclo na mesa derrotada e posiciona noutra roleta (recuperação mantém-se). */
function suspendAndPrepareNextTable(
  machine: RotatingRoomCrossingMachineState,
  lostTableId: number,
  recovery: number,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingMachineState {
  const marked = markTableSessionLoss(machine, lostTableId);
  const cleared = { ...clearCycle(marked), recovery };
  const excluded = new Set(tablesExcludedFromRotation(cleared));
  excluded.add(lostTableId);
  const alert = pickGlobalCrossingAlertWithFallback(tableIds, histories, excluded, minAbsenceSpins);
  if (!alert || alert.tableId === lostTableId) {
    return { ...cleared, awaitSwitchNoTable: true };
  }
  return beginPrepareOnAlert(cleared, alert, histories);
}

/** Vitória em POSICIONAR com recuperação — troca de mesa sem contar W nem zerar recuperação. */
function rotatePrepareAfterWinDuringPrepare(
  machine: RotatingRoomCrossingMachineState,
  fromTableId: number,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingMachineState {
  const excluded = new Set(tablesExcludedFromRotation(machine));
  excluded.add(fromTableId);
  const base: RotatingRoomCrossingMachineState = {
    ...clearPrepareState(machine),
    recovery: machine.recovery,
    tablePlacarLosses: machine.tablePlacarLosses,
    awaitSwitchNoTable: false,
  };
  const alert = pickGlobalCrossingAlertWithFallback(tableIds, histories, excluded, minAbsenceSpins);
  if (!alert) {
    return { ...base, awaitSwitchNoTable: machine.recovery > 0 };
  }
  return beginPrepareOnAlert(base, alert, histories);
}

function finishCycle(machine: RotatingRoomCrossingMachineState): RotatingRoomCrossingMachineState {

  return {
    ...clearCycle(machine),
    recovery: 0,
    tablePlacarLosses: {},
    lastLostTableId: null,
    awaitSwitchNoTable: false,
    signalQueue: [],
    awaitingQueueTableId: null,
    awaitingQueueHead: null,
  };

}



export function scanRotatingRoomCrossingTables(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  activePick: RotatingRoomCrossingPick | null,

  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,

): RotatingRoomCrossingTableScan[] {

  return tableIds.map((tableId) => {

    const pick = bestPickForTable(tableId, histories[tableId] ?? [], minAbsenceSpins);



    if (!pick) {

      return { tableId, category: null, axis: null, bucketGap: 0, factor1Label: null, factor2Label: null, status: "idle" as const, isAlertTable: false };

    }



    const active = buildCrossingActiveFromPick(pick);

    const fp = crossingFingerprint(pick.tableId, pick.axis, pick.category);

    const isActive = activePick != null && crossingFingerprint(activePick.tableId, activePick.axis, activePick.category) === fp;



    let status: RotatingRoomCrossingTableStatus = "idle";

    if (isActive) status = "active";

    else if (pick.absenceGap >= minAbsenceSpins) status = "alert";



    return {

      tableId,

      category: pick.category,

      axis: pick.axis,

      bucketGap: pick.bucketGap,

      factor1Label: active ? doisFatoresFactorLabel(active.factor1) : null,

      factor2Label: active ? doisFatoresFactorLabel(active.factor2) : null,

      status,

      isAlertTable: isActive,

    };

  });

}



export function buildRotatingRoomCrossingLiveView(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  machine: RotatingRoomCrossingMachineState,

  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,

): RotatingRoomCrossingLiveView {

  const globalPick = machine.cycleActive && machine.cycleTableId != null

    ? pickGlobalCrossingAlert(tableIds, histories, undefined, minAbsenceSpins) // fallback; active from machine

    : pickGlobalCrossingAlert(tableIds, histories, undefined, minAbsenceSpins);



  let activePick: RotatingRoomCrossingPick | null = null;

  if (machine.cycleActive && machine.cycleTableId != null) {
    const axis = crossingAxisFromActive(machine.cycleActive);
    const category = machine.cycleMetricCategory;
    activePick =
      category != null
        ? pickForTableByCategory(
            machine.cycleTableId,
            histories[machine.cycleTableId] ?? [],
            axis,
            category,
          )
        : pickForTableOnAxis(machine.cycleTableId, histories[machine.cycleTableId] ?? [], axis, 0);
  }



  const displayPick = activePick ?? globalPick;

  let preparePick: RotatingRoomCrossingPick | null = null;

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

    globalPick: displayPick,

    preparePick,

    signalQueue: [],

    crossingScan: scanRotatingRoomCrossingTables(tableIds, histories, displayPick, minAbsenceSpins),

  };

}



function syncSpinHeads(

  machine: RotatingRoomCrossingMachineState,

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

): RotatingRoomCrossingMachineState {

  const lastSpinHeadByTable = { ...machine.lastSpinHeadByTable };

  for (const tableId of tableIds) {

    lastSpinHeadByTable[String(tableId)] = spinHeadFromHistory(histories[tableId] ?? []);

  }

  return { ...machine, lastSpinHeadByTable };

}

/** Após «zerar placar», marca os giros actuais como já vistos — evita recontagem. */
export function seedRotatingRoomCrossingMachineAfterPlacarReset(
  machine: RotatingRoomCrossingMachineState,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
): RotatingRoomCrossingMachineState {
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

/** Remove ciclo/posicionar em mesas que já não pertencem ao rodízio (ex.: Latina removida). */
export function sanitizeRotatingRoomCrossingMachineForTableIds(
  machine: RotatingRoomCrossingMachineState,
  tableIds: readonly number[],
): RotatingRoomCrossingMachineState {
  if (tableIds.length === 0) return machine;
  const allowed = new Set(tableIds);
  let next = machine;
  let changed = false;

  const apply = (m: RotatingRoomCrossingMachineState) => {
    if (m !== next) {
      next = m;
      changed = true;
    }
  };

  if (next.cycleTableId != null && !allowed.has(next.cycleTableId)) {
    apply(clearCycle(next));
  }

  if (
    (next.prepareTableId != null && !allowed.has(next.prepareTableId)) ||
    (next.pendingQueueEntry != null && !allowed.has(next.pendingQueueEntry.tableId))
  ) {
    apply(clearPrepareState(next));
  }

  if (next.awaitingQueueTableId != null && !allowed.has(next.awaitingQueueTableId)) {
    next = { ...next, awaitingQueueTableId: null, awaitingQueueHead: null };
    changed = true;
  }

  const lastSpinHeadByTable = { ...next.lastSpinHeadByTable };
  let headsPruned = false;
  for (const key of Object.keys(lastSpinHeadByTable)) {
    const id = Number(key);
    if (!allowed.has(id)) {
      delete lastSpinHeadByTable[key];
      headsPruned = true;
    }
  }
  if (headsPruned) {
    next = { ...next, lastSpinHeadByTable };
    changed = true;
  }

  const tablePlacarLosses = { ...next.tablePlacarLosses };
  let lossesPruned = false;
  for (const key of Object.keys(tablePlacarLosses)) {
    const id = Number(key);
    if (!allowed.has(id)) {
      delete tablePlacarLosses[key];
      lossesPruned = true;
    }
  }
  if (lossesPruned) {
    next = { ...next, tablePlacarLosses };
    changed = true;
  }

  if (next.recovery === 0 && next.awaitSwitchNoTable) {
    next = { ...next, awaitSwitchNoTable: false };
    changed = true;
  }

  if (next.prepareFingerprint && next.prepareTableId == null) {
    apply(clearPrepareState(next));
  }

  if (next.awaitSwitchNoTable && next.recovery > 0 && next.prepareFingerprint) {
    apply(clearPrepareState(next));
  }

  if (next.awaitSwitchNoTable && next.recovery > 0 && tableIds.length > 0) {
    const relaxed = relaxTableExclusionsIfAllBlocked(next, tableIds);
    if (relaxed !== next) {
      next = relaxed;
      changed = true;
    }
  }

  return changed ? next : machine;
}



export function tickRotatingRoomCrossingPlacar(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  machine: RotatingRoomCrossingMachineState,

  stats: RotatingRoomSessionStats,

  maxRecovery: number = ROTATING_ROOM_CROSSING_MAX_RECOVERY,

  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,

): {

  nextMachine: RotatingRoomCrossingMachineState;

  stats: RotatingRoomSessionStats;

  statsChanged: boolean;

  flash: RotatingRoomCrossingPlacarFlash;

} {

  let nextMachine = sanitizeRotatingRoomCrossingMachineForTableIds(
    syncSpinHeads(machine, tableIds, histories),
    tableIds,
  );

  let nextStats = stats;

  let statsChanged = false;

  let flash: RotatingRoomCrossingPlacarFlash = null;



  if (!nextMachine.cycleActive && nextMachine.prepareFingerprint && nextMachine.prepareTableId != null) {

    const pt = nextMachine.prepareTableId;

    const head = spinHeadFromHistory(histories[pt] ?? []);

    const entry = nextMachine.pendingQueueEntry;

    if (entry && entry.tableId === pt) {
      const gapNow = pickForTableByCategory(pt, histories[pt] ?? [], entry.axis, entry.category);
      if (!absentPickMeetsAlertThreshold(gapNow, minAbsenceSpins) && head === nextMachine.armedAtHead) {
        return {
          nextMachine: clearPrepareState(nextMachine),
          stats: nextStats,
          statsChanged,
          flash,
        };
      }
    }

    if (nextMachine.armedAtHead != null && head !== nextMachine.armedAtHead) {

      const hist = histories[pt] ?? [];

      const resultNumber = hist[0];

      if (resultNumber === 0) {

        return {

          nextMachine: { ...nextMachine, armedAtHead: head },

          stats: nextStats,

          statsChanged,

          flash,

        };

      }

      const prepareActive = nextMachine.prepareActive;
      if (prepareActive && entry && entry.tableId === pt) {
        const outcome = evaluateDoisFatoresRound(resultNumber!, prepareActive);
        const pickFromEntry = pickForTableByCategory(pt, hist, entry.axis, entry.category);
        if (outcome === "W") {
          if (nextMachine.recovery > 0 && tableIds.length > 1) {
            return {
              nextMachine: rotatePrepareAfterWinDuringPrepare(
                nextMachine,
                pt,
                tableIds,
                histories,
                minAbsenceSpins,
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
        if (pickFromEntry) {
          return {
            nextMachine: armCycleFromActive(
              { ...nextMachine, pendingQueueEntry: null },
              pickFromEntry,
              prepareActive,
              histories,
              nextMachine.recovery,
              { lastEvaluatedHead: head },
            ),
            stats: nextStats,
            statsChanged,
            flash,
          };
        }
      }

      const live =
        entry && entry.tableId === pt
          ? pickForTableByCategory(pt, histories[pt] ?? [], entry.axis, entry.category)
          : null;

      if (absentPickMeetsAlertThreshold(live, minAbsenceSpins)) {
        return {
          nextMachine: armCycleFromPick(
            { ...nextMachine, pendingQueueEntry: null },
            live!,
            histories,
            nextMachine.recovery,
          ),

          stats: nextStats,

          statsChanged,

          flash,

        };

      }

      nextMachine = clearPrepareState(nextMachine);

    }

    return { nextMachine, stats: nextStats, statsChanged, flash };

  }



  if (!nextMachine.cycleActive) {

    if (nextMachine.awaitSwitchNoTable && nextMachine.recovery > 0) {
      nextMachine = relaxTableExclusionsIfAllBlocked(nextMachine, tableIds);
      const excluded = tablesExcludedFromRotation(nextMachine);
      const retry = pickGlobalCrossingAlertWithFallback(tableIds, histories, excluded, minAbsenceSpins);
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
    const alert = pickGlobalCrossingAlertWithFallback(tableIds, histories, excluded, minAbsenceSpins);

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

  if (
    nextMachine.lastEvaluatedHead === null &&
    nextMachine.recovery === 0 &&
    nextMachine.cycleMetricCategory &&
    nextMachine.cycleActive
  ) {
    const axis = crossingAxisFromActive(nextMachine.cycleActive);
    const live = pickForTableByCategory(
      tableId,
      histories[tableId] ?? [],
      axis,
      nextMachine.cycleMetricCategory,
    );
    if (!absentPickMeetsAlertThreshold(live, minAbsenceSpins)) {
      return {
        nextMachine: clearCycle(nextMachine),
        stats: nextStats,
        statsChanged,
        flash,
      };
    }
  }



  const history = histories[tableId] ?? [];

  if (history.length === 0) return { nextMachine, stats: nextStats, statsChanged, flash };



  const head = spinHeadFromHistory(history);

  if (head === nextMachine.armedAtHead || head === nextMachine.lastEvaluatedHead) {

    return { nextMachine, stats: nextStats, statsChanged, flash };

  }



  const resultNumber = history[0]!;

  /** Indicação vigente neste giro — avaliar antes de actualizar com o último número. */
  const activeForRound = nextMachine.cycleActive;

  nextMachine = { ...nextMachine, lastEvaluatedHead: head };

  const outcome = evaluateDoisFatoresRound(resultNumber, activeForRound);



  if (outcome === "W") {

    nextStats = recordRotatingRoomSessionWin(nextStats, nextMachine.recovery, maxRecovery);

    statsChanged = true;

    flash = { resultNumber, won: true, tableId, kind: "win", ...crossingFlashSnapshot(activeForRound, history, tableId, nextMachine) };

    nextMachine = finishCycle(nextMachine);

  } else if (outcome === "L") {

    const recoveryBefore = nextMachine.recovery;
    const recovery = recoveryBefore + 1;
    const canRotateTables = tableIds.length > 1;

    if (recovery > maxRecovery) {

      nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);

      statsChanged = true;

      flash = { resultNumber, won: false, tableId, kind: "loss", ...crossingFlashSnapshot(activeForRound, history, tableId, nextMachine) };

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
        nextMachine = suspendAndPrepareNextTable(
          nextMachine,
          tableId,
          recovery,
          tableIds,
          histories,
          minAbsenceSpins,
        );
      } else {
        nextMachine = { ...nextMachine, recovery };
        nextMachine = refreshCycleActiveFromLive(nextMachine, histories);
      }

    }

  } else {

    nextMachine = { ...nextMachine, cycleSpinsWithoutWin: nextMachine.cycleSpinsWithoutWin + 1 };

    nextMachine = refreshCycleActiveFromLive(nextMachine, histories);

  }



  return { nextMachine, stats: nextStats, statsChanged, flash };

}


