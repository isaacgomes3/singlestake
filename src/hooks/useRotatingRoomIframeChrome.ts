import { useEffect, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { hasSavedCasinoEmbedViewport } from "@/lib/roulette/casinoEmbedViewportPrefs";
import {
  ROTATING_ROOM_VIEW_PREFS_EVENT,
  readRotatingRoomIframeMode,
  readRotatingRoomSignalOnlyMode,
} from "@/lib/roulette/rotatingRoomViewPrefs";

/** Sala com iframe activo (painel flutuante sobre o casino embutido). */
export function useRotatingRoomIframeChrome(): boolean {
  const isMobile = useIsMobile();
  const [iframeMode, setIframeMode] = useState(
    () => readRotatingRoomIframeMode() || hasSavedCasinoEmbedViewport(),
  );
  const [signalOnlyPref, setSignalOnlyPref] = useState<boolean | null>(() =>
    readRotatingRoomSignalOnlyMode(),
  );

  useEffect(() => {
    const sync = () => {
      setIframeMode(readRotatingRoomIframeMode() || hasSavedCasinoEmbedViewport());
      setSignalOnlyPref(readRotatingRoomSignalOnlyMode());
    };
    window.addEventListener(ROTATING_ROOM_VIEW_PREFS_EVENT, sync);
    return () => window.removeEventListener(ROTATING_ROOM_VIEW_PREFS_EVENT, sync);
  }, []);

  const signalOnlyMode = signalOnlyPref ?? isMobile;
  return iframeMode && !signalOnlyMode;
}
