import { useEffect, useRef, useState } from "react";

const SIGNAL_MS = 20_000;
const TICK_MS = 250;

/** Identidade do giro mais recente: comprimento + topo (detecta novo giro mesmo com número repetido). */
function historyHeadIdentity(h: readonly number[]): string {
  if (h.length === 0) return "0:∅";
  return `${h.length}:${h[0]!}`;
}

/**
 * Com indicação activa no tapete: após **20 s** contínuos com sinal, devolve `true` até o **próximo**
 * giro chegar ao histórico (novo topo). Depois reinicia a contagem dos 20 s se o sinal continuar.
 *
 * @param historyNewestFirst — omitir para desactivar (sem overlay).
 */
export function useTapeteRouletteAwaitingSpin(
  active: unknown | null,
  historyNewestFirst?: readonly number[],
): boolean {
  const [spinning, setSpinning] = useState(false);
  const signalOn = active != null;
  const enabled = historyNewestFirst !== undefined;

  const prevSignalRef = useRef(false);
  const activeSinceRef = useRef<number | null>(null);
  const baselineRef = useRef<string>("");
  const historyRef = useRef<readonly number[]>(historyNewestFirst ?? []);

  if (enabled && historyNewestFirst !== undefined) {
    historyRef.current = historyNewestFirst;
  }

  useEffect(() => {
    if (!enabled) {
      prevSignalRef.current = false;
      activeSinceRef.current = null;
      setSpinning(false);
      return;
    }

    if (!signalOn) {
      activeSinceRef.current = null;
      prevSignalRef.current = false;
      setSpinning(false);
      return;
    }

    if (!prevSignalRef.current) {
      activeSinceRef.current = Date.now();
    }
    prevSignalRef.current = true;
  }, [enabled, signalOn]);

  useEffect(() => {
    if (!enabled || !signalOn) {
      return;
    }

    const id = window.setInterval(() => {
      const since = activeSinceRef.current;
      if (since == null) return;

      setSpinning((was) => {
        const now = Date.now();
        const headId = historyHeadIdentity(historyRef.current);

        if (!was) {
          if (now - since >= SIGNAL_MS) {
            baselineRef.current = headId;
            return true;
          }
          return false;
        }

        if (headId !== baselineRef.current) {
          activeSinceRef.current = Date.now();
          return false;
        }
        return true;
      });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [enabled, signalOn]);

  return enabled && spinning;
}
