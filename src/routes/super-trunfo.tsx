import { createFileRoute } from "@tanstack/react-router";

import { FootballBlitzStrategyPage } from "@/components/football-blitz-strategy-page";
import { requireAuth, guardAutomationWorkspaceRoute } from "@/lib/auth/guards";
import { FOOTBALL_BLITZ_SUPER_TRUNFO } from "@/lib/pragmatic/dgaFootballBlitzConstants";

export const Route = createFileRoute("/super-trunfo")({
  beforeLoad: () => {
    guardAutomationWorkspaceRoute("/super-trunfo");
    requireAuth("/super-trunfo");
  },
  head: () => ({
    meta: [
      { title: "Super Trunfo Futebol Latino" },
      {
        name: "description",
        content: "Super Trunfo — tapete, gatilho pelo último spread e indicações ao vivo.",
      },
    ],
  }),
  component: SuperTrunfoPage,
});

function SuperTrunfoPage() {
  return <FootballBlitzStrategyPage config={FOOTBALL_BLITZ_SUPER_TRUNFO} />;
}
