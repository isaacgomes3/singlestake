import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { SalaRotativaWorkspace } from "@/components/sala-rotativa-workspace";
import { StrategyLearningAdvisorPanel } from "@/components/strategy-learning-advisor-panel";
import { RouletteAppTabs } from "@/components/roulette-app-tabs";
import { useStrategyLearningAdvisor } from "@/hooks/useStrategyLearningAdvisor";
import { useRotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import {
  ROTATING_ROOM_UM_FATOR_MAX_RECOVERY,
  correctRotatingRoomUmFatorLastLossAsWin,
  resetRotatingRoomUmFatorSession,
} from "@/lib/roulette/rotatingRoomUmFatorSession";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
  writeLobbyRoletasStrategyTab,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";

export const Route = createFileRoute("/sala-rotativa-um-fator")({
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
  const [configTick, setConfigTick] = useState(0);

  useEffect(() => {
    writeLobbyRoletasStrategyTab("um1fator");
  }, []);

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
  const { snapshot, updateUmSettings } = useStrategyLearningAdvisor(histories);

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <RouletteAppTabs />
        <SalaRotativaWorkspace
          session={session}
          tableIds={tableIds}
          histories={histories}
          maxRecovery={ROTATING_ROOM_UM_FATOR_MAX_RECOVERY}
          panelTitle="Sala Rotativa · 1 Fator"
          onReset={() => resetRotatingRoomUmFatorSession(tableIds, histories)}
          onCorrectLastLoss={() => correctRotatingRoomUmFatorLastLossAsWin()}
        />
        <StrategyLearningAdvisorPanel
          className="mt-4"
          snapshot={snapshot}
          activeStrategy="um1fator"
          onUpdateUmSettings={updateUmSettings}
        />
      </main>
    </div>
  );
}
