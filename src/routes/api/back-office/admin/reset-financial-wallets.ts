import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/reset-financial-wallets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { resetAllFinancialWalletsExceptGlobalAutomation } = await import(
          "@/lib/server/finance/reset-all-financial-wallets"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const result = await resetAllFinancialWalletsExceptGlobalAutomation({
          actorUserId: user.id,
          actorLabel: user.email,
        });

        return jsonResponse({
          ok: true,
          ...result,
          message:
            "Carteiras financeiras zeradas. Saldo da automação global mantido (extrato operacional).",
        });
      },
    },
  },
});
