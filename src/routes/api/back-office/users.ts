import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { listUsersWithReferralLinks } = await import("@/lib/server/network/referral");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const origin = new URL(request.url).origin;
        const users = await listUsersWithReferralLinks(origin);
        return jsonResponse({ ok: true, users });
      },
    },
  },
});
