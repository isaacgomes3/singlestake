import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/packages/pix-order/$orderId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { syncPackagePixOrder } = await import("@/lib/server/finance/package-pix");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const result = await syncPackagePixOrder({
          orderId: params.orderId,
          userId: user.id,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }
        return jsonResponse({
          ok: true,
          order: result.order,
          userPackage: result.userPackage,
        });
      },
    },
  },
});
