import { useEffect, useMemo, useState } from "react";

import {
  defaultSequenciasMonitorState,
  tickSequenciasMonitor,
  type SequenciasMonitorState,
} from "@/lib/roulette/sequenciasStrategy";

/**
 * Monitor Sequências sobre o histórico newest-first de uma mesa (ou a mais ativa).
 */
export function useSequenciasMonitor(
  histories: Record<number, readonly number[]>,
  tableIds: readonly number[],
): {
  state: SequenciasMonitorState;
  tableId: number | null;
  history: readonly number[];
  reset: () => void;
} {
  const tableId = useMemo(() => {
    let best: number | null = null;
    let bestLen = 0;
    for (const id of tableIds) {
      const len = histories[id]?.length ?? 0;
      if (len > bestLen) {
        bestLen = len;
        best = id;
      }
    }
    return best ?? tableIds[0] ?? null;
  }, [histories, tableIds]);

  const history = useMemo(
    () => (tableId != null ? histories[tableId] ?? [] : []),
    [histories, tableId],
  );

  const [state, setState] = useState(() => defaultSequenciasMonitorState());
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    setState(defaultSequenciasMonitorState());
  }, [tableId]);

  useEffect(() => {
    setState((prev) => tickSequenciasMonitor(history, prev));
  }, [history, epoch, tableId]);

  return {
    state,
    tableId,
    history,
    reset: () => {
      setState(defaultSequenciasMonitorState());
      setEpoch((e) => e + 1);
    },
  };
}
