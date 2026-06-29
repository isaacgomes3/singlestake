import { useEffect, useMemo, useRef, useState } from "react";

import {
  ROTATING_ROOM_CROSSING_CHANGED_EVENT,
  ROTATING_ROOM_CROSSING_MAX_RECOVERY,
  ROTATING_ROOM_CROSSING_MACHINE_STORAGE_KEY,
  ROTATING_ROOM_CROSSING_RESET_EVENT,
  ROTATING_ROOM_CROSSING_STATS_CORRECTED_EVENT,
  ROTATING_ROOM_CROSSING_STATS_STORAGE_KEY,
  buildRotatingRoomCrossingSessionLiveView,
  readRotatingRoomCrossingMachineState,
  readRotatingRoomCrossingSessionStats,
  sanitizeRotatingRoomCrossingMachineForTableIds,
  tickRotatingRoomCrossingSessionPlacar,
  writeRotatingRoomCrossingMachineState,
  writeRotatingRoomCrossingSessionStats,
} from "@/lib/roulette/rotatingRoomCrossingSession";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import type {
  RotatingRoomCrossingMachineState,
  RotatingRoomCrossingTableScan,
  RotatingRoomSessionMode,
} from "@/lib/roulette/rotatingRoomCrossingStrategy";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomPhase, RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";
import { useCrossingSignalSounds } from "@/hooks/useCrossingSignalSounds";
import { useStrategySessionVisibilityEpoch } from "@/hooks/useStrategySessionVisibilityEpoch";
import {
  drainPlacarSteps,
  shouldPresentStrategyPlacarFeedback,
} from "@/lib/roulette/strategySessionDrive";
import { crossingMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomCrossingPlacarDrive";
import { useStrategyGlobalSnapshot } from "@/hooks/useStrategyGlobalSnapshot";
import {
  consumeStrategyGlobalFlashes,
  getStrategyGlobalFlashSeq,
  isStrategyGlobalEnabled,
  STRATEGY_GLOBAL_CHANGED_EVENT,
} from "@/lib/roulette/strategyGlobalClient";

import { ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT } from "@/lib/roulette/rotatingRoomLobbySignal";

export type RotatingRoomCrossingRoundFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
} | null;

type Options = {
  observeOnly?: boolean;
  /** Quando falso, não corre motor de placar local (cruzamento desligado). */
  enabled?: boolean;
};

export type RotatingRoomCrossingSession = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  roundFlash: RotatingRoomCrossingRoundFlash;
  activeCrossing: DoisFatoresActive | null;
  currentRecovery: number;
  currentTableId: number | null;
  prepareTableId: number | null;
  alertCategory: string | null;
  alertBucketGap: number;
  sessionMode: RotatingRoomSessionMode;
  prepareCategory: string | null;
  crossingScan: RotatingRoomCrossingTableScan[];
};

export function useRotatingRoomCrossingSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: Options = {},
): RotatingRoomCrossingSession {
  const observeOnly = options.observeOnly ?? false;
  const enabled = options.enabled ?? true;
  const globalSnap = useStrategyGlobalSnapshot();
  const globalActive = isStrategyGlobalEnabled() && globalSnap != null;

  const [sessionStats, setSessionStats] = useState(() => readRotatingRoomCrossingSessionStats());
  const [roundFlash, setRoundFlash] = useState<RotatingRoomCrossingRoundFlash>(null);
  const [machine, setMachine] = useState<RotatingRoomCrossingMachineState>(() =>
    sanitizeRotatingRoomCrossingMachineForTableIds(
      readRotatingRoomCrossingMachineState(tableIds),
      tableIds,
    ),
  );
  const flashClearRef = useRef<number | null>(null);
  const machineRef = useRef(machine);
  const placarResetGenRef = useRef(0);
  const globalFlashSeqRef = useRef(getStrategyGlobalFlashSeq());
  const visibilityEpoch = useStrategySessionVisibilityEpoch();
  machineRef.current = machine;

  const applyMachine = (next: RotatingRoomCrossingMachineState) => {
    machineRef.current = next;
    setMachine(next);
    writeRotatingRoomCrossingMachineState(next);
  };

  useEffect(() => {
    setSessionStats(readRotatingRoomCrossingSessionStats());
    setRoundFlash(null);
    if (flashClearRef.current != null) {
      window.clearTimeout(flashClearRef.current);
      flashClearRef.current = null;
    }
    applyMachine(
      sanitizeRotatingRoomCrossingMachineForTableIds(
        readRotatingRoomCrossingMachineState(tableIds),
        tableIds,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIds.join(",")]);

  useEffect(() => {
    const onReset = () => {
      placarResetGenRef.current += 1;
      setSessionStats(emptyRotatingRoomSessionStats(ROTATING_ROOM_CROSSING_MAX_RECOVERY));
      applyMachine(
      sanitizeRotatingRoomCrossingMachineForTableIds(
        readRotatingRoomCrossingMachineState(tableIds),
        tableIds,
      ),
    );
    };
    const onChanged = () => {
      setSessionStats(readRotatingRoomCrossingSessionStats());
      applyMachine(
      sanitizeRotatingRoomCrossingMachineForTableIds(
        readRotatingRoomCrossingMachineState(tableIds),
        tableIds,
      ),
    );
    };
    const onStorage = (ev: StorageEvent) => {
      if (
        ev.key !== ROTATING_ROOM_CROSSING_MACHINE_STORAGE_KEY &&
        ev.key !== ROTATING_ROOM_CROSSING_STATS_STORAGE_KEY
      ) {
        return;
      }
      onChanged();
    };
    window.addEventListener(ROTATING_ROOM_CROSSING_RESET_EVENT, onReset);
    window.addEventListener(ROTATING_ROOM_CROSSING_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    const onStatsCorrected = () => setSessionStats(readRotatingRoomCrossingSessionStats());
    window.addEventListener(ROTATING_ROOM_CROSSING_STATS_CORRECTED_EVENT, onStatsCorrected);
    return () => {
      window.removeEventListener(ROTATING_ROOM_CROSSING_RESET_EVENT, onReset);
      window.removeEventListener(ROTATING_ROOM_CROSSING_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROTATING_ROOM_CROSSING_STATS_CORRECTED_EVENT, onStatsCorrected);
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
    () => buildRotatingRoomCrossingSessionLiveView(tableIds, histories, machine),
    [tableIds, histories, machine],
  );

  const activeCrossing = machine.cycleActive;
  const showTapeteSignal = activeCrossing != null;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  useEffect(() => {
    if (!globalActive) return;

    const applyGlobalFlash = () => {
      const seq = getStrategyGlobalFlashSeq();
      if (seq === globalFlashSeqRef.current) return;
      globalFlashSeqRef.current = seq;
      const flashes = consumeStrategyGlobalFlashes();
      const flash = flashes?.dois2fatores;
      if (!flash || observeOnly || !shouldPresentStrategyPlacarFeedback()) return;
      setRoundFlash({
        resultNumber: flash.resultNumber,
        won: flash.won,
        tableId: flash.tableId,
        kind: flash.kind,
      });
      if (flash.kind === "win") void playPlacarWinCoins();
      else if (flash.kind === "loss") void playPlacarDefeat();
      if (flashClearRef.current != null) window.clearTimeout(flashClearRef.current);
      flashClearRef.current = window.setTimeout(() => {
        setRoundFlash(null);
        flashClearRef.current = null;
      }, ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT);
    };

    applyGlobalFlash();
    window.addEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, applyGlobalFlash);
    return () => window.removeEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, applyGlobalFlash);
  }, [globalActive, observeOnly]);

  const globalView = globalSnap?.dois2fatores;

  const crossingPrepareKey = globalActive
    ? globalView?.sessionMode === "prepare" &&
      !globalView.showTapeteSignal &&
      globalView.prepareTableId != null
      ? `${globalView.prepareTableId}:${globalView.prepareCategory ?? ""}`
      : null
    : liveView.mode === "prepare" && !showTapeteSignal && machine.prepareTableId != null && machine.prepareFingerprint
      ? `${machine.prepareTableId}:${machine.prepareFingerprint}`
      : null;

  useCrossingSignalSounds({
    activeCrossing: globalActive
      ? globalView?.showTapeteSignal
        ? globalView.activeCrossing
        : null
      : showTapeteSignal
        ? activeCrossing
        : null,
    prepareKey: crossingPrepareKey,
    enabled: enabled && !observeOnly,
  });

  useEffect(() => {
    if (!enabled || globalActive || tableIds.length === 0) return;

    const tickGen = placarResetGenRef.current;
    const placar = drainPlacarSteps(
      machineRef.current,
      readRotatingRoomCrossingSessionStats(),
      (currentMachine, currentStats) =>
        tickRotatingRoomCrossingSessionPlacar(tableIds, histories, currentMachine, currentStats),
      crossingMachinePlacarStepProgressed,
    );

    if (tickGen !== placarResetGenRef.current) return;

    if (placar.statsChanged) {
      writeRotatingRoomCrossingSessionStats(placar.stats);
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
  }, [enabled, globalActive, observeOnly, tableIds.join(","), historiesFingerprint, visibilityEpoch]);

  const allowedTableIds = useMemo(() => new Set(tableIds), [tableIds.join(",")]);

  const currentTableId =
    machine.cycleTableId != null && allowedTableIds.has(machine.cycleTableId)
      ? machine.cycleTableId
      : null;
  const prepareTableId =
    machine.prepareTableId != null && allowedTableIds.has(machine.prepareTableId)
      ? machine.prepareTableId
      : null;

  if (globalActive && globalView) {
    return {
      ...globalView,
      roundFlash,
    };
  }

  return {
    phase,
    sessionStats,
    showTapeteSignal: showTapeteSignal && currentTableId != null,
    roundFlash,
    activeCrossing: showTapeteSignal && currentTableId != null ? activeCrossing : null,
    currentRecovery: machine.recovery,
    currentTableId,
    prepareTableId,
    alertCategory: liveView.globalPick?.category ?? null,
    alertBucketGap: liveView.globalPick?.bucketGap ?? 0,
    sessionMode: liveView.mode,
    prepareCategory: liveView.preparePick?.category ?? null,
    crossingScan: liveView.crossingScan,
    cycleSpinsWithoutWin: machine.cycleSpinsWithoutWin,
    lastEvaluatedHead: machine.lastEvaluatedHead,
  };
}
