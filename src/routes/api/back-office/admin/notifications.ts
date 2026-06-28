import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { listAdminNotifications } = await import("@/lib/server/notifications/service");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const notifications = await listAdminNotifications();
        return jsonResponse({ ok: true, notifications });
      },
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { createNotification } = await import("@/lib/server/notifications/service");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        let body: {
          title?: string;
          body?: string;
          audience?: "all" | "user";
          targetUserId?: string;
        } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonResponse({ ok: false, error: "Corpo inválido." }, { status: 400 });
        }

        if (body.audience !== "all" && body.audience !== "user") {
          return jsonResponse({ ok: false, error: "Destino inválido." }, { status: 400 });
        }

        try {
          const notification = await createNotification({
            title: body.title ?? "",
            body: body.body ?? "",
            audience: body.audience,
            targetUserId: body.targetUserId,
            createdByUserId: user.id,
          });
          return jsonResponse({ ok: true, notification });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Não foi possível enviar.";
          return jsonResponse({ ok: false, error: message }, { status: 400 });
        }
      },
    },
  },
});
