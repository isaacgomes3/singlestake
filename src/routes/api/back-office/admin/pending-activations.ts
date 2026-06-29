import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/pending-activations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { listPendingAccountActivations, listPendingAutomationPixOrders } = await import(
          "@/lib/server/finance/package-pix"
        );

        const user = await requireSessionUser(request);
        if (!user) {
          return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        }
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const [rows, automationRows] = await Promise.all([
          listPendingAccountActivations(),
          listPendingAutomationPixOrders(),
        ]);
        return jsonResponse({ ok: true, rows, automationRows });
      },
    },
  },
});
