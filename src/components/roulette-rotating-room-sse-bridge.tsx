import { useEffect } from "react";

import {
  applyRotatingRoomSimulatorStreamMessage,
  clearRotatingRoomSimulatorClientState,
} from "@/lib/roulette/rotatingRoomSimulatorClient";
import type { RotatingRoomSimulatorStreamMessage } from "@/lib/roulette/rotatingRoomSimulatorTypes";

export function RouletteRotatingRoomSseBridge() {
  useEffect(() => {
    let closed = false;
    const url = new URL("/api/roulette/rotating-room/stream", window.location.origin).href;
    const source = new EventSource(url);

    source.onmessage = (event: MessageEvent) => {
      if (closed) return;
      try {
        const msg = JSON.parse(event.data) as RotatingRoomSimulatorStreamMessage;
        if (msg.type === "sync" || msg.type === "update") {
          applyRotatingRoomSimulatorStreamMessage(msg);
        }
      } catch {
        /* JSON inválido */
      }
    };

    return () => {
      closed = true;
      source.close();
      clearRotatingRoomSimulatorClientState();
    };
  }, []);

  return null;
}
