import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { BackOfficeWorkspaceNav } from "@/components/back-office/back-office-workspace-nav";
import { SalaRotativaWorkspace } from "@/components/sala-rotativa-workspace";
import { useRotatingRoomIframeChrome } from "@/hooks/useRotatingRoomIframeChrome";
import { requireAuth, guardAutomationWorkspaceRoute } from "@/lib/auth/guards";
import { useRotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import {
  ROTATING_ROOM_UM_FATOR_MAX_RECOVERY,
  correctRotatingRoomUmFatorLastLossAsWin,
  resetRotatingRoomUmFatorSession,
} from "@/lib/roulette/rotatingRoomUmFatorSession";
import { prepareRotatingRoomIframeSession } from "@/lib/roulette/rotatingRoomViewPrefs";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
  writeLobbyRoletasStrategyTab,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import {
  readRotatingRoomExtensionEnabled,
  writeRotatingRoomExtensionEnabled,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sala-rotativa-um-fator")({
  beforeLoad: () => {
    guardAutomationWorkspaceRoute("/sala-rotativa-um-fator");
    requireAuth("/sala-rotativa-um-fator");
  },
  validateSearch: (search: Record<string, unknown>): { iframe?: boolean } => {
    const raw = search.iframe;
    const iframe =
      raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "yes";
    return iframe ? { iframe: true } : {};
  },
  head: () => ({
    meta: [
      { title: "Sala Rotativa · 1 Fator" },
      {
        name: "description",
        content:
          "Sala rotativa — 1 Fator (t1/t2 nos 3 factores; confirmação com 2 factores no giro actual).",
      },
    ],
  }),
  component: SalaRotativaUmFatorPage,
});

function SalaRotativaUmFatorPage() {
  const { iframe: openIframe } = Route.useSearch();
  const iframeChrome = useRotatingRoomIframeChrome();
  const [configTick, setConfigTick] = useState(0);

  useEffect(() => {
    writeLobbyRoletasStrategyTab("um1fator");
  }, []);

  useEffect(() => {
    if (!readRotatingRoomExtensionEnabled()) writeRotatingRoomExtensionEnabled(true);
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
  const session = useRotatingRoomUmFatorSession(tableIds, histories);

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
          maxRecovery={ROTATING_ROOM_UM_FATOR_MAX_RECOVERY}
          panelTitle="Sala Rotativa · 1 Fator"
          onReset={() => resetRotatingRoomUmFatorSession(tableIds, histories)}
          onCorrectLastLoss={() => correctRotatingRoomUmFatorLastLossAsWin()}
        />
      </main>
    </div>
  );
}
