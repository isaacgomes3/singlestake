import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/network/binary/next-direct-side")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { setNextDirectBinarySide } = await import("@/lib/server/network/direct-placement");
        const { buildBinaryNetworkData } = await import("@/lib/server/network/binary");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const body = (await request.json().catch(() => null)) as { side?: "left" | "right" } | null;
        const side = body?.side;
        if (side !== "left" && side !== "right") {
          return jsonResponse({ ok: false, error: "Perna inválida." }, { status: 400 });
        }

        const result = await setNextDirectBinarySide({ userId: user.id, side });
        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
        }

        const data = await buildBinaryNetworkData(user.id, user.name);
        return jsonResponse({ ok: true, data });
      },
    },
  },
});
