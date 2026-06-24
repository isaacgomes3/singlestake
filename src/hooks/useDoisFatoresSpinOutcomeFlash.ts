import { useEffect, useRef, useState } from "react";

import { doisFatoresPlacarOutcomes } from "@/lib/roulette/doisFatoresStrategy";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";

export type DoisFatoresSpinFlash = {
  resultNumber: number;
  won: boolean;
} | null;

const FLASH_MS = 2800;

export function useDoisFatoresSpinOutcomeFlash(
  historyNewestFirst: readonly number[],
  resetKey?: string | number,
): DoisFatoresSpinFlash {
  const [flash, setFlash] = useState<DoisFatoresSpinFlash>(null);
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
    const outcomes = doisFatoresPlacarOutcomes(historyNewestFirst);
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
      else if (last === "L") void playPlacarDefeat();
      const t = window.setTimeout(() => setFlash(null), FLASH_MS);
      return () => window.clearTimeout(t);
    }

    if (outcomes.length < prevOutLen.current) {
      prevOutLen.current = outcomes.length;
    }
  }, [historyNewestFirst]);

  return flash;
}
