import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/overview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { buildBackOfficeOverview } = await import("@/lib/server/back-office/overview");

        const user = await requireSessionUser(request);
        if (!user) {
          return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        }

        const origin = new URL(request.url).origin;
        const overview = await buildBackOfficeOverview(user.id, user.referralCode, origin);
        return jsonResponse({ ok: true, overview });
      },
    },
  },
});
