import { useEffect, useMemo, useRef, useState } from "react";

import {
  DOIS_FATORES_PLUS_CHANGED_EVENT,
  DOIS_FATORES_PLUS_RESET_EVENT,
  buildDoisFatoresPlusLiveView,
  readDoisFatoresPlusMachineState,
  readDoisFatoresPlusSessionStats,
  tickDoisFatoresPlusTablePlacar,
  writeDoisFatoresPlusMachineState,
  writeDoisFatoresPlusSessionStats,
} from "@/lib/roulette/doisFatoresPlusSession";
import type { RotatingRoomSessionMode } from "@/lib/roulette/rotatingRoomPlusStrategy";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomPhase, RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";
import { useCrossingSignalSounds } from "@/hooks/useCrossingSignalSounds";
import { useStrategySessionVisibilityEpoch } from "@/hooks/useStrategySessionVisibilityEpoch";
import {
  canRunStrategyPlacarDriver,
  shouldPresentStrategyPlacarFeedback,
} from "@/lib/roulette/strategySessionDrive";

const ROUND_FLASH_MS = 2800;

export type DoisFatoresPlusRoundFlash = {
  resultNumber: number;
  won: boolean;
  kind: "win" | "loss" | "recovery";
} | null;

type Options = {
  observeOnly?: boolean;
};

export type DoisFatoresPlusSession = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  roundFlash: DoisFatoresPlusRoundFlash;
  activeCrossing: DoisFatoresActive | null;
  currentRecovery: number;
  sessionMode: RotatingRoomSessionMode;
  prepareTableId: number | null;
};

export function useDoisFatoresPlusSession(
  tableId: number,
  history: readonly number[],
  options: Options = {},
): DoisFatoresPlusSession {
  const observeOnly = options.observeOnly ?? false;

  const [sessionStats, setSessionStats] = useState(() => readDoisFatoresPlusSessionStats(tableId));
  const [roundFlash, setRoundFlash] = useState<DoisFatoresPlusRoundFlash>(null);
  const [machine, setMachine] = useState(() => readDoisFatoresPlusMachineState(tableId));
  const flashClearRef = useRef<number | null>(null);
  const machineRef = useRef(machine);
  const visibilityEpoch = useStrategySessionVisibilityEpoch();
  machineRef.current = machine;

  const applyMachine = (next: ReturnType<typeof readDoisFatoresPlusMachineState>) => {
    machineRef.current = next;
    setMachine(next);
    writeDoisFatoresPlusMachineState(tableId, next);
  };

  useEffect(() => {
    setSessionStats(readDoisFatoresPlusSessionStats(tableId));
    setRoundFlash(null);
    if (flashClearRef.current != null) {
      window.clearTimeout(flashClearRef.current);
      flashClearRef.current = null;
    }
    applyMachine(readDoisFatoresPlusMachineState(tableId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    const onReset = (ev: Event) => {
      const d = (ev as CustomEvent<{ tableId?: number }>).detail;
      if (d?.tableId != null && d.tableId !== tableId) return;
      setSessionStats(readDoisFatoresPlusSessionStats(tableId));
      applyMachine(readDoisFatoresPlusMachineState(tableId));
    };
    const onChanged = (ev: Event) => {
      const d = (ev as CustomEvent<{ tableId?: number }>).detail;
      if (d?.tableId != null && d.tableId !== tableId) return;
      applyMachine(readDoisFatoresPlusMachineState(tableId));
    };
    window.addEventListener(DOIS_FATORES_PLUS_RESET_EVENT, onReset);
    window.addEventListener(DOIS_FATORES_PLUS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(DOIS_FATORES_PLUS_RESET_EVENT, onReset);
      window.removeEventListener(DOIS_FATORES_PLUS_CHANGED_EVENT, onChanged);
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
    () => buildDoisFatoresPlusLiveView(tableId, history, machine),
    [tableId, history, machine],
  );

  const activeCrossing = machine.cycleActive;
  const showTapeteSignal = activeCrossing != null;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  useCrossingSignalSounds({
    activeCrossing: showTapeteSignal ? activeCrossing : null,
    prepareKey: null,
    enabled: !observeOnly,
  });

  useEffect(() => {
    if (!canRunStrategyPlacarDriver({ observeOnly })) return;

    const placar = tickDoisFatoresPlusTablePlacar(
      tableId,
      history,
      machineRef.current,
      readDoisFatoresPlusSessionStats(tableId),
    );

    if (placar.statsChanged) {
      writeDoisFatoresPlusSessionStats(tableId, placar.stats);
      setSessionStats(placar.stats);
    }

    if (placar.flash && shouldPresentStrategyPlacarFeedback()) {
      setRoundFlash({
        resultNumber: placar.flash.resultNumber,
        won: placar.flash.won,
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
  }, [observeOnly, tableId, historyFingerprint, visibilityEpoch]);

  return {
    phase,
    sessionStats,
    showTapeteSignal,
    roundFlash,
    activeCrossing,
    currentRecovery: machine.recovery,
    sessionMode: liveView.mode,
    prepareTableId: machine.prepareTableId,
  };
}
