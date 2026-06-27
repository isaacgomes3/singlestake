import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/roulette/automation-sim")({
  server: {
    handlers: {
      GET: async () => {
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, getStrategyGlobalSnapshotOrThrow } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const { ensureAutomationSimEngine, getAutomationSimSnapshotOrThrow } = await import(
          "@/lib/server/automationSim/engine"
        );

        ensureRouletteHubDaemon();
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        await ensureAutomationSimEngine();

        const strategySnapshot = getStrategyGlobalSnapshotOrThrow();
        const snapshot = await getAutomationSimSnapshotOrThrow(strategySnapshot);
        return Response.json(snapshot);
      },
    },
  },
});
