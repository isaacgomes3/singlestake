import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/deposits")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { listDeposits } = await import("@/lib/server/finance/deposits");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const deposits = await listDeposits({
          userId: user.id,
          isAdmin: user.role === "admin",
        });
        return jsonResponse({ ok: true, deposits });
      },
      POST: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { createDeposit } = await import("@/lib/server/finance/deposits");
        const { isLucPagueiGatewayReady } = await import(
          "@/lib/server/finance/payment-gateway-settings"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const body = await readJsonBody<{
          amount?: number;
          method?: string;
          externalRef?: string;
          cpfDocument?: string;
        }>(request);

        const method = (body?.method ?? "pix").toLowerCase();
        if (method === "pix" && (await isLucPagueiGatewayReady())) {
          const { createDepositPix } = await import("@/lib/server/finance/deposits");
          const pixResult = await createDepositPix({
            userId: user.id,
            amount: Number(body?.amount),
            cpfDocument: body?.cpfDocument,
          });
          if (!pixResult.ok) {
            return jsonResponse({ ok: false, error: pixResult.error }, { status: 400 });
          }
          return jsonResponse({ ok: true, deposit: pixResult.deposit, pix: true }, { status: 201 });
        }

        const result = await createDeposit({
          userId: user.id,
          amount: Number(body?.amount),
          method: body?.method,
          externalRef: body?.externalRef,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }
        return jsonResponse({ ok: true, deposit: result.deposit }, { status: 201 });
      },
    },
  },
});
