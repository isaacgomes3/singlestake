import { useEffect, useMemo, useState } from "react";

import { SequenciasMonitorPanel } from "@/components/sequencias-monitor-panel";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { useSequenciasMonitor } from "@/hooks/useSequenciasMonitor";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";

/** Visor Sequências embutido no módulo Administração → Automação. */
export function BackOfficeSequenciasMonitorPanel() {
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
    <SequenciasMonitorPanel
      state={state}
      tableId={tableId}
      history={history}
      onReset={reset}
      embedded
    />
  );
}
