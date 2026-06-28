import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/users/$userId/activate-automation")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import("@/lib/server/auth/http");
        const { adminActivateAutomationManual } = await import("@/lib/server/admin/users");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const body = await readJsonBody<{ amount?: number; packageId?: string }>(request);
        const result = await adminActivateAutomationManual({
          userId: params.userId,
          actorUserId: user.id,
          amount: body?.amount,
          packageId: body?.packageId,
        });
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        return jsonResponse({ ok: true });
      },
    },
  },
});
