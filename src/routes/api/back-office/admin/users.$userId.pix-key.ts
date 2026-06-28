import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/users/$userId/pix-key")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import("@/lib/server/auth/http");
        const { adminSetUserPixKey } = await import("@/lib/server/admin/users");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const body = await readJsonBody<{ pixKey?: string }>(request);
        const result = await adminSetUserPixKey({
          userId: params.userId,
          actorUserId: user.id,
          pixKey: body?.pixKey ?? "",
        });
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        return jsonResponse({ ok: true });
      },
    },
  },
});
