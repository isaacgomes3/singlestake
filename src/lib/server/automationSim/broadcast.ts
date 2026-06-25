import type { AutomationSimApiSnapshot } from "@/lib/roulette/automationSimTypes";

type Listener = (msg: AutomationSimApiSnapshot) => void;

const listeners = new Set<Listener>();

export function subscribeAutomationSimHub(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function broadcastAutomationSim(snapshot: AutomationSimApiSnapshot): void {
  for (const listener of listeners) {
    listener(snapshot);
  }
}
