import {
  AUTOMATION_STOP_PAUSE_MS,
  automationBlocksNewEntries,
  buildAutomationConfigDto,
  evaluateAutomationAutoPause,
  type GlobalAutomationConfigDto,
} from "@/lib/back-office/automation-config";
import { crossingGatilhoEnabledFromMap, enabledFibonacciZoneKindsFromMap, enabledRepeticaoZoneKindsFromMap, isRotacaoGatilhoEnabled } from "@/lib/roulette/umFatorTriggerEnable";
import {
  finalizeAutomationSimState,
  globalAutomationLedgerFloorTs,
  globalAutomationOpeningBalance,
  globalAutomationSettleKey,
  isSpinResultAlreadySettled,
  ledgerEntryKey,
  pendingSignalFromSnapshot,
  rebuildAutomationSimDisplayFromLedger,
  settleOpenBetEntry,
  spinHead,
  syncOpenBetFromPending,
  type RouletteAutomationSimState,
} from "@/lib/back-office/rouletteAutomationSim";
import { reviewMartingaleSettlement } from "@/lib/back-office/martingaleSequenceReview";
import { isAutomationProfile } from "@/lib/app-profile";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import type { AutomationSimApiSnapshot } from "@/lib/roulette/automationSimTypes";
import type { StrategyGlobalLedgerEntry, StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";
import {
  isZoneFibonacciStrategy,
  zoneFibonacciSessionEnded,
  zoneFibonacciSnapshotFromGlobal,
} from "@/lib/roulette/zoneFibonacciFamily";
import {
  ensureGlobalAutomationCapitalRegistered,
  getGlobalAutomationWalletBalance,
  isGlobalAutomationSettleRecorded,
  settleGlobalAutomationInLedger,
} from "@/lib/server/finance/global-automation-capital";

import { broadcastAutomationSim } from "./broadcast";
import { getAutomationConfig, initAutomationConfig, saveAutomationConfig } from "./config";
import {
  getAutomationSimRevision,
  getAutomationSimState,
  initAutomationSimState,
  replaceAutomationSimState,
} from "./persistence";
import type { StrategyGlobalPersistedState } from "@/lib/server/strategyGlobal/persistence";

let initialized = false;
let initPromise: Promise<void> | null = null;
let replayedLedger = false;
let capitalReady = false;
let automationSimMutationChain: Promise<unknown> = Promise.resolve();

/** Evita liquidações paralelas (SSE + extensão) duplicarem linhas no histórico. */
function withAutomationSimMutationLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = automationSimMutationChain.then(fn, fn);
  automationSimMutationChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function combinedStrategyLedger(
  ledger: Pick<
    StrategyGlobalPersistedState["ledger"],
    "um1fator" | "dois2fatores" | "fibonacci" | "repeticao" | "rotacao"
  >,
): StrategyGlobalLedgerEntry[] {
  return [
    ...ledger.um1fator,
    ...ledger.dois2fatores,
    ...ledger.fibonacci,
    ...ledger.repeticao,
    ...ledger.rotacao,
  ].sort((a, b) => a.ts - b.ts);
}

async function ensureCapitalAndSyncBalance(): Promise<void> {
  const { registeredAt, balance } = await ensureGlobalAutomationCapitalRegistered();
  capitalReady = true;
  const state = getAutomationSimState();
  const isFirstRegister = state.capitalRegisteredAt == null;
  const openingBalance = globalAutomationOpeningBalance({
    capitalRegisteredAt: state.capitalRegisteredAt ?? registeredAt,
    cycleOpeningBalance: state.cycleOpeningBalance,
  });
  if (isFirstRegister || state.balance !== balance || state.cycleOpeningBalance !== openingBalance) {
    const next = finalizeAutomationSimState(
      {
        ...state,
        cycleOpeningBalance: openingBalance,
        capitalRegisteredAt: state.capitalRegisteredAt ?? registeredAt,
      },
      balance,
    );
    replaceAutomationSimState(next);
  }
}

let configReady = false;

async function ensureAutomationConfigLoaded(): Promise<void> {
  if (configReady) return;
  await initAutomationConfig();
  configReady = true;
}

function configDtoForBalance(balance: number): GlobalAutomationConfigDto {
  return buildAutomationConfigDto(getAutomationConfig(), balance);
}

async function buildAutomationConfigDtoAsync(balance: number): Promise<GlobalAutomationConfigDto> {
  await ensureAutomationConfigLoaded();
  return configDtoForBalance(balance);
}

async function maybeAutoResumeAutomation(): Promise<boolean> {
  await ensureAutomationConfigLoaded();
  const config = getAutomationConfig();
  if (!config.paused) return false;
  if (config.pauseReason !== "stop-win" && config.pauseReason !== "stop-loss") return false;
  const pausedAt = config.pausedAt ?? config.updatedAt;
  if (Date.now() - pausedAt < AUTOMATION_STOP_PAUSE_MS) return false;
  await saveAutomationConfig({ paused: false, pauseReason: null, pausedAt: null });
  return true;
}

async function maybeAutoPauseAutomation(balance: number): Promise<void> {
  await ensureAutomationConfigLoaded();
  const config = getAutomationConfig();
  if (config.paused) return;
  const auto = evaluateAutomationAutoPause(config, balance);
  if (auto.paused && auto.reason) {
    await saveAutomationConfig({
      paused: true,
      pauseReason: auto.reason,
      pausedAt: Date.now(),
    });
  }
}

function buildSnapshotBody(
  strategySnapshot: StrategyGlobalSnapshot,
  configDto: GlobalAutomationConfigDto,
  state = getAutomationSimState(),
): AutomationSimApiSnapshot {
  const resolved = configDto ?? configDtoForBalance(state.balance);
  const blockNewEntries = resolved.blocksNewEntries;
  return {
    revision: getAutomationSimRevision(),
    updatedAt: Date.now(),
    state,
    pendingSignal: pendingSignalFromSnapshot(
      strategySnapshot,
      state.balance,
      strategySnapshot.tableHistories,
      {
        baseStake: resolved.baseStake,
        blockNewEntries,
        crossingEnabled: crossingGatilhoEnabledFromMap(getAutomationConfig().enabledTriggers),
        fibonacciEnabled:
          enabledFibonacciZoneKindsFromMap(getAutomationConfig().enabledTriggers).length > 0,
        repeticaoEnabled:
          enabledRepeticaoZoneKindsFromMap(getAutomationConfig().enabledTriggers).length > 0,
        rotacaoEnabled: isRotacaoGatilhoEnabled(),
      },
    ),
    config: resolved,
  };
}

async function reconcileAutomationSimPendingLedger(): Promise<boolean> {
  const { getStrategyGlobalState } = await import("@/lib/server/strategyGlobal/persistence");
  const ledger = combinedStrategyLedger(getStrategyGlobalState().ledger);
  let state = getAutomationSimState();
  const floorTs = globalAutomationLedgerFloorTs(state);
  let changed = false;

  for (const entry of ledger) {
    if (entry.ts < floorTs) continue;
    const key = ledgerEntryKey(entry);
    if (state.processedKeys.includes(key)) continue;
    const settleKey = globalAutomationSettleKey(entry);
    if (settleKey != null && state.processedKeys.includes(settleKey)) continue;

    const next = await settleAutomationEntry(state, entry, lobbyTableDisplayName(entry.tableId));
    if (next !== state) {
      state = next;
      changed = true;
    }
  }

  if (changed) {
    replaceAutomationSimState(state);
  }
  return changed;
}

async function buildFinalizedSnapshotBodyUnlocked(
  strategySnapshot: StrategyGlobalSnapshot,
): Promise<AutomationSimApiSnapshot> {
  await reconcileAutomationSimPendingLedger();
  const walletBalance = await getGlobalAutomationWalletBalance();
  await maybeAutoResumeAutomation();
  await maybeAutoPauseAutomation(walletBalance);
  const finalized = finalizeAutomationSimState(getAutomationSimState(), walletBalance);
  replaceAutomationSimState(finalized);
  const configDto = await buildAutomationConfigDtoAsync(walletBalance);
  return buildSnapshotBody(strategySnapshot, configDto, finalized);
}

async function buildFinalizedSnapshotBody(
  strategySnapshot: StrategyGlobalSnapshot,
): Promise<AutomationSimApiSnapshot> {
  return withAutomationSimMutationLock(() =>
    buildFinalizedSnapshotBodyUnlocked(strategySnapshot),
  );
}

export function buildAutomationSimSnapshot(
  strategySnapshot: StrategyGlobalSnapshot,
): AutomationSimApiSnapshot {
  const state = getAutomationSimState();
  return buildSnapshotBody(strategySnapshot, configDtoForBalance(state.balance), state);
}

async function publish(strategySnapshot: StrategyGlobalSnapshot): Promise<AutomationSimApiSnapshot> {
  const snapshot = await buildFinalizedSnapshotBody(strategySnapshot);
  broadcastAutomationSim(snapshot);
  return snapshot;
}

export async function ensureAutomationSimEngine(): Promise<void> {
  if (initialized) return;

  if (!initPromise) {
    initPromise = (async () => {
      const { ensureAutomationExtractUpToDate } = await import(
        "@/lib/server/automationSim/ensure-format"
      );
      await ensureAutomationExtractUpToDate();

      await initAutomationSimState();
      await initAutomationConfig();
      configReady = true;
      await ensureCapitalAndSyncBalance();
      initialized = true;

      if (!replayedLedger) {
        replayedLedger = true;
        const { getStrategyGlobalState } = await import("@/lib/server/strategyGlobal/persistence");
        const { buildStrategyGlobalSnapshot } = await import("@/lib/server/strategyGlobal/engine");
        const sim = getAutomationSimState();
        const globalState = getStrategyGlobalState();
        const hasLedger =
          globalState.ledger.um1fator.length > 0 ||
          globalState.ledger.dois2fatores.length > 0 ||
          globalState.ledger.fibonacci.length > 0 ||
          globalState.ledger.rotacao.length > 0;
        const hasSimHistory = sim.rounds.length > 0 || sim.processedKeys.length > 0;
        if (hasLedger && hasSimHistory) {
          const strategySnapshot = buildStrategyGlobalSnapshot(globalState);
          await rebuildAutomationSimHistoryFromLedger(strategySnapshot, {
            broadcast: false,
            fullLedger: combinedStrategyLedger(globalState.ledger),
          });
        }
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

  const settleKey = globalAutomationSettleKey(entry);
  if (settleKey != null && state.processedKeys.includes(settleKey)) return state;
  if (settleKey != null && state.rounds.some((round) => round.id === settleKey)) return state;

  if (automationBlocksNewEntries(getAutomationConfig(), state.balance)) {
    return state;
  }

  const baseStake = getAutomationConfig().baseStake;
  const review = reviewMartingaleSettlement(state, entry, baseStake);
  if (!review.accepted) {
    console.warn("[MartingaleReview] extrato ignorado:", review.reason);
    return state;
  }

  const stake = review.stake;
  const settleAmount = Math.abs(review.net);
  const walletSettleKey = settleKey ?? key;
  const writeWallet = capitalReady && !isAutomationProfile();

  if (writeWallet) {
    const alreadyRecorded = await isGlobalAutomationSettleRecorded(walletSettleKey);
    if (!alreadyRecorded) {
      const ledgerResult = await settleGlobalAutomationInLedger({
        settleKey: walletSettleKey,
        won: entry.won,
        stake: settleAmount,
        tableLabel,
        recovery: entry.recovery,
        kind: entry.kind,
        strategy: entry.strategy,
        resultNumber: entry.resultNumber,
      });
      if (ledgerResult == null) return state;
    }
  }

  const next = settleOpenBetEntry(
    state,
    entry,
    tableLabel,
    undefined,
    getAutomationConfig().baseStake,
  );
  if (!capitalReady) return next;

  const walletBalance = await getGlobalAutomationWalletBalance();
  return finalizeAutomationSimState(next, walletBalance);
}

/** Sincroniza entrada em jogo quando há sinal activo na sala rotativa. */
export async function syncAutomationSimWithStrategy(
  strategySnapshot: StrategyGlobalSnapshot,
  options?: { broadcast?: boolean },
): Promise<AutomationSimApiSnapshot> {
  if (!initialized) return buildAutomationSimSnapshot(strategySnapshot);

  await ensureCapitalAndSyncBalance();
  await ensureAutomationConfigLoaded();

  let state = getAutomationSimState();
  const walletBalance = await getGlobalAutomationWalletBalance();
  await maybeAutoResumeAutomation();
  const configDto = configDtoForBalance(walletBalance);
  const blockNewEntries = configDto.blocksNewEntries;
  let openBet = state.openBet;
  if (blockNewEntries && openBet) {
    state = { ...state, openBet: null };
    replaceAutomationSimState(state);
    openBet = null;
  }
  if (
    isZoneFibonacciStrategy(openBet?.strategy) &&
    zoneFibonacciSessionEnded(
      zoneFibonacciSnapshotFromGlobal(strategySnapshot, openBet!.strategy!),
    )
  ) {
    state = { ...state, openBet: null };
    replaceAutomationSimState(state);
    openBet = null;
  }
  if (
    openBet?.strategy === "um1fator" &&
    !strategySnapshot.um1fator.showTapeteSignal
  ) {
    state = { ...state, openBet: null };
    replaceAutomationSimState(state);
    openBet = null;
  }
  if (
    openBet?.strategy === "dois2fatores" &&
    !strategySnapshot.dois2fatores.showTapeteSignal
  ) {
    state = { ...state, openBet: null };
    replaceAutomationSimState(state);
    openBet = null;
  }
  if (
    openBet?.strategy === "rotacao" &&
    !strategySnapshot.rotacao.showTapeteSignal
  ) {
    state = { ...state, openBet: null };
    replaceAutomationSimState(state);
    openBet = null;
  }
  if (openBet?.tableId != null && !blockNewEntries) {
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
    {
      baseStake: configDto.baseStake,
      blockNewEntries,
      crossingEnabled: crossingGatilhoEnabledFromMap(getAutomationConfig().enabledTriggers),
      fibonacciEnabled:
        enabledFibonacciZoneKindsFromMap(getAutomationConfig().enabledTriggers).length > 0,
      repeticaoEnabled:
        enabledRepeticaoZoneKindsFromMap(getAutomationConfig().enabledTriggers).length > 0,
      rotacaoEnabled: isRotacaoGatilhoEnabled(),
    },
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
  }

  const snapshot = await buildFinalizedSnapshotBody(strategySnapshot);
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

  return withAutomationSimMutationLock(async () => {
    await ensureCapitalAndSyncBalance();

    let state = getAutomationSimState();
    const floorTs = globalAutomationLedgerFloorTs(state);
    if (entry.ts < floorTs) return null;

    const key = ledgerEntryKey(entry);
    if (state.processedKeys.includes(key)) return null;
    const settleKey = globalAutomationSettleKey(entry);
    if (settleKey != null && state.processedKeys.includes(settleKey)) return null;
    if (settleKey != null && state.rounds.some((round) => round.id === settleKey)) return null;

    state = await settleAutomationEntry(state, entry, lobbyTableDisplayName(entry.tableId));
    replaceAutomationSimState(state);

    if (options?.publish === false) return null;
    const snapshot = await buildFinalizedSnapshotBodyUnlocked(strategySnapshot);
    broadcastAutomationSim(snapshot);
    return snapshot;
  });
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
    combinedStrategyLedger(
      (await import("@/lib/server/strategyGlobal/persistence")).getStrategyGlobalState().ledger,
    );

  const floorTs = globalAutomationLedgerFloorTs(current);
  const openingBalance = globalAutomationOpeningBalance(current);

  const rebuilt = rebuildAutomationSimDisplayFromLedger(
    floorTs,
    ledger,
    openingBalance,
    current.startedAt,
  );
  const walletBalance = await getGlobalAutomationWalletBalance();

  const mergedProcessedKeys = [
    ...new Set([...rebuilt.processedKeys, ...current.processedKeys]),
  ];

  const nextState = finalizeAutomationSimState(
    {
      ...rebuilt,
      startedAt: current.startedAt,
      capitalRegisteredAt: current.capitalRegisteredAt,
      processedKeys: mergedProcessedKeys,
      spinCounter: Math.max(current.spinCounter, rebuilt.spinCounter),
      openBet: null,
    },
    walletBalance,
  );

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
  const floorTs = globalAutomationLedgerFloorTs(state);
  let changed = false;

  for (const entry of entries) {
    if (entry.ts < floorTs) continue;
    const key = ledgerEntryKey(entry);
    if (state.processedKeys.includes(key)) continue;
    state = await settleAutomationEntry(state, entry, lobbyTableDisplayName(entry.tableId));
    changed = true;
  }

  if (changed) {
    replaceAutomationSimState(state);
  } else {
    const balance = await getGlobalAutomationWalletBalance();
    replaceAutomationSimState(finalizeAutomationSimState(state, balance));
  }

  const pending = pendingSignalFromSnapshot(
    strategySnapshot,
    getAutomationSimState().balance,
    strategySnapshot.tableHistories,
    {
      baseStake: getAutomationConfig().baseStake,
      blockNewEntries: configDtoForBalance(getAutomationSimState().balance).blocksNewEntries,
      crossingEnabled: crossingGatilhoEnabledFromMap(getAutomationConfig().enabledTriggers),
      fibonacciEnabled:
        enabledFibonacciZoneKindsFromMap(getAutomationConfig().enabledTriggers).length > 0,
      repeticaoEnabled:
        enabledRepeticaoZoneKindsFromMap(getAutomationConfig().enabledTriggers).length > 0,
      rotacaoEnabled: isRotacaoGatilhoEnabled(),
    },
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

/** Propaga alterações de gatilhos/config para clientes SSE após gravação no admin. */
export async function publishAutomationConfigChange(): Promise<void> {
  const { getStrategyGlobalSnapshotOrThrow } = await import("@/lib/server/strategyGlobal/engine");
  await ensureAutomationSimEngine();
  await syncAutomationSimWithStrategy(getStrategyGlobalSnapshotOrThrow());
}

/** Após reset manual — evita reprocessar ledger antigo em memória. */
export function resetAutomationSimEngineFlags(): void {
  replayedLedger = true;
  capitalReady = true;
}
