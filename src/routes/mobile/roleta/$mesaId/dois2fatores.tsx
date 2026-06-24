import { createFileRoute, redirect } from "@tanstack/react-router";

import { MobileSignalScreen } from "@/components/mobile-app/mobile-signal-screen";
import { useDoisFatoresCrossingSession } from "@/hooks/useDoisFatoresCrossingSession";
import { useMobileTableSetup } from "@/hooks/useMobileTableSetup";
import { DOIS_FATORES_CROSSING_MAX_RECOVERY } from "@/lib/roulette/doisFatoresCrossingStrategy";
import { lobbyTableDisplayName, MOBILE_ROULETTE_FIXED_TABLE_IDS } from "@/lib/roulette/lobbyTables";
import { toMobileTableSessionView } from "@/lib/roulette/mobileTableSessionView";

function parseMesaId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export const Route = createFileRoute("/mobile/roleta/$mesaId/dois2fatores")({
  beforeLoad: ({ params }) => {
    const tableId = parseMesaId(params.mesaId);
    if (tableId == null || !MOBILE_ROULETTE_FIXED_TABLE_IDS.includes(tableId)) {
      throw redirect({ to: "/mobile" });
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `2 Fatores — Mesa ${params.mesaId}` },
      { name: "theme-color", content: "#000000" },
    ],
  }),
  component: MobileTableDois2FatoresPage,
});

function MobileTableDois2FatoresPage() {
  const { mesaId: mesaRaw } = Route.useParams();
  const tableId = parseMesaId(mesaRaw)!;
  const { history } = useMobileTableSetup(tableId);
  const session = useDoisFatoresCrossingSession(tableId, history);
  const sessionView = toMobileTableSessionView(session, tableId);

  return (
    <MobileSignalScreen
      strategyTitle="2 Fatores"
      strategySubtitle={lobbyTableDisplayName(tableId)}
      strategyKind="dois2fatores"
      tableId={tableId}
      sessionView={sessionView}
      history={history}
      maxRecovery={DOIS_FATORES_CROSSING_MAX_RECOVERY}
      backMesaId={mesaRaw}
    />
  );
}
