import { createFileRoute } from "@tanstack/react-router";

import type { StrategyGlobalKind } from "@/lib/roulette/strategyGlobalTypes";

function parseKind(raw: unknown): StrategyGlobalKind | "all" {
  if (raw === "dois2fatores" || raw === "um1fator") return raw;
  return "all";
}

export const Route = createFileRoute("/api/roulette/strategy-global/reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, resetStrategyGlobalSession } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);

        let kind: StrategyGlobalKind | "all" = "all";
        try {
          const body = (await request.json()) as { kind?: unknown };
          kind = parseKind(body.kind);
        } catch {
          /* corpo vazio = reset all */
        }

        const snapshot = resetStrategyGlobalSession(kind, tableIds);
        return Response.json({ ok: true, snapshot });
      },
    },
  },
});
