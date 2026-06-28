import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/roulette/extension-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { parseExtensionSyncPayload, verifyExtensionSyncSecret, isExtensionSyncConfigured } =
          await import("@/lib/server/extensionSource");
        const { parseRouletteTableIdsFromEnv } = await import("@/lib/server/rouletteSocket");
        const { ensureStrategyGlobalEngine, ingestStrategyGlobalExtensionSync } = await import(
          "@/lib/server/strategyGlobal/engine"
        );
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");

        if (!isExtensionSyncConfigured()) {
          return Response.json(
            { ok: false, error: "Sync da extensão não configurado no servidor." },
            { status: 503 },
          );
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
        }

        const payload = parseExtensionSyncPayload(raw);
        if (!payload) {
          return Response.json({ ok: false, error: "Payload de sync inválido." }, { status: 400 });
        }
        if (!verifyExtensionSyncSecret(payload.secret)) {
          return Response.json({ ok: false, error: "Segredo de sync inválido." }, { status: 401 });
        }

        const tableIds = parseRouletteTableIdsFromEnv();
        ensureRouletteHubDaemon();
        await ensureStrategyGlobalEngine(tableIds);
        const snapshot = ingestStrategyGlobalExtensionSync(payload, tableIds);
        if (!snapshot) {
          return Response.json({ ok: false, error: "Motor global indisponível." }, { status: 503 });
        }

        return Response.json({
          ok: true,
          revision: snapshot.revision,
          extensionSource: snapshot.extensionSource ?? null,
        });
      },
    },
  },
});
