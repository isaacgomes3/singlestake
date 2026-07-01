import type {
  StrategyGlobalFlashPayload,
  StrategyGlobalKind,
  StrategyGlobalSnapshot,
  StrategyGlobalStreamMessage,
} from "@/lib/roulette/strategyGlobalTypes";
import { syncFibonacciPrefsFromAutomationConfig } from "@/lib/roulette/fibonacciAbsencePrefs";

export const STRATEGY_GLOBAL_CHANGED_EVENT = "strategy-global-changed";

let snapshot: StrategyGlobalSnapshot | null = null;
let connected = false;
let lastFlashes: StrategyGlobalFlashPayload | null = null;
let flashSeq = 0;

export function isStrategyGlobalEnabled(): boolean {
  const v = import.meta.env.VITE_ROULETTE_STRATEGY_GLOBAL;
  if (v === "0" || v === "false") return false;
  return true;
}

export function getStrategyGlobalSnapshot(): StrategyGlobalSnapshot | null {
  return snapshot;
}

export function isStrategyGlobalConnected(): boolean {
  return connected;
}

/** Incrementa a cada update com flash — hooks consomem uma vez por seq. */
export function getStrategyGlobalFlashSeq(): number {
  return flashSeq;
}

export function consumeStrategyGlobalFlashes(): StrategyGlobalFlashPayload | null {
  return lastFlashes;
}

export function applyStrategyGlobalStreamMessage(msg: StrategyGlobalStreamMessage): void {
  if (msg.type === "sync") {
    snapshot = msg.snapshot;
    connected = true;
  } else {
    snapshot = msg.snapshot;
    if (msg.flashes) {
      lastFlashes = msg.flashes;
      flashSeq += 1;
    }
  }
  if (snapshot?.fibonacciPrefs) {
    const prefs = snapshot.fibonacciPrefs;
    syncFibonacciPrefsFromAutomationConfig({
      enabled: prefs.enabled,
      dozen: {
        enabled: prefs.dozenEnabled,
        wins: 0,
        losses: 0,
        total: 0,
        accuracyPct: null,
        absenceSpins: prefs.dozenAbsenceSpins,
      },
      column: {
        enabled: prefs.columnEnabled,
        wins: 0,
        losses: 0,
        total: 0,
        accuracyPct: null,
        absenceSpins: prefs.columnAbsenceSpins,
      },
    });
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STRATEGY_GLOBAL_CHANGED_EVENT));
  }
}

export function clearStrategyGlobalClientState(): void {
  snapshot = null;
  connected = false;
  lastFlashes = null;
}

export async function bootstrapStrategyGlobalSnapshot(): Promise<boolean> {
  try {
    const res = await fetch("/api/roulette/strategy-global");
    if (!res.ok) return false;
    const body = (await res.json()) as StrategyGlobalSnapshot;
    applyStrategyGlobalStreamMessage({ type: "sync", snapshot: body });
    return true;
  } catch {
    return false;
  }
}

export async function requestStrategyGlobalReset(_kind: StrategyGlobalKind | "all"): Promise<void> {
  if (import.meta.env.DEV) {
    console.warn(
      "[StrategyGlobal] reset bloqueado — o caixa de automação global não pode ser reiniciado.",
    );
  }
}
