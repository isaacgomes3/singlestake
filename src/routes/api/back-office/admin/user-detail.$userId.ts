import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/user-detail/$userId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getAdminUserDetail } = await import("@/lib/server/admin/user-detail");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        try {
          const origin = new URL(request.url).origin;
          const detail = await getAdminUserDetail(params.userId, origin);
          if (!detail) {
            return jsonResponse({ ok: false, error: "Utilizador não encontrado." }, { status: 404 });
          }
          return jsonResponse({ ok: true, detail });
        } catch (error) {
          console.error("[admin/user-detail] GET failed:", params.userId, error);
          return jsonResponse({ ok: false, error: "Erro ao carregar perfil do cliente." }, { status: 500 });
        }
      },
    },
  },
});
