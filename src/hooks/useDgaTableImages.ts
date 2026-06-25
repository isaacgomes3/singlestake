import { useEffect, useState } from "react";

import {
  ensureDgaTableImagesLoaded,
  subscribeDgaTableImages,
} from "@/lib/roulette/dgaTableImageStore";

/** Carrega posters DGA (`tableImage`) e força re-render quando chegam. */
export function useDgaTableImages(): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeDgaTableImages(() => setTick((n) => n + 1));
    void ensureDgaTableImagesLoaded();
    return unsub;
  }, []);
}
