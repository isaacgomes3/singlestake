import { createFileRoute } from "@tanstack/react-router";

import { FootballBlitzStrategyPage } from "@/components/football-blitz-strategy-page";
import { FOOTBALL_BLITZ_TOP_CARD } from "@/lib/pragmatic/dgaFootballBlitzConstants";

export const Route = createFileRoute("/football-blitz")({
  head: () => ({
    meta: [
      { title: "Football Blitz Top Card" },
      {
        name: "description",
        content: "Football Blitz Top Card — tapete, gatilho pelo último spread e indicações ao vivo.",
      },
    ],
  }),
  component: FootballBlitzTopCardPage,
});

function FootballBlitzTopCardPage() {
  return <FootballBlitzStrategyPage config={FOOTBALL_BLITZ_TOP_CARD} />;
}
