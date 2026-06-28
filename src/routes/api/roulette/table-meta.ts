import { createFileRoute } from "@tanstack/react-router";

import { DGA_ROULETTE_TABLE_POSTERS } from "@/lib/roulette/dgaRouletteTablePosters";
import { getAllDgaTableMeta } from "@/lib/server/dgaTableMetaCache";

export const Route = createFileRoute("/api/roulette/table-meta")({
  server: {
    handlers: {
      GET: async () => {
        const { ensureRouletteHubDaemon } = await import("@/lib/server/rouletteHubDaemon");
        ensureRouletteHubDaemon();

        const tables = getAllDgaTableMeta();
        for (const [id, url] of Object.entries(DGA_ROULETTE_TABLE_POSTERS)) {
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
