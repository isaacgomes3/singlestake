import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/activation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { buildAuthUserPayload } = await import("@/lib/server/finance/account-access");
        const {
          getOrCreateStartPackPixOrder,
          isPixCheckoutEnabled,
        } = await import("@/lib/server/finance/package-pix");
        const { START_PACKAGE_AMOUNT } = await import("@/lib/back-office/product-constants");

        const user = await requireSessionUser(request);
        if (!user) {
          return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        }

        const origin = new URL(request.url).origin;
        const authUser = await buildAuthUserPayload(user, origin);

        if (authUser.accountActive) {
          return jsonResponse({
            ok: true,
            accountActive: true,
            pixEnabled: isPixCheckoutEnabled(),
            packageAmount: START_PACKAGE_AMOUNT,
          });
        }

        const pixResult = await getOrCreateStartPackPixOrder({ userId: user.id });
        if (!pixResult.ok) {
          return jsonResponse({
            ok: true,
            accountActive: false,
            pixEnabled: isPixCheckoutEnabled(),
            packageAmount: START_PACKAGE_AMOUNT,
            pixError: pixResult.error,
          });
        }

        return jsonResponse({
          ok: true,
          accountActive: false,
          pixEnabled: isPixCheckoutEnabled(),
          packageAmount: START_PACKAGE_AMOUNT,
          order: pixResult.order,
        });
      },
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getOrCreateStartPackPixOrder } = await import("@/lib/server/finance/package-pix");

        const user = await requireSessionUser(request);
        if (!user) {
          return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        }

        const result = await getOrCreateStartPackPixOrder({ userId: user.id });
        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }

        return jsonResponse({ ok: true, order: result.order });
      },
    },
  },
});
