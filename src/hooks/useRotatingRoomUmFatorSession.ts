import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  ROTATING_ROOM_UM_FATOR_CHANGED_EVENT,
  ROTATING_ROOM_UM_FATOR_MACHINE_STORAGE_KEY,
  ROTATING_ROOM_UM_FATOR_RESET_EVENT,
  ROTATING_ROOM_UM_FATOR_STATS_CORRECTED_EVENT,
  ROTATING_ROOM_UM_FATOR_STATS_STORAGE_KEY,
  buildRotatingRoomUmFatorSessionLiveView,
  driveRotatingRoomUmFatorPlacar,
  readRotatingRoomUmFatorMachineState,
  readRotatingRoomUmFatorSessionStats,
  sanitizeUmFatorMachineForTableIds,
} from "@/lib/roulette/rotatingRoomUmFatorSession";
import {
  readEffectiveUmFatorMaxRecovery,
  writeRotatingRoomExtensionMaxRecovery,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";
import {
  isRotatingRoomExtensionPong,
  syncRotatingRoomExtensionStats,
} from "@/lib/roulette/rotatingRoomExtensionBridge";
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
  isStrategyGlobalConnected,
  isStrategyGlobalEnabled,
  STRATEGY_GLOBAL_CHANGED_EVENT,
} from "@/lib/roulette/strategyGlobalClient";

import {
  isRotatingRoomLobbyCooldownActive,
  isRotatingRoomPostResultHoldActive,
  ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import type { UmFatorPlacarFlash } from "@/lib/roulette/rotatingRoomUmFatorStrategy";

export type RotatingRoomUmFatorRoundFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
} | null;

type Options = {
  observeOnly?: boolean;
  /**
   * Extensão / bridge: usa placar e histórico local (SSE no browser),
   * sem substituir pelo snapshot strategy-global do servidor.
   */
  preferLocalSession?: boolean;
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
  /** Bloqueio pós-ciclo (vitória/derrota final) — extensão e UI respeitam antes de nova entrada. */
  lobbyCooldownUntilMs: number | null;
  lobbyCooldownActive: boolean;
  postResultHoldUntilMs: number | null;
  postResultHoldTableId: number | null;
  postResultHoldActive: boolean;
};

export function useRotatingRoomUmFatorSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: Options = {},
): RotatingRoomUmFatorSession {
  const observeOnly = options.observeOnly ?? false;
  const preferLocalSession = options.preferLocalSession === true;
  const tableIdsKey = tableIds.join(",");
  const globalSnap = useStrategyGlobalSnapshot();
  const globalView = globalSnap?.um1fator;
  const globalActive =
    isStrategyGlobalEnabled() &&
    isStrategyGlobalConnected() &&
    globalSnap != null &&
    globalView != null;
  const useGlobalSession = !preferLocalSession && globalActive;

  const [sessionStats, setSessionStats] = useState(() => readRotatingRoomUmFatorSessionStats());
  const [roundFlash, setRoundFlash] = useState<RotatingRoomUmFatorRoundFlash>(null);
  const [machine, setMachine] = useState<UmFatorMachineState>(() =>
    sanitizeUmFatorMachineForTableIds(readRotatingRoomUmFatorMachineState(), tableIds),
  );
  const [holdEpoch, setHoldEpoch] = useState(0);
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

  const applyPlacarFlash = (flash: NonNullable<UmFatorPlacarFlash>) => {
    setRoundFlash({
      resultNumber: flash.resultNumber,
      won: flash.won,
      tableId: flash.tableId,
      kind: flash.kind,
    });
    if (shouldPresentStrategyPlacarFeedback()) {
      if (flash.kind === "win") void playPlacarWinCoins();
      else if (flash.kind === "loss") void playPlacarDefeat();
    }
    if (flashClearRef.current != null) window.clearTimeout(flashClearRef.current);
    flashClearRef.current = window.setTimeout(() => {
      setRoundFlash(null);
      flashClearRef.current = null;
    }, ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT);
  };

  useEffect(() => {
    const until = machine.postResultHoldUntilMs;
    if (until == null || !isRotatingRoomPostResultHoldActive(until)) return;
    const delayMs = until - Date.now() + 40;
    const timer = window.setTimeout(() => setHoldEpoch((n) => n + 1), delayMs);
    return () => window.clearTimeout(timer);
  }, [machine.postResultHoldUntilMs, holdEpoch]);

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
      statsRef.current = emptyRotatingRoomSessionStats(readEffectiveUmFatorMaxRecovery());
      setSessionStats(statsRef.current);
      syncRotatingRoomExtensionStats(0, 0, 0);
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
    const recoveries = (sessionStats.lossesAtRecovery ?? []).reduce(
      (sum, n) => sum + (Number(n) || 0),
      0,
    );
    syncRotatingRoomExtensionStats(sessionStats.wins, sessionStats.losses, recoveries);
  }, [sessionStats.wins, sessionStats.losses, sessionStats.lossesAtRecovery]);

  useEffect(() => {
    const onPong = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (!isRotatingRoomExtensionPong(event.data)) return;
      const maxRecovery = event.data.prefs?.maxRecovery;
      if (maxRecovery != null) writeRotatingRoomExtensionMaxRecovery(maxRecovery);
    };
    window.addEventListener("message", onPong);
    return () => window.removeEventListener("message", onPong);
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
  const showTapeteSignalRaw = activeCrossing != null && currentTableId != null;
  const lobbyCooldownUntilMs =
    globalView?.lobbyCooldownUntilMs ?? machine.lobbyCooldownUntilMs;
  const postResultHoldUntilMs =
    globalView?.postResultHoldUntilMs ?? machine.postResultHoldUntilMs;
  const postResultHoldTableId =
    globalView?.postResultHoldTableId ?? machine.postResultHoldTableId;
  const lobbyCooldownActive = isRotatingRoomLobbyCooldownActive(lobbyCooldownUntilMs);
  const postResultHoldActive = isRotatingRoomPostResultHoldActive(postResultHoldUntilMs);
  const showTapeteSignal = showTapeteSignalRaw && !lobbyCooldownActive && !postResultHoldActive;
  const phase: RotatingRoomPhase = showTapeteSignal ? "active" : "waiting";

  const globalUmActive = globalView?.umActive ?? null;
  const globalActiveCrossing = useMemo(
    () => (globalUmActive ? umFatorToTapeteActive(globalUmActive) : null),
    [globalUmActive],
  );

  const indicationSoundToken = useMemo(() => {
    if (observeOnly) return null;
    if (useGlobalSession && globalView) {
      if (!globalView.showTapeteSignal || globalView.currentTableId == null || !globalUmActive) {
        return null;
      }
      const n = globalUmActive.triggerNumbers;
      return `${globalView.currentTableId}:${n[0]},${n[1]}`;
    }
    if (!showTapeteSignal || currentTableId == null || !umActive) return null;
    const pending = machine.pendingByTable[String(currentTableId)];
    if (pending) return `${currentTableId}:${pending.armedHead}`;
    const n = umActive.triggerNumbers;
    return `${currentTableId}:${n[0]},${n[1]}`;
  }, [
    observeOnly,
    useGlobalSession,
    globalUmActive,
    globalView?.currentTableId,
    globalView?.showTapeteSignal,
    showTapeteSignal,
    currentTableId,
    umActive,
    machine.pendingByTable,
  ]);

  useStrategyIndicationActivatedSound(indicationSoundToken, !observeOnly);

  useEffect(() => {
    if (!globalActive) return;

    const applyGlobalFlash = () => {
      const seq = getStrategyGlobalFlashSeq();
      if (seq === globalFlashSeqRef.current) return;
      globalFlashSeqRef.current = seq;
      const flashes = consumeStrategyGlobalFlashes();
      const flash = flashes?.um1fator;
      if (!flash || observeOnly) return;
      applyPlacarFlash(flash);
    };

    applyGlobalFlash();
    window.addEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, applyGlobalFlash);
    return () => window.removeEventListener(STRATEGY_GLOBAL_CHANGED_EVENT, applyGlobalFlash);
  }, [globalActive, observeOnly]);

  useLayoutEffect(() => {
    if (tableIds.length === 0) return;
    if (useGlobalSession) return;

    const tickGen = placarResetGenRef.current;
    isApplyingRef.current = true;
    const placar = driveRotatingRoomUmFatorPlacar(tableIds, histories);
    isApplyingRef.current = false;

    if (tickGen !== placarResetGenRef.current) return;

    applyMachineLocal(placar.nextMachine);

    statsRef.current = placar.stats;
    setSessionStats(placar.stats);

    if (placar.flash && !observeOnly) {
      applyPlacarFlash(placar.flash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGlobalSession, observeOnly, tableIdsKey, historiesFingerprint, visibilityEpoch]);

  if (useGlobalSession && globalView) {
    const effectiveShowSignal =
      globalView.showTapeteSignal && !lobbyCooldownActive && !postResultHoldActive;
    return {
      ...globalView,
      prepareTableId: null,
      prepareCategory: null,
      roundFlash,
      sessionStats: globalView.sessionStats,
      activeCrossing: effectiveShowSignal ? globalActiveCrossing : null,
      umActive: effectiveShowSignal ? globalUmActive : null,
      currentTableId: effectiveShowSignal
        ? globalView.currentTableId
        : postResultHoldActive
          ? postResultHoldTableId
          : roundFlash?.tableId ?? null,
      showTapeteSignal: effectiveShowSignal,
      lobbyCooldownUntilMs,
      lobbyCooldownActive,
      postResultHoldUntilMs,
      postResultHoldTableId,
      postResultHoldActive,
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
    currentTableId: showTapeteSignal
      ? currentTableId
      : postResultHoldActive
        ? postResultHoldTableId
        : roundFlash?.tableId ?? null,
    prepareTableId: null,
    alertCategory: umActive?.armingDescription ?? null,
    alertBucketGap: 0,
    sessionMode: showTapeteSignal ? "active" : "scanning",
    prepareCategory: null,
    umFatorScan: liveView.tableScan,
    umActive: showTapeteSignal ? umActive : null,
    lobbyCooldownUntilMs,
    lobbyCooldownActive,
    postResultHoldUntilMs,
    postResultHoldTableId,
    postResultHoldActive,
  };
}
