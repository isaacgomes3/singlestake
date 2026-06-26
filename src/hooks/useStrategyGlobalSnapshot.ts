import { useEffect, useState } from "react";

import {
  applyStrategyGlobalStreamMessage,
  clearStrategyGlobalClientState,
  getStrategyGlobalSnapshot,
  isStrategyGlobalEnabled,
  STRATEGY_GLOBAL_CHANGED_EVENT,
} from "@/lib/roulette/strategyGlobalClient";
import type { StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";

export function StrategyGlobalSseBridge() {
  useEffect(() => {
    if (!isStrategyGlobalEnabled()) {
      clearStrategyGlobalClientState();
      return;
    }

    let closed = false;
    const url = new URL("/api/roulette/strategy-global/stream", window.location.origin).href;
    const source = new EventSource(url);

    source.onmessage = (event: MessageEvent) => {
      if (closed) return;
      try {
        const msg = JSON.parse(event.data) as Parameters<typeof applyStrategyGlobalStreamMessage>[0];
        if (msg.type === "sync" || msg.type === "update") {
          applyStrategyGlobalStreamMessage(msg);
        }
      } catch {
        /* JSON inválido */
      }
    };

    return () => {
      closed = true;
      source.close();
      clearStrategyGlobalClientState();
    };
  }, []);

  return null;
}

export function useStrategyGlobalSnapshot(): StrategyGlobalSnapshot | null {
  const [snap, setSnap] = useState(() => getStrategyGlobalSnapshot());

  useEffect(() => {
    const sync = () => setSnap(getStrategyGlobalSnapshot());
    window.addEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, sync);
    return () => window.removeEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, sync);
  }, []);

  return snap;
}
