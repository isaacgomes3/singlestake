import type {
  StrategyGlobalFlashPayload,
  StrategyGlobalKind,
  StrategyGlobalSnapshot,
  StrategyGlobalStreamMessage,
} from "@/lib/roulette/strategyGlobalTypes";

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

export async function requestStrategyGlobalReset(kind: StrategyGlobalKind | "all"): Promise<void> {
  await fetch("/api/roulette/strategy-global/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
}
