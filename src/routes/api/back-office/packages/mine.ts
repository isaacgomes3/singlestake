import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/packages/mine")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { listUserPackages } = await import("@/lib/server/finance/packages");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const packages = await listUserPackages(user.id);
        return jsonResponse({ ok: true, packages });
      },
    },
  },
});
