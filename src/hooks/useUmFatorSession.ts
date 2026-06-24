import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  UM_FATOR_CHANGED_EVENT,
  UM_FATOR_MAX_RECOVERY,
  UM_FATOR_RESET_EVENT,
  buildUmFatorLiveViewForTable,
  driveUmFatorPlacarForTable,
  readUmFatorMachineState,
  readUmFatorSessionStats,
} from "@/lib/roulette/umFatorCrossingStrategy";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import type { UmFatorMachineState } from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import type { UmFatorActive } from "@/lib/roulette/umFatorStrategy";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import { umFatorToTapeteActive } from "@/lib/roulette/umFatorStrategy";
import type { RotatingRoomPhase, RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { useStrategyIndicationActivatedSound } from "@/hooks/useStrategyIndicationActivatedSound";
import { useStrategySessionVisibilityEpoch } from "@/hooks/useStrategySessionVisibilityEpoch";
import {
  canRunStrategyPlacarDriver,
  shouldPresentStrategyPlacarFeedback,
} from "@/lib/roulette/strategySessionDrive";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";

const ROUND_FLASH_MS = 2800;

export type UmFatorRoundFlash = {
  resultNumber: number;
  won: boolean;
  kind?: "win" | "loss" | "recovery";
  recoveryBefore?: number;
} | null;

type Options = {
  observeOnly?: boolean;
};

export type UmFatorSession = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  singleFactorMode: true;
  roundFlash: UmFatorRoundFlash;
  activeCrossing: DoisFatoresActive | null;
  umActive: UmFatorActive | null;
  currentRecovery: number;
  alertCategory: string | null;
};

export function useUmFatorSession(
  tableId: number,
  history: readonly number[],
  options: Options = {},
): UmFatorSession {
  const observeOnly = options.observeOnly ?? false;

  const [sessionStats, setSessionStats] = useState(() => readUmFatorSessionStats(tableId));
  const [roundFlash, setRoundFlash] = useState<UmFatorRoundFlash>(null);
  const [machine, setMachine] = useState<UmFatorMachineState>(() =>
    readUmFatorMachineState(tableId),
  );
  const flashClearRef = useRef<number | null>(null);
  const machineRef = useRef(machine);
  const statsRef = useRef(sessionStats);
  const placarResetGenRef = useRef(0);
  const isApplyingRef = useRef(false);
  const visibilityEpoch = useStrategySessionVisibilityEpoch();
  machineRef.current = machine;
  statsRef.current = sessionStats;

  const hydrateFromStorage = () => {
    const next = readUmFatorMachineState(tableId);
    machineRef.current = next;
    setMachine(next);
    const stats = readUmFatorSessionStats(tableId);
    statsRef.current = stats;
    setSessionStats(stats);
  };

  const applyMachineLocal = (next: UmFatorMachineState) => {
    machineRef.current = next;
    setMachine(next);
  };

  useEffect(() => {
    hydrateFromStorage();
    setRoundFlash(null);
    if (flashClearRef.current != null) {
      window.clearTimeout(flashClearRef.current);
      flashClearRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    const onReset = (ev: Event) => {
      const d = (ev as CustomEvent<{ tableId?: number }>).detail;
      if (d?.tableId != null && d.tableId !== tableId) return;
      placarResetGenRef.current += 1;
      statsRef.current = emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
      setSessionStats(statsRef.current);
      hydrateFromStorage();
    };
    const onChanged = (ev: Event) => {
      const d = (ev as CustomEvent<{ tableId?: number }>).detail;
      if (d?.tableId != null && d.tableId !== tableId) return;
      if (isApplyingRef.current) return;
      hydrateFromStorage();
    };
    window.addEventListener(UM_FATOR_RESET_EVENT, onReset);
    window.addEventListener(UM_FATOR_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(UM_FATOR_RESET_EVENT, onReset);
      window.removeEventListener(UM_FATOR_CHANGED_EVENT, onChanged);
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
    () => buildUmFatorLiveViewForTable(tableId, history, machine),
    [tableId, history, machine],
  );

  const umActive = liveView.globalActive;
  const activeCrossing = useMemo(
    () => (umActive ? umFatorToTapeteActive(umActive) : null),
    [umActive],
  );
  const showTapeteSignal = activeCrossing != null;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  useStrategyIndicationActivatedSound(showTapeteSignal ? umActive : null, !observeOnly);

  useLayoutEffect(() => {
    if (!canRunStrategyPlacarDriver({ observeOnly })) return;

    const tickGen = placarResetGenRef.current;
    isApplyingRef.current = true;
    const placar = driveUmFatorPlacarForTable(tableId, history);
    isApplyingRef.current = false;

    if (tickGen !== placarResetGenRef.current) return;

    applyMachineLocal(placar.nextMachine);

    statsRef.current = placar.stats;
    setSessionStats(placar.stats);

    if (placar.flash && shouldPresentStrategyPlacarFeedback()) {
      const recoveryBefore = machineRef.current.recovery;
      setRoundFlash({
        resultNumber: placar.flash.resultNumber,
        won: placar.flash.won,
        kind: placar.flash.kind,
        recoveryBefore,
      });
      if (placar.flash.kind === "win") void playPlacarWinCoins();
      else if (placar.flash.kind === "loss") void playPlacarDefeat();
      if (flashClearRef.current != null) window.clearTimeout(flashClearRef.current);
      flashClearRef.current = window.setTimeout(() => {
        setRoundFlash(null);
        flashClearRef.current = null;
      }, ROUND_FLASH_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observeOnly, tableId, historyFingerprint, visibilityEpoch]);

  return {
    phase,
    sessionStats,
    showTapeteSignal,
    singleFactorMode: true,
    roundFlash,
    activeCrossing,
    umActive: umActive,
    currentRecovery: machine.recovery,
    alertCategory: umActive ? umActive.armingDescription : null,
  };
}
