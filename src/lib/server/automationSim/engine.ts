import {

  pendingSignalFromSnapshot,

  restartAutomationSimCycle,

  settleOpenBetEntry,

  shouldRestartAutomationCycleAfterSettlement,

  syncOpenBetFromPending,

  ledgerEntryKey,

} from "@/lib/back-office/rouletteAutomationSim";

import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";

import type { AutomationSimApiSnapshot } from "@/lib/roulette/automationSimTypes";

import type { StrategyGlobalLedgerEntry, StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";



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



export async function ensureAutomationSimEngine(): Promise<void> {

  if (initialized) return;

  if (!initPromise) {

    initPromise = (async () => {

      await initAutomationSimState();

      initialized = true;



      if (!replayedLedger) {

        replayedLedger = true;

        const { getStrategyGlobalState } = await import("@/lib/server/strategyGlobal/persistence");

        const { buildStrategyGlobalSnapshot } = await import("@/lib/server/strategyGlobal/engine");

        const globalState = getStrategyGlobalState();

        const strategySnapshot = buildStrategyGlobalSnapshot(globalState);

        replayAutomationSimFromLedger(globalState.ledger.um1fator, strategySnapshot);

      }

    })().catch((err) => {

      initPromise = null;

      throw err;

    });

  }

  await initPromise;

}



function settleAutomationEntry(
  state: ReturnType<typeof getAutomationSimState>,
  entry: StrategyGlobalLedgerEntry,
  tableLabel: string,
) {
  let next = settleOpenBetEntry(state, entry, tableLabel);
  if (shouldRestartAutomationCycleAfterSettlement(entry)) {
    next = restartAutomationSimCycle(next);
  }
  return next;
}

function maybeResetCycle(state = getAutomationSimState()) {

  return state;

}



function buildSnapshotBody(

  strategySnapshot: StrategyGlobalSnapshot,

  state = getAutomationSimState(),

): AutomationSimApiSnapshot {

  return {

    revision: getAutomationSimRevision(),

    updatedAt: Date.now(),

    state,

    pendingSignal: pendingSignalFromSnapshot(strategySnapshot, state.balance),

  };

}



export function buildAutomationSimSnapshot(

  strategySnapshot: StrategyGlobalSnapshot,

): AutomationSimApiSnapshot {

  maybeResetCycle();

  return buildSnapshotBody(strategySnapshot);

}



function publish(strategySnapshot: StrategyGlobalSnapshot): AutomationSimApiSnapshot {

  const snapshot = buildSnapshotBody(strategySnapshot);

  broadcastAutomationSim(snapshot);

  return snapshot;

}



/** Sincroniza entrada em jogo quando há sinal activo na sala rotativa. */

export function syncAutomationSimWithStrategy(
  strategySnapshot: StrategyGlobalSnapshot,
  options?: { broadcast?: boolean },
): AutomationSimApiSnapshot {
  if (!initialized) return buildAutomationSimSnapshot(strategySnapshot);

  let state = maybeResetCycle();

  const pending = pendingSignalFromSnapshot(strategySnapshot);

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



export function ingestAutomationSimLedgerEntry(

  entry: StrategyGlobalLedgerEntry,

  strategySnapshot: StrategyGlobalSnapshot,

): AutomationSimApiSnapshot | null {

  if (!initialized) return null;



  let state = maybeResetCycle();

  const key = ledgerEntryKey(entry);

  if (state.processedKeys.includes(key)) return null;

  if (entry.ts < state.startedAt) return null;



  state = settleAutomationEntry(state, entry, lobbyTableDisplayName(entry.tableId));

  replaceAutomationSimState(state);



  return publish(strategySnapshot);

}



export function replayAutomationSimFromLedger(

  entries: readonly StrategyGlobalLedgerEntry[],

  strategySnapshot: StrategyGlobalSnapshot,

): AutomationSimApiSnapshot {

  let state = maybeResetCycle();

  let changed = false;



  for (const entry of entries) {

    if (entry.ts < state.startedAt) continue;

    const key = ledgerEntryKey(entry);

    if (state.processedKeys.includes(key)) continue;

    state = settleAutomationEntry(state, entry, lobbyTableDisplayName(entry.tableId));

    changed = true;

  }



  if (changed) {

    replaceAutomationSimState(state);

  }



  const pending = pendingSignalFromSnapshot(strategySnapshot);

  const withOpen = syncOpenBetFromPending(getAutomationSimState(), pending);

  if (withOpen !== getAutomationSimState()) {

    replaceAutomationSimState(withOpen);

  }



  return publish(strategySnapshot);

}



export function getAutomationSimSnapshotOrThrow(
  strategySnapshot: StrategyGlobalSnapshot,
): AutomationSimApiSnapshot {
  return syncAutomationSimWithStrategy(strategySnapshot, { broadcast: false });
}


