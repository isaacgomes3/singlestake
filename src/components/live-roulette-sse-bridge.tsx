import { useEffect } from "react";

import {
  applyLiveSpinFromSse,
  applyLiveSpinReplayBatch,
  applyPolledTableHistories,
  initLiveSpinDedupeFromStorage,
  normalizeGameId,
  type LiveSsePayload,
} from "@/lib/roulette/applyLiveSpinFromSse";
import { ROTATING_ROOM_FIXED_TABLE_IDS } from "@/lib/roulette/lobbyTables";
import {
  getLiveRouletteTableIds,
  setLiveRouletteTableConfigFromServer,
} from "@/lib/roulette/liveTableConfig";
import { dispatchLiveSseStatus } from "@/lib/roulette/liveSseEvents";

const POLL_MS = 2_000;

function parseReadyTableId(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x) && x > 0) return Math.trunc(x);
  if (typeof x === "string") {
    const n = parseInt(x.trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function pollHistories(): Promise<boolean> {
  const res = await fetch("/api/roulette/histories", { credentials: "include" });
  if (!res.ok) return false;
  const data = (await res.json()) as {
    histories?: Record<number, number[]>;
    status?: { tableIds?: number[]; hasData?: boolean };
  };
  if (Array.isArray(data.status?.tableIds) && data.status.tableIds.length > 0) {
    setLiveRouletteTableConfigFromServer(data.status.tableIds);
  }
  if (!data.histories) return false;
  return applyPolledTableHistories(data.histories);
}

export function LiveRouletteSseBridge() {
  useEffect(() => {
    initLiveSpinDedupeFromStorage();

    if (getLiveRouletteTableIds().length === 0) {
      setLiveRouletteTableConfigFromServer([...ROTATING_ROOM_FIXED_TABLE_IDS]);
    }

    let closed = false;
    dispatchLiveSseStatus({ status: "connecting", message: null });

    const syncPoll = () => {
      if (closed) return;
      void pollHistories()
        .then((ok) => {
          if (ok && !closed) dispatchLiveSseStatus({ status: "open", message: null });
        })
        .catch(() => {
          if (!closed) dispatchLiveSseStatus({ status: "error", message: null });
        });
    };

    syncPoll();
    const pollTimer = setInterval(syncPoll, POLL_MS);

    const url = new URL("/api/roulette/spins", window.location.origin).href;
    if (import.meta.env.DEV) {
      console.info("[Roleta/SSE]", url);
    }
    const source = new EventSource(url);

    source.onopen = () => {
      if (import.meta.env.DEV) console.info("[Roleta/SSE] ligado (onopen)");
      if (!closed) dispatchLiveSseStatus({ status: "connecting", message: null });
    };

    source.onmessage = (event: MessageEvent) => {
      if (closed) return;
      try {
        const o = JSON.parse(event.data) as LiveSsePayload;

        if (o.type === "ready") {
          if (Array.isArray(o.tableIds)) {
            const ids = o.tableIds.map(parseReadyTableId).filter((x): x is number => x !== null);
            if (ids.length > 0) {
              setLiveRouletteTableConfigFromServer(ids);
            } else if (o.tableIds.length > 0) {
              setLiveRouletteTableConfigFromServer([...ROTATING_ROOM_FIXED_TABLE_IDS]);
            }
          }
          if (import.meta.env.DEV) console.info("[Roleta/SSE] ready do servidor", o.tableIds);
          dispatchLiveSseStatus({ status: "open", message: null });
          return;
        }
        if (o.type === "status" && o.state === "reconnecting" && o.message) {
          dispatchLiveSseStatus({ status: "open", message: o.message });
          return;
        }

        if (o.type === "spin-replay-batch" && Array.isArray(o.spins)) {
          const batch = o.spins
            .map((s) => ({
              number: Number(s.number),
              gameId: normalizeGameId(s.gameId) ?? "",
            }))
            .filter(
              (s): s is { number: number; gameId: string } =>
                s.gameId !== "" && Number.isInteger(s.number) && s.number >= 0 && s.number <= 36,
            );
          const r = applyLiveSpinReplayBatch(batch);
          if (import.meta.env.DEV) {
            console.info("[Roleta/SSE] spin-replay-batch →", r, batch.length);
          }
          if (r === "replay-seeded") {
            dispatchLiveSseStatus({ status: "open", message: null });
          }
          return;
        }

        const r = applyLiveSpinFromSse(o);
        if (import.meta.env.DEV && o.type === "spin") {
          console.info("[Roleta/SSE] spin recebido → aplicado:", r, o);
        }
        if (r === "replay-seeded" || r === "appended") {
          dispatchLiveSseStatus({ status: "open", message: null });
        }
      } catch {
        /* JSON invalido */
      }
    };

    source.onerror = () => {
      if (import.meta.env.DEV) {
        console.warn("[Roleta/SSE]", url);
      }
      if (closed) return;
      dispatchLiveSseStatus({
        status: "error",
        message: null,
      });
    };

    return () => {
      closed = true;
      clearInterval(pollTimer);
      source.close();
    };
  }, []);

  return null;
}
