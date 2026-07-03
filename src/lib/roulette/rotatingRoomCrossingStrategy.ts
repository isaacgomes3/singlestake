/**
 * Sala rotativa — 2 Fatores por padrões de cruzamento.
 * Eixos: cor/altura, paridade/altura, cor/paridade.
 * Padrões: primário x-x-x, secundário x-x-y-x, terciário x-y-x-x.
 * - POSICIONAR → JOGANDO com indicação do cruzamento do padrão
 * - Placar: vitória só com ambos os fatores; derrota se ambos falharem (zero = derrota)
 * - Empate (um factor certo): não conta derrota — indicação vigente até vitória (ambos factores)
 * - Indicação mantém-se em empates consecutivos (sem subir gale) até W ou L
 * - **Mesa fixa após indicação:** permanece na mesma roleta até vitória (W) ou derrota final — gales e zero incluídos
 * - Recuperações na **mesma mesa** (sem trocar de mesa no ciclo activo)
 * - **Novo gatilho** (qualquer cruzamento) na mesa → nova indicação de imediato; as 2 rodadas sem padrão só contam quando não surge gatilho
 * - 5 recuperações antes de L final
 * - Não posiciona em mesas com zero nos últimos 12 números
 */

import {
  evaluateDoisFatoresRound,
  doisFatoresFactorLabel,
  type DoisFatoresActive,
  type DoisFatoresFactor,
  type DoisFatoresPairKind,
} from "@/lib/roulette/doisFatoresStrategy";
import {
  crossingPatternKindLabel,
  detectBestPatternOnTable,
  detectPatternOnTableByKind,
  factorsForNumberOnAxis,
  tableHasZeroInLastSpins,
  type CrossingPatternKind,
  type CrossingPatternMatch,
  ROTATING_ROOM_CROSSING_SWITCH_WITHOUT_PATTERN_SPINS,
} from "@/lib/roulette/doisFatoresPatternCrossing";
import { ROTATING_ROOM_CROSSING_BET_DELAY_MS } from "@/lib/roulette/rotatingRoomLobbySignal";
import {
  isAnyCrossingGatilhoEnabled,
  isCrossingGatilhoEnabled,
  getEnabledCrossingAbsenceAxes,
} from "@/lib/roulette/umFatorTriggerEnable";
import {
  readEffectiveCrossingAxisAbsenceSpins,
  absenceSpinsForCrossingAxis,
  crossingAxisKindToAbsenceKey,
} from "@/lib/roulette/crossingAbsencePrefs";
import {
  CROSSING_BUCKET_DEFINITIONS,
  crossingBucketAbsenceGap,
  type CrossingAxisKind,
  type CrossingBucketDef,
} from "@/lib/roulette/liveTableColdStats";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { tableAcceptableForRotatingRoomEntry } from "@/lib/roulette/liveTableBettingWindow";
import {
  recordRotatingRoomSessionWin,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionFinalLoss,
  recordCrossingPatternKindWin,
  recordCrossingPatternKindLoss,
  recordCrossingAbsenceAxisWin,
  recordCrossingAbsenceAxisLoss,
} from "@/lib/roulette/entryWinBreakdown";

function spinHeadFromHistory(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}



/** @deprecated Legado ausência 18 giros — padrões usam prioridade 1–3. */
export const ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS = 1;

/** @deprecated Use {@link ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS}. */
export const ROTATING_ROOM_CROSSING_ALERT_OPPOSITE_HITS = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS;

/** @deprecated Use {@link ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS}. */
export const ROTATING_ROOM_CROSSING_ALERT_ABSENCE = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS;

/** @deprecated Use {@link ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS}. */
export const ROTATING_ROOM_CROSSING_PREPARE_ABSENCE = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS;

/** @deprecated Use {@link ROTATING_ROOM_CROSSING_ALERT_ABSENCE}. */
export const ROTATING_ROOM_CROSSING_MIN_ABSENCE = ROTATING_ROOM_CROSSING_ALERT_ABSENCE;

