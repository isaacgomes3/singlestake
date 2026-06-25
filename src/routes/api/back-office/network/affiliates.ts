import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/network/affiliates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { buildAffiliatesData } = await import("@/lib/server/network/affiliates");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const origin = new URL(request.url).origin;
        const data = await buildAffiliatesData(user.id, user.referralCode, origin);
        return jsonResponse({ ok: true, data });
      },
    },
  },
});
