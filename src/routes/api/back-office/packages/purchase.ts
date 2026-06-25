import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/packages/purchase")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { purchasePackage } = await import("@/lib/server/finance/packages");
        const { isAffiliateServicesActive } = await import(
          "@/lib/server/finance/subscription-access"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const active = await isAffiliateServicesActive(user.id);
        if (!active) {
          return jsonResponse(
            {
              ok: false,
              error: "Mensalidade vencida. Regularize para comprar pacotes.",
            },
            { status: 403 },
          );
        }

        const body = await readJsonBody<{ packageId?: string; amount?: number }>(request);
        const result = await purchasePackage({
          userId: user.id,
          packageId: body?.packageId ?? "",
          amount: body?.amount,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }
        return jsonResponse({ ok: true, userPackage: result.userPackage }, { status: 201 });
      },
    },
  },
});
