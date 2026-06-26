import { useEffect } from "react";

import {
  appendDga24dSpinFromSse,
  replaceDga24dSpinHistoryFromBatch,
} from "@/lib/pragmatic/dga24dSpinHistory";
import { dispatchLiveSseStatus } from "@/lib/roulette/liveSseEvents";

type SsePayload =
  | { type: "ready"; ok?: boolean; tableKey?: number }
  | {
      type: "spin";
      number?: number;
      color?: string | null;
      gameId?: string;
      replay?: boolean;
    }
  | {
      type: "spin-replay-batch";
      spins?: { number?: number; color?: string | null; gameId?: string }[];
    }
  | { type: "status"; state?: string; message?: string };

export function Live24dSpinSseBridge() {
  useEffect(() => {
    let closed = false;
    dispatchLiveSseStatus({ status: "connecting", message: null });

    const url = new URL("/api/pragmatic/24d-spin-spins", window.location.origin).href;
    if (import.meta.env.DEV) {
      console.info("[24D Spin/SSE]", url);
    }
    const source = new EventSource(url);

    source.onopen = () => {
      if (!closed && import.meta.env.DEV) console.info("[24D Spin/SSE] onopen");
    };

    source.onmessage = (event: MessageEvent) => {
      if (closed) return;
      try {
        const o = JSON.parse(event.data) as SsePayload;

        if (o.type === "ready") {
          if (import.meta.env.DEV) console.info("[24D Spin/SSE] ready", o.tableKey);
          dispatchLiveSseStatus({ status: "open", message: null });
          return;
        }

        if (o.type === "status" && o.state === "reconnecting" && o.message) {
          dispatchLiveSseStatus({ status: "open", message: o.message });
          return;
        }

        if (o.type === "spin-replay-batch" && Array.isArray(o.spins)) {
          replaceDga24dSpinHistoryFromBatch(o.spins);
          dispatchLiveSseStatus({ status: "open", message: null });
          return;
        }

        if (o.type === "spin" && o.number !== undefined && o.gameId) {
          appendDga24dSpinFromSse({
            number: Number(o.number),
            color: o.color,
            gameId: String(o.gameId),
          });
          dispatchLiveSseStatus({ status: "open", message: null });
        }
      } catch {
        /* invalid JSON */
      }
    };

    source.onerror = () => {
      if (import.meta.env.DEV) console.warn("[24D Spin/SSE] error", url);
      if (!closed) {
        dispatchLiveSseStatus({ status: "error", message: null });
      }
    };

    return () => {
      closed = true;
      source.close();
    };
  }, []);

  return null;
}
