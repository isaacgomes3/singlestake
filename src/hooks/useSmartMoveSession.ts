import { useEffect, useMemo, useRef, useState } from "react";

import { detectSmartMoveConvergence } from "@/lib/smartMove/pattern";
import {
  computeSmartMoveSessionFromHistory,
  type SmartMovePendingBet,
} from "@/lib/smartMove/placarFromHistory";
import { defaultSmartMovePersisted, saveSmartMovePersisted, type SmartMovePersisted } from "@/lib/smartMove/persistence";
import {
  ROULETTE_HISTORY_CHANGED_EVENT,
  ROULETTE_MIRROR_HISTORY_SCOPE,
  historyChangeAffectsScope,
  readRouletteHistory,
  rouletteHistoryStorageKey,
  type RouletteHistoryChangedDetail,
} from "@/lib/roulette/historyStorage";

export type PendingBet = SmartMovePendingBet;

export type SmartMoveSessionState = {
  persisted: SmartMovePersisted;
  currentGale: number;
  pendingBet: PendingBet | null;
};

function historyEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function useSmartMoveSession() {
  const [syncTick, setSyncTick] = useState(0);
  const [session, setSession] = useState<SmartMoveSessionState>(() => {
    if (typeof window === "undefined") {
      return {
        persisted: defaultSmartMovePersisted(),
        currentGale: 0,
        pendingBet: null,
      };
    }
    return computeSmartMoveSessionFromHistory(readRouletteHistory(ROULETTE_MIRROR_HISTORY_SCOPE));
  });

  const historySnapshotRef = useRef<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scope = ROULETTE_MIRROR_HISTORY_SCOPE;
    const bump = () => setSyncTick((t) => t + 1);
    bump();
    const onHist = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteHistoryChangedDetail>).detail;
      if (historyChangeAffectsScope(d, scope)) bump();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === rouletteHistoryStorageKey(scope) || e.key === null) bump();
    };
    window.addEventListener(ROULETTE_HISTORY_CHANGED_EVENT, onHist);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ROULETTE_HISTORY_CHANGED_EVENT, onHist);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = readRouletteHistory(ROULETTE_MIRROR_HISTORY_SCOPE);
    if (historyEqual(historySnapshotRef.current, next)) return;
    historySnapshotRef.current = next;
    const computed = computeSmartMoveSessionFromHistory(next);
    setSession(computed);
    saveSmartMovePersisted(computed.persisted);
  }, [syncTick]);

  const history = useMemo(() => {
    if (typeof window === "undefined") return [];
    return readRouletteHistory(ROULETTE_MIRROR_HISTORY_SCOPE);
  }, [syncTick]);

  const currentAlert = detectSmartMoveConvergence(history);

  return {
    history,
    session,
    currentAlert,
  };
}
