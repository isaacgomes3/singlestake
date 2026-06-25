import { useEffect, useState } from "react";

import {
  isRotatingRoomExtensionPong,
  pingRotatingRoomExtension,
  ROTATING_ROOM_EXTENSION_PONG_TYPE,
  ROTATING_ROOM_EXTENSION_PRESENT_EVENT,
  type RotatingRoomExtensionPrefs,
} from "@/lib/roulette/rotatingRoomExtensionBridge";

function readDomExtensionMarker(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.singlestakeExtension === "1";
}

export function useRotatingRoomExtensionPresent(): {
  present: boolean;
  prefs: RotatingRoomExtensionPrefs | null;
} {
  const [present, setPresent] = useState(readDomExtensionMarker);
  const [prefs, setPrefs] = useState<RotatingRoomExtensionPrefs | null>(null);

  useEffect(() => {
    const markPresent = (nextPrefs?: RotatingRoomExtensionPrefs | null) => {
      setPresent(true);
      if (nextPrefs) setPrefs(nextPrefs);
    };

    const handlePong = (data: unknown) => {
      if (isRotatingRoomExtensionPong(data)) {
        markPresent(data.prefs ?? null);
        return;
      }
      const o = data as { type?: string; prefs?: RotatingRoomExtensionPrefs };
      if (o?.type === ROTATING_ROOM_EXTENSION_PONG_TYPE) {
        markPresent(o.prefs ?? null);
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      handlePong(event.data);
    };

    const onPresentEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ prefs?: RotatingRoomExtensionPrefs }>).detail;
      markPresent(detail?.prefs ?? null);
    };

    const probe = () => {
      if (readDomExtensionMarker()) setPresent(true);
      pingRotatingRoomExtension();
    };

    window.addEventListener("message", onMessage);
    window.addEventListener(ROTATING_ROOM_EXTENSION_PRESENT_EVENT, onPresentEvent);
    probe();
    const interval = window.setInterval(probe, 1500);

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener(ROTATING_ROOM_EXTENSION_PRESENT_EVENT, onPresentEvent);
      window.clearInterval(interval);
    };
  }, []);

  return { present, prefs };
}
