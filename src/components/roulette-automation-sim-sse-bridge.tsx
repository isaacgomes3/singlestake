import { useEffect } from "react";

import {
  applyAutomationSimStreamMessage,
  bootstrapAutomationSimSnapshot,
  markAutomationSimDisconnected,
} from "@/lib/roulette/automationSimClient";
import type { AutomationSimStreamMessage } from "@/lib/roulette/automationSimTypes";

const BOOTSTRAP_INTERVAL_MS = 8_000;

/** SSE da automação — mantém estado mesmo ao mudar de página no back office. */
export function RouletteAutomationSimSseBridge() {
  useEffect(() => {
    let closed = false;
    void bootstrapAutomationSimSnapshot();

    const url = new URL("/api/roulette/automation-sim/stream", window.location.origin).href;
    const source = new EventSource(url);

    /** Fallback HTTP se o EventSource cair ou o hub SSE estiver noutro processo. */
    const bootstrapTimer = window.setInterval(() => {
      if (!closed) void bootstrapAutomationSimSnapshot();
    }, BOOTSTRAP_INTERVAL_MS);

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
      markAutomationSimDisconnected();
      /* EventSource reconecta automaticamente; bootstrap periódico cobre o intervalo. */
    };

    return () => {
      closed = true;
      window.clearInterval(bootstrapTimer);
      source.close();
    };
  }, []);

  return null;
}
