import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/users/$userId/allow-pix-edit")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import("@/lib/server/auth/http");
        const { adminSetAllowPixKeyEdit } = await import("@/lib/server/admin/users");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const body = await readJsonBody<{ allowed?: boolean }>(request);
        const result = await adminSetAllowPixKeyEdit({
          userId: params.userId,
          actorUserId: user.id,
          allowed: body?.allowed !== false,
        });
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        return jsonResponse({ ok: true });
      },
    },
  },
});
