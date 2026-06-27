import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/packages")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { listAvailablePackages } = await import("@/lib/server/finance/packages");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const packages = await listAvailablePackages();
        const { isPixCheckoutEnabledAsync } = await import("@/lib/server/finance/package-pix");
        return jsonResponse({ ok: true, packages, pixEnabled: await isPixCheckoutEnabledAsync() });
      },
    },
  },
});
