import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  ROTATING_ROOM_UM_FATOR_CHANGED_EVENT,
  ROTATING_ROOM_UM_FATOR_MACHINE_STORAGE_KEY,
  ROTATING_ROOM_UM_FATOR_MAX_RECOVERY,
  ROTATING_ROOM_UM_FATOR_RESET_EVENT,
  ROTATING_ROOM_UM_FATOR_STATS_CORRECTED_EVENT,
  ROTATING_ROOM_UM_FATOR_STATS_STORAGE_KEY,
  buildRotatingRoomUmFatorSessionLiveView,
  driveRotatingRoomUmFatorPlacar,
  readRotatingRoomUmFatorMachineState,
  readRotatingRoomUmFatorSessionStats,
  sanitizeUmFatorMachineForTableIds,
} from "@/lib/roulette/rotatingRoomUmFatorSession";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import type { UmFatorMachineState, UmFatorTableScan } from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import type { UmFatorActive } from "@/lib/roulette/umFatorStrategy";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import { umFatorToTapeteActive } from "@/lib/roulette/umFatorStrategy";
import type { RotatingRoomPhase, RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { useStrategyIndicationActivatedSound } from "@/hooks/useStrategyIndicationActivatedSound";
import { useStrategySessionVisibilityEpoch } from "@/hooks/useStrategySessionVisibilityEpoch";
import { shouldPresentStrategyPlacarFeedback } from "@/lib/roulette/strategySessionDrive";
import { playPlacarDefeat, playPlacarWinCoins } from "@/lib/sound/strategyTapeteSounds";
import { useStrategyGlobalSnapshot } from "@/hooks/useStrategyGlobalSnapshot";
import {
  consumeStrategyGlobalFlashes,
  getStrategyGlobalFlashSeq,
  isStrategyGlobalEnabled,
  STRATEGY_GLOBAL_CHANGED_EVENT,
} from "@/lib/roulette/strategyGlobalClient";

const ROUND_FLASH_MS = 2800;

export type RotatingRoomUmFatorRoundFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
} | null;

type Options = {
  observeOnly?: boolean;
};

export type RotatingRoomUmFatorSession = {
  phase: RotatingRoomPhase;
  sessionStats: RotatingRoomSessionStats;
  showTapeteSignal: boolean;
  singleFactorMode: true;
  roundFlash: RotatingRoomUmFatorRoundFlash;
  activeCrossing: DoisFatoresActive | null;
  currentRecovery: number;
  currentTableId: number | null;
  prepareTableId: null;
  alertCategory: string | null;
  alertBucketGap: number;
  sessionMode: "scanning" | "active";
  prepareCategory: null;
  umFatorScan: UmFatorTableScan[];
  umActive: UmFatorActive | null;
};

export function useRotatingRoomUmFatorSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: Options = {},
): RotatingRoomUmFatorSession {
  const observeOnly = options.observeOnly ?? false;
  const tableIdsKey = tableIds.join(",");
  const globalSnap = useStrategyGlobalSnapshot();
  const globalActive = isStrategyGlobalEnabled() && globalSnap != null;

  const [sessionStats, setSessionStats] = useState(() => readRotatingRoomUmFatorSessionStats());
  const [roundFlash, setRoundFlash] = useState<RotatingRoomUmFatorRoundFlash>(null);
  const [machine, setMachine] = useState<UmFatorMachineState>(() =>
    sanitizeUmFatorMachineForTableIds(readRotatingRoomUmFatorMachineState(), tableIds),
  );
  const flashClearRef = useRef<number | null>(null);
  const machineRef = useRef(machine);
  const statsRef = useRef(sessionStats);
  const placarResetGenRef = useRef(0);
  const globalFlashSeqRef = useRef(getStrategyGlobalFlashSeq());
  const isApplyingRef = useRef(false);
  const visibilityEpoch = useStrategySessionVisibilityEpoch();
  machineRef.current = machine;
  statsRef.current = sessionStats;

  const hydrateFromStorage = () => {
    const next = sanitizeUmFatorMachineForTableIds(readRotatingRoomUmFatorMachineState(), tableIds);
    machineRef.current = next;
    setMachine(next);
    const stats = readRotatingRoomUmFatorSessionStats();
    statsRef.current = stats;
    setSessionStats(stats);
  };

  const applyMachineLocal = (next: UmFatorMachineState) => {
    machineRef.current = next;
    setMachine(next);
  };

  useEffect(() => {
    statsRef.current = readRotatingRoomUmFatorSessionStats();
    setSessionStats(statsRef.current);
    setRoundFlash(null);
    if (flashClearRef.current != null) {
      window.clearTimeout(flashClearRef.current);
      flashClearRef.current = null;
    }
    hydrateFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIdsKey]);

  useEffect(() => {
    const onReset = () => {
      placarResetGenRef.current += 1;
      statsRef.current = emptyRotatingRoomSessionStats(ROTATING_ROOM_UM_FATOR_MAX_RECOVERY);
      setSessionStats(statsRef.current);
      hydrateFromStorage();
    };
    const onChanged = () => {
      if (isApplyingRef.current) return;
      hydrateFromStorage();
    };
    const onStorage = (ev: StorageEvent) => {
      if (
        ev.key !== ROTATING_ROOM_UM_FATOR_MACHINE_STORAGE_KEY &&
        ev.key !== ROTATING_ROOM_UM_FATOR_STATS_STORAGE_KEY
      ) {
        return;
      }
      onChanged();
    };
    window.addEventListener(ROTATING_ROOM_UM_FATOR_RESET_EVENT, onReset);
    window.addEventListener(ROTATING_ROOM_UM_FATOR_CHANGED_EVENT, onChanged);
    window.addEventListener("storage", onStorage);
    const onStatsCorrected = () => {
      const stats = readRotatingRoomUmFatorSessionStats();
      statsRef.current = stats;
      setSessionStats(stats);
    };
    window.addEventListener(ROTATING_ROOM_UM_FATOR_STATS_CORRECTED_EVENT, onStatsCorrected);
    return () => {
      window.removeEventListener(ROTATING_ROOM_UM_FATOR_RESET_EVENT, onReset);
      window.removeEventListener(ROTATING_ROOM_UM_FATOR_CHANGED_EVENT, onChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROTATING_ROOM_UM_FATOR_STATS_CORRECTED_EVENT, onStatsCorrected);
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
    () => buildRotatingRoomUmFatorSessionLiveView(tableIds, histories, machine),
    [tableIds, histories, machine],
  );

  const umActive = liveView.globalActive;
  const currentTableId = liveView.globalTableId;
  const activeCrossing = useMemo(
    () => (umActive ? umFatorToTapeteActive(umActive) : null),
    [umActive],
  );
  const showTapeteSignal = activeCrossing != null && currentTableId != null;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  const globalView = globalSnap?.um1fator;
  const globalUmActive = globalView?.umActive ?? null;
  const globalActiveCrossing = useMemo(
    () => (globalUmActive ? umFatorToTapeteActive(globalUmActive) : null),
    [globalUmActive],
  );

  useStrategyIndicationActivatedSound(
    globalActive ? (globalView?.showTapeteSignal ? globalUmActive : null) : showTapeteSignal ? umActive : null,
    !observeOnly,
  );

  useEffect(() => {
    if (!globalActive) return;

    const applyGlobalFlash = () => {
      const seq = getStrategyGlobalFlashSeq();
      if (seq === globalFlashSeqRef.current) return;
      globalFlashSeqRef.current = seq;
      const flashes = consumeStrategyGlobalFlashes();
      const flash = flashes?.um1fator;
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
      }, ROUND_FLASH_MS);
    };

    applyGlobalFlash();
    window.addEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, applyGlobalFlash);
    return () => window.removeEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, applyGlobalFlash);
  }, [globalActive, observeOnly]);

  useLayoutEffect(() => {
    if (globalActive || tableIds.length === 0) return;

    const tickGen = placarResetGenRef.current;
    isApplyingRef.current = true;
    const placar = driveRotatingRoomUmFatorPlacar(tableIds, histories);
    isApplyingRef.current = false;

    if (tickGen !== placarResetGenRef.current) return;

    applyMachineLocal(placar.nextMachine);

    statsRef.current = placar.stats;
    setSessionStats(placar.stats);

    if (placar.flash && !observeOnly && shouldPresentStrategyPlacarFeedback()) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalActive, observeOnly, tableIdsKey, historiesFingerprint, visibilityEpoch]);

  if (globalActive && globalView) {
    return {
      ...globalView,
      roundFlash,
      activeCrossing: globalView.showTapeteSignal ? globalActiveCrossing : null,
    };
  }

  return {
    phase,
    sessionStats,
    showTapeteSignal,
    singleFactorMode: true,
    roundFlash,
    activeCrossing: showTapeteSignal ? activeCrossing : null,
    currentRecovery: machine.recovery,
    currentTableId: showTapeteSignal ? currentTableId : null,
    prepareTableId: null,
    alertCategory: umActive?.armingDescription ?? null,
    alertBucketGap: 0,
    sessionMode: showTapeteSignal ? "active" : "scanning",
    prepareCategory: null,
    umFatorScan: liveView.tableScan,
    umActive: umActive,
  };
}
