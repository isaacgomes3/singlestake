import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/automation-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine } = await import("@/lib/server/strategyGlobal/engine");
        const { buildAutomationTriggerStatsDtoAsync } = await import(
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
        return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
      },
      POST: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { initAutomationConfig, getAutomationConfig, saveAutomationConfig } = await import(
          "@/lib/server/automationSim/config"
        );
        const { buildAutomationTriggerStatsDtoAsync } = await import(
          "@/lib/server/strategyGlobal/automation-trigger-stats"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const body = await readJsonBody<{ id?: string; enabled?: boolean }>(request);
        const id = body?.id;
        const enabled = body?.enabled;
        if ((id !== "two" && id !== "three") || typeof enabled !== "boolean") {
          return jsonResponse({ ok: false, error: "Gatilho ou estado inválido." }, { status: 400 });
        }

        await initAutomationConfig();
        const current = getAutomationConfig();
        await saveAutomationConfig({
          enabledTriggers: { ...current.enabledTriggers, [id]: enabled },
        });

        return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
      },
    },
  },
});
