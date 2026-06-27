import type {
  StrategyGlobalLedgerEntry,
  StrategyGlobalSnapshot,
} from "@/lib/roulette/strategyGlobalTypes";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import {
  tableAcceptableForRotatingRoomEntry,
} from "@/lib/roulette/liveTableBettingWindow";
import type { RotatingRoomSimulatorIndication } from "@/lib/roulette/rotatingRoomSimulatorTypes";
import {
  evaluateUmFatorRound,
  umFatorAlertLabel,
  UM_FATOR_MAX_RECOVERY,
  type UmFatorActive,
} from "@/lib/roulette/umFatorStrategy";

export const ROULETTE_AUTOMATION_INITIAL_BANK = 50_000;
/** Aposta inicial fixa na roleta (sem centavos): R$ 50 → 100 → 200 → 400 → 800 → 1600. */
export const ROULETTE_AUTOMATION_BASE_STAKE = 50;
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
  umActive?: UmFatorActive;
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
};

export type AutomationSimChartPoint = {
  ts: number;
  label: string;
  balance: number;
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
};

export function formatStakeBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Sempre R$ 50 — stake não depende mais da banca. */
export function baseStakeFromBalance(_balance?: number): number {
  return ROULETTE_AUTOMATION_BASE_STAKE;
}

/** R$ 50 × 2^recuperação (máx. rec5 = R$ 1600); após isso volta a R$ 50. */
export function stakeForRecovery(recovery: number, _balance?: number): number {
  const level = Math.max(0, Math.floor(recovery));
  if (level > UM_FATOR_MAX_RECOVERY) return ROULETTE_AUTOMATION_BASE_STAKE;
  return ROULETTE_AUTOMATION_BASE_STAKE * 2 ** level;
}

export function pendingSignalFromSnapshot(
  snapshot: StrategyGlobalSnapshot,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
): AutomationPendingSignal | null {
  return pendingSignalFromUmFatorSession(snapshot.um1fator, balance, histories);
}

/** Mesma lógica do cartão da sala rotativa — só com janela de apostas aberta (início do gatilho). */
export function pendingSignalFromUmFatorSession(
  session: Pick<
    StrategyGlobalSnapshot["um1fator"],
    "showTapeteSignal" | "currentTableId" | "currentRecovery" | "umActive"
  >,
  balance = ROULETTE_AUTOMATION_INITIAL_BANK,
  histories?: Record<number, readonly number[]>,
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
    stake: stakeForRecovery(recovery, balance),
    umActive: session.umActive,
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

export function ledgerResultKey(entry: Pick<StrategyGlobalLedgerEntry, "tableId" | "recovery" | "resultNumber">): string | null {
  if (entry.resultNumber == null) return null;
  return `${entry.tableId}:${entry.recovery}:${entry.resultNumber}`;
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
    kind: won ? "win" : ledgerKindForSpinLoss(bet.recovery),
    resultNumber,
  };
}

function ledgerKindForSpinLoss(recovery: number): StrategyGlobalLedgerEntry["kind"] {
  return recovery >= UM_FATOR_MAX_RECOVERY ? "loss" : "recovery";
}

