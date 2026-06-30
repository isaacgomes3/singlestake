import { useEffect, useMemo, useRef, useState } from "react";

import {
  ROTATING_ROOM_FIBONACCI_CHANGED_EVENT,
  ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  ROTATING_ROOM_FIBONACCI_MACHINE_STORAGE_KEY,
  ROTATING_ROOM_FIBONACCI_RESET_EVENT,
  ROTATING_ROOM_FIBONACCI_STATS_CORRECTED_EVENT,
  ROTATING_ROOM_FIBONACCI_STATS_STORAGE_KEY,
  buildRotatingRoomFibonacciSessionLiveView,
  readRotatingRoomFibonacciMachineState,
  readRotatingRoomFibonacciSessionStats,
  sanitizeRotatingRoomFibonacciMachineForTableIds,
  tickRotatingRoomFibonacciSessionPlacar,
  writeRotatingRoomFibonacciMachineState,
  writeRotatingRoomFibonacciSessionStats,
} from "@/lib/roulette/rotatingRoomFibonacciSession";
import {
  buildFibonacciActiveFromPick,
  consecutiveZoneAbsence,
  type RotatingRoomFibonacciMachineState,
  type RotatingRoomFibonacciTableScan,
} from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import type { RotatingRoomPhase, RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";
import { useStrategySessionVisibilityEpoch } from "@/hooks/useStrategySessionVisibilityEpoch";
import {
  drainPlacarSteps,
  shouldPresentStrategyPlacarFeedback,
} from "@/lib/roulette/strategySessionDrive";
import { fibonacciMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomFibonacciPlacarDrive";
import { ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT } from "@/lib/roulette/rotatingRoomLobbySignal";
import type { RotatingRoomFibonacciActive } from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import type { RotatingRoomSessionMode } from "@/lib/roulette/rotatingRoomCrossingStrategy";

export type RotatingRoomFibonacciRoundFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
} | null;

type Options = {
  observeOnly?: boolean;
  enabled?: boolean;
};

export type RotatingRoomFibonacciSession = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  roundFlash: RotatingRoomFibonacciRoundFlash;
  activeFibonacci: RotatingRoomFibonacciActive | null;
  currentRecovery: number;
  currentTableId: number | null;
  prepareTableId: null;
  alertCategory: string | null;
  alertBucketGap: number;
  sessionMode: RotatingRoomSessionMode;
  prepareCategory: null;
  fibonacciScan: RotatingRoomFibonacciTableScan[];
  lastEvaluatedHead: string | null;
  fibonacciMode: true;
};

export function useRotatingRoomFibonacciSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: Options = {},
): RotatingRoomFibonacciSession {
  const observeOnly = options.observeOnly ?? false;
  const enabled = options.enabled ?? true;

  const [sessionStats, setSessionStats] = useState(() => readRotatingRoomFibonacciSessionStats());
  const [roundFlash, setRoundFlash] = useState<RotatingRoomFibonacciRoundFlash>(null);
  const [machine, setMachine] = useState<RotatingRoomFibonacciMachineState>(() =>
    sanitizeRotatingRoomFibonacciMachineForTableIds(
      readRotatingRoomFibonacciMachineState(tableIds),
      tableIds,
    ),
  );
  const flashClearRef = useRef<number | null>(null);
  const machineRef = useRef(machine);
  const placarResetGenRef = useRef(0);
  const visibilityEpoch = useStrategySessionVisibilityEpoch();
  machineRef.current = machine;

  const applyMachine = (next: RotatingRoomFibonacciMachineState) => {
    machineRef.current = next;
    setMachine(next);
    writeRotatingRoomFibonacciMachineState(next);
  };

  useEffect(() => {
    setSessionStats(readRotatingRoomFibonacciSessionStats());
    setRoundFlash(null);
    if (flashClearRef.current != null) {
      window.clearTimeout(flashClearRef.current);
      flashClearRef.current = null;
    }
    applyMachine(
      sanitizeRotatingRoomFibonacciMachineForTableIds(
        readRotatingRoomFibonacciMachineState(tableIds),
        tableIds,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIds.join(",")]);

  useEffect(() => {
    const onReset = () => {
      placarResetGenRef.current += 1;
      setSessionStats(emptyRotatingRoomSessionStats(ROTATING_ROOM_FIBONACCI_MAX_RECOVERY));
      applyMachine(
        sanitizeRotatingRoomFibonacciMachineForTableIds(
          readRotatingRoomFibonacciMachineState(tableIds),
          tableIds,
        ),
      );
    };
    const onChanged = () => {
      setSessionStats(readRotatingRoomFibonacciSessionStats());
      applyMachine(
        sanitizeRotatingRoomFibonacciMachineForTableIds(
          readRotatingRoomFibonacciMachineState(tableIds),
          tableIds,
        ),
      );
    };
    const onStorage = (ev: StorageEvent) => {
      if (
        ev.key !== ROTATING_ROOM_FIBONACCI_MACHINE_STORAGE_KEY &&
        ev.key !== ROTATING_ROOM_FIBONACCI_STATS_STORAGE_KEY
      ) {
        return;
      }
      onChanged();
    };
    window.addEventListener(ROTATING_ROOM_FIBONACCI_RESET_EVENT, onReset);
    window.addEventListener(ROTATING_ROOM_FIBONACCI_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    const onStatsCorrected = () => setSessionStats(readRotatingRoomFibonacciSessionStats());
    window.addEventListener(ROTATING_ROOM_FIBONACCI_STATS_CORRECTED_EVENT, onStatsCorrected);
    return () => {
      window.removeEventListener(ROTATING_ROOM_FIBONACCI_RESET_EVENT, onReset);
      window.removeEventListener(ROTATING_ROOM_FIBONACCI_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROTATING_ROOM_FIBONACCI_STATS_CORRECTED_EVENT, onStatsCorrected);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (flashClearRef.current != null) window.clearTimeout(flashClearRef.current);
    };
  }, []);

  const historiesFingerprint = useMemo(
    () =>
      tableIds
        .map((id) => {
          const h = histories[id] ?? [];
          return `${id}:${h.length}:${h[0] ?? ""}`;
        })
        .join("|"),
    [tableIds, histories],
  );

  const liveView = useMemo(
    () => buildRotatingRoomFibonacciSessionLiveView(tableIds, histories, machine),
    [tableIds, histories, machine],
  );

  const activeFibonacci =
    machine.cycleZone && machine.cycleTableId != null
      ? buildFibonacciActiveFromPick(
          {
            tableId: machine.cycleTableId,
            zone: machine.cycleZone,
            absenceGap: consecutiveZoneAbsence(
              histories[machine.cycleTableId] ?? [],
              machine.cycleZone,
            ),
          },
          machine.recovery,
        )
      : null;

  const showTapeteSignal = activeFibonacci != null;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  useEffect(() => {
    if (!enabled || observeOnly || tableIds.length === 0) return;

    const tickGen = placarResetGenRef.current;
    const placar = drainPlacarSteps(
      machineRef.current,
      readRotatingRoomFibonacciSessionStats(),
      (currentMachine, currentStats) =>
        tickRotatingRoomFibonacciSessionPlacar(tableIds, histories, currentMachine, currentStats),
      fibonacciMachinePlacarStepProgressed,
    );

    if (tickGen !== placarResetGenRef.current) return;

    if (placar.statsChanged) {
      writeRotatingRoomFibonacciSessionStats(placar.stats);
      setSessionStats(placar.stats);
    }

    const showFeedback = shouldPresentStrategyPlacarFeedback();
    if (placar.flash && !observeOnly && showFeedback) {
      setRoundFlash({
        resultNumber: placar.flash.resultNumber,
        won: placar.flash.won,
        tableId: placar.flash.tableId,
        kind: placar.flash.kind,
      });
      if (placar.flash.kind === "win") void playPlacarWinCoins();
      else if (placar.flash.kind === "loss") void playPlacarDefeat();
      if (flashClearRef.current != null) window.clearTimeout(flashClearRef.current);
      flashClearRef.current = window.setTimeout(() => {
        setRoundFlash(null);
        flashClearRef.current = null;
      }, ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT);
    }

    applyMachine(placar.nextMachine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, observeOnly, tableIds.join(","), historiesFingerprint, visibilityEpoch]);

  const allowedTableIds = useMemo(() => new Set(tableIds), [tableIds.join(",")]);

  const currentTableId =
    machine.cycleTableId != null && allowedTableIds.has(machine.cycleTableId)
      ? machine.cycleTableId
      : null;

  const alertPick = liveView.globalPick;

  return {
    phase,
    sessionStats,
    showTapeteSignal: showTapeteSignal && currentTableId != null,
    roundFlash,
    activeFibonacci: showTapeteSignal && currentTableId != null ? activeFibonacci : null,
    currentRecovery: machine.recovery,
    currentTableId,
    prepareTableId: null,
    alertCategory: alertPick ? alertPick.zone.kind === "dozen" ? `Dúzia ${alertPick.zone.id}` : `Coluna ${alertPick.zone.id}` : null,
    alertBucketGap: alertPick?.absenceGap ?? 0,
    sessionMode: showTapeteSignal ? "active" : "scanning",
    prepareCategory: null,
    fibonacciScan: liveView.fibonacciScan,
    lastEvaluatedHead: machine.lastEvaluatedHead,
    fibonacciMode: true,
  };
}