export const ROTATING_ROOM_CROSSING_MAX_RECOVERY = 5;



export type RotatingRoomCrossingPick = {
  tableId: number;
  axis: CrossingAxisKind;
  category: string;
  absentCategory: string;
  /** Prioridade do padrão (3=primário, 2=secundário, 1=terciário) ou giros de ausência. */
  bucketGap: number;
  absenceGap: number;
  excludedPair: readonly [number, number];
  triggerMode: "pattern" | "absence";
  patternKind: CrossingPatternKind;
  triggerNumbers: readonly number[];
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
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



export type CrossingPostResultHoldReason = "draw" | "loss";

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

  /** Cruzamento alvo do ciclo activo. */
  cycleMetricCategory: string | null;

  /** Padrão de gatilho do ciclo activo (primário / secundário / terciário). */
  cyclePatternKind: CrossingPatternKind | null;

  /** Eixo de ausência do ciclo activo (cor/altura ou paridade/altura). */
  cycleAbsenceAxis: CrossingAxisKind | null;

  /** Identificador estável do ciclo (gatilho → vitória ou derrota final). */
  cycleSeq: number;

  /** Aguardar após resultado antes de nova aposta (ms epoch). */
  postResultHoldUntilMs: number | null;

  postResultHoldTableId: number | null;

  /** Empate → repetir (1×); derrota → dobrar (2× em qualquer gale). */
  postResultHoldReason: CrossingPostResultHoldReason | null;

  /** Giros na mesa fixa **sem** gatilho (troca de mesa só após 2 seguidos). */
  prepareSpinsWithoutPattern: number;

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

    cyclePatternKind: null,

    cycleAbsenceAxis: null,

    cycleSeq: 0,

    postResultHoldUntilMs: null,

    postResultHoldTableId: null,

    postResultHoldReason: null,

    prepareSpinsWithoutPattern: 0,

  };

}



function pickFromPatternMatch(
  tableId: number,
  match: CrossingPatternMatch,
): RotatingRoomCrossingPick {
  const t0 = match.triggerNumbers[0] ?? 0;
  const t1 = match.triggerNumbers[1] ?? t0;
  return {
    tableId,
    axis: match.axis,
    category: match.category,
    absentCategory: match.category,
    bucketGap: match.patternPriority,
    absenceGap: match.patternPriority,
    excludedPair: [t0, t1] as const,
    triggerMode: "pattern",
    patternKind: match.patternKind,
    triggerNumbers: match.triggerNumbers,
    factor1: match.factor1,
    factor2: match.factor2,
  };
}

function pickFromAbsenceBucket(
  tableId: number,
  def: CrossingBucketDef,
  bucketGap: number,
): RotatingRoomCrossingPick | null {
  const refNum = def.nums[0];
  if (refNum == null) return null;
  const factors = factorsForNumberOnAxis(refNum, def.axis);
  if (!factors) return null;
  return {
    tableId,
    axis: def.axis,
    category: def.category,
    absentCategory: def.category,
    bucketGap,
    absenceGap: bucketGap,
    excludedPair: [refNum, refNum] as const,
    triggerMode: "absence",
    patternKind: "primary",
    triggerNumbers: [refNum],
    factor1: factors[0],
    factor2: factors[1],
  };
}

function bestExactAbsencePickForTable(
  tableId: number,
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
  exactAbsence: number,
): RotatingRoomCrossingPick | null {
  let best: { def: CrossingBucketDef; gap: number } | null = null;
  for (const def of CROSSING_BUCKET_DEFINITIONS) {
    if (def.axis !== axis) continue;
    const gap = crossingBucketAbsenceGap(historyNewestFirst, def);
    if (gap !== exactAbsence) continue;
    if (!best || def.category < best.def.category) {
      best = { def, gap };
    }
  }
  if (!best) return null;
  return pickFromAbsenceBucket(tableId, best.def, best.gap);
}

