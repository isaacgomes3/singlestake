import {
  buildAutomationChartData,
  isSpinResultAlreadySettled,
  ledgerEntryKey,
  pendingSignalFromSnapshot,
  rebuildAutomationSimDisplayFromLedger,
  recalculateAutomationRoundBalances,
  ROULETTE_AUTOMATION_INITIAL_BANK,
  settleOpenBetEntry,
  spinHead,
  spinSettleKey,
  syncOpenBetFromPending,
  type RouletteAutomationSimState,
} from "@/lib/back-office/rouletteAutomationSim";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import type { AutomationSimApiSnapshot } from "@/lib/roulette/automationSimTypes";
import type { StrategyGlobalLedgerEntry, StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";
import {
  ensureGlobalAutomationCapitalRegistered,
  getGlobalAutomationWalletBalance,
  settleGlobalAutomationInLedger,
} from "@/lib/server/finance/global-automation-capital";

import { broadcastAutomationSim } from "./broadcast";
import {
  getAutomationSimRevision,
  getAutomationSimState,
  initAutomationSimState,
  replaceAutomationSimState,
} from "./persistence";

let initialized = false;
let initPromise: Promise<void> | null = null;
let replayedLedger = false;
let capitalReady = false;

async function ensureCapitalAndSyncBalance(): Promise<void> {
  const { registeredAt, balance } = await ensureGlobalAutomationCapitalRegistered();
  capitalReady = true;
  const state = getAutomationSimState();
  const isFirstRegister = state.capitalRegisteredAt == null;
  if (isFirstRegister || state.balance !== balance) {
    const next = {
      ...state,
      balance,
      cycleOpeningBalance: isFirstRegister
        ? ROULETTE_AUTOMATION_INITIAL_BANK
        : state.cycleOpeningBalance,
      capitalRegisteredAt: state.capitalRegisteredAt ?? registeredAt,
    };
    replaceAutomationSimState({ ...next, chart: buildAutomationChartData(next) });
  }
}

export async function ensureAutomationSimEngine(): Promise<void> {
  if (initialized) return;

  if (!initPromise) {
    initPromise = (async () => {
      await initAutomationSimState();
      await ensureCapitalAndSyncBalance();
      initialized = true;

      if (!replayedLedger) {
        replayedLedger = true;
        const { getStrategyGlobalState } = await import("@/lib/server/strategyGlobal/persistence");
        const { buildStrategyGlobalSnapshot } = await import("@/lib/server/strategyGlobal/engine");
        const globalState = getStrategyGlobalState();
        const strategySnapshot = buildStrategyGlobalSnapshot(globalState);
        await rebuildAutomationSimHistoryFromLedger(strategySnapshot, {
          broadcast: false,
          fullLedger: globalState.ledger.um1fator,
        });
      }
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  await initPromise;
}

async function settleAutomationEntry(
  state: ReturnType<typeof getAutomationSimState>,
  entry: StrategyGlobalLedgerEntry,
  tableLabel: string,
) {
  const key = ledgerEntryKey(entry);
  if (state.processedKeys.includes(key)) return state;

  const spinKey =
    entry.resultNumber != null ? spinSettleKey(entry.tableId, entry.resultNumber) : null;
  if (spinKey != null && state.processedKeys.includes(spinKey)) return state;

  const stake = (await import("@/lib/back-office/rouletteAutomationSim")).stakeForRecovery(
    entry.recovery,
    state.balance,
  );

  const settleKey = spinKey ?? key;

  if (capitalReady) {
    const ledgerResult = await settleGlobalAutomationInLedger({
      settleKey,
      won: entry.won,
      stake,
      tableLabel,
      recovery: entry.recovery,
      kind: entry.kind,
    });
    if (ledgerResult == null) return state;
  }

  const next = settleOpenBetEntry(state, entry, tableLabel);
  if (!capitalReady) return next;

  const walletBalance = await getGlobalAutomationWalletBalance();
  return { ...next, balance: walletBalance, chart: buildAutomationChartData({ ...next, balance: walletBalance }) };
}

function buildSnapshotBody(
  strategySnapshot: StrategyGlobalSnapshot,
  state = getAutomationSimState(),
): AutomationSimApiSnapshot {
  return {
    revision: getAutomationSimRevision(),
    updatedAt: Date.now(),
    state,
    pendingSignal: pendingSignalFromSnapshot(
      strategySnapshot,
      state.balance,
      strategySnapshot.tableHistories,
    ),
  };
}

export function buildAutomationSimSnapshot(
  strategySnapshot: StrategyGlobalSnapshot,
): AutomationSimApiSnapshot {
  return buildSnapshotBody(strategySnapshot);
}

function publish(strategySnapshot: StrategyGlobalSnapshot): AutomationSimApiSnapshot {
  const snapshot = buildSnapshotBody(strategySnapshot);
  broadcastAutomationSim(snapshot);
  return snapshot;
}

/** Sincroniza entrada em jogo quando há sinal activo na sala rotativa. */
export async function syncAutomationSimWithStrategy(
  strategySnapshot: StrategyGlobalSnapshot,
  options?: { broadcast?: boolean },
): Promise<AutomationSimApiSnapshot> {
  if (!initialized) return buildAutomationSimSnapshot(strategySnapshot);

  await ensureCapitalAndSyncBalance();

  let state = getAutomationSimState();
  const openBet = state.openBet;
  if (openBet?.tableId != null) {
    const head = strategySnapshot.tableHistories[openBet.tableId]?.[0];
    if (head != null && isSpinResultAlreadySettled(state, openBet.tableId, head)) {
      state = { ...state, openBet: null };
      replaceAutomationSimState(state);
    }
  }

  const pending = pendingSignalFromSnapshot(
    strategySnapshot,
    state.balance,
    strategySnapshot.tableHistories,
  );
  const openedHead =
    pending?.tableId != null
      ? spinHead(strategySnapshot.tableHistories[pending.tableId] ?? [])
      : "0";
  const next = syncOpenBetFromPending(
    state,
    pending,
    openedHead,
    strategySnapshot.tableHistories,
  );

  if (next !== state) {
    replaceAutomationSimState(next);
    state = next;
  }

  const snapshot = buildSnapshotBody(strategySnapshot);
  if (options?.broadcast !== false) {
    broadcastAutomationSim(snapshot);
  }
  return snapshot;
}

export async function ingestAutomationSimLedgerEntry(
  entry: StrategyGlobalLedgerEntry,
  strategySnapshot: StrategyGlobalSnapshot,
  options?: { publish?: boolean },
): Promise<AutomationSimApiSnapshot | null> {
  if (!initialized) return null;

  await ensureCapitalAndSyncBalance();

  let state = getAutomationSimState();
  if (entry.ts < state.startedAt) return null;

  const key = ledgerEntryKey(entry);
  if (state.processedKeys.includes(key)) return null;
  if (entry.resultNumber != null) {
    const spinKey = spinSettleKey(entry.tableId, entry.resultNumber);
    if (state.processedKeys.includes(spinKey)) return null;
  }

  state = await settleAutomationEntry(state, entry, lobbyTableDisplayName(entry.tableId));
  replaceAutomationSimState(state);

  if (options?.publish === false) return null;
  return publish(strategySnapshot);
}

export async function rebuildAutomationSimHistoryFromLedger(
  strategySnapshot: StrategyGlobalSnapshot,
  options?: {
    broadcast?: boolean;
    fullLedger?: readonly StrategyGlobalLedgerEntry[];
  },
): Promise<AutomationSimApiSnapshot> {
  await ensureCapitalAndSyncBalance();

  const current = getAutomationSimState();
  const ledger =
    options?.fullLedger ??
    (await import("@/lib/server/strategyGlobal/persistence")).getStrategyGlobalState().ledger
      .um1fator;

  const floorTs = current.capitalRegisteredAt ?? current.startedAt;
  const openingBalance =
    typeof current.cycleOpeningBalance === "number" && Number.isFinite(current.cycleOpeningBalance)
      ? current.cycleOpeningBalance
      : ROULETTE_AUTOMATION_INITIAL_BANK;

  const rebuilt = rebuildAutomationSimDisplayFromLedger(floorTs, ledger, openingBalance);
  const walletBalance = await getGlobalAutomationWalletBalance();

  const chainFixed = recalculateAutomationRoundBalances({
    ...rebuilt,
    startedAt: current.startedAt,
    capitalRegisteredAt: current.capitalRegisteredAt,
  });

  const nextState: RouletteAutomationSimState = {
    ...chainFixed,
    balance: walletBalance,
    chart: buildAutomationChartData({ ...chainFixed, balance: walletBalance }),
    openBet: null,
  };

  replaceAutomationSimState(nextState);

  return syncAutomationSimWithStrategy(strategySnapshot, {
    broadcast: options?.broadcast !== false,
  });
}

export async function replayAutomationSimFromLedger(
  entries: readonly StrategyGlobalLedgerEntry[],
  strategySnapshot: StrategyGlobalSnapshot,
): Promise<AutomationSimApiSnapshot> {
  await ensureCapitalAndSyncBalance();

  let state = getAutomationSimState();
  let changed = false;

  for (const entry of entries) {
    if (entry.ts < state.startedAt) continue;
    const key = ledgerEntryKey(entry);
    if (state.processedKeys.includes(key)) continue;
    state = await settleAutomationEntry(state, entry, lobbyTableDisplayName(entry.tableId));
    changed = true;
  }

  if (changed) {
    replaceAutomationSimState(state);
  } else {
    const balance = await getGlobalAutomationWalletBalance();
    if (state.balance !== balance) {
      replaceAutomationSimState({ ...state, balance });
    }
  }

  const pending = pendingSignalFromSnapshot(
    strategySnapshot,
    getAutomationSimState().balance,
    strategySnapshot.tableHistories,
  );
  const openedHead =
    pending?.tableId != null
      ? spinHead(strategySnapshot.tableHistories[pending.tableId] ?? [])
      : "0";
  const withOpen = syncOpenBetFromPending(
    getAutomationSimState(),
    pending,
    openedHead,
    strategySnapshot.tableHistories,
  );
  if (withOpen !== getAutomationSimState()) {
    replaceAutomationSimState(withOpen);
  }

  return publish(strategySnapshot);
}

export async function getAutomationSimSnapshotOrThrow(
  strategySnapshot: StrategyGlobalSnapshot,
): Promise<AutomationSimApiSnapshot> {
  return syncAutomationSimWithStrategy(strategySnapshot, { broadcast: false });
}
