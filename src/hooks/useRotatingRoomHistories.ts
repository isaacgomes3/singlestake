import { useEffect, useMemo, useState } from "react";

import { useStrategyGlobalSnapshot } from "@/hooks/useStrategyGlobalSnapshot";
import { isStrategyGlobalConnected, isStrategyGlobalEnabled } from "@/lib/roulette/strategyGlobalClient";
import {
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  liveTableHistoryStorageKey,
  liveTableSpinTimesStorageKey,
  readLiveTableHistory,
  type RouletteLiveTableHistoryDetail,
} from "@/lib/roulette/historyStorage";
import { ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";

export function useRotatingRoomHistories(tableIds: readonly number[]): Record<number, number[]> {
  const globalSnap = useStrategyGlobalSnapshot();
  const globalOn =
    isStrategyGlobalEnabled() && isStrategyGlobalConnected() && globalSnap != null;

  const [histories, setHistories] = useState<Record<number, number[]>>(() => {
    const out: Record<number, number[]> = {};
    for (const id of tableIds) out[id] = readLiveTableHistory(id);
    return out;
  });

  useEffect(() => {
    const sync = () => {
      setHistories((prev) => {
        const next = { ...prev };
        for (const id of tableIds) next[id] = readLiveTableHistory(id);
        return next;
      });
    };
    sync();
    const onLive = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteLiveTableHistoryDetail>).detail;
      if (d?.tableId != null && tableIds.includes(d.tableId)) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null) {
        sync();
        return;
      }
      for (const id of tableIds) {
        if (
          e.key === liveTableHistoryStorageKey(id) ||
          e.key === liveTableSpinTimesStorageKey(id)
        ) {
          sync();
          break;
        }
      }
    };
    window.addEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    return () => {
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    };
  }, [tableIds]);

  const globalHistories = useMemo(() => {
    if (!globalSnap) return null;
    const out: Record<number, number[]> = {};
    for (const id of tableIds) out[id] = globalSnap.tableHistories[id] ?? [];
    return out;
  }, [globalSnap, tableIds]);

  const mergedHistories = useMemo(() => {
    if (!globalOn || !globalHistories) return histories;
    const out: Record<number, number[]> = { ...histories };
    for (const id of tableIds) {
      const local = histories[id] ?? [];
      const remote = globalHistories[id] ?? [];
      if (remote.length === 0) {
        out[id] = local;
      } else if (local.length === 0) {
        out[id] = remote;
      } else if (local[0] === remote[0]) {
        out[id] = local.length >= remote.length ? local : remote;
      } else {
        // Cabeçalho divergente — confiar no motor global (hub / extensão).
        out[id] = remote;
      }
    }
    return out;
  }, [globalOn, globalHistories, histories, tableIds]);

  return mergedHistories;
}