function listAllCrossingAbsenceAlertPicks(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
): RotatingRoomCrossingPick[] {
  const axes = getEnabledCrossingAbsenceAxes();
  if (axes.length === 0) return [];

  const absenceSpins = readEffectiveCrossingAxisAbsenceSpins();
  const out: RotatingRoomCrossingPick[] = [];

  for (const tableId of tableIds) {
    if (excludeTableIds?.has(tableId)) continue;
    const history = histories[tableId] ?? [];
    if (!tableAcceptableForRotatingRoomEntry(tableId, history)) continue;
    if (tableHasZeroInLastSpins(history)) continue;

    for (const axis of axes) {
      const key = crossingAxisKindToAbsenceKey(axis);
      if (!key) continue;
      const exactSpins = absenceSpinsForCrossingAxis(key, absenceSpins);
      const pick = bestExactAbsencePickForTable(tableId, history, axis, exactSpins);
      if (pick) out.push(pick);
    }
  }

  out.sort(comparePicks);
  return out;
}

function pairKindFromAxis(axis: CrossingAxisKind): DoisFatoresPairKind {
  return axis;
}

function pairKindLabel(axis: CrossingAxisKind): string {
  switch (axis) {
    case "cor-altura":
      return "Cor · Altura";
    case "cor-paridade":
      return "Cor · Paridade";
    case "altura-paridade":
      return "Paridade · Altura";
  }
}

function crossingAxisFromActive(active: DoisFatoresActive): CrossingAxisKind {
  return active.pairKind;
}

export function crossingFingerprint(tableId: number, axis: CrossingAxisKind, category: string): string {
  return `${tableId}:${axis}:${category}`;
}

/** Id estável do ciclo de indicação (mesmo gatilho até vitória ou derrota final). */
export function crossingSignalId(
  tableId: number,
  fingerprint: string,
  recovery: number,
  cycleSeq: number,
  attempt = 0,
): string {
  return `${tableId}:${fingerprint}:${Math.max(0, Math.floor(recovery))}:c${Math.max(0, Math.floor(cycleSeq))}:a${Math.max(0, Math.floor(attempt))}`;
}

function beginCrossingPostResultHold(
  machine: RotatingRoomCrossingMachineState,
  tableId: number,
  histories: Record<number, readonly number[]>,
  recovery: number,
  active: DoisFatoresActive,
  opts?: { cycleSpinsWithoutWin?: number; reason: CrossingPostResultHoldReason },
): RotatingRoomCrossingMachineState {
  const head = spinHeadFromHistory(histories[tableId] ?? []);
  const now = Date.now();
  return {
    ...machine,
    cycleTableId: tableId,
    cycleActive: active,
    recovery,
    cycleSpinsWithoutWin: opts?.cycleSpinsWithoutWin ?? machine.cycleSpinsWithoutWin,
    armedAtHead: head,
    lastEvaluatedHead: head,
    postResultHoldUntilMs: now + ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    postResultHoldTableId: tableId,
    postResultHoldReason: opts?.reason ?? null,
    prepareFingerprint: null,
    prepareTableId: null,
    prepareActive: null,
    pendingQueueEntry: null,
    awaitSwitchNoTable: false,
  };
}

/** Mesa + eixo na fase POSICIONAR (categoria muda com o último número). */
function crossingPrepareKey(tableId: number, axis: CrossingAxisKind): string {
  return `${tableId}:${axis}`;
}

const ANCHOR_FINGERPRINT_PREFIX = "anchor:";

function anchorFingerprint(tableId: number): string {
  return `${ANCHOR_FINGERPRINT_PREFIX}${tableId}`;
}

function isAnchoredFingerprint(fp: string | null | undefined): boolean {
  return fp != null && fp.startsWith(ANCHOR_FINGERPRINT_PREFIX);
}

/** Mesa fixa: à espera de novo gatilho na mesma roleta (não alterna sem zero ou 2 giros sem padrão). */
export function isRotatingRoomCrossingTableAnchored(
  machine: Pick<RotatingRoomCrossingMachineState, "prepareFingerprint">,
): boolean {
  return isAnchoredFingerprint(machine.prepareFingerprint);
}

