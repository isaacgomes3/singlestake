import { createFileRoute } from "@tanstack/react-router";

import { buildRotatingRoomSimulatorIndication } from "@/lib/roulette/rotatingRoomSimulatorIndication";

export const Route = createFileRoute("/api/roulette/rotating-room")({
  server: {
    handlers: {
      GET: async () => {
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, getStrategyGlobalSnapshotOrThrow } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const { ensureAutomationSimEngine } = await import("@/lib/server/automationSim/engine");
        const { getAutomationConfig } = await import("@/lib/server/automationSim/config");
        const { getAutomationSimState } = await import("@/lib/server/automationSim/persistence");
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        await ensureAutomationSimEngine();
        const snapshot = getStrategyGlobalSnapshotOrThrow();
        const balance = getAutomationSimState().balance;
        const { crossingGatilhoEnabledFromMap } = await import("@/lib/roulette/umFatorTriggerEnable");
        const crossingEnabled = crossingGatilhoEnabledFromMap(
          getAutomationConfig().enabledTriggers,
        );
        return Response.json(
          buildRotatingRoomSimulatorIndication(snapshot, balance, { crossingEnabled }),
        );
      },
    },
  },
});
