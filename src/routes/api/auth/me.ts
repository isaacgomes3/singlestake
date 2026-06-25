import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser, toAuthUser } = await import("@/lib/server/auth/http");

        const user = await requireSessionUser(request);
        if (!user) {
          return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        }

        return jsonResponse({ ok: true, user: toAuthUser(user, new URL(request.url).origin) });
      },
    },
  },
});
