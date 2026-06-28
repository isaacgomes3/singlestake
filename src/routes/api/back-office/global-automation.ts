import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/global-automation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getGlobalAutomationFinanceSnapshot } = await import(
          "@/lib/server/finance/global-automation-capital"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const finance = await getGlobalAutomationFinanceSnapshot();
        return jsonResponse({ ok: true, finance });
      },
    },
  },
});
