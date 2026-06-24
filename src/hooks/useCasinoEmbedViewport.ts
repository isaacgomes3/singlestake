import { useCallback, useEffect, useState } from "react";

import {
  CASINO_EMBED_VIEWPORT_CHANGED_EVENT,
  clearCasinoEmbedViewport,
  clampCasinoEmbedViewport,
  readCasinoEmbedViewport,
  resolveCasinoEmbedViewport,
  writeCasinoEmbedViewport,
  type CasinoEmbedViewportInsets,
} from "@/lib/roulette/casinoEmbedViewportPrefs";

export function useCasinoEmbedViewport() {
  const [viewport, setViewport] = useState<CasinoEmbedViewportInsets>(() =>
    resolveCasinoEmbedViewport(),
  );

  useEffect(() => {
    const sync = () => setViewport(resolveCasinoEmbedViewport());
    const onCustom = (ev: Event) => {
      const d = (ev as CustomEvent<CasinoEmbedViewportInsets>).detail;
      if (d) setViewport(clampCasinoEmbedViewport(d));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "roulette.casinoEmbedViewport.v1") sync();
    };
    window.addEventListener(CASINO_EMBED_VIEWPORT_CHANGED_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CASINO_EMBED_VIEWPORT_CHANGED_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const applyViewport = useCallback((next: CasinoEmbedViewportInsets) => {
    const clamped = clampCasinoEmbedViewport(next);
    writeCasinoEmbedViewport(clamped);
    setViewport(clamped);
  }, []);

  const patchViewport = useCallback((patch: Partial<CasinoEmbedViewportInsets>) => {
    setViewport((prev) => {
      const next = clampCasinoEmbedViewport({ ...prev, ...patch });
      writeCasinoEmbedViewport(next);
      return next;
    });
  }, []);

  const resetViewport = useCallback(() => {
    clearCasinoEmbedViewport();
    setViewport(resolveCasinoEmbedViewport());
  }, []);

  return { viewport, applyViewport, patchViewport, resetViewport };
}
