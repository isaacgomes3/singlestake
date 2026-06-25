import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/network/binary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { buildBinaryNetworkData } = await import("@/lib/server/network/binary");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const data = await buildBinaryNetworkData(user.id, user.name);
        return jsonResponse({ ok: true, data });
      },
    },
  },
});