function parseCrossingPrepareKey(key: string): { tableId: number; axis: CrossingAxisKind } | null {
  const parts = key.split(":");
  if (parts.length < 2) return null;
  const tableId = Number(parts[0]);
  const axis = parts[1] as CrossingAxisKind;
  if (!Number.isFinite(tableId)) return null;
  if (axis !== "cor-altura" && axis !== "altura-paridade" && axis !== "cor-paridade") return null;
  return { tableId, axis };
}

export function buildCrossingActiveFromPick(pick: RotatingRoomCrossingPick): DoisFatoresActive | null {
  const armingDescription =
    pick.triggerMode === "absence"
      ? `Ausência ${pick.bucketGap}g · ${pick.category} (mesa ${pick.tableId})`
      : `${crossingPatternKindLabel(pick.patternKind)} · ${pick.category} (mesa ${pick.tableId})`;
  return {
    pairKind: pairKindFromAxis(pick.axis),
    pairKindLabel: pairKindLabel(pick.axis),
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: pick.triggerNumbers[0] ?? pick.excludedPair[0],
    factor1: pick.factor1,
    factor2: pick.factor2,
    triggerNumbers: [pick.excludedPair[0], pick.excludedPair[1]] as const,
    armingDescription,
  };
}

function pickForTableByCategory(
  tableId: number,
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
  category: string,
): RotatingRoomCrossingPick | null {
  const match = detectBestPatternOnTable(historyNewestFirst);
  if (!match || match.axis !== axis || match.category !== category) return null;
  return pickFromPatternMatch(tableId, match);
}

function patternPickMeetsThreshold(pick: RotatingRoomCrossingPick | null): boolean {
  return pick != null;
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
    prepareSpinsWithoutPattern: 0,
  };
}

