import { useEffect, useRef, useState } from "react";

import { nums28PctPlacarOutcomes } from "@/lib/roulette/nums28PctStrategy";
import { playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";

export type Nums28PctSpinFlash = {
  resultNumber: number;
  won: boolean;
} | null;

const FLASH_MS = 2800;

/** Igual ao flash das Ruas, mas com placar Números 2,8% (só W / L). */
export function useNums28PctSpinOutcomeFlash(
  historyNewestFirst: number[],
  resetKey?: string | number,
): Nums28PctSpinFlash {
  const [flash, setFlash] = useState<Nums28PctSpinFlash>(null);
  const init = useRef(true);
  const prevOutLen = useRef(0);
  const lastReset = useRef(resetKey);

  useEffect(() => {
    if (lastReset.current !== resetKey) {
      lastReset.current = resetKey;
      init.current = true;
      prevOutLen.current = 0;
      setFlash(null);
    }
  }, [resetKey]);

  useEffect(() => {
    const outcomes = nums28PctPlacarOutcomes(historyNewestFirst);
    if (outcomes.length === 0) {
      prevOutLen.current = 0;
      return;
    }

    if (init.current) {
      init.current = false;
      prevOutLen.current = outcomes.length;
      return;
    }

    if (outcomes.length > prevOutLen.current) {
      const last = outcomes[outcomes.length - 1]!;
      const resultNumber = historyNewestFirst[0]!;
      prevOutLen.current = outcomes.length;
      setFlash({
        resultNumber,
        won: last === "W",
      });
      if (last === "W") void playPlacarWinCoins();
      const t = window.setTimeout(() => setFlash(null), FLASH_MS);
      return () => window.clearTimeout(t);
    }

    if (outcomes.length < prevOutLen.current) {
      prevOutLen.current = outcomes.length;
    }
  }, [historyNewestFirst]);

  return flash;
}
