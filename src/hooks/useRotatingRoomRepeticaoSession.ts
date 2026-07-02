import { useMemo } from "react";

import type { RotatingRoomFibonacciSession } from "@/hooks/useRotatingRoomFibonacciSession";
import { useStrategyGlobalSnapshot } from "@/hooks/useStrategyGlobalSnapshot";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import { ROTATING_ROOM_REPETICAO_MAX_RECOVERY } from "@/lib/roulette/rotatingRoomRepeticaoStrategy";
import type { RotatingRoomFibonacciTableScan } from "@/lib/roulette/rotatingRoomFibonacciStrategy";

type Options = {
  enabled?: boolean;
};

/** Mapeia o motor Repetição para o formato Fibonacci do painel (mesma UI e recuperação). */
export function useRotatingRoomRepeticaoSession(
  _tableIds: readonly number[],
  _histories: Record<number, number[]>,
  options: Options = {},
): RotatingRoomFibonacciSession {
  const enabled = options.enabled ?? true;
  const globalSnap = useStrategyGlobalSnapshot();
  const rep = globalSnap?.repeticao;

  return useMemo((): RotatingRoomFibonacciSession => {
    if (!enabled || !rep) {
      return {
        phase: "waiting",
        sessionStats: emptyRotatingRoomSessionStats(ROTATING_ROOM_REPETICAO_MAX_RECOVERY),
        showTapeteSignal: false,
        roundFlash: null,
        activeFibonacci: null,
        currentRecovery: 0,
        cycleSeq: 0,
        currentTableId: null,
        prepareTableId: null,
        alertCategory: null,
        alertBucketGap: 0,
        sessionMode: "scanning",
        prepareCategory: null,
        fibonacciScan: [],
        lastEvaluatedHead: null,
        fibonacciMode: true,
      };
    }

    const fibonacciScan: RotatingRoomFibonacciTableScan[] = rep.repeticaoScan.map((row) => ({
      tableId: row.tableId,
      zoneLabel: row.zoneLabel,
      zoneKind: row.zoneKind,
      absenceGap: row.streakGap,
      status: row.status,
      isAlertTable: row.isAlertTable,
    }));

    return {
      phase: rep.phase,
      sessionStats: rep.sessionStats,
      showTapeteSignal: rep.showTapeteSignal,
      roundFlash: null,
      activeFibonacci: rep.activeRepeticao
        ? { ...rep.activeRepeticao, absenceGap: rep.activeRepeticao.streakGap }
        : null,
      currentRecovery: rep.currentRecovery,
      cycleSeq: rep.cycleSeq,
      currentTableId: rep.currentTableId,
      prepareTableId: rep.prepareTableId,
      alertCategory: rep.alertCategory,
      alertBucketGap: rep.alertBucketGap,
      sessionMode: rep.sessionMode,
      prepareCategory: rep.prepareCategory,
      fibonacciScan,
      lastEvaluatedHead: null,
      fibonacciMode: true,
    };
  }, [enabled, rep]);
}
