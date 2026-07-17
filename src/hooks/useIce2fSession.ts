import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  ICE2F_TABLE_CHANGED_EVENT,
  ICE2F_TABLE_MAX_RECOVERY,
  ICE2F_TABLE_RESET_EVENT,
  buildIce2fLiveViewForTable,
  driveIce2fPlacarForTable,
  readIce2fMachineState,
  readIce2fSessionStats,
} from "@/lib/roulette/ice2fTableSession";
import {
  ice2fToTapeteActive,
  type Ice2fActive,
  type Ice2fMachineState,
} from "@/lib/roulette/iceCruzamento2fStrategy";
import { emptyIce2fStats } from "@/lib/roulette/iceCruzamento2fStrategy";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomPhase, RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { useStrategyIndicationActivatedSound } from "@/hooks/useStrategyIndicationActivatedSound";
import { useStrategySessionVisibilityEpoch } from "@/hooks/useStrategySessionVisibilityEpoch";
import {
  canRunStrategyPlacarDriver,
  shouldPresentStrategyPlacarFeedback,
} from "@/lib/roulette/strategySessionDrive";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";

const ROUND_FLASH_MS = 2800;

export type Ice2fRoundFlash = {
  resultNumber: number;
  won: boolean;
  kind?: "win" | "loss" | "recovery" | "tie" | "zero";
  recoveryBefore?: number;
} | null;

type Options = {
  observeOnly?: boolean;
};

export type Ice2fSession = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  roundFlash: Ice2fRoundFlash;
  activeCrossing: DoisFatoresActive | null;
  ice2fActive: Ice2fActive | null;
  currentRecovery: number;
  alertCategory: string | null;
  maxRecovery: typeof ICE2F_TABLE_MAX_RECOVERY;
};

export function useIce2fSession(
  tableId: number,
  history: readonly number[],
  options: Options = {},
): Ice2fSession {
  const observeOnly = options.observeOnly ?? false;

  const [sessionStats, setSessionStats] = useState(() => readIce2fSessionStats(tableId));
  const [roundFlash, setRoundFlash] = useState<Ice2fRoundFlash>(null);
  const [machine, setMachine] = useState<Ice2fMachineState>(() => readIce2fMachineState(tableId));
  const flashClearRef = useRef<number | null>(null);
  const machineRef = useRef(machine);
  const statsRef = useRef(sessionStats);
  const placarResetGenRef = useRef(0);
  const isApplyingRef = useRef(false);
  const visibilityEpoch = useStrategySessionVisibilityEpoch();
  machineRef.current = machine;
  statsRef.current = sessionStats;

  const hydrateFromStorage = () => {
    const next = readIce2fMachineState(tableId);
    machineRef.current = next;
    setMachine(next);
    const stats = readIce2fSessionStats(tableId);
    statsRef.current = stats;
    setSessionStats(stats);
  };

  const applyMachineLocal = (next: Ice2fMachineState) => {
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
      statsRef.current = emptyIce2fStats(ICE2F_TABLE_MAX_RECOVERY);
      setSessionStats(statsRef.current);
      hydrateFromStorage();
    };
    const onChanged = (ev: Event) => {
      const d = (ev as CustomEvent<{ tableId?: number }>).detail;
      if (d?.tableId != null && d.tableId !== tableId) return;
      if (isApplyingRef.current) return;
      hydrateFromStorage();
    };
    window.addEventListener(ICE2F_TABLE_RESET_EVENT, onReset);
    window.addEventListener(ICE2F_TABLE_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(ICE2F_TABLE_RESET_EVENT, onReset);
      window.removeEventListener(ICE2F_TABLE_CHANGED_EVENT, onChanged);
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
    () => buildIce2fLiveViewForTable(history, machine),
    [history, machine],
  );

  const ice2fActive = liveView.globalActive;
  const activeCrossing = useMemo(
    () => (ice2fActive ? ice2fToTapeteActive(ice2fActive) : null),
    [ice2fActive],
  );
  const showTapeteSignal = ice2fActive != null;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  useStrategyIndicationActivatedSound(showTapeteSignal ? ice2fActive : null, !observeOnly);

  useLayoutEffect(() => {
    if (!canRunStrategyPlacarDriver({ observeOnly })) return;

    const tickGen = placarResetGenRef.current;
    isApplyingRef.current = true;
    const placar = driveIce2fPlacarForTable(tableId, history);
    isApplyingRef.current = false;

    if (tickGen !== placarResetGenRef.current) return;

    applyMachineLocal(placar.nextMachine);

    statsRef.current = placar.stats;
    setSessionStats(placar.stats);

    if (placar.flash && shouldPresentStrategyPlacarFeedback()) {
      const recoveryBefore = placar.flash.recovery ?? 0;
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
    roundFlash,
    activeCrossing,
    ice2fActive,
    currentRecovery: liveView.globalRecovery,
    alertCategory: ice2fActive?.armingDescription ?? null,
    maxRecovery: ICE2F_TABLE_MAX_RECOVERY,
  };
}
