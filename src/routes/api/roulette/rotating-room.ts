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
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        const snapshot = getStrategyGlobalSnapshotOrThrow();
        return Response.json(buildRotatingRoomSimulatorIndication(snapshot));
      },
    },
  },
});
