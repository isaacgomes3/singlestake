import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { SalaRotativaWorkspace } from "@/components/sala-rotativa-workspace";
import { StrategyLearningAdvisorPanel } from "@/components/strategy-learning-advisor-panel";
import { RouletteAppTabs } from "@/components/roulette-app-tabs";
import { useStrategyLearningAdvisor } from "@/hooks/useStrategyLearningAdvisor";
import { useRotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import {
  ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  correctRotatingRoomCrossingLastLossAsWin,
  resetRotatingRoomCrossingSession,
} from "@/lib/roulette/rotatingRoomCrossingSession";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";

export const Route = createFileRoute("/sala-rotativa")({
  head: () => ({
    meta: [
      { title: "Sala Rotativa · 2 Fatores" },
      {
        name: "description",
        content:
          "Sala rotativa — 2 Fatores por ausência de cruzamento em todas as roletas disponíveis.",
      },
    ],
  }),
  component: SalaRotativaPage,
});

function SalaRotativaPage() {
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
  const session = useRotatingRoomCrossingSession(tableIds, histories);
  const { snapshot, updateUmSettings } = useStrategyLearningAdvisor(histories);

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <RouletteAppTabs />
        <SalaRotativaWorkspace
          session={session}
          tableIds={tableIds}
          histories={histories}
          maxRecovery={ROTATING_ROOM_CROSSING_MAX_RECOVERY}
          onReset={() => resetRotatingRoomCrossingSession(tableIds, histories)}
          onCorrectLastLoss={() => correctRotatingRoomCrossingLastLossAsWin()}
        />
        <StrategyLearningAdvisorPanel
          className="mt-4"
          snapshot={snapshot}
          activeStrategy="dois2fatores"
          onUpdateUmSettings={updateUmSettings}
        />
      </main>
    </div>
  );
}
