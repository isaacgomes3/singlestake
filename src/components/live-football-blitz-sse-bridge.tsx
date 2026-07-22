import { useEffect } from "react";

import { DGA_FOOTBALL_BLITZ_TABLE_KEYS } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import {
  appendFootballBlitzFromSse,
  clearFootballBlitzHistory,
  replaceFootballBlitzHistoryFromBatch,
} from "@/lib/pragmatic/dgaFootballBlitzHistory";
import { dispatchLiveSseStatus } from "@/lib/roulette/liveSseEvents";

type SsePayload =
  | { type: "ready"; ok?: boolean; tableKeys?: number[] }
  | {
      type: "round";
      tableKey?: number;
      gameId?: string;
      winner?: string;
      winningNumber?: number;
      scoreDiff?: number;
      time?: string;
      replay?: boolean;
    }
  | {
      type: "round-replay-batch";
      tableKey?: number;
      rounds?: {
        gameId?: string;
        winner?: string;
        winningNumber?: number;
        scoreDiff?: number;
        time?: string;
      }[];
    }
  | {
      type: "shuffle";
      tableKey?: number;
      detectedAt?: string;
      suppressGameIds?: string[];
    }
  | { type: "status"; state?: string; message?: string };

function isKnownTableKey(tableKey: number | undefined): tableKey is number {
  return (
    tableKey != null &&
    Number.isFinite(tableKey) &&
    DGA_FOOTBALL_BLITZ_TABLE_KEYS.includes(tableKey)
  );
}

export function LiveFootballBlitzSseBridge() {
  useEffect(() => {
    let closed = false;
    dispatchLiveSseStatus({ status: "connecting", message: null });

    const url = new URL("/api/pragmatic/football-blitz-spins", window.location.origin).href;
    if (import.meta.env.DEV) {
      console.info("[Football Blitz/SSE]", url);
    }
    const source = new EventSource(url);

    source.onopen = () => {
      if (!closed && import.meta.env.DEV) console.info("[Football Blitz/SSE] onopen");
    };

    source.onmessage = (event: MessageEvent) => {
      if (closed) return;
      try {
        const o = JSON.parse(event.data) as SsePayload;

        if (o.type === "ready") {
          if (import.meta.env.DEV) console.info("[Football Blitz/SSE] ready", o.tableKeys);
          dispatchLiveSseStatus({ status: "open", message: null });
          return;
        }

        if (o.type === "status" && o.state === "reconnecting" && o.message) {
          dispatchLiveSseStatus({ status: "open", message: o.message });
          return;
        }

        if (o.type === "shuffle" && isKnownTableKey(o.tableKey)) {
          const suppress = Array.isArray(o.suppressGameIds)
            ? o.suppressGameIds.map(String).filter(Boolean)
            : [];
          clearFootballBlitzHistory(o.tableKey, { suppressGameIds: suppress });
          if (import.meta.env.DEV) {
            console.info("[Football Blitz/SSE] shuffle", o.tableKey, "suppress", suppress.length);
          }
          dispatchLiveSseStatus({ status: "open", message: null });
          return;
        }

        if (
          o.type === "round-replay-batch" &&
          Array.isArray(o.rounds) &&
          isKnownTableKey(o.tableKey)
        ) {
          replaceFootballBlitzHistoryFromBatch(o.tableKey, o.rounds);
          dispatchLiveSseStatus({ status: "open", message: null });
          return;
        }

        if (
          o.type === "round" &&
          isKnownTableKey(o.tableKey) &&
          o.gameId &&
          (o.winner === "home" || o.winner === "away" || o.winner === "draw") &&
          o.winningNumber !== undefined
        ) {
          appendFootballBlitzFromSse(o.tableKey, {
            gameId: String(o.gameId),
            winner: o.winner,
            winningNumber: Number(o.winningNumber),
            scoreDiff: o.scoreDiff,
            time: o.time,
          });
          dispatchLiveSseStatus({ status: "open", message: null });
        }
      } catch {
        /* invalid JSON */
      }
    };

    source.onerror = () => {
      if (import.meta.env.DEV) console.warn("[Football Blitz/SSE] error", url);
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
