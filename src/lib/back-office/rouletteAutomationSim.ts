import type {
  StrategyGlobalKind,
  StrategyGlobalLedgerEntry,
  StrategyGlobalSnapshot,
} from "@/lib/roulette/strategyGlobalTypes";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import {
  ROTATING_ROOM_MIN_BETTING_TIME_REMAINING_SEC,
  tableAcceptableForRotatingRoomEntry,
  crossingMinBettingTimeRemainingSec,
} from "@/lib/roulette/liveTableBettingWindow";
import {
  crossingSignalId,
  isCrossingAwaitingObservationBet,
  isCrossingAwaitingSpinAfterArm,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import { isRotatingRoomPostResultHoldActive } from "@/lib/roulette/rotatingRoomLobbySignal";
import { activeCrossingFromAutomationBet } from "@/lib/roulette/automationBetCrossing";
import type { RotatingRoomSimulatorIndication } from "@/lib/roulette/rotatingRoomSimulatorTypes";
import { doisFatoresFactorLabel, evaluateDoisFatoresRound, type DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import { resolveRotativaTriggerFromSnapshot } from "@/lib/roulette/rotatingRoomRotativaMerge";
import {
  rotacaoSignalId,
  rotacaoActiveToCrossing,
  type RotacaoActive,
} from "@/lib/roulette/rotatingRoomRotacaoStrategy";
import {
  kto2fActiveToCrossing,
  kto2fAlertLabel,
  kto2fSignalId,
  stakeForKto2fRecovery,
} from "@/lib/roulette/rotatingRoomKto2fStrategy";
import {
  ice3fActiveToCrossing,
  ice3fAlertLabel,
  ice3fSignalId,
  stakeForIce3fAutomation,
} from "@/lib/roulette/rotatingRoomIce3fStrategy";
import type { Ice2fActive } from "@/lib/roulette/iceCruzamento2fStrategy";
import type { Ice3fActive } from "@/lib/roulette/iceTresFatoresStrategy";
import {
  fibonacciSignalId,
  type RotatingRoomFibonacciActive,
} from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import {
  repeticaoSignalId,
  type RotatingRoomRepeticaoActive,
} from "@/lib/roulette/rotatingRoomRepeticaoStrategy";
import {
  activeFibonacciViewFromBet,
  evaluateZoneFibonacciRound,
  isZoneFibonacciStrategy,
  ledgerKindForZoneFibonacciLoss,
  repeticaoActiveAsFibonacci,
  type ZoneFibonacciSessionSlice,
  type ZoneFibonacciStrategyKind,
} from "@/lib/roulette/zoneFibonacciFamily";
import {
  evaluateUmFatorRound,
  umFatorAlertLabel,
  UM_FATOR_MAX_RECOVERY,
  type UmFatorActive,
} from "@/lib/roulette/umFatorStrategy";
import { reviewMartingaleSettlement } from "@/lib/back-office/martingaleSequenceReview";
import {
  EXTENSION_REAL_BASE_STAKE,
  resolveLedgerEntryStake,
  ROULETTE_AUTOMATION_BASE_STAKE,
  stakeForRecovery,
  stakeForFibonacciRecovery,
} from "@/lib/back-office/automationStakes";

export {
  EXTENSION_REAL_BASE_STAKE,
  ROULETTE_AUTOMATION_BASE_STAKE,
  resolveLedgerEntryStake,
  stakeForRecovery,
  stakeForFibonacciRecovery,
} from "@/lib/back-office/automationStakes";

export const ROULETTE_AUTOMATION_INITIAL_BANK = 50_000;
/** Versão do extrato — incrementar força reset automático (saldo R$ 50.000, histórico limpo). */
export const AUTOMATION_EXTRACT_FORMAT_VERSION = 5;
/** @deprecated Mantido só por compatibilidade de import — não usar para calcular stake. */
export const AUTOMATION_BANK_SHARE = 0.001;
/** @deprecated Use ROULETTE_AUTOMATION_BASE_STAKE. */
export const ROULETTE_AUTOMATION_LEGACY_BASE_STAKE = ROULETTE_AUTOMATION_BASE_STAKE;
/** Máximo de pontos no gráfico (só performance — sem janela temporal). */
export const ROULETTE_AUTOMATION_MAX_CHART_POINTS = 500;

export type AutomationRoundBadge = "SINAL" | "RECUPERAÇÃO" | "VITÓRIA" | "DERROTA" | "EM JOGO";

export type AutomationPendingSignal = {
  signalId: string;
  tableId: number;
  tableLabel: string;
  alertLabel: string;
  recovery: number;
  stake: number;
  strategy?:
    | "um1fator"
    | "dois2fatores"
    | "fibonacci"
    | "repeticao"
    | "rotacao"
    | "kto2fcruzamento"
    | "tres3fatores";
  umActive?: UmFatorActive;
  activeCrossing?: DoisFatoresActive;
  activeFibonacci?: RotatingRoomFibonacciActive;
  activeRepeticao?: RotatingRoomRepeticaoActive;
  rotacaoActive?: RotacaoActive;
  kto2fActive?: Ice2fActive;
  ice3fActive?: Ice3fActive;
  /** 2F — empate (repetir) vs derrota (dobrar) no hold pós-giro. */
  crossingHoldReason?: "draw" | "loss";
  /** 2F ausência oposta — repetir aposta após vitória na entrada (R0). */
  crossingOppositeWinPersist?: boolean;
};

/** Aposta aberta — entrada em jogo à espera do giro. */
export type AutomationOpenBet = AutomationPendingSignal & {
  openedAt: number;
  /** Cabeçalho do histórico no momento da entrada (`len:firstSpin`). */
  openedHead: string;
};

export type AutomationSimRound = {
  id: string;
  ts: number;
  tableId: number;
  tableLabel: string;
  spinIndex: number;
  badge: AutomationRoundBadge;
  recovery: number;
  stake: number;
  net: number;
  balanceAfter: number;
  resultNumber?: number;
  strategy?: StrategyGlobalKind;
};

export type AutomationSimChartPoint = {
  ts: number;
  label: string;
  balance: number;
};

/** Vela OHLC entre duas liquidações consecutivas (abertura = saldo anterior, fecho = saldo após). */
export type AutomationCandlestickPoint = {
  ts: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type RouletteAutomationSimState = {
  startedAt: number;
  /** Banca no início do ciclo visual (gráfico / histórico). */
  cycleOpeningBalance: number;
  balance: number;
  /** Capital registado no extrato — proíbe reinício de saldo. */
  capitalRegisteredAt?: number | null;
  rounds: AutomationSimRound[];
  chart: AutomationSimChartPoint[];
  processedKeys: string[];
  spinCounter: number;
  openBet: AutomationOpenBet | null;
  /** Incrementar AUTOMATION_EXTRACT_FORMAT_VERSION força reset do extrato no arranque. */
  extractFormatVersion?: number;
};

/** Saldo imediatamente antes da próxima liquidação (cadeia do histórico). */
export function runningBalanceBefore(state: RouletteAutomationSimState): number {
  if (state.rounds.length > 0) {
    return state.rounds[0]!.balanceAfter;
  }
  if (typeof state.cycleOpeningBalance === "number" && Number.isFinite(state.cycleOpeningBalance)) {
    return state.cycleOpeningBalance;
  }
  return state.balance;
}

/** Remove linhas repetidas do mesmo giro (mesa + resultado + gale + tipo). */
export function dedupeAutomationSimRounds(
  rounds: readonly AutomationSimRound[],
): AutomationSimRound[] {
  const seen = new Set<string>();
  const deduped: AutomationSimRound[] = [];
  const sorted = [...rounds].sort((a, b) => a.ts - b.ts);
  for (const round of sorted) {
    if (seen.has(round.id)) continue;
    seen.add(round.id);
    deduped.push(round);
  }
  return deduped.reverse();
}

/** Recalcula saldo após cada linha — vitórias e perdas sempre coerentes. */
export function recalculateAutomationRoundBalances(
  state: RouletteAutomationSimState,
): RouletteAutomationSimState {
  const opening =
    typeof state.cycleOpeningBalance === "number" && Number.isFinite(state.cycleOpeningBalance)
      ? state.cycleOpeningBalance
      : ROULETTE_AUTOMATION_INITIAL_BANK;

  const sorted = [...dedupeAutomationSimRounds(state.rounds)].sort((a, b) => a.ts - b.ts);
  let running = opening;
  const fixed = sorted.map((round) => {
    running += round.net;
    return { ...round, balanceAfter: running };
  });

  const rounds = fixed.reverse();
  const next = { ...state, rounds, balance: running };
  return { ...next, chart: buildAutomationChartData(next) };
}

/** Banca de referência para lucro/prejuízo após capital registado no extrato. */
export function globalAutomationOpeningBalance(
  state: Pick<RouletteAutomationSimState, "capitalRegisteredAt" | "cycleOpeningBalance">,
): number {
  if (state.capitalRegisteredAt != null) return ROULETTE_AUTOMATION_INITIAL_BANK;
  if (typeof state.cycleOpeningBalance === "number" && Number.isFinite(state.cycleOpeningBalance)) {
    return state.cycleOpeningBalance;
  }
  return ROULETTE_AUTOMATION_INITIAL_BANK;
}

/** Timestamp mínimo do ledger estratégico — só entradas após o início do ciclo visual. */
export function globalAutomationLedgerFloorTs(
  state: Pick<RouletteAutomationSimState, "capitalRegisteredAt" | "startedAt">,
): number {
  const capital = state.capitalRegisteredAt ?? 0;
  return Math.max(state.startedAt, capital);
}

/**
 * Saldo oficial da automação global = capital + liquidações de roleta (extrato filtrado).
 * Histórico/gráfico seguem a cadeia cumulativa das rodadas.
 */
export function finalizeAutomationSimState(
  state: RouletteAutomationSimState,
  officialBalance: number,
): RouletteAutomationSimState {
  const opening = globalAutomationOpeningBalance(state);
  const recalculated = recalculateAutomationRoundBalances({
    ...state,
    cycleOpeningBalance: opening,
  });

  if (Math.abs(recalculated.balance - officialBalance) <= 0.01) {
    return {
      ...recalculated,
      balance: officialBalance,
      chart: buildAutomationChartData({ ...recalculated, balance: officialBalance }),
    };
  }

  return recalculated;
}

export function formatStakeBrl(value: number): string {
  const abs = Math.abs(value);
  const fractionDigits = abs > 0 && abs < 1 ? 2 : abs % 1 !== 0 ? 2 : 0;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Stake inicial configurável — por defeito R$ 0,50 (igual à extensão). */
export function baseStakeFromBalance(
  _balance?: number,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): number {
  return baseStake;
}

/** Nível de gale registado no ledger (recoveryBefore da aposta). */
export function recoveryLevelForRound(round: Pick<AutomationSimRound, "recovery" | "stake">): number {
  return Math.max(0, Math.floor(round.recovery));
}

export function pendingSignalFromSnapshot(
  snapshot: StrategyGlobalSnapshot,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
  options?: {
    baseStake?: number;
    blockNewEntries?: boolean;
    crossingEnabled?: boolean;
    fibonacciEnabled?: boolean;
    repeticaoEnabled?: boolean;
    rotacaoEnabled?: boolean;
    kto2fEnabled?: boolean;
    tres3fEnabled?: boolean;
  },
): AutomationPendingSignal | null {
  if (options?.blockNewEntries) return null;

  const crossingEnabled = options?.crossingEnabled !== false;
  const fibonacciEnabled = options?.fibonacciEnabled !== false;
  const repeticaoEnabled = options?.repeticaoEnabled === true;
  const rotacaoEnabled = options?.rotacaoEnabled === true;
  const kto2fEnabled = options?.kto2fEnabled === true;
  const tres3fEnabled = options?.tres3fEnabled === true;
  const trigger = resolveRotativaTriggerFromSnapshot(
    snapshot,
    crossingEnabled,
    fibonacciEnabled,
    rotacaoEnabled,
    repeticaoEnabled,
    kto2fEnabled,
    tres3fEnabled,
  );
  if (trigger === "crossing") {
    return pendingSignalFromCrossingSession(
      snapshot.dois2fatores,
      balance,
      histories,
      options?.baseStake,
    );
  }

  if (trigger === "fibonacci") {
    return pendingSignalFromFibonacciSession(
      snapshot.fibonacci,
      balance,
      histories,
      options?.baseStake,
    );
  }

  if (trigger === "repeticao") {
    return pendingSignalFromRepeticaoSession(
      snapshot.repeticao,
      balance,
      histories,
      options?.baseStake,
    );
  }

  if (trigger === "rotacao") {
    return pendingSignalFromRotacaoSession(
      snapshot.rotacao,
      balance,
      histories,
      options?.baseStake,
    );
  }

  if (trigger === "kto2fcruzamento") {
    return pendingSignalFromKto2fSession(snapshot.kto2fcruzamento, balance);
  }

  if (trigger === "tres3fatores") {
    return pendingSignalFromIce3fSession(
      snapshot.tres3fatores,
      balance,
      options?.baseStake,
    );
  }

  return pendingSignalFromUmFatorSession(
    snapshot.um1fator,
    balance,
    histories,
    options?.baseStake,
  );
}

/** Sinal activo do cruzamento 2 Fatores — ciclo persistente até vitória ou derrota final. */
export function pendingSignalFromCrossingSession(
  session: Pick<
    StrategyGlobalSnapshot["dois2fatores"],
    | "showTapeteSignal"
    | "currentTableId"
    | "currentRecovery"
    | "activeCrossing"
    | "cycleSpinsWithoutWin"
    | "cycleSeq"
    | "cycleFingerprint"
    | "postResultHoldUntilMs"
    | "armedAtHead"
    | "crossingObservationConfirmed"
  >,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): AutomationPendingSignal | null {
  if (!session.showTapeteSignal || session.currentTableId == null || !session.activeCrossing) {
    return null;
  }

  if (isRotatingRoomPostResultHoldActive(session.postResultHoldUntilMs)) {
    return null;
  }

  const tableId = session.currentTableId;
  const history = histories?.[tableId] ?? [];

  if (isCrossingAwaitingSpinAfterArm(history, session.armedAtHead)) {
    return null;
  }

  if (
    isCrossingAwaitingObservationBet({
      cycleActive: session.activeCrossing,
      recovery: session.currentRecovery,
      cycleSpinsWithoutWin: session.cycleSpinsWithoutWin ?? 0,
      crossingObservationConfirmed: session.crossingObservationConfirmed === true,
    })
  ) {
    return null;
  }

  const active = session.activeCrossing;
  const alertLabel = `${doisFatoresFactorLabel(active.factor1)} · ${doisFatoresFactorLabel(active.factor2)}`;
  const recovery = session.currentRecovery;
  const attempt =
    typeof session.cycleSpinsWithoutWin === "number" && Number.isFinite(session.cycleSpinsWithoutWin)
      ? Math.max(0, Math.floor(session.cycleSpinsWithoutWin))
      : 0;
  const fingerprint =
    session.cycleFingerprint ??
    `${tableId}:${active.pairKind}:${active.referenceNumber}`;
  const cycleSeq =
    typeof session.cycleSeq === "number" && Number.isFinite(session.cycleSeq)
      ? Math.max(0, Math.floor(session.cycleSeq))
      : 0;

  if (
    history.length > 0 &&
    !tableAcceptableForRotatingRoomEntry(
      tableId,
      history,
      crossingMinBettingTimeRemainingSec(recovery, attempt),
    )
  ) {
    return null;
  }

  return {
    signalId: crossingSignalId(tableId, fingerprint, recovery, cycleSeq, attempt),
    tableId,
    tableLabel: lobbyTableDisplayName(tableId),
    alertLabel,
    recovery,
    stake: stakeForRecovery(recovery, balance, baseStake),
    strategy: "dois2fatores",
    activeCrossing: active,
  };
}

export type CrossingMesaWatchSignal = {
  tableId: number;
  tableLabel: string;
  armedAtHead: string;
  fingerprint: string;
};

/** Fase 1 — abrir mesa no giro do arm; apostar só após novo resultado com indicação activa. */
export function pendingCrossingMesaWatchFromSession(
  session: Pick<
    StrategyGlobalSnapshot["dois2fatores"],
    | "showTapeteSignal"
    | "currentTableId"
    | "armedAtHead"
    | "postResultHoldUntilMs"
    | "currentRecovery"
    | "cycleSpinsWithoutWin"
    | "crossingObservationConfirmed"
    | "activeCrossing"
  >,
  histories?: Record<number, readonly number[]>,
): CrossingMesaWatchSignal | null {
  if (!session.showTapeteSignal || session.currentTableId == null || !session.activeCrossing) {
    return null;
  }
  if (isRotatingRoomPostResultHoldActive(session.postResultHoldUntilMs)) {
    return null;
  }

  const tableId = session.currentTableId;
  const history = histories?.[tableId] ?? [];

  const awaitingObservation = isCrossingAwaitingObservationBet({
    cycleActive: session.activeCrossing,
    recovery: session.currentRecovery,
    cycleSpinsWithoutWin: session.cycleSpinsWithoutWin ?? 0,
    crossingObservationConfirmed: session.crossingObservationConfirmed === true,
  });

  const awaitingArmSpin =
    session.armedAtHead != null && isCrossingAwaitingSpinAfterArm(history, session.armedAtHead);

  if (!awaitingObservation && !awaitingArmSpin) {
    return null;
  }

  const armedAtHead = session.armedAtHead ?? `open:${tableId}`;
  return {
    tableId,
    tableLabel: lobbyTableDisplayName(tableId),
    armedAtHead,
    fingerprint: awaitingObservation
      ? `crossing-mesa-watch:${tableId}:obs`
      : `crossing-mesa-watch:${tableId}:${armedAtHead}`,
  };
}

/** Durante hold pós-giro — sinal para extensão clicar aos 5s (gale ou reentrada). */
export function pendingSignalFromCrossingExtensionBridge(
  session: Pick<
    StrategyGlobalSnapshot["dois2fatores"],
    | "showTapeteSignal"
    | "currentTableId"
    | "currentRecovery"
    | "activeCrossing"
    | "cycleSpinsWithoutWin"
    | "cycleSeq"
    | "cycleFingerprint"
    | "postResultHoldUntilMs"
    | "postResultHoldTableId"
    | "postResultHoldReason"
    | "cycleOppositeAbsence"
  >,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): AutomationPendingSignal | null {
  if (!isRotatingRoomPostResultHoldActive(session.postResultHoldUntilMs)) {
    return null;
  }

  const tableId =
    session.postResultHoldTableId ?? session.currentTableId;
  const active = session.activeCrossing;
  if (tableId == null || !active) return null;

  const recovery = session.currentRecovery;
  const attempt =
    typeof session.cycleSpinsWithoutWin === "number" && Number.isFinite(session.cycleSpinsWithoutWin)
      ? Math.max(0, Math.floor(session.cycleSpinsWithoutWin))
      : 0;
  const oppositeWinPersist =
    session.cycleOppositeAbsence === true &&
    session.postResultHoldReason === "draw" &&
    recovery <= 0 &&
    attempt <= 0;
  const isDrawHold = session.postResultHoldReason === "draw";
  if (recovery <= 0 && attempt <= 0 && !oppositeWinPersist && !isDrawHold) return null;

  const fingerprint =
    session.cycleFingerprint ??
    `${tableId}:${active.pairKind}:${active.referenceNumber}`;
  const cycleSeq =
    typeof session.cycleSeq === "number" && Number.isFinite(session.cycleSeq)
      ? Math.max(0, Math.floor(session.cycleSeq))
      : 0;
  const alertLabel = `${doisFatoresFactorLabel(active.factor1)} · ${doisFatoresFactorLabel(active.factor2)}`;

  const history = histories?.[tableId] ?? [];
  if (
    history.length > 0 &&
    !tableAcceptableForRotatingRoomEntry(
      tableId,
      history,
      crossingMinBettingTimeRemainingSec(recovery, attempt),
    )
  ) {
    return null;
  }

  return {
    signalId: crossingSignalId(tableId, fingerprint, recovery, cycleSeq, attempt),
    tableId,
    tableLabel: lobbyTableDisplayName(tableId),
    alertLabel,
    recovery,
    stake: stakeForRecovery(recovery, balance, baseStake),
    strategy: "dois2fatores",
    activeCrossing: active,
    crossingHoldReason: session.postResultHoldReason ?? undefined,
    crossingOppositeWinPersist: oppositeWinPersist,
  };
}

/** Mesma lógica do cartão da sala rotativa — só com janela de apostas aberta (início do gatilho). */
export function pendingSignalFromUmFatorSession(
  session: Pick<
    StrategyGlobalSnapshot["um1fator"],
    "showTapeteSignal" | "currentTableId" | "currentRecovery" | "umActive"
  >,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): AutomationPendingSignal | null {
  if (!session.showTapeteSignal || session.currentTableId == null || !session.umActive) {
    return null;
  }

  const tableId = session.currentTableId;
  const history = histories?.[tableId] ?? [];
  if (history.length > 0) {
    if (!tableAcceptableForRotatingRoomEntry(tableId, history)) return null;
    if (history[0] !== session.umActive.resultNumber) return null;
  }

  const alertLabel = umFatorAlertLabel(session.umActive);
  const recovery = session.currentRecovery;

  return {
    signalId: `${tableId}:${session.umActive.resultNumber}:${alertLabel}:${recovery}`,
    tableId,
    tableLabel: lobbyTableDisplayName(tableId),
    alertLabel,
    recovery,
    stake: stakeForRecovery(recovery, balance, baseStake),
    strategy: "um1fator",
    umActive: session.umActive,
  };
}

/** Sinal activo Fibonacci / Repetição (dúzia/coluna, mesma família operacional). */
function pendingSignalFromZoneFibonacciSession(
  session: ZoneFibonacciSessionSlice,
  strategy: ZoneFibonacciStrategyKind,
  active: RotatingRoomFibonacciActive | RotatingRoomRepeticaoActive | null,
  signalId: string,
  histories?: Record<number, readonly number[]>,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): AutomationPendingSignal | null {
  const tableId = session.currentTableId;
  const recovery = session.currentRecovery;
  const inPlay =
    tableId != null && active != null && (session.showTapeteSignal || recovery > 0);

  if (!inPlay) return null;

  const history = histories?.[tableId] ?? [];
  if (history.length > 0 && !tableAcceptableForRotatingRoomEntry(tableId, history)) {
    return null;
  }

  const fibView =
    strategy === "repeticao" && active
      ? repeticaoActiveAsFibonacci(active as RotatingRoomRepeticaoActive)
      : (active as RotatingRoomFibonacciActive | null);

  return {
    signalId,
    tableId,
    tableLabel: lobbyTableDisplayName(tableId),
    alertLabel: active!.zoneLabel,
    recovery,
    stake: stakeForFibonacciRecovery(recovery, baseStake),
    strategy,
    activeFibonacci: fibView ?? undefined,
    ...(strategy === "repeticao"
      ? { activeRepeticao: active as RotatingRoomRepeticaoActive }
      : {}),
  };
}

/** Sinal activo Fibonacci (dúzia/coluna). */
export function pendingSignalFromFibonacciSession(
  session: Pick<
    StrategyGlobalSnapshot["fibonacci"],
    "showTapeteSignal" | "currentTableId" | "currentRecovery" | "activeFibonacci" | "cycleSeq"
  >,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): AutomationPendingSignal | null {
  const active = session.activeFibonacci;
  if (!active || session.currentTableId == null) return null;
  return pendingSignalFromZoneFibonacciSession(
    session,
    "fibonacci",
    active,
    fibonacciSignalId(session.currentTableId, active.zone, session.currentRecovery, session.cycleSeq ?? 0),
    histories,
    baseStake,
  );
}

/** Sinal activo Repetição (dúzia/coluna do número mais recente). */
export function pendingSignalFromRepeticaoSession(
  session: Pick<
    StrategyGlobalSnapshot["repeticao"],
    "showTapeteSignal" | "currentTableId" | "currentRecovery" | "activeRepeticao" | "cycleSeq"
  >,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): AutomationPendingSignal | null {
  const active = session.activeRepeticao;
  if (!active || session.currentTableId == null) return null;
  return pendingSignalFromZoneFibonacciSession(
    session,
    "repeticao",
    active,
    repeticaoSignalId(session.currentTableId, active.zone, session.currentRecovery, session.cycleSeq ?? 0),
    histories,
    baseStake,
  );
}

/** Sinal activo Rotação — Roulette 1, altura/paridade/cor. */
export function pendingSignalFromRotacaoSession(
  session: Pick<
    StrategyGlobalSnapshot["rotacao"],
    "showTapeteSignal" | "currentTableId" | "currentRecovery" | "rotacaoActive" | "cycleSeq"
  >,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): AutomationPendingSignal | null {
  if (!session.showTapeteSignal || session.currentTableId == null || !session.rotacaoActive) {
    return null;
  }

  const tableId = session.currentTableId;
  const history = histories?.[tableId] ?? [];
  if (history.length > 0 && !tableAcceptableForRotatingRoomEntry(tableId, history)) {
    return null;
  }
  if (history.length > 0 && history[0] !== session.rotacaoActive.baseNumber) {
    return null;
  }

  const active = session.rotacaoActive;
  const alertLabel = active.alertLabel;
  const recovery = session.currentRecovery;

  return {
    signalId: rotacaoSignalId(
      active.baseNumber,
      active.dimension,
      recovery,
      session.cycleSeq ?? 0,
    ),
    tableId,
    tableLabel: lobbyTableDisplayName(tableId),
    alertLabel,
    recovery,
    stake: stakeForRecovery(recovery, balance, baseStake),
    strategy: "rotacao",
    rotacaoActive: active,
    activeCrossing: rotacaoActiveToCrossing(active),
  };
}

/** Sinal activo KTO 2F — Roulette 3, cruzamento posições críticas. */
export function pendingSignalFromKto2fSession(
  session: Pick<
    StrategyGlobalSnapshot["kto2fcruzamento"],
    "showTapeteSignal" | "currentTableId" | "currentRecovery" | "kto2fActive"
  >,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
): AutomationPendingSignal | null {
  if (!session.showTapeteSignal || session.currentTableId == null || !session.kto2fActive) {
    return null;
  }

  const tableId = session.currentTableId;
  const active = session.kto2fActive;
  const recovery = session.currentRecovery;

  return {
    signalId: kto2fSignalId(active, recovery),
    tableId,
    tableLabel: lobbyTableDisplayName(tableId),
    alertLabel: kto2fAlertLabel(active),
    recovery,
    stake: stakeForKto2fRecovery(recovery),
    strategy: "kto2fcruzamento",
    kto2fActive: active,
    activeCrossing: kto2fActiveToCrossing(active),
  };
}

/** Sinal activo ICE 3F — Roulette 2 Extra Time, eco → cor/altura. */
export function pendingSignalFromIce3fSession(
  session: Pick<
    StrategyGlobalSnapshot["tres3fatores"],
    "showTapeteSignal" | "currentTableId" | "currentRecovery" | "currentUnitScale" | "ice3fActive"
  >,
  _balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): AutomationPendingSignal | null {
  if (!session.showTapeteSignal || session.currentTableId == null || !session.ice3fActive) {
    return null;
  }

  const tableId = session.currentTableId;
  const active = session.ice3fActive;
  const recovery = session.currentRecovery;
  const unitScale = session.currentUnitScale;

  return {
    signalId: ice3fSignalId(active, unitScale),
    tableId,
    tableLabel: lobbyTableDisplayName(tableId),
    alertLabel: ice3fAlertLabel(active),
    recovery,
    stake: stakeForIce3fAutomation(unitScale, baseStake),
    strategy: "tres3fatores",
    ice3fActive: active,
    activeCrossing: ice3fActiveToCrossing(active),
  };
}

export function pendingSignalFromRotatingRoom(
  indication: RotatingRoomSimulatorIndication,
): AutomationPendingSignal | null {
  if (indication.action !== "bet" || indication.tableId == null || !indication.signalId) {
    return null;
  }
  return {
    signalId: indication.signalId,
    tableId: indication.tableId,
    tableLabel: indication.tableLabel ?? lobbyTableDisplayName(indication.tableId),
    alertLabel: indication.alertLabel ?? "Sinal",
    recovery: indication.recovery,
    stake: indication.suggestedStake,
  };
}

export function ledgerEntryKey(entry: StrategyGlobalLedgerEntry): string {
  return `${entry.ts}-${entry.tableId}-${entry.recovery}-${entry.kind}-${entry.won}`;
}

/** Um giro liquidado — inclui timestamp para permitir o mesmo número na mesma mesa em giros distintos. */
export function ledgerResultKey(
  entry: Pick<StrategyGlobalLedgerEntry, "tableId" | "resultNumber" | "ts">,
): string | null {
  if (entry.resultNumber == null) return null;
  return `${entry.tableId}:${entry.resultNumber}:${entry.ts}`;
}

export function spinSettleKey(tableId: number, resultNumber: number): string {
  return `spin:${tableId}:${resultNumber}`;
}

/** Chave estável para dedupe financeiro — mesa + resultado + gale + tipo. */
export function globalAutomationSettleKey(
  entry: Pick<StrategyGlobalLedgerEntry, "tableId" | "resultNumber" | "recovery" | "kind">,
): string | null {
  if (entry.resultNumber == null) return null;
  return `${entry.tableId}:${entry.resultNumber}:${entry.recovery}:${entry.kind}`;
}

/** Junta ledger do servidor com liquidações locais ainda não sincronizadas. */
export function mergeAutomationLedgerSources(
  server: readonly StrategyGlobalLedgerEntry[],
  local: readonly StrategyGlobalLedgerEntry[],
): StrategyGlobalLedgerEntry[] {
  const seenKeys = new Set<string>();
  const seenResults = new Set<string>();
  const merged: StrategyGlobalLedgerEntry[] = [];

  for (const entry of [...server, ...local]) {
    const resultKey = ledgerResultKey(entry);
    if (resultKey != null) {
      if (seenResults.has(resultKey)) continue;
      seenResults.add(resultKey);
    }
    const key = ledgerEntryKey(entry);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    merged.push(entry);
  }

  return merged.sort((a, b) => a.ts - b.ts);
}

/** Remove entradas locais já presentes no ledger do servidor. */
export function pruneLocalAutomationLedger(
  server: readonly StrategyGlobalLedgerEntry[],
  local: readonly StrategyGlobalLedgerEntry[],
): StrategyGlobalLedgerEntry[] {
  const serverResults = new Set(
    server.map((entry) => ledgerResultKey(entry)).filter((k): k is string => k != null),
  );
  const serverKeys = new Set(server.map(ledgerEntryKey));

  return local.filter((entry) => {
    const resultKey = ledgerResultKey(entry);
    if (resultKey != null && serverResults.has(resultKey)) return false;
    return !serverKeys.has(ledgerEntryKey(entry));
  });
}

export function ledgerEntryFromFlashSettlement(
  flash: UmFatorPlacarFlashLike,
  bet: AutomationOpenBet,
  ts = Date.now(),
): StrategyGlobalLedgerEntry {
  return {
    ts,
    tableId: flash.tableId,
    won: flash.won,
    recovery: bet.recovery,
    kind: flash.kind,
    resultNumber: flash.resultNumber,
    strategy: bet.strategy,
  };
}

export function ledgerEntryFromSpinSettlement(
  bet: AutomationOpenBet,
  resultNumber: number,
  won: boolean,
  ts = Date.now(),
): StrategyGlobalLedgerEntry {
  return {
    ts,
    tableId: bet.tableId,
    won,
    recovery: bet.recovery,
    kind: won ? "win" : ledgerKindForSpinLoss(bet.recovery, bet.strategy),
    resultNumber,
    strategy: bet.strategy,
  };
}

function ledgerKindForSpinLoss(
  recovery: number,
  strategy?: StrategyGlobalKind,
): StrategyGlobalLedgerEntry["kind"] {
  if (isZoneFibonacciStrategy(strategy)) {
    return ledgerKindForZoneFibonacciLoss(recovery);
  }
  return recovery >= UM_FATOR_MAX_RECOVERY ? "loss" : "recovery";
}

export function roundBadge(entry: StrategyGlobalLedgerEntry): AutomationRoundBadge {
  if (entry.won) return "VITÓRIA";
  if (entry.kind === "loss") return "DERROTA";
  if (entry.kind === "recovery") return "RECUPERAÇÃO";
  return "DERROTA";
}

/** Badge curto para a lista (como no mock de referência). */
export function roundBadgeShort(entry: StrategyGlobalLedgerEntry): "SINAL" | "RECUPERAÇÃO" {
  if (entry.recovery > 0 || entry.kind === "recovery") return "RECUPERAÇÃO";
  return "SINAL";
}

export function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

export function placeOpenBet(
  state: RouletteAutomationSimState,
  pending: AutomationPendingSignal,
  openedHead: string,
  histories?: Record<number, readonly number[]>,
  now = Date.now(),
): RouletteAutomationSimState {
  if (state.openBet?.signalId === pending.signalId) return state;
  if (state.openBet && state.openBet.signalId !== pending.signalId) {
    if (
      state.openBet.strategy === "dois2fatores" &&
      pending.strategy === "dois2fatores" &&
      histories
    ) {
      const released = releaseCrossingOpenBetAfterContinue(state, histories);
      if (released !== state) {
        state = released;
      }
    }
    if (state.openBet && state.openBet.signalId !== pending.signalId) {
      const head = histories?.[state.openBet.tableId]?.[0];
      if (
        head == null ||
        !isSpinResultAlreadySettled(state, state.openBet.tableId, head)
      ) {
        if (
          !(
            state.openBet.strategy === "dois2fatores" &&
            pending.strategy === "dois2fatores" &&
            histories &&
            openBetSpinArrived(state.openBet, histories)
          )
        ) {
          return state;
        }
        state = { ...state, openBet: null };
      } else {
        state = { ...state, openBet: null };
      }
    }
  }
  if (histories && pendingConflictsWithSettledHead(state, pending, histories)) return state;
  if (state.balance < pending.stake) return state;

  return {
    ...state,
    openBet: { ...pending, openedAt: now, openedHead },
  };
}

export function isSpinResultAlreadySettled(
  state: RouletteAutomationSimState,
  tableId: number,
  resultNumber: number,
): boolean {
  const spinKey = spinSettleKey(tableId, resultNumber);
  if (state.processedKeys.includes(spinKey)) return true;
  return state.rounds.some((r) => r.tableId === tableId && r.resultNumber === resultNumber);
}

/** Não abrir aposta se o giro actual da mesa já foi liquidado no histórico. */
export function pendingConflictsWithSettledHead(
  state: RouletteAutomationSimState,
  pending: AutomationPendingSignal,
  histories: Record<number, readonly number[]>,
): boolean {
  // Fibonacci/Repetição/Rotação apostam no giro seguinte — o head actual é o resultado já liquidado.
  if (
    isZoneFibonacciStrategy(pending.strategy) ||
    pending.strategy === "rotacao"
  ) {
    return false;
  }

  // 2 Fatores / cruzamento / ICE 3F — aposta no giro seguinte.
  if (pending.strategy === "dois2fatores" || pending.strategy === "tres3fatores") {
    return false;
  }

  const history = histories[pending.tableId];
  const head = history?.[0];
  if (head == null) return false;
  return isSpinResultAlreadySettled(state, pending.tableId, head);
}

/** Giro concluído — pode liquidar a aposta aberta. */
export function openBetSpinArrived(
  bet: AutomationOpenBet,
  histories: Record<number, readonly number[]>,
): { resultNumber: number; head: string } | null {
  const history = histories[bet.tableId];
  if (!history?.length) return null;

  const head = spinHead(history);
  const resultNumber = history[0]!;
  const formationNumber = bet.umActive?.resultNumber;
  const spinArrived =
    head !== bet.openedHead || (formationNumber != null && resultNumber !== formationNumber);
  if (!spinArrived) return null;

  return { resultNumber, head };
}

/** Liberta openBet após empate ou gale parcial 2F — permite nova aposta no mesmo ciclo. */
export function releaseCrossingOpenBetAfterContinue(
  state: RouletteAutomationSimState,
  histories: Record<number, readonly number[]>,
): RouletteAutomationSimState {
  const bet = state.openBet;
  if (bet?.strategy !== "dois2fatores") return state;

  const active = activeCrossingFromAutomationBet(bet);
  if (!active) return state;

  const arrived = openBetSpinArrived(bet, histories);
  if (!arrived) return state;

  const outcome = evaluateDoisFatoresRound(arrived.resultNumber, active);
  if (outcome !== "continue" && outcome !== "L") {
    return state;
  }

  return { ...state, openBet: null };
}

/** Liquida aposta — saldo da linha = cadeia cumulativa (anterior + net). */
export function settleOpenBetEntry(
  state: RouletteAutomationSimState,
  entry: StrategyGlobalLedgerEntry,
  tableLabel: string,
  _balanceAfter?: number,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): RouletteAutomationSimState {
  const key = ledgerEntryKey(entry);
  if (state.processedKeys.includes(key)) return state;

  const settleKey = globalAutomationSettleKey(entry);
  if (settleKey != null && state.processedKeys.includes(settleKey)) return state;
  if (settleKey != null && state.rounds.some((round) => round.id === settleKey)) return state;

  const review = reviewMartingaleSettlement(state, entry, baseStake);
  if (!review.accepted) {
    console.warn("[MartingaleReview] liquidação rejeitada:", review.reason);
    return state;
  }

  const stake = review.stake;
  const net = review.net;
  const balance = runningBalanceBefore(state) + net;

  const spinIndex = state.spinCounter;
  const round: AutomationSimRound = {
    id: settleKey ?? key,
    ts: entry.ts,
    tableId: entry.tableId,
    tableLabel,
    spinIndex,
    badge: roundBadge(entry),
    recovery: entry.recovery,
    stake,
    net,
    balanceAfter: balance,
    resultNumber: entry.resultNumber,
    strategy: entry.strategy,
  };

  const processedKeys = [...state.processedKeys, key];
  if (settleKey != null) processedKeys.push(settleKey);

  const next: RouletteAutomationSimState = {
    ...state,
    balance,
    openBet: null,
    spinCounter: spinIndex + 1,
    rounds: [round, ...state.rounds].slice(0, 80),
    processedKeys: processedKeys.slice(-400),
  };

  return {
    ...next,
    chart: buildAutomationChartData(next),
  };
}

export function syncOpenBetFromPending(
  state: RouletteAutomationSimState,
  pending: AutomationPendingSignal | null,
  openedHead = "0",
  histories?: Record<number, readonly number[]>,
): RouletteAutomationSimState {
  if (!pending) return state;
  return placeOpenBet(state, pending, openedHead, histories);
}

export function settleLedgerEntry(
  state: RouletteAutomationSimState,
  entry: StrategyGlobalLedgerEntry,
  tableLabel: string,
  balanceAfter?: number,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): RouletteAutomationSimState {
  return settleOpenBetEntry(state, entry, tableLabel, balanceAfter, baseStake);
}

export type UmFatorPlacarFlashLike = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
};

export function umFatorFlashSettlementKey(
  flash: UmFatorPlacarFlashLike,
  recovery: number,
): string {
  return `flash:${flash.tableId}:${flash.resultNumber}:${recovery}:${flash.kind}:${flash.won}`;
}

/** Liquidação imediata quando o placar 1 fator confirma resultado (fallback ao ledger SSE). */
export function settleFromUmFatorFlash(
  state: RouletteAutomationSimState,
  flash: UmFatorPlacarFlashLike,
  tableLabel: string,
  localProcessed: Set<string>,
): RouletteAutomationSimState {
  const bet = state.openBet;
  if (!bet || bet.tableId !== flash.tableId) return state;

  const key = umFatorFlashSettlementKey(flash, bet.recovery);
  if (localProcessed.has(key)) return state;
  localProcessed.add(key);

  return settleOpenBetEntry(
    state,
    {
      ts: Date.now(),
      tableId: flash.tableId,
      won: flash.won,
      recovery: bet.recovery,
      kind: flash.kind,
      resultNumber: flash.resultNumber,
    },
    tableLabel,
  );
}

/** Remove entradas duplicadas do mesmo giro (mesa + número) — mantém a primeira cronológica. */
export function dedupeStrategyLedgerEntries(
  ledger: readonly StrategyGlobalLedgerEntry[],
): StrategyGlobalLedgerEntry[] {
  const seen = new Set<string>();
  const sorted = [...ledger].sort((a, b) => a.ts - b.ts);
  const deduped: StrategyGlobalLedgerEntry[] = [];

  for (const entry of sorted) {
    const settleKey = globalAutomationSettleKey(entry);
    if (settleKey != null) {
      if (seen.has(settleKey)) continue;
      seen.add(settleKey);
    }
    deduped.push(entry);
  }

  return deduped;
}

/** Reconstrói banca/rodadas só a partir do ledger (ignora saldo corrompido do servidor). */
export function rebuildAutomationSimFromLedger(
  floorTs: number,
  ledger: readonly StrategyGlobalLedgerEntry[],
  openingBalance = ROULETTE_AUTOMATION_INITIAL_BANK,
  startedAt = floorTs,
): RouletteAutomationSimState {
  return rebuildAutomationSimDisplayFromLedger(floorTs, ledger, openingBalance, startedAt);
}

/** Reconstrói histórico visual a partir do ledger — sem movimentar extrato financeiro. */
export function rebuildAutomationSimDisplayFromLedger(
  floorTs: number,
  ledger: readonly StrategyGlobalLedgerEntry[],
  openingBalance = ROULETTE_AUTOMATION_INITIAL_BANK,
  startedAt = floorTs,
): RouletteAutomationSimState {
  let state: RouletteAutomationSimState = {
    ...freshAutomationSimState(startedAt),
    balance: openingBalance,
    cycleOpeningBalance: openingBalance,
  };
  state = { ...state, chart: buildAutomationChartData(state) };

  const sorted = dedupeStrategyLedgerEntries(ledger).filter((entry) => entry.ts >= floorTs);

  for (const entry of sorted) {
    state = settleLedgerEntry(state, entry, lobbyTableDisplayName(entry.tableId));
  }

  return recalculateAutomationRoundBalances(state);
}

export function openBetWasSettled(
  state: RouletteAutomationSimState,
  bet: AutomationOpenBet,
): boolean {
  const formationNum = bet.umActive?.resultNumber;
  return state.rounds.some((r) => {
    if (r.tableId !== bet.tableId || r.ts < bet.openedAt - 5000) return false;
    if (r.recovery === bet.recovery) return true;
    if (r.resultNumber == null) return false;
    if (formationNum == null) return true;
    return r.resultNumber !== formationNum;
  });
}

/** Liquidação do servidor para aposta aberta — recovery do ledger prevalece sobre openBet. */
export function findLedgerEntryForOpenBet(
  bet: AutomationOpenBet,
  ledger: readonly StrategyGlobalLedgerEntry[],
  resultNumber?: number,
): StrategyGlobalLedgerEntry | null {
  const formationNum = bet.umActive?.resultNumber;
  const candidates = ledger.filter((e) => {
    if (e.tableId !== bet.tableId || e.ts < bet.openedAt - 5000 || e.resultNumber == null) {
      return false;
    }
    if (resultNumber != null && e.resultNumber !== resultNumber) return false;
    if (formationNum != null && e.resultNumber === formationNum) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  const withRecovery = candidates.filter((e) => e.recovery === bet.recovery);
  const pool = withRecovery.length > 0 ? withRecovery : candidates;
  return [...pool].sort((a, b) => a.ts - b.ts).at(-1)!;
}

export function pendingSignalAlreadySettled(
  state: RouletteAutomationSimState,
  pending: AutomationPendingSignal,
): boolean {
  const formationPart = pending.signalId.split(":")[1];
  const formationNum = formationPart ? Number(formationPart) : Number.NaN;
  if (!Number.isFinite(formationNum)) return false;

  return state.rounds.some(
    (r) =>
      r.tableId === pending.tableId &&
      r.recovery === pending.recovery &&
      r.resultNumber != null &&
      r.resultNumber !== formationNum,
  );
}

/** Liquida aposta aberta com entrada recente do ledger global (SSE). */
export function trySettleOpenBetFromLedger(
  state: RouletteAutomationSimState,
  ledger: readonly StrategyGlobalLedgerEntry[],
  onSettled?: (entry: StrategyGlobalLedgerEntry) => void,
): RouletteAutomationSimState {
  const bet = state.openBet;
  if (!bet) return state;

  const entry = findLedgerEntryForOpenBet(bet, ledger);
  if (!entry || entry.resultNumber == null) return state;
  if (isSpinResultAlreadySettled(state, entry.tableId, entry.resultNumber)) return state;
  const next = settleOpenBetEntry(state, entry, bet.tableLabel);
  if (next !== state) onSettled?.(entry);
  return next;
}

/** Liquida aposta aberta quando chegou giro novo (fallback se ledger/flash atrasarem). */
export function trySettleOpenBetFromSpin(
  state: RouletteAutomationSimState,
  histories: Record<number, readonly number[]>,
  localProcessed: Set<string>,
  onSettled?: (entry: StrategyGlobalLedgerEntry) => void,
  ledger: readonly StrategyGlobalLedgerEntry[] = [],
): RouletteAutomationSimState {
  const bet = state.openBet;
  if (
    !bet?.umActive &&
    !bet?.activeCrossing &&
    !bet?.rotacaoActive &&
    !isZoneFibonacciStrategy(bet?.strategy)
  ) {
    return state;
  }

  const arrived = openBetSpinArrived(bet, histories);
  if (!arrived) return state;

  const { resultNumber, head } = arrived;
  if (isSpinResultAlreadySettled(state, bet.tableId, resultNumber)) return state;

  const key = `spin:${bet.tableId}:${resultNumber}:${head}`;
  if (localProcessed.has(key)) return state;

  const ledgerEntry = findLedgerEntryForOpenBet(bet, ledger, resultNumber);
  if (ledgerEntry) {
    localProcessed.add(key);
    const next = settleOpenBetEntry(state, ledgerEntry, bet.tableLabel);
    if (next !== state) onSettled?.(ledgerEntry);
    return next;
  }

  if (isZoneFibonacciStrategy(bet.strategy)) {
    const active = activeFibonacciViewFromBet(bet);
    if (!active) return state;
    const won = evaluateZoneFibonacciRound(resultNumber, active.zone) === "W";
    localProcessed.add(key);
    const entry = ledgerEntryFromSpinSettlement(bet, resultNumber, won);
    const next = settleOpenBetEntry(state, entry, bet.tableLabel);
    if (next !== state) onSettled?.(entry);
    return next;
  }

  if (bet.activeCrossing) {
    const outcome = evaluateDoisFatoresRound(resultNumber, bet.activeCrossing);
    if (outcome === "continue") {
      localProcessed.add(key);
      return { ...state, openBet: null };
    }
    const won = outcome === "W";
    localProcessed.add(key);
    const entry = ledgerEntryFromSpinSettlement(bet, resultNumber, won);
    const next = settleOpenBetEntry(state, entry, bet.tableLabel);
    if (next !== state) onSettled?.(entry);
    return next;
  }

  const outcome = evaluateUmFatorRound(resultNumber, bet.umActive!);
  const won = outcome === "W";
  localProcessed.add(key);

  const entry = ledgerEntryFromSpinSettlement(bet, resultNumber, won);
  const next = settleOpenBetEntry(state, entry, bet.tableLabel);
  if (next !== state) onSettled?.(entry);
  return next;
}

export function applyCapturedUmFatorFlashes(
  state: RouletteAutomationSimState,
  flashes: readonly UmFatorPlacarFlashLike[],
  histories: Record<number, readonly number[]>,
  localProcessed: Set<string>,
  onSettled?: (entry: StrategyGlobalLedgerEntry) => void,
): RouletteAutomationSimState {
  let next = state;
  for (const flash of flashes) {
    if (!next.openBet || next.openBet.tableId !== flash.tableId) continue;
    const bet = next.openBet;
    if (isSpinResultAlreadySettled(next, flash.tableId, flash.resultNumber)) continue;

    const arrived = openBetSpinArrived(bet, histories);
    if (!arrived || arrived.resultNumber !== flash.resultNumber) continue;

    const key = umFatorFlashSettlementKey(flash, bet.recovery);
    if (localProcessed.has(key)) continue;
    const entry = ledgerEntryFromFlashSettlement(flash, bet);
    const settled = settleFromUmFatorFlash(next, flash, bet.tableLabel, localProcessed);
    if (settled !== next) onSettled?.(entry);
    next = settled;
  }
  return next;
}

function trimChart(points: AutomationSimChartPoint[]): AutomationSimChartPoint[] {
  if (points.length <= ROULETTE_AUTOMATION_MAX_CHART_POINTS) return points;
  return points.slice(-ROULETTE_AUTOMATION_MAX_CHART_POINTS);
}

export function formatChartTime(ts: number, withSeconds = false): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

/** Série do gráfico: banca no início do ciclo + um ponto por rodada liquidada. */
export function buildAutomationChartData(state: RouletteAutomationSimState): AutomationSimChartPoint[] {
  const opening =
    typeof state.cycleOpeningBalance === "number" && Number.isFinite(state.cycleOpeningBalance)
      ? state.cycleOpeningBalance
      : state.balance;
  const points: AutomationSimChartPoint[] = [
    {
      ts: state.startedAt,
      label: formatChartTime(state.startedAt),
      balance: opening,
    },
  ];

  for (const round of [...state.rounds].reverse()) {
    points.push({
      ts: round.ts,
      label: formatChartTime(round.ts, true),
      balance: round.balanceAfter,
    });
  }

  return trimChart(points);
}

/** Converte a série de saldo em velas (uma vela por liquidação). */
export function chartPointsToCandlesticks(
  points: readonly AutomationSimChartPoint[],
): AutomationCandlestickPoint[] {
  if (points.length < 2) return [];
  const candles: AutomationCandlestickPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const open = prev.balance;
    const close = curr.balance;
    candles.push({
      ts: curr.ts,
      label: curr.label,
      open,
      close,
      high: Math.max(open, close),
      low: Math.min(open, close),
    });
  }
  return candles;
}

export function automationCandlestickYDomain(
  candles: readonly AutomationCandlestickPoint[],
): [number, number] {
  if (candles.length === 0) {
    return automationChartYDomain([]);
  }
  const vals = candles.flatMap((c) => [c.high, c.low]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  const pad = Math.max(span * 0.2, span === 0 ? 250 : 80);
  return [min - pad, max + pad];
}

export function automationChartYDomain(
  points: readonly AutomationSimChartPoint[],
): [number, number] {
  if (points.length === 0) {
    return [ROULETTE_AUTOMATION_INITIAL_BANK - 500, ROULETTE_AUTOMATION_INITIAL_BANK + 500];
  }
  const vals = points.map((p) => p.balance);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  const pad = Math.max(span * 0.2, span === 0 ? 250 : 80);
  return [min - pad, max + pad];
}

/** Formata ticks do eixo Y sem repetir «50.0k» quando a variação é pequena. */
export function formatAutomationChartYTick(value: number, domain: readonly [number, number]): string {
  const span = domain[1] - domain[0];
  if (span <= 800) return formatBrlCompact(value);
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

function formatBrlCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function freshAutomationSimState(now = Date.now()): RouletteAutomationSimState {
  const state: RouletteAutomationSimState = {
    startedAt: now,
    cycleOpeningBalance: ROULETTE_AUTOMATION_INITIAL_BANK,
    balance: ROULETTE_AUTOMATION_INITIAL_BANK,
    capitalRegisteredAt: null,
    rounds: [],
    chart: [],
    processedKeys: [],
    spinCounter: 0,
    openBet: null,
    extractFormatVersion: AUTOMATION_EXTRACT_FORMAT_VERSION,
  };
  return { ...state, chart: buildAutomationChartData(state) };
}

/** @deprecated Ciclo visual — não reinicia saldo após capital registado no extrato. */
export function restartAutomationSimCycle(
  state: RouletteAutomationSimState,
  now = Date.now(),
): RouletteAutomationSimState {
  if (state.capitalRegisteredAt != null) {
    return {
      ...state,
      openBet: null,
      chart: buildAutomationChartData(state),
    };
  }
  const next: RouletteAutomationSimState = {
    ...state,
    startedAt: now,
    cycleOpeningBalance: state.balance,
    rounds: [],
    spinCounter: 0,
    openBet: null,
    chart: [],
  };
  return { ...next, chart: buildAutomationChartData(next) };
}

export function shouldRestartAutomationCycleAfterSettlement(
  _entry: Pick<StrategyGlobalLedgerEntry, "kind">,
): boolean {
  return false;
}

export function shouldResetAutomationSim(_startedAt: number, _now = Date.now()): boolean {
  return false;
}

export function parseAutomationSimState(raw: unknown): RouletteAutomationSimState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<RouletteAutomationSimState>;
  if (typeof o.startedAt !== "number" || typeof o.balance !== "number") return null;
  return {
    startedAt: o.startedAt,
    cycleOpeningBalance:
      typeof o.cycleOpeningBalance === "number" && Number.isFinite(o.cycleOpeningBalance)
        ? o.cycleOpeningBalance
        : o.balance,
    balance: o.balance,
    capitalRegisteredAt:
      typeof o.capitalRegisteredAt === "number" && Number.isFinite(o.capitalRegisteredAt)
        ? o.capitalRegisteredAt
        : null,
    rounds: Array.isArray(o.rounds) ? o.rounds : [],
    chart: Array.isArray(o.chart) ? o.chart : [],
    processedKeys: Array.isArray(o.processedKeys) ? o.processedKeys : [],
    spinCounter: typeof o.spinCounter === "number" ? o.spinCounter : 0,
    extractFormatVersion:
      typeof o.extractFormatVersion === "number" && Number.isFinite(o.extractFormatVersion)
        ? o.extractFormatVersion
        : 0,
    openBet: o.openBet
      ? {
          ...o.openBet,
          openedHead:
            typeof (o.openBet as AutomationOpenBet).openedHead === "string"
              ? (o.openBet as AutomationOpenBet).openedHead
              : "0",
        }
      : null,
  };
}
