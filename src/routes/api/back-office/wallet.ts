import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/wallet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getWalletBalances } = await import("@/lib/server/finance/wallet");
        const { getPersonalAutomationWalletBalance } = await import(
          "@/lib/server/finance/global-automation-capital"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const personalAutomacao = await getPersonalAutomationWalletBalance(user.id);
        const wallets = (await getWalletBalances(user.id)).map((w) =>
          w.bucket === "automacao" ? { ...w, availableBalance: personalAutomacao } : w,
        );
        return jsonResponse({ ok: true, wallets });
      },
    },
  },
});
