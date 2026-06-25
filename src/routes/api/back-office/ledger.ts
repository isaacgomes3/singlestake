import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/ledger")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const {
          listLedgerEntries,
          parseLedgerBucket,
          parseLedgerEntryType,
        } = await import("@/lib/server/finance/ledger");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });

        const url = new URL(request.url);
        const bucket = parseLedgerBucket(url.searchParams.get("bucket"));
        const entryType = parseLedgerEntryType(url.searchParams.get("entryType"));
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Number(limitRaw) : undefined;

        const entries = await listLedgerEntries({
          userId: user.id,
          isAdmin: user.role === "admin",
          bucket,
          entryType,
          limit: Number.isFinite(limit) ? limit : undefined,
        });

        return jsonResponse({ ok: true, entries });
      },
    },
  },
});
