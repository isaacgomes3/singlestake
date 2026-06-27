import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildAutomationChartData,
  applyCapturedUmFatorFlashes,
  freshAutomationSimState,
  mergeAutomationLedgerSources,
  openBetWasSettled,
  pendingSignalAlreadySettled,
  pendingSignalFromRotatingRoom,
  pendingSignalFromSnapshot,
  pendingSignalFromUmFatorSession,
  pruneLocalAutomationLedger,
  rebuildAutomationSimFromLedger,
  ROULETTE_AUTOMATION_INITIAL_BANK,
  settleLedgerEntry,
  spinHead,
  syncOpenBetFromPending,
  trySettleOpenBetFromLedger,
  trySettleOpenBetFromSpin,
  type AutomationOpenBet,
  type AutomationPendingSignal,
  type RouletteAutomationSimState,
  type UmFatorPlacarFlashLike,
} from "@/lib/back-office/rouletteAutomationSim";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import type { StrategyGlobalLedgerEntry } from "@/lib/roulette/strategyGlobalTypes";
import {
  AUTOMATION_SIM_CHANGED_EVENT,
  bootstrapAutomationSimSnapshot,
  getAutomationSimSnapshot,
  isAutomationSimConnected,
} from "@/lib/roulette/automationSimClient";
import type { AutomationSimApiSnapshot } from "@/lib/roulette/automationSimTypes";
import { useRotatingRoomSimulatorIndication } from "@/hooks/useRotatingRoomSimulatorIndication";
import { useRotatingRoomSetup } from "@/hooks/useRotatingRoomSetup";
import { useRotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { useStrategyGlobalSnapshot } from "@/hooks/useStrategyGlobalSnapshot";
import {
  consumeStrategyGlobalFlashes,
  getStrategyGlobalFlashSeq,
  STRATEGY_GLOBAL_CHANGED_EVENT,
} from "@/lib/roulette/strategyGlobalClient";

const BOOTSTRAP_INTERVAL_MS = 5_000;

function resolveCycleStartedAt(
  serverState: RouletteAutomationSimState | undefined,
  stableRef: { current: number | null },
  lastKnown: RouletteAutomationSimState | null,
): number {
  if (stableRef.current != null) return stableRef.current;
  const boot = serverState ?? lastKnown ?? getAutomationSimSnapshot()?.state;
  if (boot?.startedAt) {
    stableRef.current = boot.startedAt;
    return boot.startedAt;
  }
  return stableRef.current ?? 0;
}

export function useRouletteAutomationSim() {
  const clientStrategy = useStrategyGlobalSnapshot();
  const { indication: rotatingRoomIndication } = useRotatingRoomSimulatorIndication();
  const { tableIds, histories } = useRotatingRoomSetup();
  const umFatorSession = useRotatingRoomUmFatorSession(tableIds, histories, {
    observeOnly: true,
  });

  const [apiSnapshot, setApiSnapshot] = useState<AutomationSimApiSnapshot | null>(() =>
    getAutomationSimSnapshot(),
  );
  const [connected, setConnected] = useState(() => isAutomationSimConnected());
  const [flashTick, setFlashTick] = useState(0);

  const localProcessedRef = useRef<Set<string>>(new Set());
  const cycleStartedAtRef = useRef<number | null>(null);
  const stableStartedAtRef = useRef<number | null>(null);
  const strategyFlashSeqRef = useRef(getStrategyGlobalFlashSeq());
  const capturedFlashesRef = useRef<UmFatorPlacarFlashLike[]>([]);
  const lastOpenBetRef = useRef<AutomationOpenBet | null>(null);
  const localLedgerRef = useRef<StrategyGlobalLedgerEntry[]>([]);
  const lastServerStateRef = useRef<RouletteAutomationSimState | null>(
    getAutomationSimSnapshot()?.state ?? null,
  );

  const recordLocalSettlement = (entry: StrategyGlobalLedgerEntry) => {
    const resultKey =
      entry.resultNumber != null
        ? `${entry.tableId}:${entry.recovery}:${entry.resultNumber}`
        : null;
    const exists = localLedgerRef.current.some((local) => {
      if (resultKey != null && local.resultNumber != null) {
        return `${local.tableId}:${local.recovery}:${local.resultNumber}` === resultKey;
      }
      return false;
    });
    if (!exists) localLedgerRef.current.push(entry);
  };

  useEffect(() => {
    const sync = () => {
      const snap = getAutomationSimSnapshot();
      if (snap?.state) lastServerStateRef.current = snap.state;
      setApiSnapshot(snap);
      setConnected(isAutomationSimConnected());
    };
    window.addEventListener(AUTOMATION_SIM_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTOMATION_SIM_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    void bootstrapAutomationSimSnapshot();
    const id = window.setInterval(() => {
      if (!isAutomationSimConnected()) void bootstrapAutomationSimSnapshot();
    }, BOOTSTRAP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const captureFlash = () => {
      const seq = getStrategyGlobalFlashSeq();
      if (seq === strategyFlashSeqRef.current) return;
      strategyFlashSeqRef.current = seq;
      const flash = consumeStrategyGlobalFlashes()?.um1fator;
      if (!flash) return;
      const exists = capturedFlashesRef.current.some(
        (f) =>
          f.tableId === flash.tableId &&
          f.resultNumber === flash.resultNumber &&
          f.kind === flash.kind &&
          f.won === flash.won,
      );
      if (!exists) {
        capturedFlashesRef.current.push(flash);
        setFlashTick((n) => n + 1);
      }
    };

    captureFlash();
    window.addEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, captureFlash);
    return () => window.removeEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, captureFlash);
  }, []);

  const historiesFingerprint = useMemo(
    () =>
      tableIds
        .map((id) => {
          const h = histories[id] ?? [];
          return `${id}:${h.length}:${h[0] ?? ""}`;
        })
        .join("|"),
    [tableIds, histories],
  );

  const automationBalance =
    apiSnapshot?.state?.balance ??
    lastServerStateRef.current?.balance ??
    ROULETTE_AUTOMATION_INITIAL_BANK;

  const clientPending = useMemo((): AutomationPendingSignal | null => {
    if (clientStrategy) {
      const fromStrategy = pendingSignalFromSnapshot(clientStrategy, automationBalance);
      if (fromStrategy) return fromStrategy;
      return null;
    }
    const fromSession = pendingSignalFromUmFatorSession(umFatorSession, automationBalance, histories);
    if (fromSession) return fromSession;
    if (rotatingRoomIndication) {
      return pendingSignalFromRotatingRoom(rotatingRoomIndication);
    }
    return null;
  }, [clientStrategy, umFatorSession, rotatingRoomIndication, automationBalance, histories]);

  const effectivePending = clientPending ?? apiSnapshot?.pendingSignal ?? null;

  const state = useMemo((): RouletteAutomationSimState => {
    const persistedServer = apiSnapshot?.state ?? lastServerStateRef.current;
    const startedAt = resolveCycleStartedAt(persistedServer ?? undefined, stableStartedAtRef, lastServerStateRef.current);

    if (cycleStartedAtRef.current !== startedAt) {
      const isCycleReset = cycleStartedAtRef.current != null;
      cycleStartedAtRef.current = startedAt;
      if (isCycleReset) {
        localProcessedRef.current = new Set();
        capturedFlashesRef.current = [];
        lastOpenBetRef.current = null;
        localLedgerRef.current = [];
      }
    }

    const onSettled = recordLocalSettlement;

    let base: RouletteAutomationSimState;
    let ledgerForSettle: StrategyGlobalLedgerEntry[] = [];

    if (clientStrategy) {
      const serverLedger = clientStrategy.ledgerTail.um1fator;
      localLedgerRef.current = pruneLocalAutomationLedger(serverLedger, localLedgerRef.current);
      ledgerForSettle = mergeAutomationLedgerSources(serverLedger, localLedgerRef.current);

      if (persistedServer?.capitalRegisteredAt != null || persistedServer?.balance != null) {
        base = {
          ...(persistedServer ?? freshAutomationSimState(startedAt > 0 ? startedAt : Date.now())),
          balance: persistedServer?.balance ?? ROULETTE_AUTOMATION_INITIAL_BANK,
          cycleOpeningBalance:
            persistedServer?.cycleOpeningBalance ??
            persistedServer?.balance ??
            ROULETTE_AUTOMATION_INITIAL_BANK,
        };
      } else {
        const openingBalance =
          persistedServer?.cycleOpeningBalance ??
          persistedServer?.balance ??
          ROULETTE_AUTOMATION_INITIAL_BANK;
        base = rebuildAutomationSimFromLedger(startedAt, ledgerForSettle, openingBalance);
      }
    } else {
      base =
        persistedServer ??
        (startedAt > 0 ? freshAutomationSimState(startedAt) : freshAutomationSimState(Date.now()));
      for (const entry of localLedgerRef.current) {
        base = settleLedgerEntry(base, entry, lobbyTableDisplayName(entry.tableId));
      }
    }

    let working: RouletteAutomationSimState = base;

    if (lastOpenBetRef.current && openBetWasSettled(base, lastOpenBetRef.current)) {
      lastOpenBetRef.current = null;
    }

    if (!working.openBet && lastOpenBetRef.current) {
      working = { ...working, openBet: lastOpenBetRef.current };
    }

    working = applyCapturedUmFatorFlashes(
      working,
      capturedFlashesRef.current,
      histories,
      localProcessedRef.current,
      onSettled,
    );

    if (working.openBet) {
      working = trySettleOpenBetFromLedger(working, ledgerForSettle, onSettled);
    }

    if (working.openBet) {
      working = trySettleOpenBetFromSpin(
        working,
        histories,
        localProcessedRef.current,
        onSettled,
      );
    }

    if (working.openBet) {
      lastOpenBetRef.current = working.openBet;
    } else {
      lastOpenBetRef.current = null;
    }

    if (
      effectivePending &&
      !pendingSignalAlreadySettled(working, effectivePending) &&
      !working.openBet
    ) {
      const head = spinHead(histories[effectivePending.tableId] ?? []);
      working = syncOpenBetFromPending(working, effectivePending, head);
      if (working.openBet) lastOpenBetRef.current = working.openBet;
    }

    return {
      ...working,
      chart: buildAutomationChartData(working),
    };
  }, [
    apiSnapshot,
    clientStrategy,
    clientStrategy?.revision,
    effectivePending,
    flashTick,
    histories,
    historiesFingerprint,
  ]);

  const openBet: AutomationOpenBet | null = state.openBet;

  const syncing =
    !connected &&
    !clientPending &&
    !apiSnapshot?.pendingSignal &&
    openBet == null &&
    !clientStrategy;

  return {
    state,
    pendingSignal: effectivePending,
    openBet,
    syncing,
  };
}
