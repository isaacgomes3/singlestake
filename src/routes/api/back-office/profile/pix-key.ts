import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/profile/pix-key")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { getPixKeyProfile } = await import("@/lib/server/admin/users");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const profile = await getPixKeyProfile(user.id);
        if (!profile) return jsonResponse({ ok: false, error: "Perfil não encontrado." }, { status: 404 });
        return jsonResponse({ ok: true, profile });
      },
      PUT: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import("@/lib/server/auth/http");
        const { saveUserPixKey } = await import("@/lib/server/admin/users");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const body = await readJsonBody<{ pixKey?: string }>(request);
        const result = await saveUserPixKey({ userId: user.id, pixKey: body?.pixKey ?? "" });
        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }
        return jsonResponse({ ok: true, profile: result.profile });
      },
    },
  },
});
