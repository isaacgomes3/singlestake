import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/users/$userId")({
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

        const origin = new URL(request.url).origin;
        const detail = await getAdminUserDetail(params.userId, origin);
        if (!detail) {
          return jsonResponse({ ok: false, error: "Utilizador não encontrado." }, { status: 404 });
        }
        return jsonResponse({ ok: true, detail });
      },
      PATCH: async ({ request, params }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { updateAdminUserProfile } = await import("@/lib/server/admin/user-detail");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return jsonResponse({ ok: false, error: "Corpo inválido." }, { status: 400 });
        }

        const result = await updateAdminUserProfile({
          userId: params.userId,
          name: typeof body.name === "string" ? body.name : undefined,
          email: typeof body.email === "string" ? body.email : undefined,
          cpf: body.cpf === null || typeof body.cpf === "string" ? body.cpf : undefined,
          qualification:
            typeof body.qualification === "string"
              ? (body.qualification as "bronze" | "prata" | "ouro" | "diamante" | "imperial")
              : undefined,
        });
        if (!result.ok) return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        return jsonResponse({ ok: true });
      },
    },
  },
});
