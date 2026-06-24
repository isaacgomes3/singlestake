import { useEffect, useRef } from "react";

import {
  playCrossingPreparePositionAlert,
  playTapeteIndicationActivated,
} from "@/lib/sound/strategyTapeteSounds";

type Options = {
  /** Sinal activo (aposte) — cruzamento armado. */
  activeCrossing: unknown | null;
  /** Chave estável da fase posicionar; `null` quando não está em prepare. */
  prepareKey: string | null;
  enabled?: boolean;
};

/**
 * Alertas sonoros dos sinais de cruzamento:
 * - **prepare** → «posicione-se»
 * - **active** → «aposte»
 *
 * Não dispara no primeiro render nem ao recarregar já com sinal.
 */
export function useCrossingSignalSounds({
  activeCrossing,
  prepareKey,
  enabled = true,
}: Options): void {
  const prevActive = useRef<boolean | null>(null);
  const prevPrepareKey = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;
    const on = activeCrossing != null;
    if (prevActive.current === null) {
      prevActive.current = on;
      return;
    }
    if (on && !prevActive.current) {
      void playTapeteIndicationActivated();
    }
    prevActive.current = on;
  }, [activeCrossing, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (prevPrepareKey.current === undefined) {
      prevPrepareKey.current = prepareKey;
      return;
    }
    if (prepareKey != null && prepareKey !== prevPrepareKey.current && activeCrossing == null) {
      void playCrossingPreparePositionAlert();
    }
    prevPrepareKey.current = prepareKey;
  }, [prepareKey, activeCrossing, enabled]);
}
