import { createFileRoute } from "@tanstack/react-router";

import { getAllDgaTableMeta } from "@/lib/server/dgaTableMetaCache";

/** URLs `tableImage` conhecidas na DGA (fallback até o hub receber subscribe). */
const DGA_TABLE_IMAGE_FALLBACK: Record<number, string> = {
  213: "https://client.pragmaticplaylive.net/desktop/assets/snaps/381rwkr381korean/poster.jpg",
};

export const Route = createFileRoute("/api/roulette/table-meta")({
  server: {
    handlers: {
      GET: async () => {
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        ensureRouletteHubDaemon();

        const tables = getAllDgaTableMeta();
        for (const [id, url] of Object.entries(DGA_TABLE_IMAGE_FALLBACK)) {
          const key = id;
          if (!tables[key]?.tableImage) {
            tables[key] = { ...tables[key], tableImage: url };
          }
        }

        return new Response(JSON.stringify({ tables }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
