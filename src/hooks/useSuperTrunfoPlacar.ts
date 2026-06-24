import { useEffect, useState } from "react";

import type { FootballBlitzTableVariant } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import type { FootballBlitzRoundStored } from "@/lib/pragmatic/dgaFootballBlitzHistory";
import { superTrunfoPlacarEvolutionFromOutcomes } from "@/lib/pragmatic/superTrunfoPlacar";
import {
  readSuperTrunfoPlacar,
  SUPER_TRUNFO_PLACAR_CHANGED_EVENT,
  syncSuperTrunfoPlacarFromHistory,
  type SuperTrunfoPlacarState,
} from "@/lib/pragmatic/superTrunfoPlacarStorage";

/**
 * Placar W/L persistido por mesa (`localStorage`), sincronizado com o histórico DGA.
 */
export function useSuperTrunfoPlacar(
  tableKey: number,
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  variant: FootballBlitzTableVariant,
) {
  const [placar, setPlacar] = useState<SuperTrunfoPlacarState>(() =>
    typeof window !== "undefined"
      ? readSuperTrunfoPlacar(tableKey)
      : {
          wins: 0,
          losses: 0,
          aproveitamentoPct: 0,
          outcomes: [],
          rodadas: 0,
        },
  );

  useEffect(() => {
    const sync = () => {
      setPlacar(syncSuperTrunfoPlacarFromHistory(tableKey, historyNewestFirst, variant));
    };
    sync();
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ tableKey?: number }>).detail;
      if (detail?.tableKey != null && detail.tableKey !== tableKey) return;
      setPlacar(readSuperTrunfoPlacar(tableKey));
    };
    window.addEventListener(SUPER_TRUNFO_PLACAR_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SUPER_TRUNFO_PLACAR_CHANGED_EVENT, onChanged);
  }, [tableKey, historyNewestFirst, variant]);

  const evo = superTrunfoPlacarEvolutionFromOutcomes(placar.outcomes);

  return { ...placar, evo };
}
