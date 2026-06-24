import { useEffect, useRef, useState } from "react";

import { readLiveTableSpinTimesAligned } from "@/lib/roulette/historyStorage";

export type RouletteSimulatorSpinEvent = {
  number: number;
  isInitial: boolean;
};

/**
 * Emite quando chega um giro novo da mesa ao vivo (histórico prepend).
 * Ignora a carga inicial; no primeiro render só regista o estado sem emitir liquidação.
 */
export function useRouletteSimulatorLiveSpin(
  tableId: number,
  historyNewestFirst: readonly number[],
): RouletteSimulatorSpinEvent | null {
  const [event, setEvent] = useState<RouletteSimulatorSpinEvent | null>(null);
  const markerRef = useRef<{ len: number; t0: number | null; num: number | null } | null>(null);

  useEffect(() => {
    const len = historyNewestFirst.length;
    const num = len > 0 ? historyNewestFirst[0]! : null;
    const t0 = readLiveTableSpinTimesAligned(tableId, len)[0] ?? null;

    if (markerRef.current === null) {
      markerRef.current = { len, t0, num };
      if (num !== null) {
        setEvent({ number: num, isInitial: true });
      }
      return;
    }

    const prev = markerRef.current;
    const grew = len > prev.len;
    const timeChanged = t0 !== null && t0 !== prev.t0;
    const numChanged = num !== null && num !== prev.num;
    const isNewSpin = grew || timeChanged || (t0 === null && numChanged);

    markerRef.current = { len, t0, num };

    if (!isNewSpin || num === null) return;
    setEvent({ number: num, isInitial: false });
  }, [tableId, historyNewestFirst]);

  return event;
}
