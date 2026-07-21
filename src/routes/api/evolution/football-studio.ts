import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/evolution/football-studio")({
  server: {
    handlers: {
      GET: async () => {
        const { waitForFootballStudioDaemon } = await import(
          "@/lib/server/footballStudio/daemon"
        );
        const { getFootballStudioHubSnapshot, getFootballStudioSidePatterns } = await import(
          "@/lib/server/footballStudio/hub"
        );
        await waitForFootballStudioDaemon(8_000);
        const snapshot = getFootballStudioHubSnapshot();
        return Response.json({
          ...snapshot,
          patterns: getFootballStudioSidePatterns(2),
        });
      },
    },
  },
});
