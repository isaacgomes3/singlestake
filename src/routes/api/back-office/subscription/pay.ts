import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/subscription/pay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { paySubscription } = await import("@/lib/server/finance/subscriptions");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const result = await paySubscription(user.id);
        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }
        return jsonResponse({ ok: true });
      },
    },
  },
});
