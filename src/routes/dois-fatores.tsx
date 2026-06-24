import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { DesktopTableSignalView } from "@/components/desktop-table-signal-view";
import { useDoisFatoresCrossingSession } from "@/hooks/useDoisFatoresCrossingSession";
import { useMobileTableSetup } from "@/hooks/useMobileTableSetup";
import {
  DOIS_FATORES_CROSSING_MAX_RECOVERY,
  DOIS_FATORES_CROSSING_MIN_ABSENCE_SPINS,
  resetDoisFatoresCrossingSession,
} from "@/lib/roulette/doisFatoresCrossingStrategy";
import {
  resolveRuas9ViewTableId,
  writeLobbyRoletasStrategyTab,
} from "@/lib/roulette/lobbyTables";
import { toMobileTableSessionView } from "@/lib/roulette/mobileTableSessionView";

export const Route = createFileRoute("/dois-fatores")({
  validateSearch: (search: Record<string, unknown>): { mesa?: number } => {
    const raw = search.mesa;
    if (raw === undefined || raw === null || raw === "") return {};
    const n = typeof raw === "number" ? raw : Number(String(raw));
    if (!Number.isInteger(n) || n <= 0) return {};
    return { mesa: n };
  },
  head: () => ({
    meta: [
      { title: "2 Fatores - Roleta" },
      {
        name: "description",
        content: `2 Fatores — alerta quando um cruzamento cor/altura ou paridade/altura está ausente há ${DOIS_FATORES_CROSSING_MIN_ABSENCE_SPINS}+ giros.`,
      },
    ],
  }),
  component: DoisFatoresCrossingPage,
});

function DoisFatoresCrossingPage() {
  const { mesa } = Route.useSearch();
  const viewTableId = resolveRuas9ViewTableId(mesa);

  useEffect(() => {
    writeLobbyRoletasStrategyTab("dois2fatores");
  }, []);

  const { history } = useMobileTableSetup(viewTableId);
  const session = useDoisFatoresCrossingSession(viewTableId, history);
  const sessionView = toMobileTableSessionView(session, viewTableId);

  return (
    <DesktopTableSignalView
      strategyTitle="2 Fatores"
      tableId={viewTableId}
      strategyKind="dois2fatores"
      sessionView={sessionView}
      history={history}
      maxRecovery={DOIS_FATORES_CROSSING_MAX_RECOVERY}
      sessionStats={session.sessionStats}
      onReset={() => resetDoisFatoresCrossingSession(viewTableId, history)}
      alertLabel={session.alertCategory ?? session.prepareCategory}
    />
  );
}
