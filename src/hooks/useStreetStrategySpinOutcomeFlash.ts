import { useEffect, useRef, useState } from "react";

import {
  streetStrategyPlacarOutcomesByExcludedStreets,
  type SimulateStreetStrategyOptions,
} from "@/lib/roulette/streetStrategy";
import { playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";

export type StreetStrategySpinFlash = {
  resultNumber: number;
  /** Vitória no placar (metade exterior, sem excluídas). */
  won: boolean;
  /** Empate: Ruas 20% com `placarBetStreetsAsDraws` — caiu numa transversal com ficha. */
  tie?: boolean;
} | null;

const FLASH_MS = 2800;

/**
 * Quando o histórico ganha um giro novo (índice 0) e o placar por ruas excluídas regista mais uma entrada,
 * devolve brevemente o número sorteado e se foi vitória ou derrota — para pino no tapete + overlay.
 */
export function useStreetStrategySpinOutcomeFlash(
  historyNewestFirst: number[],
  opts: SimulateStreetStrategyOptions | undefined,
  /** Ao mudar (ex. mesa Ruas 9%), não dispara flash no primeiro render com histórico já carregado. */
  resetKey?: string | number,
): StreetStrategySpinFlash {
  const [flash, setFlash] = useState<StreetStrategySpinFlash>(null);
  const init = useRef(true);
  const prevOutLen = useRef(0);
  const prevHistLen = useRef(0);
  const lastReset = useRef(resetKey);

  useEffect(() => {
    if (lastReset.current !== resetKey) {
      lastReset.current = resetKey;
      init.current = true;
      prevOutLen.current = 0;
      prevHistLen.current = 0;
      setFlash(null);
    }
  }, [resetKey]);

  useEffect(() => {
    const histLen = historyNewestFirst.length;
    const outcomes = streetStrategyPlacarOutcomesByExcludedStreets(historyNewestFirst, opts);
    if (outcomes.length === 0) {
      prevOutLen.current = 0;
      prevHistLen.current = histLen;
      return;
    }

    if (init.current) {
      init.current = false;
      prevOutLen.current = outcomes.length;
      prevHistLen.current = histLen;
      return;
    }

    const historyGrewExactlyOne = histLen === prevHistLen.current + 1;
    const placarGrewExactlyOne = outcomes.length === prevOutLen.current + 1;

    if (historyGrewExactlyOne && placarGrewExactlyOne) {
      const last = outcomes[outcomes.length - 1]!;
      const resultNumber = historyNewestFirst[0]!;
      prevOutLen.current = outcomes.length;
      prevHistLen.current = histLen;
      setFlash({
        resultNumber,
        won: last === "W",
        tie: last === "D",
      });
      if (last === "W") void playPlacarWinCoins();
      const t = window.setTimeout(() => setFlash(null), FLASH_MS);
      return () => window.clearTimeout(t);
    }

    prevOutLen.current = outcomes.length;
    prevHistLen.current = histLen;
  }, [historyNewestFirst, opts]);

  return flash;
}
