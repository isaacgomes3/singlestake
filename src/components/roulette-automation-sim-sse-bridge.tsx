import { useEffect } from "react";

import { applyAutomationSimStreamMessage } from "@/lib/roulette/automationSimClient";
import type { AutomationSimStreamMessage } from "@/lib/roulette/automationSimTypes";

/** SSE da automação — mantém estado mesmo ao mudar de página no back office. */
export function RouletteAutomationSimSseBridge() {
  useEffect(() => {
    let closed = false;
    const url = new URL("/api/roulette/automation-sim/stream", window.location.origin).href;
    const source = new EventSource(url);

    source.onmessage = (event: MessageEvent) => {
      if (closed) return;
      try {
        const msg = JSON.parse(event.data) as AutomationSimStreamMessage;
        if (msg.type === "sync" || msg.type === "update") {
          applyAutomationSimStreamMessage(msg);
        }
      } catch {
        /* JSON inválido */
      }
    };

    source.onerror = () => {
      /* EventSource reconecta automaticamente */
    };

    return () => {
      closed = true;
      source.close();
    };
  }, []);

  return null;
}
