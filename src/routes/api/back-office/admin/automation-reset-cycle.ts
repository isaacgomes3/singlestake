import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/automation-reset-cycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine } = await import("@/lib/server/strategyGlobal/engine");
        const { ensureAutomationSimEngine } = await import("@/lib/server/automationSim/engine");
        const { resetGlobalAutomationCycle } = await import("@/lib/server/automationSim/reset-cycle");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        ensureRouletteHubDaemon();
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        await ensureAutomationSimEngine();

        const result = await resetGlobalAutomationCycle({ liveTableIds: tableIds, broadcast: true });

        return jsonResponse({
          ok: true,
          balance: result.balance,
          settlementsRemoved: result.settlementsRemoved,
          rounds: result.snapshot.state.rounds.length,
          message:
            "Ciclo reiniciado — saldo R$ 50.000, histórico e liquidações removidos. Reinicie PM2 na VPS se usar dois processos.",
        });
      },
    },
  },
});
