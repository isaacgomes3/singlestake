import { useEffect, useMemo, useRef, useState } from "react";

import {
  ROTATING_ROOM_PLUS_CHANGED_EVENT,
  ROTATING_ROOM_PLUS_RESET_EVENT,
  buildRotatingRoomPlusSessionLiveView,
  readRotatingRoomPlusMachineState,
  readRotatingRoomPlusSessionStats,
  resetRotatingRoomPlusSession,
  tickRotatingRoomPlusSessionPlacar,
  writeRotatingRoomPlusMachineState,
  writeRotatingRoomPlusSessionStats,
} from "@/lib/roulette/rotatingRoomPlusSession";
import type {
  RotatingRoomPlusMachineState,
  RotatingRoomPlusTableScan,
  RotatingRoomSessionMode,
} from "@/lib/roulette/rotatingRoomPlusStrategy";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomPhase, RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";
import { useCrossingSignalSounds } from "@/hooks/useCrossingSignalSounds";
import { useStrategySessionVisibilityEpoch } from "@/hooks/useStrategySessionVisibilityEpoch";
import {
  canRunStrategyPlacarDriver,
  shouldPresentStrategyPlacarFeedback,
} from "@/lib/roulette/strategySessionDrive";

export { resetRotatingRoomPlusSession };

const ROUND_FLASH_MS = 2800;

export type RotatingRoomPlusRoundFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
} | null;

type Options = {
  observeOnly?: boolean;
};

export type RotatingRoomPlusSession = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  roundFlash: RotatingRoomPlusRoundFlash;
  activeCrossing: DoisFatoresActive | null;
  currentRecovery: number;
  currentTableId: number | null;
  prepareTableId: number | null;
  sessionMode: RotatingRoomSessionMode;
  crossingScan: RotatingRoomPlusTableScan[];
};

export function useRotatingRoomPlusSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: Options = {},
): RotatingRoomPlusSession {
  const observeOnly = options.observeOnly ?? false;

  const [sessionStats, setSessionStats] = useState(() => readRotatingRoomPlusSessionStats());
  const [roundFlash, setRoundFlash] = useState<RotatingRoomPlusRoundFlash>(null);
  const [machine, setMachine] = useState<RotatingRoomPlusMachineState>(() =>
    readRotatingRoomPlusMachineState(),
  );
  const flashClearRef = useRef<number | null>(null);
  const machineRef = useRef(machine);
  const visibilityEpoch = useStrategySessionVisibilityEpoch();
  machineRef.current = machine;

  const applyMachine = (next: RotatingRoomPlusMachineState) => {
    machineRef.current = next;
    setMachine(next);
    writeRotatingRoomPlusMachineState(next);
  };

  useEffect(() => {
    setSessionStats(readRotatingRoomPlusSessionStats());
    setRoundFlash(null);
    if (flashClearRef.current != null) {
      window.clearTimeout(flashClearRef.current);
      flashClearRef.current = null;
    }
    applyMachine(readRotatingRoomPlusMachineState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIds.join(",")]);

  useEffect(() => {
    const onReset = () => {
      setSessionStats(readRotatingRoomPlusSessionStats());
      applyMachine(readRotatingRoomPlusMachineState());
    };
    const onChanged = () => {
      applyMachine(readRotatingRoomPlusMachineState());
    };
    window.addEventListener(ROTATING_ROOM_PLUS_RESET_EVENT, onReset);
    window.addEventListener(ROTATING_ROOM_PLUS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(ROTATING_ROOM_PLUS_RESET_EVENT, onReset);
      window.removeEventListener(ROTATING_ROOM_PLUS_CHANGED_EVENT, onChanged);
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
    () => buildRotatingRoomPlusSessionLiveView(tableIds, histories, machine),
    [tableIds, histories, machine],
  );

  const activeCrossing = machine.cycleActive;
  const showTapeteSignal = activeCrossing != null;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  const plusPrepareKey =
    liveView.mode === "prepare" && !showTapeteSignal && machine.prepareTableId != null && machine.prepareFingerprint
      ? `${machine.prepareTableId}:${machine.prepareFingerprint}`
      : null;

  useCrossingSignalSounds({
    activeCrossing: showTapeteSignal ? activeCrossing : null,
    prepareKey: plusPrepareKey,
    enabled: !observeOnly,
  });

  useEffect(() => {
    if (!canRunStrategyPlacarDriver({ observeOnly }) || tableIds.length === 0) return;

    const placar = tickRotatingRoomPlusSessionPlacar(
      tableIds,
      histories,
      machineRef.current,
      readRotatingRoomPlusSessionStats(),
    );

    if (placar.statsChanged) {
      writeRotatingRoomPlusSessionStats(placar.stats);
      setSessionStats(placar.stats);
    }

    if (placar.flash && shouldPresentStrategyPlacarFeedback()) {
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
      }, ROUND_FLASH_MS);
    }

    applyMachine(placar.nextMachine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observeOnly, tableIds.join(","), historiesFingerprint, visibilityEpoch]);

  return {
    phase,
    sessionStats,
    showTapeteSignal,
    roundFlash,
    activeCrossing,
    currentRecovery: machine.recovery,
    currentTableId: machine.cycleTableId,
    prepareTableId: machine.prepareTableId,
    sessionMode: liveView.mode,
    crossingScan: liveView.crossingScan,
  };
}
