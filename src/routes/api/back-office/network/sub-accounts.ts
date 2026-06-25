import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/network/sub-accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { listQualificationSubAccounts } = await import(
          "@/lib/server/network/sub-accounts"
        );

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const items = await listQualificationSubAccounts(user.id);
        return jsonResponse({ ok: true, items });
      },
      POST: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { createQualificationSubAccount } = await import(
          "@/lib/server/network/sub-accounts"
        );
        const { resolvePrimaryUserId } = await import("@/lib/server/network/binary-engine");
        const { getDb } = await import("@/lib/server/db/client");
        const { users } = await import("@/lib/server/db/schema");
        const { eq } = await import("drizzle-orm");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const db = getDb();
        const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
        if (!row) return jsonResponse({ ok: false, error: "Utilizador não encontrado." }, { status: 404 });

        const primaryId = resolvePrimaryUserId(row);
        const body = await readJsonBody<{
          name?: string;
          password?: string;
          level?: number;
          legSide?: "left" | "right";
        }>(request);

        const result = await createQualificationSubAccount({
          masterUserId: primaryId,
          name: body?.name ?? "",
          password: body?.password ?? "",
          level: Number(body?.level ?? 0),
          legSide: body?.legSide === "right" ? "right" : "left",
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }

        return jsonResponse(
          {
            ok: true,
            subAccount: result.subAccount,
            credentials: result.credentials,
          },
          { status: 201 },
        );
      },
    },
  },
});
