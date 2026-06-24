import { useEffect, useRef } from "react";

import { playTapeteIndicationActivated } from "@/lib/sound/strategyTapeteSounds";

/**
 * Toca o alerta **aposte** (Web Audio) quando a indicação do tapete **passa a activa**
 * (`null` → objecto), sem disparar no primeiro render nem ao recarregar já com sinal.
 */
export function useStrategyIndicationActivatedSound(
  active: unknown | null,
  enabled = true,
): void {
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const on = active != null;
    if (prev.current === null) {
      prev.current = on;
      return;
    }
    if (on && !prev.current) {
      void playTapeteIndicationActivated();
    }
    prev.current = on;
  }, [active, enabled]);
}
