import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/api/back-office/admin/user-detail/$userId/pix-orders/$orderId",
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getAdminUserPixOrderQr } = await import("@/lib/server/admin/user-detail");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const qr = await getAdminUserPixOrderQr(params.userId, params.orderId);
        if (!qr) {
          return jsonResponse({ ok: false, error: "Pedido PIX não encontrado." }, { status: 404 });
        }
        return jsonResponse({ ok: true, ...qr });
      },
    },
  },
});
