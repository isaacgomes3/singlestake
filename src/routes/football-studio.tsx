import { createFileRoute } from "@tanstack/react-router";

import { FootballStudioHubPage } from "@/components/football-studio-hub-page";
import { requireAuth } from "@/lib/auth/guards";

export const Route = createFileRoute("/football-studio")({
  beforeLoad: () => {
    requireAuth("/football-studio");
  },
  component: FootballStudioHubPage,
});
