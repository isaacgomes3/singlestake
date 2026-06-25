import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/daily-automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse } = await import("@/lib/server/auth/http");
        const { runAutomationYieldIfDue } = await import(
          "@/lib/server/finance/automation-scheduler"
        );
        const { getClockInTimezone, getAutomationYieldTimezone } = await import(
          "@/lib/server/finance/automation-scheduler-state"
        );

        const secret = process.env.CRON_SECRET?.trim();
        if (!secret) {
          return jsonResponse(
            { ok: false, error: "CRON_SECRET não configurado no servidor." },
            { status: 503 },
          );
        }

        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-cron-secret");
        if (token !== secret) {
          return jsonResponse({ ok: false, error: "Não autorizado." }, { status: 401 });
        }

        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "true";
        const tz = getAutomationYieldTimezone();
        const ymd = url.searchParams.get("ymd") ?? getClockInTimezone(tz).ymd;

        const outcome = await runAutomationYieldIfDue({ force, ymd });
        if (!outcome.ran) {
          return jsonResponse({ ok: true, skipped: true, reason: outcome.reason });
        }

        return jsonResponse({ ok: true, result: outcome.result });
      },
    },
  },
});
