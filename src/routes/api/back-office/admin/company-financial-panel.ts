import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/company-financial-panel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getCompanyFinancialPanel } = await import("@/lib/server/finance/company-financial");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const panel = await getCompanyFinancialPanel();
        return jsonResponse({ ok: true, panel });
      },
      POST: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { createCompanyManualWithdrawal } = await import(
          "@/lib/server/finance/company-financial"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const body = await readJsonBody<{
          bucket?: string;
          amount?: number;
          description?: string;
        }>(request);

        const bucket = body?.bucket;
        if (bucket !== "empresa" && bucket !== "automacao") {
          return jsonResponse(
            { ok: false, error: "Carteira inválida para retirada manual." },
            { status: 400 },
          );
        }

        const result = await createCompanyManualWithdrawal({
          actorUserId: user.id,
          actorName: user.name || user.email,
          bucket,
          amount: Number(body?.amount),
          description: body?.description ?? "",
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }

        const panel = await import("@/lib/server/finance/company-financial").then((m) =>
          m.getCompanyFinancialPanel(),
        );

        return jsonResponse({ ok: true, referenceId: result.referenceId, panel });
      },
    },
  },
});
