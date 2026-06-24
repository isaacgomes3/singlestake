import type { StrategyGlobalStreamMessage } from "@/lib/roulette/strategyGlobalTypes";

type Listener = (msg: StrategyGlobalStreamMessage) => void;

const listeners = new Set<Listener>();

export function subscribeStrategyGlobalHub(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function broadcastStrategyGlobal(msg: StrategyGlobalStreamMessage): void {
  for (const listener of listeners) {
    listener(msg);
  }
}

export type { StrategyGlobalStreamMessage };
