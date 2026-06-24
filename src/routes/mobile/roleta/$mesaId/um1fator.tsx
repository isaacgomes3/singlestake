import { createFileRoute, redirect } from "@tanstack/react-router";

import { MobileSignalScreen } from "@/components/mobile-app/mobile-signal-screen";
import { useMobileTableSetup } from "@/hooks/useMobileTableSetup";
import { useUmFatorSession } from "@/hooks/useUmFatorSession";
import { lobbyTableDisplayName, MOBILE_ROULETTE_FIXED_TABLE_IDS } from "@/lib/roulette/lobbyTables";
import { toMobileTableSessionView } from "@/lib/roulette/mobileTableSessionView";
import { UM_FATOR_MAX_RECOVERY } from "@/lib/roulette/umFatorCrossingStrategy";

function parseMesaId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export const Route = createFileRoute("/mobile/roleta/$mesaId/um1fator")({
  beforeLoad: ({ params }) => {
    const tableId = parseMesaId(params.mesaId);
    if (tableId == null || !MOBILE_ROULETTE_FIXED_TABLE_IDS.includes(tableId)) {
      throw redirect({ to: "/mobile" });
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `1 Fator — Mesa ${params.mesaId}` },
      { name: "theme-color", content: "#000000" },
    ],
  }),
  component: MobileTableUm1FatorPage,
});

function MobileTableUm1FatorPage() {
  const { mesaId: mesaRaw } = Route.useParams();
  const tableId = parseMesaId(mesaRaw)!;
  const { history } = useMobileTableSetup(tableId);
  const session = useUmFatorSession(tableId, history);
  const sessionView = toMobileTableSessionView(session, tableId);

  return (
    <MobileSignalScreen
      strategyTitle="1 Fator"
      strategySubtitle={lobbyTableDisplayName(tableId)}
      strategyKind="um1fator"
      tableId={tableId}
      sessionView={sessionView}
      history={history}
      maxRecovery={UM_FATOR_MAX_RECOVERY}
      backMesaId={mesaRaw}
    />
  );
}
