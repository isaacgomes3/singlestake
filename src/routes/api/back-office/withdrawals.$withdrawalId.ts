import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/withdrawals/$withdrawalId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { processWithdrawal } = await import("@/lib/server/finance/withdrawals");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso restrito a administradores." }, { status: 403 });
        }

        const body = await readJsonBody<{ action?: "approve" | "reject" | "paid" }>(request);
        if (body?.action !== "approve" && body?.action !== "reject" && body?.action !== "paid") {
          return jsonResponse({ ok: false, error: "Acção inválida." }, { status: 400 });
        }

        const result = await processWithdrawal({
          withdrawalId: params.withdrawalId,
          actorUserId: user.id,
          actorName: user.name,
          action: body.action,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }
        return jsonResponse({ ok: true, withdrawal: result.withdrawal });
      },
    },
  },
});
