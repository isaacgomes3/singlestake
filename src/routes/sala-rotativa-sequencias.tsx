import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { BackOfficeWorkspaceNav } from "@/components/back-office/back-office-workspace-nav";
import { SequenciasMonitorPanel } from "@/components/sequencias-monitor-panel";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { useSequenciasMonitor } from "@/hooks/useSequenciasMonitor";
import { requireAuth, guardAutomationWorkspaceRoute } from "@/lib/auth/guards";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sala-rotativa-sequencias")({
  beforeLoad: async ({ search }) => {
    guardAutomationWorkspaceRoute("/sala-rotativa-sequencias", search);
    requireAuth("/sala-rotativa-sequencias");
    await requireActiveSubscription();
  },
  validateSearch: (search: Record<string, unknown>): { iframe?: boolean } => {
    const raw = search.iframe;
    const iframe =
      raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "yes";
    return iframe ? { iframe: true } : {};
  },
  head: () => ({
    meta: [
      { title: "Automação · Sequências" },
      {
        name: "description",
        content:
          "Monitor Sequências — alertas de cor, altura e paridade por sequência limpa ou suja.",
      },
    ],
  }),
  component: SalaRotativaSequenciasPage,
});

function SalaRotativaSequenciasPage() {
  const [configTick, setConfigTick] = useState(0);

  useEffect(() => {
    const sync = () => setConfigTick((x) => x + 1);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    return () => window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
  }, []);

  const tableIds = useMemo(() => {
    void configTick;
    const live = getLiveRouletteTableIds();
    const resolved = resolveRotatingRoomTableIds(live);
    return resolved.length > 0 ? resolved : [...ROTATING_ROOM_FIXED_TABLE_IDS];
  }, [configTick]);

  const histories = useRotatingRoomHistories(tableIds);
  const { state, tableId, history, reset } = useSequenciasMonitor(histories, tableIds);

  return (
    <div className={cn("rotating-room-page min-h-screen text-text-primary")}>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <BackOfficeWorkspaceNav rotatingRoom />
        <SequenciasMonitorPanel
          state={state}
          tableId={tableId}
          history={history}
          onReset={reset}
        />
      </main>
    </div>
  );
}
