import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/automation-yield-pct")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getAutomationDailyYieldPct } = await import(
          "@/lib/server/finance/automation-yield-settings"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const pct = await getAutomationDailyYieldPct();
        return jsonResponse({ ok: true, pct });
      },
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { setAutomationDailyYieldPct } = await import(
          "@/lib/server/finance/automation-yield-settings"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const body = (await request.json()) as { pct?: number };
        const pct = Number(body.pct);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          return jsonResponse({ ok: false, error: "Percentual inválido (0–100)." }, { status: 400 });
        }

        const saved = await setAutomationDailyYieldPct(pct);
        return jsonResponse({ ok: true, pct: saved });
      },
    },
  },
});
