import { useEffect, useState } from "react";

import {
  applyStrategyGlobalStreamMessage,
  bootstrapStrategyGlobalSnapshot,
  getStrategyGlobalSnapshot,
  isStrategyGlobalEnabled,
  STRATEGY_GLOBAL_CHANGED_EVENT,
} from "@/lib/roulette/strategyGlobalClient";
import type { StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";

const BOOTSTRAP_INTERVAL_MS = 5_000;

export function StrategyGlobalSseBridge() {
  useEffect(() => {
    if (!isStrategyGlobalEnabled()) return;

    void bootstrapStrategyGlobalSnapshot();

    let closed = false;
    const url = new URL("/api/roulette/strategy-global/stream", window.location.origin).href;
    const source = new EventSource(url);

    const bootstrapTimer = window.setInterval(() => {
      if (!closed) void bootstrapStrategyGlobalSnapshot();
    }, BOOTSTRAP_INTERVAL_MS);

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
      window.clearInterval(bootstrapTimer);
      source.close();
      /* Mantém snapshot em memória — caixa global não reinicia ao mudar de página. */
    };
  }, []);

  return null;
}

export function useStrategyGlobalSnapshot(): StrategyGlobalSnapshot | null {
  const [snap, setSnap] = useState(() => getStrategyGlobalSnapshot());

  useEffect(() => {
    const sync = () => setSnap(getStrategyGlobalSnapshot());
    window.addEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, sync);
    void bootstrapStrategyGlobalSnapshot().then(sync);
    return () => window.removeEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, sync);
  }, []);

  return snap;
}
