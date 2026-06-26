import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/roulette/histories")({
  server: {
    handlers: {
      GET: async () => {
        const { ensureRouletteHubDaemon, waitForRouletteHubDaemon } = await import(
          "@/lib/server/rouletteHubDaemon"
        );
        const { getRouletteHubHistories, getRouletteHubStatus, waitForRouletteHubData } =
          await import("@/lib/server/rouletteHub");

        ensureRouletteHubDaemon();
        await waitForRouletteHubDaemon(30_000);
        await waitForRouletteHubData(25_000);

        const status = getRouletteHubStatus();
        const histories = getRouletteHubHistories();

        return new Response(
          JSON.stringify({
            ok: true,
            histories,
            status,
          }),
          {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
