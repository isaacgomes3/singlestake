import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/automation-config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getGlobalAutomationWalletBalance } = await import(
          "@/lib/server/finance/global-automation-capital"
        );
        const { buildAutomationConfigDto } = await import("@/lib/back-office/automation-config");
        const { getAutomationConfig, initAutomationConfig } = await import(
          "@/lib/server/automationSim/config"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        await initAutomationConfig();
        const config = getAutomationConfig();
        const balance = await getGlobalAutomationWalletBalance();

        return jsonResponse({
          ok: true,
          config: buildAutomationConfigDto(config, balance),
        });
      },
      PUT: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { getGlobalAutomationWalletBalance } = await import(
          "@/lib/server/finance/global-automation-capital"
        );
        const { buildAutomationConfigDto } = await import("@/lib/back-office/automation-config");
        const { getAutomationConfig, initAutomationConfig, saveAutomationConfig } = await import(
          "@/lib/server/automationSim/config"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const body = await readJsonBody<{
          paused?: boolean;
          baseStake?: number;
          stopWin?: number | null;
          stopLoss?: number | null;
          fibonacciAbsenceSpins?: number;
          fibonacciDozenAbsenceSpins?: number;
          fibonacciColumnAbsenceSpins?: number;
          enabledTriggers?: Partial<import("@/lib/roulette/umFatorTriggerEnable").RotatingRoomGatilhoEnableMap>;
        }>(request);

        await initAutomationConfig();
        const current = getAutomationConfig();
        const nextPaused = body?.paused ?? current.paused;
        const pausePatch =
          body?.paused === true && !current.paused
            ? { pauseReason: "manual" as const, pausedAt: Date.now() }
            : body?.paused === false
              ? { pauseReason: null, pausedAt: null }
              : {};

        const fibonacciPatch: Partial<typeof current> = {};
        if (typeof body?.fibonacciDozenAbsenceSpins === "number") {
          fibonacciPatch.fibonacciDozenAbsenceSpins = Math.min(
            99,
            Math.max(3, Math.floor(body.fibonacciDozenAbsenceSpins)),
          );
        }
        if (typeof body?.fibonacciColumnAbsenceSpins === "number") {
          fibonacciPatch.fibonacciColumnAbsenceSpins = Math.min(
            99,
            Math.max(3, Math.floor(body.fibonacciColumnAbsenceSpins)),
          );
        }
        if (typeof body?.fibonacciAbsenceSpins === "number") {
          const spins = Math.min(99, Math.max(3, Math.floor(body.fibonacciAbsenceSpins)));
          fibonacciPatch.fibonacciAbsenceSpins = spins;
          fibonacciPatch.fibonacciDozenAbsenceSpins = spins;
          fibonacciPatch.fibonacciColumnAbsenceSpins = spins;
        }

        const next = {
          ...current,
          paused: nextPaused,
          baseStake: body?.baseStake ?? current.baseStake,
          stopWin: null,
          stopLoss: null,
          ...fibonacciPatch,
          enabledTriggers: body?.enabledTriggers
            ? { ...current.enabledTriggers, ...body.enabledTriggers }
            : current.enabledTriggers,
          ...pausePatch,
        };
        await saveAutomationConfig(next);

        const { publishAutomationConfigChange } = await import("@/lib/server/automationSim/engine");
        await publishAutomationConfigChange();

        const balance = await getGlobalAutomationWalletBalance();

        return jsonResponse({
          ok: true,
          config: buildAutomationConfigDto(getAutomationConfig(), balance),
        });
      },
    },
  },
});
