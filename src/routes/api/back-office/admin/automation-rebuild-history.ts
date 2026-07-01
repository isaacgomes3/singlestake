import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/automation-rebuild-history")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, getStrategyGlobalSnapshotOrThrow } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const {
          ensureAutomationSimEngine,
          rebuildAutomationSimHistoryFromLedger,
        } = await import("@/lib/server/automationSim/engine");
        const { getStrategyGlobalState } = await import("@/lib/server/strategyGlobal/persistence");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        ensureRouletteHubDaemon();
        const tableIds = parseRouletteTableIdsFromEnv();
        await ensureStrategyGlobalEngine(tableIds);
        await ensureAutomationSimEngine();

        const globalState = getStrategyGlobalState();
        const strategySnapshot = getStrategyGlobalSnapshotOrThrow();
        const fullLedger = [
          ...globalState.ledger.um1fator,
          ...globalState.ledger.dois2fatores,
          ...globalState.ledger.fibonacci,
        ].sort((a, b) => a.ts - b.ts);
        const snapshot = await rebuildAutomationSimHistoryFromLedger(strategySnapshot, {
          broadcast: true,
          fullLedger,
        });

        return jsonResponse({
          ok: true,
          rounds: snapshot.state.rounds.length,
          balance: snapshot.state.balance,
          message: "Histórico reconstruído a partir do ledger completo.",
        });
      },
    },
  },
});
