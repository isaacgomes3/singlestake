import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/withdrawals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { listWithdrawals } = await import("@/lib/server/finance/withdrawals");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const withdrawals = await listWithdrawals({
          userId: user.id,
          isAdmin: user.role === "admin",
        });
        return jsonResponse({ ok: true, withdrawals });
      },
      POST: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const { createWithdrawal } = await import("@/lib/server/finance/withdrawals");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const body = await readJsonBody<{
          amount?: number;
          bucket?: string;
          pixKey?: string;
        }>(request);

        const result = await createWithdrawal({
          userId: user.id,
          amount: Number(body?.amount),
          bucket: body?.bucket ?? "",
          pixKey: body?.pixKey,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }
        return jsonResponse({ ok: true, withdrawal: result.withdrawal }, { status: 201 });
      },
    },
  },
});