function bestPickForTable(
  tableId: number,
  historyNewestFirst: readonly number[],
  _minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingPick | null {
  const axes = getEnabledCrossingAbsenceAxes();
  if (axes.length > 0) {
    const absenceSpins = readEffectiveCrossingAxisAbsenceSpins();
    let best: RotatingRoomCrossingPick | null = null;
    for (const axis of axes) {
      const key = crossingAxisKindToAbsenceKey(axis);
      if (!key) continue;
      const pick = bestExactAbsencePickForTable(
        tableId,
        historyNewestFirst,
        axis,
        absenceSpinsForCrossingAxis(key, absenceSpins),
      );
      if (pick && (!best || comparePicks(pick, best) < 0)) best = pick;
    }
    if (best) return best;
  }
  if (!isCrossingGatilhoEnabled()) return null;
  const match = detectBestPatternOnTable(historyNewestFirst);
  if (!match) return null;
  return pickFromPatternMatch(tableId, match);
}

function pickForTableOnAxis(
  tableId: number,
  historyNewestFirst: readonly number[],
  axis: CrossingAxisKind,
  _minGap = 1,
  category?: string,
): RotatingRoomCrossingPick | null {
  const match = detectBestPatternOnTable(historyNewestFirst);
  if (!match || match.axis !== axis) return null;
  if (category && match.category !== category) return null;
  return pickFromPatternMatch(tableId, match);
}

function comparePicks(a: RotatingRoomCrossingPick, b: RotatingRoomCrossingPick): number {
  if (a.absenceGap !== b.absenceGap) return b.absenceGap - a.absenceGap;
  return a.tableId - b.tableId;
}

export function listAllAlertPicks(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  excludeTableIds?: ReadonlySet<number>,
  _minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingPick[] {
  const absencePicks = listAllCrossingAbsenceAlertPicks(tableIds, histories, excludeTableIds);
  if (absencePicks.length > 0) return absencePicks;

  if (!isCrossingGatilhoEnabled()) return [];

  const kinds = ["primary", "secondary", "tertiary"] as const;
  for (const kind of kinds) {
    const out: RotatingRoomCrossingPick[] = [];
    for (const tableId of tableIds) {
      if (excludeTableIds?.has(tableId)) continue;
      const history = histories[tableId] ?? [];
      if (!tableAcceptableForRotatingRoomEntry(tableId, history)) continue;
      if (tableHasZeroInLastSpins(history)) continue;
      const match = detectPatternOnTableByKind(history, kind);
      if (match) out.push(pickFromPatternMatch(tableId, match));
    }
    if (out.length > 0) {
      out.sort(comparePicks);
      return out;
    }
  }
  return [];
}



export function pickGlobalCrossingAlert(

  tableIds: readonly number[],

  histories: Record<number, readonly number[]>,

  excludeTableIds?: ReadonlySet<number>,

  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,

): RotatingRoomCrossingPick | null {

  if (!isAnyCrossingGatilhoEnabled()) return null;
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
  const nextCycleSeq = recovery === 0 ? (machine.cycleSeq ?? 0) + 1 : (machine.cycleSeq ?? 0);

  return {

    ...machine,

    cycleTableId: pick.tableId,

    cycleFingerprint: crossingFingerprint(pick.tableId, pick.axis, pick.category),

    cycleActive: active,

    recovery,

    cycleSeq: nextCycleSeq,

    cycleSpinsWithoutWin: 0,

    armedAtHead: head,

    lastEvaluatedHead: opts?.lastEvaluatedHead ?? null,

    postResultHoldUntilMs: null,

    postResultHoldTableId: null,

    postResultHoldReason: null,

    signalQueue: [],

    awaitingQueueTableId: null,

    awaitingQueueHead: null,

    awaitSwitchNoTable: false,

    prepareFingerprint: null,

    prepareTableId: null,

    prepareActive: null,

    pendingQueueEntry: null,

    cycleMetricCategory: pick.absentCategory,

    cyclePatternKind: pick.triggerMode === "pattern" ? pick.patternKind : null,

    cycleAbsenceAxis: pick.triggerMode === "absence" ? pick.axis : null,

  };

}



function clearCycle(machine: RotatingRoomCrossingMachineState): RotatingRoomCrossingMachineState {

  return {
    ...machine,
    cycleTableId: null,
    cycleFingerprint: null,
    cycleActive: null,
    cycleMetricCategory: null,
    cyclePatternKind: null,
    cycleAbsenceAxis: null,
    cycleSpinsWithoutWin: 0,
    postResultHoldUntilMs: null,
    postResultHoldTableId: null,
    postResultHoldReason: null,
    armedAtHead: null,
    lastEvaluatedHead: null,
  };

}



function refreshCycleActiveFromLive(
  machine: RotatingRoomCrossingMachineState,
  _histories: Record<number, readonly number[]>,
): RotatingRoomCrossingMachineState {
  return machine;
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

function enterCrossingFromAlert(
  machine: RotatingRoomCrossingMachineState,
  alert: RotatingRoomCrossingPick,
  histories: Record<number, readonly number[]>,
  recovery: number = machine.recovery,
): RotatingRoomCrossingMachineState {
  return armCycleFromPick(clearPrepareState(machine), alert, histories, recovery);
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
    prepareSpinsWithoutPattern: 0,
  };
}

function tryEnterCrossingFromTablePattern(
  machine: RotatingRoomCrossingMachineState,
  tableId: number,
  histories: Record<number, readonly number[]>,
  recovery: number,
  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingMachineState | null {
  const freshPick = bestPickForTable(tableId, histories[tableId] ?? [], minAbsenceSpins);
  if (!freshPick) return null;
  return enterCrossingFromAlert(machine, freshPick, histories, recovery);
}

function reanchorOnTable(
  machine: RotatingRoomCrossingMachineState,
  tableId: number,
  histories: Record<number, readonly number[]>,
  recovery: number,
  _minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingMachineState {
  const head = spinHeadFromHistory(histories[tableId] ?? []);
  return {
    ...clearCycle(machine),
    recovery,
    prepareTableId: tableId,
    prepareFingerprint: anchorFingerprint(tableId),
    prepareSpinsWithoutPattern: 0,
    prepareActive: null,
    pendingQueueEntry: null,
    lastEvaluatedHead: head,
    awaitSwitchNoTable: false,
  };
}

function rotateAnchoredToNewTable(
  machine: RotatingRoomCrossingMachineState,
  fromTableId: number,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingMachineState {
  const excluded = new Set<number>([fromTableId]);
  const base = clearPrepareState({ ...machine, prepareSpinsWithoutPattern: 0 });
  const alert = pickGlobalCrossingAlert(tableIds, histories, excluded, minAbsenceSpins);
  if (!alert) {
    return { ...base, awaitSwitchNoTable: machine.recovery > 0 };
  }
  return enterCrossingFromAlert(base, alert, histories, machine.recovery);
}

function rotatePrepareToNextTable(
  machine: RotatingRoomCrossingMachineState,
  fromTableId: number,
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingMachineState {
  return rotateAnchoredToNewTable(machine, fromTableId, tableIds, histories, minAbsenceSpins);
}

/** @deprecated Recuperação mantém-se na mesma mesa — usar {@link reanchorOnTable}. */
function suspendAndPrepareNextTable(
  machine: RotatingRoomCrossingMachineState,
  lostTableId: number,
  recovery: number,
  _tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  _minAbsenceSpins: number = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS,
): RotatingRoomCrossingMachineState {
  return reanchorOnTable(machine, lostTableId, histories, recovery);
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
  return enterCrossingFromAlert(base, alert, histories);
}

function finishCycle(machine: RotatingRoomCrossingMachineState): RotatingRoomCrossingMachineState {

  return {
    ...clearPrepareState(clearCycle(machine)),
    recovery: 0,
    postResultHoldUntilMs: null,
    postResultHoldTableId: null,
    postResultHoldReason: null,
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

    else if (pick) status = "alert";



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

  if (
    machine.prepareTableId != null &&
    isAnchoredFingerprint(machine.prepareFingerprint) &&
    !machine.cycleActive
  ) {
    preparePick = bestPickForTable(
      machine.prepareTableId,
      histories[machine.prepareTableId] ?? [],
      minAbsenceSpins,
    );
  } else if (machine.prepareTableId != null && machine.prepareFingerprint && !machine.cycleActive) {
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
  let next: RotatingRoomCrossingMachineState = {
    ...machine,
    postResultHoldReason:
      machine.postResultHoldReason === "draw" || machine.postResultHoldReason === "loss"
        ? machine.postResultHoldReason
        : null,
  };
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

  return next;
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



  if (
    !nextMachine.cycleActive &&
    nextMachine.prepareTableId != null &&
    isAnchoredFingerprint(nextMachine.prepareFingerprint)
  ) {
    const pt = nextMachine.prepareTableId;
    const hist = histories[pt] ?? [];
    const head = spinHeadFromHistory(hist);

    if (head !== nextMachine.lastEvaluatedHead) {
      nextMachine = { ...nextMachine, lastEvaluatedHead: head };
      const resultNumber = hist[0];

      if (resultNumber === 0 && tableIds.length > 1) {
        return {
          nextMachine: rotateAnchoredToNewTable(nextMachine, pt, tableIds, histories, minAbsenceSpins),
          stats: nextStats,
          statsChanged,
          flash,
        };
      }

      const freshPick = bestPickForTable(pt, hist, minAbsenceSpins);
      if (freshPick) {
        return {
          nextMachine: enterCrossingFromAlert(nextMachine, freshPick, histories),
          stats: nextStats,
          statsChanged,
          flash,
        };
      }

      /** Só conta rodada sem gatilho — se surgir padrão em qualquer cruzamento, entra acima. */
      const spinsWithout = nextMachine.prepareSpinsWithoutPattern + 1;
      if (
        spinsWithout >= ROTATING_ROOM_CROSSING_SWITCH_WITHOUT_PATTERN_SPINS &&
        tableIds.length > 1
      ) {
        return {
          nextMachine: rotateAnchoredToNewTable(
            { ...nextMachine, prepareSpinsWithoutPattern: spinsWithout },
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

      nextMachine = { ...nextMachine, prepareSpinsWithoutPattern: spinsWithout };
    }

    return { nextMachine, stats: nextStats, statsChanged, flash };
  }



  if (!nextMachine.cycleActive) {

    if (nextMachine.awaitSwitchNoTable && nextMachine.recovery > 0) {
      const retry = pickGlobalCrossingAlert(tableIds, histories, undefined, minAbsenceSpins);
      if (retry) {
        return {
          nextMachine: enterCrossingFromAlert(nextMachine, retry, histories),
          stats: nextStats,
          statsChanged,
          flash,
        };
      }
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }

    const alert = pickGlobalCrossingAlert(tableIds, histories, undefined, minAbsenceSpins);

    if (alert && !nextMachine.prepareFingerprint) {
      nextMachine = enterCrossingFromAlert(nextMachine, alert, histories);

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



  const head = spinHeadFromHistory(history);

  if (head === nextMachine.armedAtHead || head === nextMachine.lastEvaluatedHead) {

    return { nextMachine, stats: nextStats, statsChanged, flash };

  }



  const resultNumber = history[0]!;

  /** Indicação vigente neste giro — avaliar antes de actualizar com o último número. */
  const activeForRound = nextMachine.cycleActive;
  const patternKindForRound = nextMachine.cyclePatternKind;
  const absenceAxisForRound = nextMachine.cycleAbsenceAxis;

  nextMachine = { ...nextMachine, lastEvaluatedHead: head };

  const outcome = evaluateDoisFatoresRound(resultNumber, activeForRound);



  if (outcome === "W") {

    nextStats = recordRotatingRoomSessionWin(nextStats, nextMachine.recovery, maxRecovery);
    if (patternKindForRound != null) {
      nextStats = recordCrossingPatternKindWin(nextStats, patternKindForRound);
      statsChanged = true;
    }
    if (absenceAxisForRound != null) {
      nextStats = recordCrossingAbsenceAxisWin(nextStats, absenceAxisForRound);
      statsChanged = true;
    }

    statsChanged = true;

    flash = { resultNumber, won: true, tableId, kind: "win", ...crossingFlashSnapshot(activeForRound, history, tableId, nextMachine) };

    nextMachine = reanchorOnTable(
      {
        ...nextMachine,
        tablePlacarLosses: {},
        lastLostTableId: null,
        signalQueue: [],
        awaitingQueueTableId: null,
        awaitingQueueHead: null,
        awaitSwitchNoTable: false,
      },
      tableId,
      histories,
      0,
      minAbsenceSpins,
    );

  } else if (outcome === "L") {

    const recoveryBefore = nextMachine.recovery;
    const recovery = recoveryBefore + 1;
    const canRotateTables = tableIds.length > 1;

    if (patternKindForRound != null) {
      nextStats = recordCrossingPatternKindLoss(nextStats, patternKindForRound);
      statsChanged = true;
    }
    if (absenceAxisForRound != null) {
      nextStats = recordCrossingAbsenceAxisLoss(nextStats, absenceAxisForRound);
      statsChanged = true;
    }

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
      };

      nextMachine = beginCrossingPostResultHold(
        { ...nextMachine, recovery },
        tableId,
        histories,
        recovery,
        activeForRound,
        { reason: "loss" },
      );

    }

  } else {
    /** Empate (um factor certo): não conta derrota — mantém indicação até vitória. */
    nextMachine = beginCrossingPostResultHold(
      nextMachine,
      tableId,
      histories,
      nextMachine.recovery,
      activeForRound,
      {
        cycleSpinsWithoutWin: nextMachine.cycleSpinsWithoutWin + 1,
        reason: "draw",
      },
    );
  }



  return { nextMachine, stats: nextStats, statsChanged, flash };

}


