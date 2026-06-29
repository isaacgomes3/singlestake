import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/network/binary/subtree")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const { buildBinarySubtree } = await import("@/lib/server/network/binary");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const url = new URL(request.url);
        const rootUserId = url.searchParams.get("userId")?.trim();
        const depthRaw = url.searchParams.get("depth");
        const depth = depthRaw ? Number.parseInt(depthRaw, 10) : undefined;

        if (!rootUserId) {
          return jsonResponse({ ok: false, error: "userId obrigatório." }, { status: 400 });
        }

        const subtree = await buildBinarySubtree({
          viewerId: user.id,
          rootUserId,
          maxDepth: Number.isFinite(depth) ? depth : undefined,
        });

        if (!subtree) {
          return jsonResponse({ ok: false, error: "Nó não encontrado na sua rede." }, { status: 403 });
        }

        return jsonResponse({ ok: true, subtree });
      },
    },
  },
});
