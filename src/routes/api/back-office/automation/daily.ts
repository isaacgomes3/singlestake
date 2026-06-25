import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/automation/daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { triggerDailyAutomationYield } = await import(
          "@/lib/server/finance/automation-yield"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const force = new URL(request.url).searchParams.get("force") === "true";
        const { getClockInTimezone, getAutomationYieldTimezone } = await import(
          "@/lib/server/finance/automation-scheduler-state"
        );
        const ymd = getClockInTimezone(getAutomationYieldTimezone()).ymd;

        const result = await triggerDailyAutomationYield({
          force,
          ymd,
          actorLabel: user.name,
        });

        if (result.skipped) {
          return jsonResponse({
            ok: true,
            skipped: true,
            message: "Rendimento de hoje já foi processado. Use ?force=true para repetir.",
          });
        }

        return jsonResponse({ ok: true, result });
      },
    },
  },
});
