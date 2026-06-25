export type AutomationSimApiSnapshot = {
  revision: number;
  updatedAt: number;
  state: import("@/lib/back-office/rouletteAutomationSim").RouletteAutomationSimState;
  pendingSignal: import("@/lib/back-office/rouletteAutomationSim").AutomationPendingSignal | null;
};

export type AutomationSimStreamMessage =
  | { type: "sync"; snapshot: AutomationSimApiSnapshot }
  | { type: "update"; snapshot: AutomationSimApiSnapshot };
