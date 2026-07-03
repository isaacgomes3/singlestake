import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/automation-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { resolveRotatingRoomTableIds } = await import("@/lib/roulette/lobbyTables");
        const { initStrategyGlobalState, getStrategyGlobalState } = await import(
          "@/lib/server/strategyGlobal/persistence"
        );
        const { buildAutomationTriggerStatsDtoAsync } = await import(
          "@/lib/server/strategyGlobal/automation-trigger-stats"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        try {
          ensureRouletteHubDaemon();
          try {
            getStrategyGlobalState();
          } catch {
            const tableIds = resolveRotatingRoomTableIds(parseRouletteTableIdsFromEnv());
            await initStrategyGlobalState(tableIds);
          }
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        } catch (err) {
          console.error("[automation-stats] GET falhou:", err);
          return jsonResponse(
            { ok: false, error: "Falha ao carregar estatísticas da automação." },
            { status: 500 },
          );
        }
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

        const body = await readJsonBody<{
          id?: string;
          enabled?: boolean;
          fibonacciAbsenceSpins?: number;
          fibonacciDozenAbsenceSpins?: number;
          fibonacciColumnAbsenceSpins?: number;
          repeticaoDozenAbsenceSpins?: number;
          repeticaoColumnAbsenceSpins?: number;
          crossingCorAlturaAbsenceSpins?: number;
          crossingAlturaParidadeAbsenceSpins?: number;
          crossingCorAlturaAbsenceAuto?: boolean;
          crossingAlturaParidadeAbsenceAuto?: boolean;
        }>(request);

        await initAutomationConfig();
        const current = getAutomationConfig();

        if (typeof body?.fibonacciDozenAbsenceSpins === "number") {
          const spins = Math.min(99, Math.max(3, Math.floor(body.fibonacciDozenAbsenceSpins)));
          await saveAutomationConfig({ fibonacciDozenAbsenceSpins: spins });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        if (typeof body?.fibonacciColumnAbsenceSpins === "number") {
          const spins = Math.min(99, Math.max(3, Math.floor(body.fibonacciColumnAbsenceSpins)));
          await saveAutomationConfig({ fibonacciColumnAbsenceSpins: spins });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        if (typeof body?.fibonacciAbsenceSpins === "number") {
          const spins = Math.min(99, Math.max(3, Math.floor(body.fibonacciAbsenceSpins)));
          await saveAutomationConfig({
            fibonacciAbsenceSpins: spins,
            fibonacciDozenAbsenceSpins: spins,
            fibonacciColumnAbsenceSpins: spins,
          });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        if (typeof body?.repeticaoDozenAbsenceSpins === "number") {
          const spins = Math.min(99, Math.max(3, Math.floor(body.repeticaoDozenAbsenceSpins)));
          await saveAutomationConfig({ repeticaoDozenAbsenceSpins: spins });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        if (typeof body?.repeticaoColumnAbsenceSpins === "number") {
          const spins = Math.min(99, Math.max(3, Math.floor(body.repeticaoColumnAbsenceSpins)));
          await saveAutomationConfig({ repeticaoColumnAbsenceSpins: spins });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        if (typeof body?.crossingCorAlturaAbsenceSpins === "number") {
          const spins = Math.min(99, Math.max(3, Math.floor(body.crossingCorAlturaAbsenceSpins)));
          await saveAutomationConfig({
            crossingCorAlturaAbsenceSpins: spins,
            crossingCorAlturaAbsenceAuto: false,
          });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        if (typeof body?.crossingAlturaParidadeAbsenceSpins === "number") {
          const spins = Math.min(99, Math.max(3, Math.floor(body.crossingAlturaParidadeAbsenceSpins)));
          await saveAutomationConfig({
            crossingAlturaParidadeAbsenceSpins: spins,
            crossingAlturaParidadeAbsenceAuto: false,
          });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        if (typeof body?.crossingCorAlturaAbsenceAuto === "boolean") {
          await saveAutomationConfig({ crossingCorAlturaAbsenceAuto: body.crossingCorAlturaAbsenceAuto });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        if (typeof body?.crossingAlturaParidadeAbsenceAuto === "boolean") {
          await saveAutomationConfig({
            crossingAlturaParidadeAbsenceAuto: body.crossingAlturaParidadeAbsenceAuto,
          });
          const { publishAutomationConfigChange } = await import(
            "@/lib/server/automationSim/engine"
          );
          await publishAutomationConfigChange();
          return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
        }

        const id = body?.id;
        const enabled = body?.enabled;
        if (
          (id !== "three" &&
            id !== "crossing" &&
            id !== "fibonacci" &&
            id !== "repeticao" &&
            id !== "rotacao" &&
            id !== "fibonacciDozen" &&
            id !== "fibonacciColumn" &&
            id !== "repeticaoDozen" &&
            id !== "repeticaoColumn" &&
            id !== "crossingCorAltura" &&
            id !== "crossingAlturaParidade") ||
          typeof enabled !== "boolean"
        ) {
          return jsonResponse({ ok: false, error: "Gatilho ou estado inválido." }, { status: 400 });
        }

        const nextTriggers = { ...current.enabledTriggers, [id]: enabled };
        if (id === "fibonacciDozen" || id === "fibonacciColumn") {
          const dozenOn = nextTriggers.fibonacciDozen !== false;
          const columnOn = nextTriggers.fibonacciColumn !== false;
          nextTriggers.fibonacci = dozenOn || columnOn;
        }
        if (id === "fibonacci" && !enabled) {
          nextTriggers.fibonacciDozen = false;
          nextTriggers.fibonacciColumn = false;
        }
        if (id === "fibonacci" && enabled) {
          if (nextTriggers.fibonacciDozen === false && nextTriggers.fibonacciColumn === false) {
            nextTriggers.fibonacciDozen = true;
            nextTriggers.fibonacciColumn = true;
          }
        }
        if (id === "repeticaoDozen" || id === "repeticaoColumn") {
          const dozenOn = nextTriggers.repeticaoDozen !== false;
          const columnOn = nextTriggers.repeticaoColumn !== false;
          nextTriggers.repeticao = dozenOn || columnOn;
        }
        if (id === "repeticao" && !enabled) {
          nextTriggers.repeticaoDozen = false;
          nextTriggers.repeticaoColumn = false;
        }
        if (id === "repeticao" && enabled) {
          if (nextTriggers.repeticaoDozen === false && nextTriggers.repeticaoColumn === false) {
            nextTriggers.repeticaoDozen = true;
            nextTriggers.repeticaoColumn = true;
          }
        }

        await saveAutomationConfig({
          enabledTriggers: nextTriggers,
        });

        const { publishAutomationConfigChange } = await import("@/lib/server/automationSim/engine");
        await publishAutomationConfigChange();

        return jsonResponse({ ok: true, data: await buildAutomationTriggerStatsDtoAsync() });
      },
    },
  },
});
