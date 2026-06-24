import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/roulette/strategy-global")({
  server: {
    handlers: {
      GET: async () => {
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, getStrategyGlobalSnapshotOrThrow } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        const snapshot = getStrategyGlobalSnapshotOrThrow();
        return Response.json(snapshot);
      },
    },
  },
});
