import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/evolution/football-studio")({
  server: {
    handlers: {
      GET: async () => {
        const { waitForFootballStudioDaemon } = await import(
          "@/lib/server/footballStudio/daemon"
        );
        const {
          getFootballStudioHubSnapshot,
          getFootballStudioSidePatterns,
          hydrateFootballStudioHub,
        } = await import("@/lib/server/footballStudio/hub");
        await waitForFootballStudioDaemon(8_000);
        let snapshot = getFootballStudioHubSnapshot();
        // Memória vazia após HMR/restart: força reload do hub-state.json.
        if ((snapshot.cardHistory?.length ?? 0) === 0) {
          await hydrateFootballStudioHub({ force: true });
          snapshot = getFootballStudioHubSnapshot();
        }
        return Response.json({
          ...snapshot,
          patterns: getFootballStudioSidePatterns(2),
        });
      },
    },
  },
});
