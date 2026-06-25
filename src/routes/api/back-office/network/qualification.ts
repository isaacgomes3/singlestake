import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/network/qualification")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { buildQualificationProgress } = await import("@/lib/server/network/qualification");
        const { getDb } = await import("@/lib/server/db/client");
        const { users } = await import("@/lib/server/db/schema");
        const { eq } = await import("drizzle-orm");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const db = getDb();
        const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        const qualification = row?.qualification ?? "bronze";

        const data = await buildQualificationProgress(user.id, qualification);
        return jsonResponse({ ok: true, data });
      },
    },
  },
});
