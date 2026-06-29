import type { AutomationSimApiSnapshot, AutomationSimStreamMessage } from "@/lib/roulette/automationSimTypes";
import { setRotatingRoomGatilhoEnabled } from "@/lib/roulette/umFatorTriggerEnable";

export const AUTOMATION_SIM_CHANGED_EVENT = "automation-sim-changed";

let snapshot: AutomationSimApiSnapshot | null = null;
let connected = false;

function syncClientTriggerEnableFromSnapshot(next: AutomationSimApiSnapshot): void {
  if (next.config?.enabledTriggers) {
    setRotatingRoomGatilhoEnabled(next.config.enabledTriggers);
  }
}

export function getAutomationSimSnapshot(): AutomationSimApiSnapshot | null {
  return snapshot;
}

export function isAutomationSimConnected(): boolean {
  return connected;
}

export function applyAutomationSimStreamMessage(msg: AutomationSimStreamMessage): void {
  snapshot = msg.snapshot;
  connected = true;
  syncClientTriggerEnableFromSnapshot(msg.snapshot);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTOMATION_SIM_CHANGED_EVENT));
  }
}

export function clearAutomationSimClientState(): void {
  snapshot = null;
  connected = false;
}

export async function bootstrapAutomationSimSnapshot(): Promise<boolean> {
  try {
    const res = await fetch("/api/roulette/automation-sim");
    if (!res.ok) return false;
    const body = (await res.json()) as AutomationSimApiSnapshot;
    applyAutomationSimStreamMessage({ type: "sync", snapshot: body });
    return true;
  } catch {
    return false;
  }
}
