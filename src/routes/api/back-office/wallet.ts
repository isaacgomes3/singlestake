import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/wallet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getWalletBalances } = await import("@/lib/server/finance/wallet");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const wallets = await getWalletBalances(user.id);
        return jsonResponse({ ok: true, wallets });
      },
    },
  },
});
