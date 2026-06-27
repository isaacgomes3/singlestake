import {
  buildAutomationChartData,
  ledgerEntryKey,
  pendingSignalFromSnapshot,
  ROULETTE_AUTOMATION_INITIAL_BANK,
  settleOpenBetEntry,
  syncOpenBetFromPending,
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
        await replayAutomationSimFromLedger(globalState.ledger.um1fator, strategySnapshot);
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

  const stake = (await import("@/lib/back-office/rouletteAutomationSim")).stakeForRecovery(
    entry.recovery,
    state.balance,
  );

  let balanceAfter: number | undefined;
  if (capitalReady) {
    const ledgerResult = await settleGlobalAutomationInLedger({
      settleKey: key,
      won: entry.won,
      stake,
      tableLabel,
      recovery: entry.recovery,
      kind: entry.kind,
    });
    if (ledgerResult == null) return state;
    balanceAfter = ledgerResult.balanceAfter;
  } else {
    balanceAfter = await getGlobalAutomationWalletBalance();
  }

  return settleOpenBetEntry(state, entry, tableLabel, balanceAfter);
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
  const pending = pendingSignalFromSnapshot(
    strategySnapshot,
    state.balance,
    strategySnapshot.tableHistories,
  );
  const next = syncOpenBetFromPending(state, pending);

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
): Promise<AutomationSimApiSnapshot | null> {
  if (!initialized) return null;

  await ensureCapitalAndSyncBalance();

  let state = getAutomationSimState();
  if (entry.ts < state.startedAt) return null;

  const key = ledgerEntryKey(entry);
  if (state.processedKeys.includes(key)) return null;

  state = await settleAutomationEntry(state, entry, lobbyTableDisplayName(entry.tableId));
  replaceAutomationSimState(state);

  return publish(strategySnapshot);
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
  const withOpen = syncOpenBetFromPending(getAutomationSimState(), pending);
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
