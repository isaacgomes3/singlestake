import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/automation-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine } = await import("@/lib/server/strategyGlobal/engine");
        const { buildAutomationTriggerStatsDto } = await import(
          "@/lib/server/strategyGlobal/automation-trigger-stats"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        ensureRouletteHubDaemon();
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        return jsonResponse({ ok: true, data: buildAutomationTriggerStatsDto() });
      },
    },
  },
});
