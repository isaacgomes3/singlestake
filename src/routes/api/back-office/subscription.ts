import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/subscription")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getSubscriptionDetails } = await import("@/lib/server/finance/subscriptions");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const subscription = await getSubscriptionDetails(user.id);
        return jsonResponse({ ok: true, subscription });
      },
    },
  },
});
