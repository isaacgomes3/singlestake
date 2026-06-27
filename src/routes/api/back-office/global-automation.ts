import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/global-automation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, getStrategyGlobalSnapshotOrThrow } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const { ensureAutomationSimEngine, getAutomationSimSnapshotOrThrow } = await import(
          "@/lib/server/automationSim/engine"
        );
        const { getGlobalAutomationFinanceSnapshot } = await import(
          "@/lib/server/finance/global-automation-capital"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const finance = await getGlobalAutomationFinanceSnapshot();

        let automation = null;
        try {
          ensureRouletteHubDaemon();
          const tableIds = parseRouletteTableIdsFromEnv();
          await ensureStrategyGlobalEngine(tableIds);
          await ensureAutomationSimEngine();
          const strategySnapshot = getStrategyGlobalSnapshotOrThrow();
          automation = await getAutomationSimSnapshotOrThrow(strategySnapshot);
        } catch {
          /* roleta offline — saldo/extrato financeiro continuam disponíveis */
        }

        return jsonResponse({ ok: true, finance, automation });
      },
    },
  },
});
