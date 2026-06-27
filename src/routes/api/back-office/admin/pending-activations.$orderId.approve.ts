import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/api/back-office/admin/pending-activations/$orderId/approve",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { approvePackagePixOrder } = await import("@/lib/server/finance/package-pix");

        const user = await requireSessionUser(request);
        if (!user) {
          return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        }
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const result = await approvePackagePixOrder({
          orderId: params.orderId,
          actorUserId: user.id,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }

        return jsonResponse({ ok: true, order: result.order, userPackage: result.userPackage });
      },
    },
  },
});
