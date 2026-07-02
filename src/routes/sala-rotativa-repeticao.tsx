import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { BackOfficeWorkspaceNav } from "@/components/back-office/back-office-workspace-nav";
import { SalaRotativaWorkspace } from "@/components/sala-rotativa-workspace";
import { useAutomationAlignedRepeticaoSession } from "@/hooks/useAutomationAlignedRotatingSession";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { useRotatingRoomIframeChrome } from "@/hooks/useRotatingRoomIframeChrome";
import { requireAuth, guardAutomationWorkspaceRoute } from "@/lib/auth/guards";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  correctRotatingRoomRepeticaoLastLossAsWin,
  resetRotatingRoomRepeticaoSession,
  ROTATING_ROOM_REPETICAO_MAX_RECOVERY,
} from "@/lib/roulette/rotatingRoomRepeticaoSession";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import { prepareRotatingRoomIframeSession } from "@/lib/roulette/rotatingRoomViewPrefs";
import { isRepeticaoGatilhoEnabled } from "@/lib/roulette/umFatorTriggerEnable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sala-rotativa-repeticao")({
  beforeLoad: async ({ search }) => {
    guardAutomationWorkspaceRoute("/sala-rotativa-repeticao", search);
    requireAuth("/sala-rotativa-repeticao");
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
      { title: "Sala Rotativa · Repetição" },
      {
        name: "description",
        content:
          "Sala rotativa Repetição — ausência de repetição em dúzia/coluna; indica repetir a zona do número mais recente; recuperação Fibonacci 1-1-2-3-5-8-13-21.",
      },
    ],
  }),
  component: SalaRotativaRepeticaoPage,
});

function SalaRotativaRepeticaoPage() {
  const { iframe: openIframe } = Route.useSearch();
  const iframeChrome = useRotatingRoomIframeChrome();
  const [configTick, setConfigTick] = useState(0);

  useLayoutEffect(() => {
    prepareRotatingRoomIframeSession();
  }, []);

  useEffect(() => {
    if (openIframe) prepareRotatingRoomIframeSession();
  }, [openIframe]);

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
  const session = useAutomationAlignedRepeticaoSession(tableIds, histories, {
    enabled: isRepeticaoGatilhoEnabled(),
  });

  return (
    <div
      className={cn(
        "rotating-room-page min-h-screen text-text-primary",
        iframeChrome && "rotating-room-iframe-active",
      )}
    >
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <BackOfficeWorkspaceNav rotatingRoom />
        <SalaRotativaWorkspace
          session={session}
          tableIds={tableIds}
          histories={histories}
          maxRecovery={ROTATING_ROOM_REPETICAO_MAX_RECOVERY}
          panelTitle="Sala Rotativa · Repetição"
          onReset={() => resetRotatingRoomRepeticaoSession(tableIds, histories)}
          onCorrectLastLoss={() => correctRotatingRoomRepeticaoLastLossAsWin()}
        />
      </main>
    </div>
  );
}
