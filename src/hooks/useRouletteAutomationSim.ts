import { useEffect, useMemo, useRef, useState } from "react";

import {
  finalizeAutomationSimState,
  freshAutomationSimState,
  type AutomationOpenBet,
  type AutomationPendingSignal,
  type RouletteAutomationSimState,
} from "@/lib/back-office/rouletteAutomationSim";
import {
  AUTOMATION_SIM_CHANGED_EVENT,
  bootstrapAutomationSimSnapshot,
  getAutomationSimSnapshot,
  isAutomationSimConnected,
} from "@/lib/roulette/automationSimClient";
import type { AutomationSimApiSnapshot } from "@/lib/roulette/automationSimTypes";

const BOOTSTRAP_INTERVAL_MS = 5_000;

/**
 * Estado da automação global — fonte única: motor no servidor (`/api/roulette/automation-sim`).
 * O browser só visualiza; não recalcula entradas nem liquidações localmente.
 */
export function useRouletteAutomationSim() {
  const [apiSnapshot, setApiSnapshot] = useState<AutomationSimApiSnapshot | null>(() =>
    getAutomationSimSnapshot(),
  );
  const [connected, setConnected] = useState(() => isAutomationSimConnected());
  const lastServerStateRef = useRef<RouletteAutomationSimState | null>(
    getAutomationSimSnapshot()?.state ?? null,
  );

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

  const state = useMemo((): RouletteAutomationSimState => {
    const persisted = apiSnapshot?.state ?? lastServerStateRef.current;
    if (!persisted) {
      return freshAutomationSimState(Date.now());
    }
    return finalizeAutomationSimState(persisted, persisted.balance);
  }, [apiSnapshot]);

  const openBet: AutomationOpenBet | null = state.openBet;
  const pendingSignal: AutomationPendingSignal | null = apiSnapshot?.pendingSignal ?? null;

  const syncing = !connected && apiSnapshot == null;

  return {
    state,
    pendingSignal,
    openBet,
    syncing,
    config: apiSnapshot?.config ?? null,
    revision: apiSnapshot?.revision ?? 0,
  };
}
