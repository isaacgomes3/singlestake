import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/network/bonuses")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { buildNetworkBonusesData } = await import("@/lib/server/network/bonuses");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const data = await buildNetworkBonusesData(user.id);
        return jsonResponse({ ok: true, data });
      },
    },
  },
});
