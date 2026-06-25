import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/deposits/$depositId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { processDeposit } = await import("@/lib/server/finance/deposits");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso restrito a administradores." }, { status: 403 });
        }

        const body = await readJsonBody<{ action?: "approve" | "reject" }>(request);
        if (body?.action !== "approve" && body?.action !== "reject") {
          return jsonResponse({ ok: false, error: "Acção inválida." }, { status: 400 });
        }

        const result = await processDeposit({
          depositId: params.depositId,
          actorUserId: user.id,
          actorName: user.name,
          action: body.action,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }
        return jsonResponse({ ok: true, deposit: result.deposit });
      },
    },
  },
});
