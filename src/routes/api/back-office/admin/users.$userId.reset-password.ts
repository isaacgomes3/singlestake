import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/users/$userId/reset-password")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { adminResetUserPassword } = await import("@/lib/server/admin/user-detail");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        let body: { password?: string };
        try {
          body = (await request.json()) as { password?: string };
        } catch {
          return jsonResponse({ ok: false, error: "Corpo inválido." }, { status: 400 });
        }

        const result = await adminResetUserPassword({
          userId: params.userId,
          password: body.password ?? "",
        });
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        return jsonResponse({ ok: true });
      },
    },
  },
});
