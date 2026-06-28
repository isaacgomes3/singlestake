import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const {
          countUnreadNotifications,
          listNotificationsForUser,
        } = await import("@/lib/server/notifications/service");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const [items, unreadCount] = await Promise.all([
          listNotificationsForUser(user.id),
          countUnreadNotifications(user.id),
        ]);

        return jsonResponse({ ok: true, notifications: items, unreadCount });
      },
      PATCH: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const {
          markAllNotificationsRead,
          markNotificationRead,
        } = await import("@/lib/server/notifications/service");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        let body: { action?: string; notificationId?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonResponse({ ok: false, error: "Corpo inválido." }, { status: 400 });
        }

        if (body.action === "markAllRead") {
          const marked = await markAllNotificationsRead(user.id);
          return jsonResponse({ ok: true, marked });
        }

        if (body.action === "markRead" && body.notificationId) {
          const ok = await markNotificationRead(user.id, body.notificationId);
          if (!ok) {
            return jsonResponse({ ok: false, error: "Notificação não encontrada." }, { status: 404 });
          }
          return jsonResponse({ ok: true });
        }

        return jsonResponse({ ok: false, error: "Acção inválida." }, { status: 400 });
      },
    },
  },
});
