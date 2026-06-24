import { useEffect, useMemo, useRef, useState } from "react";

import {
  DOIS_FATORES_CROSSING_CHANGED_EVENT,
  DOIS_FATORES_CROSSING_MAX_RECOVERY,
  DOIS_FATORES_CROSSING_RESET_EVENT,
  buildDoisFatoresCrossingLiveView,
  readDoisFatoresCrossingMachineState,
  readDoisFatoresCrossingSessionStats,
  tickDoisFatoresCrossingPlacar,
  writeDoisFatoresCrossingMachineState,
  writeDoisFatoresCrossingSessionStats,
} from "@/lib/roulette/doisFatoresCrossingStrategy";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import type {
  RotatingRoomCrossingMachineState,
  RotatingRoomSessionMode,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomPhase, RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";
import { useCrossingSignalSounds } from "@/hooks/useCrossingSignalSounds";
import { useStrategySessionVisibilityEpoch } from "@/hooks/useStrategySessionVisibilityEpoch";
import { crossingMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomCrossingPlacarDrive";
import {
  canRunStrategyPlacarDriver,
  drainPlacarSteps,
  shouldPresentStrategyPlacarFeedback,
} from "@/lib/roulette/strategySessionDrive";

const ROUND_FLASH_MS = 2800;

export type DoisFatoresCrossingRoundFlash = {
  resultNumber: number;
  won: boolean;
  kind?: "win" | "loss" | "recovery";
  recoveryBefore?: number;
} | null;

type Options = {
  observeOnly?: boolean;
};

export type DoisFatoresCrossingSession = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  roundFlash: DoisFatoresCrossingRoundFlash;
  activeCrossing: DoisFatoresActive | null;
  currentRecovery: number;
  alertCategory: string | null;
  alertBucketGap: number;
  sessionMode: RotatingRoomSessionMode;
  prepareCategory: string | null;
};

export function useDoisFatoresCrossingSession(
  tableId: number,
  history: readonly number[],
  options: Options = {},
): DoisFatoresCrossingSession {
  const observeOnly = options.observeOnly ?? false;

  const [sessionStats, setSessionStats] = useState(() =>
    readDoisFatoresCrossingSessionStats(tableId),
  );
  const [roundFlash, setRoundFlash] = useState<DoisFatoresCrossingRoundFlash>(null);
  const [machine, setMachine] = useState<RotatingRoomCrossingMachineState>(() =>
    readDoisFatoresCrossingMachineState(tableId),
  );
  const flashClearRef = useRef<number | null>(null);
  const machineRef = useRef(machine);
  const placarResetGenRef = useRef(0);
  const visibilityEpoch = useStrategySessionVisibilityEpoch();
  machineRef.current = machine;

  const applyMachine = (next: RotatingRoomCrossingMachineState) => {
    machineRef.current = next;
    setMachine(next);
    writeDoisFatoresCrossingMachineState(tableId, next);
  };

  useEffect(() => {
    setSessionStats(readDoisFatoresCrossingSessionStats(tableId));
    setRoundFlash(null);
    if (flashClearRef.current != null) {
      window.clearTimeout(flashClearRef.current);
      flashClearRef.current = null;
    }
    applyMachine(readDoisFatoresCrossingMachineState(tableId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    const onReset = (ev: Event) => {
      const d = (ev as CustomEvent<{ tableId?: number }>).detail;
      if (d?.tableId != null && d.tableId !== tableId) return;
      placarResetGenRef.current += 1;
      setSessionStats(emptyRotatingRoomSessionStats(DOIS_FATORES_CROSSING_MAX_RECOVERY));
      applyMachine(readDoisFatoresCrossingMachineState(tableId));
    };
    const onChanged = (ev: Event) => {
      const d = (ev as CustomEvent<{ tableId?: number }>).detail;
      if (d?.tableId != null && d.tableId !== tableId) return;
      applyMachine(readDoisFatoresCrossingMachineState(tableId));
    };
    window.addEventListener(DOIS_FATORES_CROSSING_RESET_EVENT, onReset);
    window.addEventListener(DOIS_FATORES_CROSSING_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(DOIS_FATORES_CROSSING_RESET_EVENT, onReset);
      window.removeEventListener(DOIS_FATORES_CROSSING_CHANGED_EVENT, onChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    return () => {
      if (flashClearRef.current != null) window.clearTimeout(flashClearRef.current);
    };
  }, []);

  const historyFingerprint = useMemo(
    () => `${history.length}:${history[0] ?? ""}`,
    [history],
  );

  const liveView = useMemo(
    () => buildDoisFatoresCrossingLiveView(tableId, history, machine),
    [tableId, history, machine],
  );

  const activeCrossing = useMemo(() => {
    if (!machine.cycleActive) return null;
    return machine.cycleActive;
  }, [machine.cycleActive]);
  const showTapeteSignal = activeCrossing != null;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  const crossingPrepareKey =
    liveView.mode === "prepare" && !showTapeteSignal && machine.prepareFingerprint
      ? `${tableId}:${machine.prepareFingerprint}`
      : null;

  useCrossingSignalSounds({
    activeCrossing: showTapeteSignal ? activeCrossing : null,
    prepareKey: crossingPrepareKey,
    enabled: !observeOnly,
  });

  useEffect(() => {
    if (!canRunStrategyPlacarDriver({ observeOnly })) return;

    const tickGen = placarResetGenRef.current;
    const placar = drainPlacarSteps(
      machineRef.current,
      readDoisFatoresCrossingSessionStats(tableId),
      (currentMachine, currentStats) =>
        tickDoisFatoresCrossingPlacar(tableId, history, currentMachine, currentStats),
      crossingMachinePlacarStepProgressed,
    );

    if (tickGen !== placarResetGenRef.current) return;

    if (placar.statsChanged) {
      writeDoisFatoresCrossingSessionStats(tableId, placar.stats);
      setSessionStats(placar.stats);
    }

    if (placar.flash && shouldPresentStrategyPlacarFeedback()) {
      const recoveryBefore = machineRef.current.recovery;
      setRoundFlash({
        resultNumber: placar.flash.resultNumber,
        won: placar.flash.won,
        kind: placar.flash.kind,
        recoveryBefore,
      });
      if (placar.flash.kind === "win" || placar.flash.won) void playPlacarWinCoins();
      else if (placar.flash.kind === "loss") void playPlacarDefeat();
      if (flashClearRef.current != null) window.clearTimeout(flashClearRef.current);
      flashClearRef.current = window.setTimeout(() => {
        setRoundFlash(null);
        flashClearRef.current = null;
      }, ROUND_FLASH_MS);
    }

    applyMachine(placar.nextMachine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observeOnly, tableId, historyFingerprint, visibilityEpoch]);

  return {
    phase,
    sessionStats,
    showTapeteSignal,
    roundFlash,
    activeCrossing,
    currentRecovery: machine.recovery,
    alertCategory: liveView.globalPick?.category ?? null,
    alertBucketGap: liveView.globalPick?.bucketGap ?? 0,
    sessionMode: liveView.mode,
    prepareCategory: liveView.preparePick?.category ?? null,
  };
}
