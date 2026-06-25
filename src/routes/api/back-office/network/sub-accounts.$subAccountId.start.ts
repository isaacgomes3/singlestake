import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/api/back-office/network/sub-accounts/$subAccountId/start",
)({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { purchaseStartForSubAccount } = await import("@/lib/server/network/sub-accounts");
        const { resolvePrimaryUserId } = await import("@/lib/server/network/binary-engine");
        const { isAffiliateServicesActive } = await import(
          "@/lib/server/finance/subscription-access"
        );
        const { getDb } = await import("@/lib/server/db/client");
        const { users } = await import("@/lib/server/db/schema");
        const { eq } = await import("drizzle-orm");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const db = getDb();
        const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        if (!row) {
          return jsonResponse({ ok: false, error: "Utilizador não encontrado." }, { status: 404 });
        }

        const primaryId = resolvePrimaryUserId(row);
        const active = await isAffiliateServicesActive(primaryId);
        if (!active) {
          return jsonResponse(
            {
              ok: false,
              error: "Mensalidade vencida. Regularize para activar sub-contas.",
            },
            { status: 403 },
          );
        }

        const result = await purchaseStartForSubAccount({
          masterUserId: primaryId,
          subAccountId: params.subAccountId,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }

        return jsonResponse({ ok: true, subAccount: result.subAccount }, { status: 201 });
      },
    },
  },
});