export function roundBadge(entry: StrategyGlobalLedgerEntry): AutomationRoundBadge {
  if (entry.won) return "VITÓRIA";
  if (entry.kind === "loss") return "DERROTA";
  if (entry.recovery > 0) return "RECUPERAÇÃO";
  return entry.kind === "recovery" ? "RECUPERAÇÃO" : "SINAL";
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
  now = Date.now(),
): RouletteAutomationSimState {
  if (state.openBet?.signalId === pending.signalId) return state;
  if (state.openBet && state.openBet.signalId !== pending.signalId) return state;
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
  return state.rounds.some((r) => r.tableId === tableId && r.resultNumber === resultNumber);
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

/** Liquida aposta — saldo vem do extrato (passar balanceAfter) ou calcula localmente em dev. */
export function settleOpenBetEntry(
  state: RouletteAutomationSimState,
  entry: StrategyGlobalLedgerEntry,
  tableLabel: string,
  balanceAfter?: number,
): RouletteAutomationSimState {
  if (
    entry.resultNumber != null &&
    isSpinResultAlreadySettled(state, entry.tableId, entry.resultNumber)
  ) {
    return state;
  }

  const key = ledgerEntryKey(entry);
  if (state.processedKeys.includes(key)) return state;

  const stake = stakeForRecovery(entry.recovery, state.balance);
  const net = entry.won ? stake : -stake;
  const balance =
    typeof balanceAfter === "number" && Number.isFinite(balanceAfter)
      ? balanceAfter
      : state.balance + net;

  const spinIndex = state.spinCounter;
  const round: AutomationSimRound = {
    id: ledgerEntryKey(entry),
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
  };

  const next: RouletteAutomationSimState = {
    ...state,
    balance,
    openBet: null,
    spinCounter: spinIndex + 1,
    rounds: [round, ...state.rounds].slice(0, 80),
    processedKeys: [...state.processedKeys, ledgerEntryKey(entry)].slice(-400),
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
): RouletteAutomationSimState {
  if (!pending) return state;
  return placeOpenBet(state, pending, openedHead);
}

export function settleLedgerEntry(
  state: RouletteAutomationSimState,
  entry: StrategyGlobalLedgerEntry,
  tableLabel: string,
  balanceAfter?: number,
): RouletteAutomationSimState {
  return settleOpenBetEntry(state, entry, tableLabel, balanceAfter);
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

/** Reconstrói banca/rodadas só a partir do ledger (ignora saldo corrompido do servidor). */
export function rebuildAutomationSimFromLedger(
  startedAt: number,
  ledger: readonly StrategyGlobalLedgerEntry[],
  openingBalance = ROULETTE_AUTOMATION_INITIAL_BANK,
): RouletteAutomationSimState {
  let state: RouletteAutomationSimState = {
    ...freshAutomationSimState(startedAt),
    balance: openingBalance,
    cycleOpeningBalance: openingBalance,
  };
  state = { ...state, chart: buildAutomationChartData(state) };
  const sorted = [...ledger]
    .filter((entry) => entry.ts >= startedAt)
    .sort((a, b) => a.ts - b.ts);

  for (const entry of sorted) {
    state = settleLedgerEntry(state, entry, lobbyTableDisplayName(entry.tableId));
  }

  return state;
}

export function openBetWasSettled(
  state: RouletteAutomationSimState,
  bet: AutomationOpenBet,
): boolean {
  return state.rounds.some(
    (r) =>
      r.tableId === bet.tableId &&
      r.recovery === bet.recovery &&
      r.ts >= bet.openedAt - 3000,
  );
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

  const candidates = ledger.filter(
    (e) =>
      e.tableId === bet.tableId &&
      e.recovery === bet.recovery &&
      e.ts >= bet.openedAt - 3000 &&
      e.resultNumber != null,
  );
  if (candidates.length === 0) return state;

  const entry = [...candidates].sort((a, b) => a.ts - b.ts).at(-1)!;
  if (isSpinResultAlreadySettled(state, entry.tableId, entry.resultNumber!)) return state;
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
): RouletteAutomationSimState {
  const bet = state.openBet;
  if (!bet?.umActive) return state;

  const arrived = openBetSpinArrived(bet, histories);
  if (!arrived) return state;

  const { resultNumber, head } = arrived;
  if (isSpinResultAlreadySettled(state, bet.tableId, resultNumber)) return state;

  const key = `spin:${bet.tableId}:${resultNumber}:${bet.recovery}:${head}`;
  if (localProcessed.has(key)) return state;

  const outcome = evaluateUmFatorRound(resultNumber, bet.umActive);
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
