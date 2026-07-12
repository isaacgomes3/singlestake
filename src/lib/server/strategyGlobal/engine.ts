import { automationBlocksNewEntries } from "@/lib/back-office/automation-config";
import { getAutomationConfig, saveAutomationConfig } from "@/lib/server/automationSim/config";
import {
  applyCrossingAutoAbsenceRuntime,
} from "@/lib/server/automationSim/crossing-auto-absence";
import {
  applyCrossingOppositeAutoAbsenceRuntime,
} from "@/lib/server/automationSim/crossing-opposite-auto-absence";
import { refreshZoneFibonacciAutoAbsenceForHistories } from "@/lib/server/automationSim/zone-fibonacci-auto-absence";
import { readEffectiveFibonacciZoneAbsenceSpins } from "@/lib/roulette/fibonacciAbsencePrefs";
import { readEffectiveRepeticaoZoneAbsenceSpins } from "@/lib/roulette/repeticaoAbsencePrefs";
import {
  anyZoneFibonacciMachineInCycle,
  fibonacciMachineInCycle,
  repeticaoMachineInCycle,
} from "@/lib/roulette/zoneFibonacciFamily";
import {
  enabledFibonacciZoneKindsFromMap,
  enabledRepeticaoZoneKindsFromMap,
  isRotacaoGatilhoEnabled,
  isKto2fGatilhoEnabled,
  isTres3fatoresGatilhoEnabled,
} from "@/lib/roulette/umFatorTriggerEnable";
import { parseLiveTableIdFromCompositeGameId } from "@/lib/roulette/liveTableConfig";
import { resolveRotatingRoomTableIds } from "@/lib/roulette/lobbyTables";
import {
  ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  isRotatingRoomCrossingPrepareIndication,
  isRotatingRoomCrossingTableAnchored,
  sanitizeRotatingRoomCrossingMachineForTableIds,
  seedRotatingRoomCrossingMachineAfterPlacarReset,
  type RotatingRoomCrossingPlacarFlash,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import {
  UM_FATOR_MAX_RECOVERY,
  defaultUmFatorMachineState,
  sanitizeUmFatorMachineForTableIds,
  seedUmFatorMachineAfterPlacarReset,
  type UmFatorPlacarFlash,
} from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import {
  buildRotatingRoomCrossingSessionLiveView,
  tickRotatingRoomCrossingSessionPlacar,
  defaultRotatingRoomCrossingMachineState,
} from "@/lib/roulette/rotatingRoomCrossingSession";
import {
  buildRotatingRoomUmFatorSessionLiveView,
  tickRotatingRoomUmFatorSessionPlacar,
} from "@/lib/roulette/rotatingRoomUmFatorSession";
import {
  buildRotatingRoomFibonacciSessionLiveView,
  tickRotatingRoomFibonacciSessionPlacar,
} from "@/lib/roulette/rotatingRoomFibonacciSession";
import {
  ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  buildFibonacciActiveFromPick,
  consecutiveZoneAbsence,
  defaultRotatingRoomFibonacciMachineState,
  pickGlobalFibonacciPrepare,
  sanitizeRotatingRoomFibonacciMachineForTableIds,
  seedRotatingRoomFibonacciMachineAfterPlacarReset,
  tickRotatingRoomFibonacciPlacar,
  type RotatingRoomFibonacciPlacarFlash,
} from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import {
  buildRotatingRoomRepeticaoSessionLiveView,
  tickRotatingRoomRepeticaoSessionPlacar,
} from "@/lib/roulette/rotatingRoomRepeticaoSession";
import {
  ROTATING_ROOM_REPETICAO_MAX_RECOVERY,
  buildRepeticaoActiveFromZone,
  consecutiveNoRepeatStreak,
  defaultRotatingRoomRepeticaoMachineState,
  pickGlobalRepeticaoPrepare,
  sanitizeRotatingRoomRepeticaoMachineForTableIds,
  seedRotatingRoomRepeticaoMachineAfterPlacarReset,
  tickRotatingRoomRepeticaoPlacar,
  zoneFromHeadNumber,
  type RotatingRoomRepeticaoPlacarFlash,
} from "@/lib/roulette/rotatingRoomRepeticaoStrategy";
import {
  KTO2F_MAX_RECOVERY,
  KTO2F_TABLE_ID,
  kto2fActiveToCrossing,
  kto2fAlertLabel,
  kto2fCurrentRecovery,
  kto2fGlobalActive,
  kto2fHasOpenCycle,
  kto2fShowTapeteSignal,
  kto2fWatchLabel,
  seedKto2fMachineAfterPlacarReset,
  stakeForKto2fRecovery,
  tickKto2fPlacar,
  type Kto2fPlacarFlash,
} from "@/lib/roulette/rotatingRoomKto2fStrategy";
import {
  ICE3F_MAX_RECOVERY,
  ICE3F_TABLE_ID,
  ice3fActiveToCrossing,
  ice3fAlertLabel,
  ice3fBetDelayUntilMs,
  ice3fCurrentRecovery,
  ice3fCurrentUnitScale,
  ice3fGlobalActive,
  ice3fHasOpenCycle,
  ice3fShowTapeteSignal,
  ice3fWatchLabel,
  markIce3fRotatingBetPlaced,
  seedIce3fMachineAfterPlacarReset,
  stakeForIce3fAutomation,
  tickIce3fRotatingPlacar,
  type Ice3fPlacarFlash,
} from "@/lib/roulette/rotatingRoomIce3fStrategy";
import { ice3fEntryUnitsOf } from "@/lib/roulette/iceTresFatoresStrategy";
import { ice2fBetDelayUntilMs } from "@/lib/roulette/iceCruzamento2fStrategy";
import {
  ROTACAO_MAX_RECOVERY,
  defaultRotacaoMachineState,
  rotacaoActiveToCrossing,
  rotacaoGlobalActive,
  rotacaoShowTapeteSignal,
  tickRotacaoPlacar,
  type RotacaoPlacarFlash,
} from "@/lib/roulette/rotatingRoomRotacaoStrategy";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import { reconcileHistoryWithApiSnapshot } from "@/lib/roulette/historyReconcile";
import { STRATEGY_PLACAR_DRAIN_MAX_STEPS, drainPlacarSteps } from "@/lib/roulette/strategySessionDrive";
import { crossingMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomCrossingPlacarDrive";
import { umFatorMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomUmFatorPlacarDrive";
import { fibonacciMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomFibonacciPlacarDrive";
import { repeticaoMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomRepeticaoPlacarDrive";
import { umFatorToTapeteActive } from "@/lib/roulette/umFatorStrategy";
import {
  isRotatingRoomLobbyCooldownActive,
  isRotatingRoomPostResultHoldActive,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import type {
  StrategyGlobalCrossingClientView,
  StrategyGlobalFibonacciClientView,
  StrategyGlobalRepeticaoClientView,
  StrategyGlobalKto2fClientView,
  StrategyGlobalIce3fClientView,
  StrategyGlobalRotacaoClientView,
  StrategyGlobalKind,
  StrategyGlobalLedgerEntry,
  StrategyGlobalSnapshot,
  StrategyGlobalUmFatorClientView,
} from "@/lib/roulette/strategyGlobalTypes";
import type { ExtensionSyncPayload } from "@/lib/roulette/extensionSyncTypes";
import {
  applyExtensionMachineToState,
  getExtensionSourceStatus,
  isExtensionSourceActive,
  rememberExtensionSettlementKey,
  touchExtensionSource,
} from "@/lib/server/extensionSource";
import { broadcastStrategyGlobal } from "@/lib/server/strategyGlobal/broadcast";
import {
  appendLedger,
  appendTableSpin,
  emptyStrategyGlobalState,
  ensureStrategyGlobalStateShape,
  getStrategyGlobalState,
  historiesRecord,
  initStrategyGlobalState,
  rememberGameId,
  replaceStrategyGlobalState,
  schedulePersist,
  type StrategyGlobalPersistedState,
} from "@/lib/server/strategyGlobal/persistence";

import type { StrategyGlobalFlashPayload } from "@/lib/roulette/strategyGlobalTypes";

let initialized = false;

export async function ensureStrategyGlobalEngine(liveTableIds: readonly number[]): Promise<void> {
  if (initialized) return;
  const rotatingIds = resolveRotatingRoomTableIds(liveTableIds);
  await initStrategyGlobalState(rotatingIds);
  const state = getStrategyGlobalState();
  if (state.rotatingRoomTableIds.length === 0) {
    state.rotatingRoomTableIds = [...rotatingIds];
  }
  initialized = true;
}

function syncRotatingTableIds(state: StrategyGlobalPersistedState, liveTableIds: readonly number[]): void {
  const next = resolveRotatingRoomTableIds(liveTableIds);
  if (next.length === 0) return;
  state.rotatingRoomTableIds = next;
  state.dois2fatores.machine = sanitizeRotatingRoomCrossingMachineForTableIds(
    state.dois2fatores.machine,
    next,
  );
  state.um1fator.machine = sanitizeUmFatorMachineForTableIds(state.um1fator.machine, next);
  state.fibonacci.machine = sanitizeRotatingRoomFibonacciMachineForTableIds(
    state.fibonacci.machine,
    next,
  );
  state.repeticao.machine = sanitizeRotatingRoomRepeticaoMachineForTableIds(
    state.repeticao.machine,
    next,
  );
}

function appendCrossingLedgerIfNeeded(
  state: StrategyGlobalPersistedState,
  crossing: { flash: RotatingRoomCrossingPlacarFlash; recoveryBefore: number },
): StrategyGlobalLedgerEntry[] {
  if (
    !crossing.flash ||
    (crossing.flash.kind !== "win" &&
      crossing.flash.kind !== "loss" &&
      crossing.flash.kind !== "recovery")
  ) {
    return [];
  }
  const ledgerEntry = ledgerFromFlash(crossing.flash, crossing.recoveryBefore, "dois2fatores");
  appendLedger(state, "dois2fatores", ledgerEntry, ROTATING_ROOM_CROSSING_MAX_RECOVERY);
  return [ledgerEntry];
}

function appendRotacaoLedgerIfNeeded(
  state: StrategyGlobalPersistedState,
  rotacao: { flash: RotacaoPlacarFlash; recoveryBefore: number },
): StrategyGlobalLedgerEntry[] {
  if (automationBlocksNewEntries(getAutomationConfig(), 0)) {
    return [];
  }
  if (
    !rotacao.flash ||
    (rotacao.flash.kind !== "win" &&
      rotacao.flash.kind !== "loss" &&
      rotacao.flash.kind !== "recovery")
  ) {
    return [];
  }
  const ledgerEntry = ledgerFromFlash(rotacao.flash, rotacao.recoveryBefore, "rotacao");
  appendLedger(state, "rotacao", ledgerEntry, ROTACAO_MAX_RECOVERY);
  return [ledgerEntry];
}

function appendKto2fLedgerIfNeeded(
  state: StrategyGlobalPersistedState,
  kto2f: { flash: Kto2fPlacarFlash; recoveryBefore: number },
): StrategyGlobalLedgerEntry[] {
  if (automationBlocksNewEntries(getAutomationConfig(), 0)) {
    return [];
  }
  if (
    !kto2f.flash ||
    (kto2f.flash.kind !== "win" &&
      kto2f.flash.kind !== "loss" &&
      kto2f.flash.kind !== "recovery")
  ) {
    return [];
  }
  const ledgerEntry = ledgerFromFlash(
    kto2f.flash,
    kto2f.recoveryBefore,
    "kto2fcruzamento",
    stakeForKto2fRecovery(kto2f.recoveryBefore),
  );
  appendLedger(state, "kto2fcruzamento", ledgerEntry, KTO2F_MAX_RECOVERY);
  return [ledgerEntry];
}

function appendIce3fLedgerIfNeeded(
  state: StrategyGlobalPersistedState,
  ice3f: { flash: Ice3fPlacarFlash; recoveryBefore: number; entryUnits: number },
): StrategyGlobalLedgerEntry[] {
  if (automationBlocksNewEntries(getAutomationConfig(), 0)) {
    return [];
  }
  if (
    !ice3f.flash ||
    (ice3f.flash.kind !== "win" &&
      ice3f.flash.kind !== "loss" &&
      ice3f.flash.kind !== "recovery")
  ) {
    return [];
  }
  const unitScale =
    Math.max(1, Math.floor(ice3f.entryUnits)) * 2 ** Math.max(0, Math.floor(ice3f.recoveryBefore));
  const baseStake = getAutomationConfig().baseStake;
  const ledgerEntry = ledgerFromFlash(
    ice3f.flash,
    ice3f.recoveryBefore,
    "tres3fatores",
    stakeForIce3fAutomation(unitScale, baseStake),
  );
  appendLedger(state, "tres3fatores", ledgerEntry, ICE3F_MAX_RECOVERY);
  return [ledgerEntry];
}

function appendFibonacciLedgerIfNeeded(
  state: StrategyGlobalPersistedState,
  fibonacci: { flash: RotatingRoomFibonacciPlacarFlash; recoveryBefore: number },
): StrategyGlobalLedgerEntry[] {
  if (automationBlocksNewEntries(getAutomationConfig(), 0)) {
    return [];
  }
  if (
    !fibonacci.flash ||
    (fibonacci.flash.kind !== "win" &&
      fibonacci.flash.kind !== "loss" &&
      fibonacci.flash.kind !== "recovery")
  ) {
    return [];
  }
  const ledgerEntry = ledgerFromFlash(fibonacci.flash, fibonacci.recoveryBefore, "fibonacci");
  appendLedger(state, "fibonacci", ledgerEntry, ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
  return [ledgerEntry];
}

function ledgerFromFlash(
  flash: NonNullable<
    RotatingRoomCrossingPlacarFlash | UmFatorPlacarFlash | RotatingRoomFibonacciPlacarFlash
  >,
  recovery: number,
  strategy: StrategyGlobalKind,
  stake?: number,
): StrategyGlobalLedgerEntry {
  return {
    ts: Date.now(),
    tableId: flash.tableId,
    won: flash.won,
    recovery,
    kind: flash.kind,
    strategy,
    resultNumber: flash.resultNumber,
    factor1: "factor1" in flash ? flash.factor1 : undefined,
    factor2: "factor2" in flash ? flash.factor2 : undefined,
    triggerNumbers: "triggerNumbers" in flash ? flash.triggerNumbers : undefined,
    bucketGap: "bucketGap" in flash ? flash.bucketGap : undefined,
    zoneLabel: "zoneLabel" in flash ? flash.zoneLabel : undefined,
    ...(typeof stake === "number" && stake > 0 && Number.isFinite(stake) ? { stake } : {}),
  };
}

function refreshCrossingAutoAbsenceForHistories(
  histories: Record<number, readonly number[]>,
): void {
  const config = getAutomationConfig();
  if (config.crossingCorAlturaAbsenceAuto || config.crossingAlturaParidadeAbsenceAuto) {
    applyCrossingAutoAbsenceRuntime(config, histories);
  }
  applyCrossingOppositeAutoAbsenceRuntime(config, histories);
}

function driveCrossing(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): { flash: RotatingRoomCrossingPlacarFlash; recoveryBefore: number } {
  refreshCrossingAutoAbsenceForHistories(histories);
  const tableIds = state.rotatingRoomTableIds;
  const recoveryBefore = state.dois2fatores.machine.recovery;
  const result = drainPlacarSteps(
    state.dois2fatores.machine,
    state.dois2fatores.stats,
    (machine, stats) =>
      tickRotatingRoomCrossingSessionPlacar(tableIds, histories, machine, stats),
    crossingMachinePlacarStepProgressed,
  );
  state.dois2fatores.machine = sanitizeRotatingRoomCrossingMachineForTableIds(
    result.nextMachine,
    tableIds,
  );
  state.dois2fatores.stats = result.stats;
  return { flash: result.flash, recoveryBefore };
}

function driveUmFator(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): {
  flash: UmFatorPlacarFlash;
  recoveryBefore: number;
  settlements: Array<{ flash: NonNullable<UmFatorPlacarFlash>; recoveryBefore: number }>;
} {
  const tableIds = state.rotatingRoomTableIds;
  let machine = state.um1fator.machine;
  let stats = state.um1fator.stats;
  const settlements: Array<{ flash: NonNullable<UmFatorPlacarFlash>; recoveryBefore: number }> = [];

  for (let i = 0; i < STRATEGY_PLACAR_DRAIN_MAX_STEPS; i++) {
    const recoveryBefore = machine.recovery;
    const before = machine;
    const step = tickRotatingRoomUmFatorSessionPlacar(tableIds, histories, machine, stats);
    machine = sanitizeUmFatorMachineForTableIds(step.nextMachine, tableIds);
    stats = step.stats;
    if (
      step.flash &&
      (step.flash.kind === "win" || step.flash.kind === "loss" || step.flash.kind === "recovery")
    ) {
      settlements.push({ flash: step.flash, recoveryBefore });
    }
    if (!umFatorMachinePlacarStepProgressed(before, machine, step)) break;
  }

  state.um1fator.machine = machine;
  state.um1fator.stats = stats;

  const last = settlements.at(-1);
  return {
    flash: last?.flash ?? null,
    recoveryBefore: last?.recoveryBefore ?? state.um1fator.machine.recovery,
    settlements,
  };
}

function driveFibonacci(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): { flash: RotatingRoomFibonacciPlacarFlash; recoveryBefore: number } {
  refreshZoneFibonacciAutoAbsenceForHistories(histories);
  const tableIds = state.rotatingRoomTableIds;
  const recoveryBefore = state.fibonacci.machine.recovery;
  const config = getAutomationConfig();
  const fibonacciTriggerOn = enabledFibonacciZoneKindsFromMap(config.enabledTriggers).length > 0;
  const enabledZoneKinds = enabledFibonacciZoneKindsFromMap(config.enabledTriggers);
  const allowNewArming =
    fibonacciTriggerOn &&
    !automationBlocksNewEntries(getAutomationConfig(), 0) &&
    !repeticaoMachineInCycle(state.repeticao.machine);
  const absenceByKind = readEffectiveFibonacciZoneAbsenceSpins();
  const result = drainPlacarSteps(
    state.fibonacci.machine,
    state.fibonacci.stats,
    (machine, stats) =>
      tickRotatingRoomFibonacciPlacar(
        tableIds,
        histories,
        machine,
        stats,
        ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
        allowNewArming,
        absenceByKind,
        enabledZoneKinds,
      ),
    fibonacciMachinePlacarStepProgressed,
  );
  state.fibonacci.machine = sanitizeRotatingRoomFibonacciMachineForTableIds(
    result.nextMachine,
    tableIds,
  );
  state.fibonacci.stats = result.stats;
  return { flash: result.flash, recoveryBefore };
}

function appendRepeticaoLedgerIfNeeded(
  state: StrategyGlobalPersistedState,
  repeticao: { flash: RotatingRoomRepeticaoPlacarFlash; recoveryBefore: number },
): StrategyGlobalLedgerEntry[] {
  if (automationBlocksNewEntries(getAutomationConfig(), 0)) {
    return [];
  }
  if (
    !repeticao.flash ||
    (repeticao.flash.kind !== "win" &&
      repeticao.flash.kind !== "loss" &&
      repeticao.flash.kind !== "recovery")
  ) {
    return [];
  }
  const ledgerEntry = ledgerFromFlash(repeticao.flash, repeticao.recoveryBefore, "repeticao");
  appendLedger(state, "repeticao", ledgerEntry, ROTATING_ROOM_REPETICAO_MAX_RECOVERY);
  return [ledgerEntry];
}

function driveRepeticao(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): { flash: RotatingRoomRepeticaoPlacarFlash; recoveryBefore: number } {
  refreshZoneFibonacciAutoAbsenceForHistories(histories);
  const tableIds = state.rotatingRoomTableIds;
  const recoveryBefore = state.repeticao.machine.recovery;
  const config = getAutomationConfig();
  const repeticaoTriggerOn = enabledRepeticaoZoneKindsFromMap(config.enabledTriggers).length > 0;
  const enabledZoneKinds = enabledRepeticaoZoneKindsFromMap(config.enabledTriggers);
  const allowNewArming =
    repeticaoTriggerOn &&
    !automationBlocksNewEntries(getAutomationConfig(), 0) &&
    !fibonacciMachineInCycle(state.fibonacci.machine);
  const absenceByKind = readEffectiveRepeticaoZoneAbsenceSpins();
  const result = drainPlacarSteps(
    state.repeticao.machine,
    state.repeticao.stats,
    (machine, stats) =>
      tickRotatingRoomRepeticaoPlacar(
        tableIds,
        histories,
        machine,
        stats,
        ROTATING_ROOM_REPETICAO_MAX_RECOVERY,
        allowNewArming,
        absenceByKind,
        enabledZoneKinds,
      ),
    repeticaoMachinePlacarStepProgressed,
  );
  state.repeticao.machine = sanitizeRotatingRoomRepeticaoMachineForTableIds(
    result.nextMachine,
    tableIds,
  );
  state.repeticao.stats = result.stats;
  return { flash: result.flash, recoveryBefore };
}

function driveRotacao(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): { flash: RotacaoPlacarFlash; recoveryBefore: number } {
  const recoveryBefore = state.rotacao.machine.recovery;
  const rotacaoTriggerOn = isRotacaoGatilhoEnabled();
  const allowNewArming =
    rotacaoTriggerOn && !automationBlocksNewEntries(getAutomationConfig(), 0);
  const result = tickRotacaoPlacar(
    histories,
    state.rotacao.machine,
    state.rotacao.stats,
    ROTACAO_MAX_RECOVERY,
    allowNewArming,
  );
  state.rotacao.machine = result.nextMachine;
  state.rotacao.stats = result.stats;
  return { flash: result.flash, recoveryBefore };
}

function driveKto2f(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
  spinTableId?: number,
): { flash: Kto2fPlacarFlash; recoveryBefore: number } {
  const recoveryBefore = kto2fCurrentRecovery(state.kto2fcruzamento.machine);
  const kto2fTriggerOn = isKto2fGatilhoEnabled();
  const allowNewArming =
    kto2fTriggerOn && !automationBlocksNewEntries(getAutomationConfig(), 0);
  const result = tickKto2fPlacar(
    histories,
    state.kto2fcruzamento.machine,
    state.kto2fcruzamento.stats,
    KTO2F_MAX_RECOVERY,
    allowNewArming,
    spinTableId,
  );
  state.kto2fcruzamento.machine = result.nextMachine;
  state.kto2fcruzamento.stats = result.stats;
  return { flash: result.flash, recoveryBefore };
}

function driveIce3f(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
  spinTableId?: number,
): { flash: Ice3fPlacarFlash; recoveryBefore: number; entryUnits: number } {
  const recoveryBefore = ice3fCurrentRecovery(state.tres3fatores.machine);
  const entryUnits = ice3fEntryUnitsOf(state.tres3fatores.machine);
  const ice3fTriggerOn = isTres3fatoresGatilhoEnabled();
  const allowNewArming =
    ice3fTriggerOn && !automationBlocksNewEntries(getAutomationConfig(), 0);
  const result = tickIce3fRotatingPlacar(
    histories,
    state.tres3fatores.machine,
    state.tres3fatores.stats,
    ICE3F_MAX_RECOVERY,
    allowNewArming,
    spinTableId,
  );
  state.tres3fatores.machine = result.nextMachine;
  state.tres3fatores.stats = result.stats;
  return { flash: result.flash, recoveryBefore, entryUnits };
}

async function pushAutomationSimSettlements(
  entries: readonly StrategyGlobalLedgerEntry[],
  snapshot: StrategyGlobalSnapshot,
): Promise<void> {
  const m = await import("@/lib/server/automationSim/engine");
  await m.ensureAutomationSimEngine();
  for (const entry of entries) {
    await m.ingestAutomationSimLedgerEntry(entry, snapshot, { publish: false });
  }
  await m.syncAutomationSimWithStrategy(snapshot);
}

function buildCrossingClientView(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): StrategyGlobalCrossingClientView {
  const tableIds = state.rotatingRoomTableIds;
  const machine = sanitizeRotatingRoomCrossingMachineForTableIds(state.dois2fatores.machine, tableIds);
  const liveView = buildRotatingRoomCrossingSessionLiveView(tableIds, histories, machine);
  const allowed = new Set(tableIds);
  const activeCrossing = machine.cycleActive;
  const postResultHoldUntilMs = machine.postResultHoldUntilMs;
  const postResultHoldTableId = machine.postResultHoldTableId;
  const postResultHoldActive = isRotatingRoomPostResultHoldActive(postResultHoldUntilMs);
  const showTapeteSignalRaw = activeCrossing != null;
  const cycleTableId =
    machine.cycleTableId != null && allowed.has(machine.cycleTableId) ? machine.cycleTableId : null;
  const showTapeteSignal = showTapeteSignalRaw && cycleTableId != null;
  const currentTableId = showTapeteSignal
    ? cycleTableId
    : postResultHoldActive &&
        postResultHoldTableId != null &&
        allowed.has(postResultHoldTableId)
      ? postResultHoldTableId
      : cycleTableId;
  const prepareTableIdRaw =
    machine.prepareTableId != null && allowed.has(machine.prepareTableId)
      ? machine.prepareTableId
      : null;
  const tableAnchored = isRotatingRoomCrossingTableAnchored(machine);
  const prepareTableId = isRotatingRoomCrossingPrepareIndication({
    showTapeteSignal: showTapeteSignal && currentTableId != null,
    postResultHoldActive,
    prepareTableId: prepareTableIdRaw,
    prepareCategory: liveView.preparePick?.category ?? null,
    sessionMode: liveView.mode,
    tableAnchored,
  })
    ? prepareTableIdRaw
    : null;
  return {
    phase: showTapeteSignal && currentTableId != null ? "active" : "waiting",
    sessionStats: state.dois2fatores.stats,
    showTapeteSignal: showTapeteSignal && currentTableId != null,
    currentRecovery: machine.recovery,
    currentTableId,
    prepareTableId,
    alertCategory: liveView.globalPick?.category ?? null,
    alertBucketGap: liveView.globalPick?.bucketGap ?? 0,
    sessionMode: liveView.mode,
    prepareCategory: liveView.preparePick?.category ?? null,
    crossingScan: liveView.crossingScan,
    activeCrossing:
      currentTableId != null && activeCrossing != null ? activeCrossing : null,
    tableAnchored: isRotatingRoomCrossingTableAnchored(machine),
    cycleSpinsWithoutWin: machine.cycleSpinsWithoutWin,
    cycleSeq: machine.cycleSeq ?? 0,
    cycleFingerprint: machine.cycleFingerprint,
    postResultHoldUntilMs: machine.postResultHoldUntilMs,
    postResultHoldTableId: machine.postResultHoldTableId,
    postResultHoldReason: machine.postResultHoldReason ?? null,
    cycleOppositeAbsence: machine.cycleOppositeAbsence === true,
    armedAtHead: machine.armedAtHead,
    crossingObservationConfirmed: machine.crossingObservationConfirmed === true,
  };
}

function buildUmFatorClientView(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): StrategyGlobalUmFatorClientView {
  const tableIds = state.rotatingRoomTableIds;
  const machine = sanitizeUmFatorMachineForTableIds(state.um1fator.machine, tableIds);
  const liveView = buildRotatingRoomUmFatorSessionLiveView(tableIds, histories, machine);
  const umActive = liveView.globalActive;
  const currentTableId = liveView.globalTableId;
  const lobbyCooldownUntilMs = machine.lobbyCooldownUntilMs;
  const postResultHoldUntilMs = machine.postResultHoldUntilMs;
  const postResultHoldTableId = machine.postResultHoldTableId;
  const lobbyCooldownActive = isRotatingRoomLobbyCooldownActive(lobbyCooldownUntilMs);
  const postResultHoldActive = isRotatingRoomPostResultHoldActive(postResultHoldUntilMs);
  const showTapeteSignalRaw = umActive != null && currentTableId != null;
  const showTapeteSignal =
    showTapeteSignalRaw && !lobbyCooldownActive && !postResultHoldActive;
  const activeCrossing =
    showTapeteSignal && umActive ? umFatorToTapeteActive(umActive) : null;
  return {
    phase: showTapeteSignal ? "active" : "waiting",
    sessionStats: state.um1fator.stats,
    showTapeteSignal,
    singleFactorMode: true,
    currentRecovery: machine.recovery,
    currentTableId: showTapeteSignal
      ? currentTableId
      : postResultHoldActive && postResultHoldTableId != null
        ? postResultHoldTableId
        : null,
    alertCategory: umActive?.armingDescription ?? null,
    alertBucketGap: 0,
    sessionMode: showTapeteSignal ? "active" : "scanning",
    umFatorScan: liveView.tableScan,
    activeCrossing,
    umActive: showTapeteSignal ? umActive : null,
    lobbyCooldownUntilMs,
    postResultHoldUntilMs,
    postResultHoldTableId,
  };
}

function buildFibonacciClientView(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): StrategyGlobalFibonacciClientView {
  const tableIds = state.rotatingRoomTableIds;
  const machine = sanitizeRotatingRoomFibonacciMachineForTableIds(state.fibonacci.machine, tableIds);
  const zoneFamilyBusy = anyZoneFibonacciMachineInCycle(state.fibonacci.machine, state.repeticao.machine);
  const liveView = buildRotatingRoomFibonacciSessionLiveView(tableIds, histories, machine, {
    suppressNewAlerts: zoneFamilyBusy,
  });
  const allowed = new Set(tableIds);
  const activeFibonacci =
    machine.cycleZone && machine.cycleTableId != null
      ? buildFibonacciActiveFromPick(
          {
            tableId: machine.cycleTableId,
            zone: machine.cycleZone,
            absenceGap: consecutiveZoneAbsence(
              histories[machine.cycleTableId] ?? [],
              machine.cycleZone,
            ),
          },
          machine.recovery,
        )
      : null;
  const currentTableId =
    machine.cycleTableId != null && allowed.has(machine.cycleTableId) ? machine.cycleTableId : null;
  const showTapeteSignal = activeFibonacci != null && currentTableId != null;
  const absenceByKind = readEffectiveFibonacciZoneAbsenceSpins();
  const enabledZoneKinds = enabledFibonacciZoneKindsFromMap(getAutomationConfig().enabledTriggers);
  const livePreparePick =
    !showTapeteSignal && machine.recovery === 0 && !zoneFamilyBusy
      ? pickGlobalFibonacciPrepare(
          tableIds,
          histories,
          undefined,
          absenceByKind,
          enabledZoneKinds,
        )
      : null;
  const machinePreparePick =
    machine.prepareTableId != null && machine.prepareZone && allowed.has(machine.prepareTableId)
      ? {
          tableId: machine.prepareTableId,
          zone: machine.prepareZone,
          absenceGap: consecutiveZoneAbsence(
            histories[machine.prepareTableId] ?? [],
            machine.prepareZone,
          ),
        }
      : null;
  const preparePick = machinePreparePick ?? livePreparePick;
  const prepareTableId = preparePick?.tableId ?? null;
  const sessionMode = showTapeteSignal ? "active" : prepareTableId != null ? "prepare" : "scanning";
  const alertCategory = activeFibonacci
    ? activeFibonacci.zone.kind === "dozen"
      ? `Dúzia ${activeFibonacci.zone.id}`
      : `Coluna ${activeFibonacci.zone.id}`
    : preparePick
      ? preparePick.zone.kind === "dozen"
        ? `Dúzia ${preparePick.zone.id}`
        : `Coluna ${preparePick.zone.id}`
      : null;
  return {
    phase: showTapeteSignal ? "active" : "waiting",
    sessionStats: state.fibonacci.stats,
    showTapeteSignal,
    fibonacciMode: true,
    currentRecovery: machine.recovery,
    cycleSeq: machine.cycleSeq ?? 0,
    currentTableId: showTapeteSignal ? currentTableId : null,
    prepareTableId,
    alertCategory,
    alertBucketGap:
      activeFibonacci?.absenceGap ?? preparePick?.absenceGap ?? 0,
    sessionMode,
    prepareCategory: preparePick
      ? preparePick.zone.kind === "dozen"
        ? `Dúzia ${preparePick.zone.id}`
        : `Coluna ${preparePick.zone.id}`
      : null,
    fibonacciScan: liveView.fibonacciScan,
    activeFibonacci: showTapeteSignal ? activeFibonacci : null,
  };
}

function buildRepeticaoClientView(
  state: StrategyGlobalPersistedState,
  histories: Record<number, readonly number[]>,
): StrategyGlobalRepeticaoClientView {
  const tableIds = state.rotatingRoomTableIds;
  const machine = sanitizeRotatingRoomRepeticaoMachineForTableIds(state.repeticao.machine, tableIds);
  const zoneFamilyBusy = anyZoneFibonacciMachineInCycle(state.fibonacci.machine, state.repeticao.machine);
  const liveView = buildRotatingRoomRepeticaoSessionLiveView(tableIds, histories, machine, {
    suppressNewAlerts: zoneFamilyBusy,
  });
  const allowed = new Set(tableIds);
  const activeRepeticao =
    machine.cycleZone && machine.cycleTableId != null
      ? buildRepeticaoActiveFromZone(
          machine.cycleTableId,
          machine.cycleZone,
          consecutiveNoRepeatStreak(
            histories[machine.cycleTableId] ?? [],
            machine.cycleZone.kind,
          ),
          machine.recovery,
        )
      : null;
  const currentTableId =
    machine.cycleTableId != null && allowed.has(machine.cycleTableId) ? machine.cycleTableId : null;
  const showTapeteSignal = activeRepeticao != null && currentTableId != null;
  const absenceByKind = readEffectiveRepeticaoZoneAbsenceSpins();
  const enabledZoneKinds = enabledRepeticaoZoneKindsFromMap(getAutomationConfig().enabledTriggers);
  const livePreparePick =
    !showTapeteSignal && machine.recovery === 0 && !zoneFamilyBusy
      ? pickGlobalRepeticaoPrepare(
          tableIds,
          histories,
          undefined,
          absenceByKind,
          enabledZoneKinds,
        )
      : null;
  const machinePreparePick =
    machine.prepareTableId != null &&
    machine.prepareZoneKind &&
    allowed.has(machine.prepareTableId)
      ? {
          tableId: machine.prepareTableId,
          zoneKind: machine.prepareZoneKind,
          streakGap: consecutiveNoRepeatStreak(
            histories[machine.prepareTableId] ?? [],
            machine.prepareZoneKind,
          ),
        }
      : null;
  const preparePick = machinePreparePick ?? livePreparePick;
  const prepareTableId = preparePick?.tableId ?? null;
  const sessionMode = showTapeteSignal ? "active" : prepareTableId != null ? "prepare" : "scanning";
  const prepareZone =
    prepareTableId != null && preparePick
      ? zoneFromHeadNumber(histories[prepareTableId] ?? [], preparePick.zoneKind)
      : null;
  const alertCategory = activeRepeticao
    ? activeRepeticao.zone.kind === "dozen"
      ? `Dúzia ${activeRepeticao.zone.id}`
      : `Coluna ${activeRepeticao.zone.id}`
    : prepareZone
      ? prepareZone.kind === "dozen"
        ? `Dúzia ${prepareZone.id}`
        : `Coluna ${prepareZone.id}`
      : preparePick
        ? preparePick.zoneKind === "dozen"
          ? "Dúzia"
          : "Coluna"
        : null;
  return {
    phase: showTapeteSignal ? "active" : "waiting",
    sessionStats: state.repeticao.stats,
    showTapeteSignal,
    repeticaoMode: true,
    currentRecovery: machine.recovery,
    cycleSeq: machine.cycleSeq ?? 0,
    currentTableId: showTapeteSignal ? currentTableId : null,
    prepareTableId,
    alertCategory,
    alertBucketGap: activeRepeticao?.streakGap ?? preparePick?.streakGap ?? 0,
    sessionMode,
    prepareCategory: prepareZone
      ? prepareZone.kind === "dozen"
        ? `Dúzia ${prepareZone.id}`
        : `Coluna ${prepareZone.id}`
      : preparePick
        ? preparePick.zoneKind === "dozen"
          ? "Dúzia"
          : "Coluna"
        : null,
    repeticaoScan: liveView.repeticaoScan,
    activeRepeticao: showTapeteSignal ? activeRepeticao : null,
  };
}

function buildRotacaoClientView(
  state: StrategyGlobalPersistedState,
): StrategyGlobalRotacaoClientView {
  const machine = state.rotacao.machine;
  const rotacaoActive = rotacaoGlobalActive(machine);
  const showTapeteSignal = rotacaoShowTapeteSignal(machine);
  const activeCrossing = rotacaoActive ? rotacaoActiveToCrossing(rotacaoActive) : null;
  return {
    phase: showTapeteSignal ? "active" : "waiting",
    sessionStats: state.rotacao.stats,
    showTapeteSignal,
    rotacaoMode: true,
    currentRecovery: machine.recovery,
    cycleSeq: machine.cycleSeq,
    currentTableId: showTapeteSignal ? rotacaoActive?.tableId ?? null : null,
    currentDimension: machine.pendingDimension,
    alertCategory: rotacaoActive
      ? `${rotacaoActive.dimension} · ${rotacaoActive.alertLabel}`
      : null,
    sessionMode: showTapeteSignal ? "active" : "scanning",
    activeCrossing,
    rotacaoActive,
  };
}

function buildKto2fClientView(state: StrategyGlobalPersistedState): StrategyGlobalKto2fClientView {
  const machine = state.kto2fcruzamento.machine;
  const kto2fActive = kto2fGlobalActive(machine);
  const showTapeteSignal = kto2fShowTapeteSignal(machine);
  const hasOpenCycle = kto2fHasOpenCycle(machine);
  const activeCrossing = kto2fActive ? kto2fActiveToCrossing(kto2fActive) : null;
  const recovery = kto2fCurrentRecovery(machine);
  return {
    phase: showTapeteSignal ? "active" : hasOpenCycle ? "waiting" : "waiting",
    sessionStats: state.kto2fcruzamento.stats,
    showTapeteSignal,
    kto2fMode: true,
    currentRecovery: recovery,
    currentTableId: hasOpenCycle ? KTO2F_TABLE_ID : null,
    alertCategory: kto2fActive ? kto2fAlertLabel(kto2fActive) : null,
    sessionMode: showTapeteSignal ? "active" : hasOpenCycle ? "waiting" : "scanning",
    hasOpenCycle,
    watchLabel: hasOpenCycle ? null : kto2fWatchLabel(machine),
    activeCrossing,
    kto2fActive,
    lastSpinAtMs: machine.lastSpinAtMs,
    betDelayUntilMs: ice2fBetDelayUntilMs(recovery, machine.lastSpinAtMs),
  };
}

function buildIce3fClientView(state: StrategyGlobalPersistedState): StrategyGlobalIce3fClientView {
  const machine = state.tres3fatores.machine;
  const ice3fActive = ice3fGlobalActive(machine);
  const showTapeteSignal = ice3fShowTapeteSignal(machine);
  const hasOpenCycle = ice3fHasOpenCycle(machine);
  const activeCrossing = ice3fActive ? ice3fActiveToCrossing(ice3fActive) : null;
  const recovery = ice3fCurrentRecovery(machine);
  return {
    phase: showTapeteSignal ? "active" : hasOpenCycle ? "waiting" : "waiting",
    sessionStats: state.tres3fatores.stats,
    showTapeteSignal,
    ice3fMode: true,
    currentRecovery: recovery,
    currentUnitScale: ice3fCurrentUnitScale(machine),
    currentTableId: hasOpenCycle ? ICE3F_TABLE_ID : null,
    alertCategory: ice3fActive ? ice3fAlertLabel(ice3fActive) : null,
    sessionMode: showTapeteSignal ? "active" : hasOpenCycle ? "waiting" : "scanning",
    hasOpenCycle,
    watchLabel: hasOpenCycle ? null : ice3fWatchLabel(machine),
    activeCrossing,
    ice3fActive,
    lastSpinAtMs: machine.lastSpinAtMs,
    betDelayUntilMs: ice3fBetDelayUntilMs(machine),
  };
}

export function buildStrategyGlobalSnapshot(state: StrategyGlobalPersistedState): StrategyGlobalSnapshot {
  state = ensureStrategyGlobalStateShape(state);
  const histories = historiesRecord(state);
  const tableHistories: Record<number, number[]> = {};
  for (const [id, list] of Object.entries(histories)) {
    tableHistories[Number(id)] = [...list];
  }
  const extensionSource = getExtensionSourceStatus();
  const config = getAutomationConfig();
  return {
    revision: state.revision,
    updatedAt: state.updatedAt,
    rotatingRoomTableIds: [...state.rotatingRoomTableIds],
    tableHistories,
    dois2fatores: buildCrossingClientView(state, histories),
    um1fator: buildUmFatorClientView(state, histories),
    fibonacci: buildFibonacciClientView(state, histories),
    repeticao: buildRepeticaoClientView(state, histories),
    rotacao: buildRotacaoClientView(state),
    kto2fcruzamento: buildKto2fClientView(state),
    tres3fatores: buildIce3fClientView(state),
    lifetime: state.lifetime,
    ledgerTail: {
      dois2fatores: state.ledger.dois2fatores.slice(-120),
      um1fator: state.ledger.um1fator.slice(-120),
      fibonacci: state.ledger.fibonacci.slice(-120),
      repeticao: state.ledger.repeticao.slice(-120),
      rotacao: state.ledger.rotacao.slice(-120),
      kto2fcruzamento: state.ledger.kto2fcruzamento.slice(-120),
      tres3fatores: state.ledger.tres3fatores.slice(-120),
    },
    extensionSource: {
      active: extensionSource.active,
      lastSyncAt: extensionSource.lastSyncAt,
      autopilotRunning: extensionSource.autopilotRunning,
    },
    fibonacciPrefs: {
      enabled: enabledFibonacciZoneKindsFromMap(config.enabledTriggers).length > 0,
      absenceSpins: config.fibonacciDozenAbsenceSpins,
      dozenAbsenceSpins: config.fibonacciDozenAbsenceSpins,
      columnAbsenceSpins: config.fibonacciColumnAbsenceSpins,
      dozenEnabled:
        config.enabledTriggers.fibonacci !== false &&
        config.enabledTriggers.fibonacciDozen !== false,
      columnEnabled:
        config.enabledTriggers.fibonacci !== false &&
        config.enabledTriggers.fibonacciColumn !== false,
    },
    repeticaoPrefs: {
      enabled: enabledRepeticaoZoneKindsFromMap(config.enabledTriggers).length > 0,
      absenceSpins: config.repeticaoDozenAbsenceSpins,
      dozenAbsenceSpins: config.repeticaoDozenAbsenceSpins,
      columnAbsenceSpins: config.repeticaoColumnAbsenceSpins,
      dozenEnabled:
        config.enabledTriggers.repeticao !== false &&
        config.enabledTriggers.repeticaoDozen !== false,
      columnEnabled:
        config.enabledTriggers.repeticao !== false &&
        config.enabledTriggers.repeticaoColumn !== false,
    },
  };
}

function toFlashPayload(
  crossing: RotatingRoomCrossingPlacarFlash,
  um: UmFatorPlacarFlash,
  fibonacci: RotatingRoomFibonacciPlacarFlash = null,
  repeticao: RotatingRoomRepeticaoPlacarFlash = null,
  rotacao: RotacaoPlacarFlash = null,
  kto2f: Kto2fPlacarFlash = null,
  ice3f: Ice3fPlacarFlash = null,
): StrategyGlobalFlashPayload {
  return {
    dois2fatores: crossing
      ? {
          resultNumber: crossing.resultNumber,
          won: crossing.won,
          tableId: crossing.tableId,
          kind: crossing.kind,
        }
      : null,
    um1fator: um
      ? {
          resultNumber: um.resultNumber,
          won: um.won,
          tableId: um.tableId,
          kind: um.kind,
        }
      : null,
    fibonacci: fibonacci
      ? {
          resultNumber: fibonacci.resultNumber,
          won: fibonacci.won,
          tableId: fibonacci.tableId,
          kind: fibonacci.kind,
        }
      : null,
    repeticao: repeticao
      ? {
          resultNumber: repeticao.resultNumber,
          won: repeticao.won,
          tableId: repeticao.tableId,
          kind: repeticao.kind,
        }
      : null,
    rotacao: rotacao
      ? {
          resultNumber: rotacao.resultNumber,
          won: rotacao.won,
          tableId: rotacao.tableId,
          kind: rotacao.kind,
        }
      : null,
    kto2fcruzamento: kto2f
      ? {
          resultNumber: kto2f.resultNumber,
          won: kto2f.won,
          tableId: kto2f.tableId,
          kind: kto2f.kind,
        }
      : null,
    tres3fatores: ice3f
      ? {
          resultNumber: ice3f.resultNumber,
          won: ice3f.won,
          tableId: ice3f.tableId,
          kind: ice3f.kind,
        }
      : null,
  };
}

function bumpAndBroadcast(
  state: StrategyGlobalPersistedState,
  crossingFlash: RotatingRoomCrossingPlacarFlash,
  umFlash: UmFatorPlacarFlash,
  fibonacciFlash: RotatingRoomFibonacciPlacarFlash = null,
  repeticaoFlash: RotatingRoomRepeticaoPlacarFlash = null,
  rotacaoFlash: RotacaoPlacarFlash = null,
  kto2fFlash: Kto2fPlacarFlash = null,
  ice3fFlash: Ice3fPlacarFlash = null,
): StrategyGlobalSnapshot {
  state.revision += 1;
  state.updatedAt = Date.now();
  schedulePersist(state);
  const snapshot = buildStrategyGlobalSnapshot(state);
  const flashes = toFlashPayload(
    crossingFlash,
    umFlash,
    fibonacciFlash,
    repeticaoFlash,
    rotacaoFlash,
    kto2fFlash,
    ice3fFlash,
  );
  broadcastStrategyGlobal({ type: "update", revision: snapshot.revision, snapshot, flashes });
  void import("@/lib/server/automationSim/engine").then((m) => {
    void m.ensureAutomationSimEngine().then(() => {
      void m.syncAutomationSimWithStrategy(snapshot);
    });
  });
  return snapshot;
}

export function ingestStrategyGlobalSpin(
  spin: RouletteSpin,
  liveTableIds: readonly number[],
): StrategyGlobalSnapshot | null {
  if (!initialized) return null;
  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, liveTableIds);

  const tableId = parseLiveTableIdFromCompositeGameId(spin.gameId);
  if (tableId == null) return null;
  if (!rememberGameId(state, spin.gameId)) return null;

  appendTableSpin(state, tableId, spin.number);
  const histories = historiesRecord(state);

  const extensionActive = isExtensionSourceActive();
  const crossing = driveCrossing(state, histories);
  const crossingLedgerEntries = appendCrossingLedgerIfNeeded(state, crossing);
  const fibonacci = driveFibonacci(state, histories);
  const fibonacciLedgerEntries = appendFibonacciLedgerIfNeeded(state, fibonacci);
  const repeticao = driveRepeticao(state, histories);
  const repeticaoLedgerEntries = appendRepeticaoLedgerIfNeeded(state, repeticao);
  const rotacao = driveRotacao(state, histories);
  const rotacaoLedgerEntries = appendRotacaoLedgerIfNeeded(state, rotacao);
  const kto2f = driveKto2f(state, histories, tableId);
  const kto2fLedgerEntries = appendKto2fLedgerIfNeeded(state, kto2f);
  const ice3f = driveIce3f(state, histories, tableId);
  const ice3fLedgerEntries = appendIce3fLedgerIfNeeded(state, ice3f);

  if (extensionActive) {
    const snapshot = bumpAndBroadcast(
      state,
      crossing.flash,
      null,
      fibonacci.flash,
      repeticao.flash,
      rotacao.flash,
      kto2f.flash,
      ice3f.flash,
    );
    const automationEntries = [
      ...crossingLedgerEntries,
      ...fibonacciLedgerEntries,
      ...repeticaoLedgerEntries,
      ...rotacaoLedgerEntries,
      ...kto2fLedgerEntries,
      ...ice3fLedgerEntries,
    ];
    if (automationEntries.length > 0) {
      void pushAutomationSimSettlements(automationEntries, snapshot);
    }
    return snapshot;
  }

  const um = driveUmFator(state, histories);
  const umLedgerEntries: StrategyGlobalLedgerEntry[] = [];
  for (const settlement of um.settlements) {
    const ledgerEntry = ledgerFromFlash(settlement.flash, settlement.recoveryBefore, "um1fator");
    appendLedger(state, "um1fator", ledgerEntry, UM_FATOR_MAX_RECOVERY);
    umLedgerEntries.push(ledgerEntry);
  }

  const snapshot = bumpAndBroadcast(
    state,
    crossing.flash,
    um.flash,
    fibonacci.flash,
    repeticao.flash,
    rotacao.flash,
    kto2f.flash,
    ice3f.flash,
  );
  const automationEntries = [
    ...crossingLedgerEntries,
    ...umLedgerEntries,
    ...fibonacciLedgerEntries,
    ...repeticaoLedgerEntries,
    ...rotacaoLedgerEntries,
    ...kto2fLedgerEntries,
    ...ice3fLedgerEntries,
  ];
  if (automationEntries.length > 0) {
    void pushAutomationSimSettlements(automationEntries, snapshot);
  }
  return snapshot;
}

/** Aplica estado do motor da extensão Chrome — visor, extrato e automação seguem a mesma fonte. */
export async function ingestStrategyGlobalExtensionSync(
  payload: ExtensionSyncPayload,
  liveTableIds: readonly number[],
): Promise<StrategyGlobalSnapshot | null> {
  if (!initialized) return null;

  touchExtensionSource(payload);
  const { saveAutomationConfig, getAutomationConfig } = await import(
    "@/lib/server/automationSim/config"
  );
  const { EXTENSION_REAL_BASE_STAKE } = await import("@/lib/back-office/rouletteAutomationSim");
  if (getAutomationConfig().baseStake !== EXTENSION_REAL_BASE_STAKE) {
    await saveAutomationConfig({ baseStake: EXTENSION_REAL_BASE_STAKE });
  }

  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, payload.tableIds.length > 0 ? payload.tableIds : liveTableIds);

  const maxRecovery = payload.maxRecovery ?? UM_FATOR_MAX_RECOVERY;
  for (const [key, numbers] of Object.entries(payload.histories)) {
    if (!Array.isArray(numbers) || numbers.length === 0) continue;
    state.tableHistories[key] = numbers.slice(0, 4_000);
  }

  state.um1fator.stats = payload.stats;
  state.um1fator.machine = applyExtensionMachineToState(
    state.rotatingRoomTableIds,
    payload.machine,
    payload.stats,
  );

  if (payload.crossingMachine && payload.crossingStats) {
    state.dois2fatores.stats = payload.crossingStats;
    state.dois2fatores.machine = sanitizeRotatingRoomCrossingMachineForTableIds(
      payload.crossingMachine,
      state.rotatingRoomTableIds,
    );
  }

  if (payload.fibonacciMachine && payload.fibonacciStats) {
    state.fibonacci.stats = payload.fibonacciStats;
    state.fibonacci.machine = sanitizeRotatingRoomFibonacciMachineForTableIds(
      payload.fibonacciMachine,
      state.rotatingRoomTableIds,
    );
  }

  if (payload.repeticaoMachine && payload.repeticaoStats) {
    state.repeticao.stats = payload.repeticaoStats;
    state.repeticao.machine = sanitizeRotatingRoomRepeticaoMachineForTableIds(
      payload.repeticaoMachine,
      state.rotatingRoomTableIds,
    );
  }

  const histories = historiesRecord(state);
  let crossingFlash: RotatingRoomCrossingPlacarFlash = null;
  const crossingLedgerEntries: StrategyGlobalLedgerEntry[] = [];
  if (!payload.crossingMachine) {
    const crossing = driveCrossing(state, histories);
    crossingFlash = crossing.flash;
    crossingLedgerEntries.push(...appendCrossingLedgerIfNeeded(state, crossing));
  }

  let fibonacciFlash: RotatingRoomFibonacciPlacarFlash = null;
  const fibonacciLedgerEntries: StrategyGlobalLedgerEntry[] = [];
  if (!payload.fibonacciMachine) {
    const fibonacci = driveFibonacci(state, histories);
    fibonacciFlash = fibonacci.flash;
    fibonacciLedgerEntries.push(...appendFibonacciLedgerIfNeeded(state, fibonacci));
  }

  let repeticaoFlash: RotatingRoomRepeticaoPlacarFlash = null;
  const repeticaoLedgerEntries: StrategyGlobalLedgerEntry[] = [];
  if (!payload.repeticaoMachine) {
    const repeticao = driveRepeticao(state, histories);
    repeticaoFlash = repeticao.flash;
    repeticaoLedgerEntries.push(...appendRepeticaoLedgerIfNeeded(state, repeticao));
  }

  const rotacao = driveRotacao(state, histories);
  const rotacaoLedgerEntries = appendRotacaoLedgerIfNeeded(state, rotacao);
  let rotacaoFlash: RotacaoPlacarFlash = rotacao.flash;
  const kto2f = driveKto2f(state, histories);
  const kto2fLedgerEntries = appendKto2fLedgerIfNeeded(state, kto2f);
  let kto2fFlash: Kto2fPlacarFlash = kto2f.flash;
  const ice3f = driveIce3f(state, histories);
  const ice3fLedgerEntries = appendIce3fLedgerIfNeeded(state, ice3f);
  let ice3fFlash: Ice3fPlacarFlash = ice3f.flash;

  const umLedgerEntries: StrategyGlobalLedgerEntry[] = [];
  const crossLedgerFromExtension: StrategyGlobalLedgerEntry[] = [];
  const fibLedgerFromExtension: StrategyGlobalLedgerEntry[] = [];
  const repLedgerFromExtension: StrategyGlobalLedgerEntry[] = [];
  let umFlash: UmFatorPlacarFlash = null;
  for (const settlement of payload.settlements ?? []) {
    if (!rememberExtensionSettlementKey(settlement.dedupeKey)) continue;
    const trigger = settlement.trigger ?? "um1fator";
    const kind: StrategyGlobalKind =
      trigger === "dois2fatores"
        ? "dois2fatores"
        : trigger === "fibonacci"
          ? "fibonacci"
          : trigger === "repeticao"
            ? "repeticao"
            : trigger === "rotacao"
              ? "rotacao"
              : trigger === "kto2fcruzamento"
                ? "kto2fcruzamento"
                : trigger === "tres3fatores"
                  ? "tres3fatores"
                  : "um1fator";
    const ledgerEntry = ledgerFromFlash(
      settlement.flash,
      settlement.recoveryBefore,
      kind,
      settlement.stake,
    );
    const maxR =
      kind === "dois2fatores"
        ? ROTATING_ROOM_CROSSING_MAX_RECOVERY
        : kind === "fibonacci"
          ? ROTATING_ROOM_FIBONACCI_MAX_RECOVERY
          : kind === "repeticao"
            ? ROTATING_ROOM_REPETICAO_MAX_RECOVERY
            : kind === "rotacao"
              ? ROTACAO_MAX_RECOVERY
              : kind === "kto2fcruzamento"
                ? KTO2F_MAX_RECOVERY
                : kind === "tres3fatores"
                  ? ICE3F_MAX_RECOVERY
                  : maxRecovery;
    appendLedger(state, kind, ledgerEntry, maxR);
    if (kind === "dois2fatores") {
      crossLedgerFromExtension.push(ledgerEntry);
      crossingFlash = settlement.flash;
    } else if (kind === "fibonacci") {
      fibLedgerFromExtension.push(ledgerEntry);
      fibonacciFlash = settlement.flash;
    } else if (kind === "repeticao") {
      repLedgerFromExtension.push(ledgerEntry);
      repeticaoFlash = settlement.flash;
    } else if (kind === "rotacao") {
      rotacaoFlash = settlement.flash;
    } else if (kind === "kto2fcruzamento") {
      kto2fFlash = settlement.flash;
    } else if (kind === "tres3fatores") {
      ice3fFlash = settlement.flash;
    } else {
      umLedgerEntries.push(ledgerEntry);
      umFlash = settlement.flash;
    }
  }

  const snapshot = bumpAndBroadcast(
    state,
    crossingFlash,
    umFlash,
    fibonacciFlash,
    repeticaoFlash,
    rotacaoFlash,
    kto2fFlash,
    ice3fFlash,
  );
  const automationEntries = [
    ...crossingLedgerEntries,
    ...crossLedgerFromExtension,
    ...umLedgerEntries,
    ...fibonacciLedgerEntries,
    ...fibLedgerFromExtension,
    ...repeticaoLedgerEntries,
    ...repLedgerFromExtension,
    ...rotacaoLedgerEntries,
    ...kto2fLedgerEntries,
    ...ice3fLedgerEntries,
  ];
  if (automationEntries.length > 0) {
    void pushAutomationSimSettlements(automationEntries, snapshot);
  }
  return snapshot;
}

/** Sem dedupe — reconcilia sempre com `last20Results` (prefixo Pragmatic). */
export function ingestStrategyGlobalHistorySnapshot(
  tableId: number,
  spins: RouletteSpin[],
  liveTableIds: readonly number[],
): void {
  if (!initialized || spins.length === 0 || isExtensionSourceActive()) return;
  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, liveTableIds);

  const key = String(tableId);
  const existing = state.tableHistories[key] ?? [];
  const numbers = spins.map((s) => s.number);
  const next = reconcileHistoryWithApiSnapshot(existing, numbers);
  const changed =
    next.length !== existing.length || next.some((n, i) => n !== existing[i]);
  if (!changed && existing.length > 0) return;

  state.tableHistories[key] = next.slice(0, 4_000);
  for (const s of spins) {
    rememberGameId(state, s.gameId);
  }

  const histories = historiesRecord(state);
  driveCrossing(state, histories);
  driveUmFator(state, histories);
  driveFibonacci(state, histories);
  driveRepeticao(state, histories);
  driveRotacao(state, histories);
  driveKto2f(state, histories);
  driveIce3f(state, histories);
  bumpAndBroadcast(state, null, null, null, null, null, null, null);
  schedulePersist(state);
}

export function ingestStrategyGlobalReplayBatch(
  spins: RouletteSpin[],
  liveTableIds: readonly number[],
): void {
  if (!initialized || spins.length === 0 || isExtensionSourceActive()) return;
  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, liveTableIds);

  let changed = false;
  for (const spin of spins) {
    const tableId = parseLiveTableIdFromCompositeGameId(spin.gameId);
    if (tableId == null) continue;
    const key = String(tableId);
    if ((state.tableHistories[key] ?? []).length > 0) continue;
    if (!rememberGameId(state, spin.gameId)) continue;
    appendTableSpin(state, tableId, spin.number);
    changed = true;
  }
  if (!changed) return;

  const histories = historiesRecord(state);
  driveCrossing(state, histories);
  driveUmFator(state, histories);
  driveFibonacci(state, histories);
  driveRepeticao(state, histories);
  driveRotacao(state, histories);
  driveKto2f(state, histories);
  driveIce3f(state, histories);
  bumpAndBroadcast(state, null, null, null, null, null, null, null);
}

export function getStrategyGlobalSnapshotOrThrow(): StrategyGlobalSnapshot {
  return buildStrategyGlobalSnapshot(getStrategyGlobalState());
}

/**
 * Confirma aposta ICE 3F na máquina global (automação / extensão).
 * Sem isto o ciclo fica em awaiting_bet e o próximo giro cancela sem placar.
 */
export function markStrategyGlobalIce3fBetPlaced(): boolean {
  const state = getStrategyGlobalState();
  const before = state.tres3fatores.machine;
  if (!before.cycle || before.cycle.phase !== "awaiting_bet") return false;
  state.tres3fatores.machine = markIce3fRotatingBetPlaced(before);
  schedulePersist(state);
  return true;
}

export function resetStrategyGlobalSession(
  kind: StrategyGlobalKind | "all",
  liveTableIds: readonly number[],
): StrategyGlobalSnapshot {
  const state = getStrategyGlobalState();
  syncRotatingTableIds(state, liveTableIds);
  const histories = historiesRecord(state);
  const tableIds = state.rotatingRoomTableIds;

  const resetOne = (k: StrategyGlobalKind) => {
    if (k === "dois2fatores") {
      state.dois2fatores.stats = emptyRotatingRoomSessionStats(ROTATING_ROOM_CROSSING_MAX_RECOVERY);
      state.dois2fatores.machine = seedRotatingRoomCrossingMachineAfterPlacarReset(
        defaultRotatingRoomCrossingMachineState(),
        tableIds,
        histories,
      );
    } else if (k === "fibonacci") {
      state.fibonacci.stats = emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY);
      state.fibonacci.machine = seedRotatingRoomFibonacciMachineAfterPlacarReset(
        defaultRotatingRoomFibonacciMachineState(),
        tableIds,
        histories,
      );
    } else if (k === "repeticao") {
      state.repeticao.stats = emptyRotatingRoomSessionStats(ROTATING_ROOM_REPETICAO_MAX_RECOVERY);
      state.repeticao.machine = seedRotatingRoomRepeticaoMachineAfterPlacarReset(
        defaultRotatingRoomRepeticaoMachineState(),
        tableIds,
        histories,
      );
    } else if (k === "rotacao") {
      state.rotacao.stats = emptyRotatingRoomSessionStats(ROTACAO_MAX_RECOVERY);
      state.rotacao.machine = defaultRotacaoMachineState();
    } else if (k === "kto2fcruzamento") {
      state.kto2fcruzamento.stats = emptyRotatingRoomSessionStats(KTO2F_MAX_RECOVERY);
      state.kto2fcruzamento.machine = seedKto2fMachineAfterPlacarReset(histories);
    } else if (k === "tres3fatores") {
      state.tres3fatores.stats = emptyRotatingRoomSessionStats(ICE3F_MAX_RECOVERY);
      state.tres3fatores.machine = seedIce3fMachineAfterPlacarReset(histories);
    } else {
      state.um1fator.stats = emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
      state.um1fator.machine = seedUmFatorMachineAfterPlacarReset(
        defaultUmFatorMachineState(),
        tableIds,
        histories,
      );
    }
  };

  if (kind === "all") {
    resetOne("dois2fatores");
    resetOne("um1fator");
    resetOne("fibonacci");
    resetOne("repeticao");
    resetOne("rotacao");
    resetOne("kto2fcruzamento");
    resetOne("tres3fatores");
  } else {
    resetOne(kind);
  }

  return bumpAndBroadcast(state, null, null, null, null, null, null, null);
}

export function wipeStrategyGlobalState(liveTableIds: readonly number[]): StrategyGlobalSnapshot {
  const rotatingIds = resolveRotatingRoomTableIds(liveTableIds);
  const next = emptyStrategyGlobalState(rotatingIds);
  replaceStrategyGlobalState(next);
  const snapshot = buildStrategyGlobalSnapshot(next);
  broadcastStrategyGlobal({ type: "sync", snapshot });
  return snapshot;
}
