import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { DesktopTableSignalView } from "@/components/desktop-table-signal-view";
import { useMobileTableSetup } from "@/hooks/useMobileTableSetup";
import { useUmFatorSession } from "@/hooks/useUmFatorSession";
import {
  resolveRuas9ViewTableId,
  writeLobbyRoletasStrategyTab,
} from "@/lib/roulette/lobbyTables";
import { toMobileTableSessionView } from "@/lib/roulette/mobileTableSessionView";
import {
  UM_FATOR_MAX_RECOVERY,
  resetUmFatorSession,
} from "@/lib/roulette/umFatorCrossingStrategy";

export const Route = createFileRoute("/um-fator")({
  validateSearch: (search: Record<string, unknown>): { mesa?: number } => {
    const raw = search.mesa;
    if (raw === undefined || raw === null || raw === "") return {};
    const n = typeof raw === "number" ? raw : Number(String(raw));
    if (!Number.isInteger(n) || n <= 0) return {};
    return { mesa: n };
  },
  head: () => ({
    meta: [
      { title: "1 Fator - Roleta" },
      {
        name: "description",
        content:
          "1 Fator — t1 e t2 iguais nos 3 factores; confirmação quando o giro actual bate em exactamente 2.",
      },
    ],
  }),
  component: UmFatorPage,
});

function UmFatorPage() {
  const { mesa } = Route.useSearch();
  const viewTableId = resolveRuas9ViewTableId(mesa);

  useEffect(() => {
    writeLobbyRoletasStrategyTab("um1fator");
  }, []);

  const { history } = useMobileTableSetup(viewTableId);
  const session = useUmFatorSession(viewTableId, history);
  const sessionView = toMobileTableSessionView(session, viewTableId);

  return (
    <DesktopTableSignalView
      strategyTitle="1 Fator"
      tableId={viewTableId}
      strategyKind="um1fator"
      sessionView={sessionView}
      history={history}
      maxRecovery={UM_FATOR_MAX_RECOVERY}
      sessionStats={session.sessionStats}
      onReset={() => resetUmFatorSession(viewTableId, history)}
      alertLabel={session.alertCategory}
    />
  );
}
