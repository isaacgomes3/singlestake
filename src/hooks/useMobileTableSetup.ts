import { useEffect, useMemo, useState } from "react";

import {
  MOBILE_ROULETTE_FIXED_TABLE_IDS,
  resolveMobileRouletteTableIds,
} from "@/lib/roulette/lobbyTables";
import {
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  readLiveTableHistory,
} from "@/lib/roulette/historyStorage";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";

/** Histórico ao vivo de uma mesa (modo mobile por roleta). */
export function useMobileTableSetup(tableId: number) {
  const [configTick, setConfigTick] = useState(0);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    const syncConfig = () => setConfigTick((x) => x + 1);
    const syncHistory = () => setHistoryTick((x) => x + 1);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, syncConfig);
    window.addEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, syncHistory);
    return () => {
      window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, syncConfig);
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, syncHistory);
    };
  }, []);

  const mobileTableIds = useMemo(() => {
    void configTick;
    const live = getLiveRouletteTableIds();
    const resolved = resolveMobileRouletteTableIds(live);
    return resolved.length > 0 ? resolved : [...MOBILE_ROULETTE_FIXED_TABLE_IDS];
  }, [configTick]);

  const history = useMemo(() => {
    void historyTick;
    return readLiveTableHistory(tableId);
  }, [tableId, historyTick]);

  const isKnownTable = mobileTableIds.includes(tableId);

  return { tableId, history, mobileTableIds, isKnownTable };
}
