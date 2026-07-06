import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import {
  useAutomationAlignedBet,
  useAutomationAlignedRotativaSession,
} from "@/hooks/useAutomationAlignedRotatingSession";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import {
  type AutomationOpenBet,
  type AutomationPendingSignal,
  pendingSignalFromCrossingExtensionBridge,
} from "@/lib/back-office/rouletteAutomationSim";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import {
  buildExtensionBridgeFromAutomationBet,
  emitRotatingRoomExtensionBridge,
  emitRotatingRoomExtensionCancelCloseMesa,
  emitRotatingRoomExtensionCloseMesa,
  mesaTabCloseAfterOpenBetChange,
  mesaUrlForTableId,
  shouldDeferMesaCloseForFibonacciRecovery,
  shouldDeferMesaCloseForCrossingRecovery,
  shouldDeferMesaCloseForUmFatorRecovery,
} from "@/lib/roulette/rotatingRoomExtensionBridge";
import {
  clearExtensionLastEmitKey,
  readExtensionLastEmitKey,
  readRotatingRoomExtensionEnabled,
  ROTATING_ROOM_EXTENSION_PREFS_EVENT,
  writeExtensionLastEmitKey,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";

/** Evita fechar mesa logo ao ligar o bridge (alarmes antigos / API instável). */
const BRIDGE_CLOSE_GRACE_MS = 10_000;
/** openBet tem de estar vazio este tempo antes de fechar o separador. */
const OPEN_BET_CLEAR_STABLE_MS = 2_000;

function emitMesaCloseOnce(
  dedupeRef: { current: string | null },
  dedupeKey: string,
  tableId: number,
): void {
  if (dedupeRef.current === dedupeKey) return;
  dedupeRef.current = dedupeKey;
  emitRotatingRoomExtensionCloseMesa(tableId, mesaUrlForTableId(tableId));
}

function isCrossingRotativaSession(session: {
  rotativaTrigger?: string;
}): boolean {
  return "rotativaTrigger" in session && session.rotativaTrigger === "crossing";
}

function resolveMesaCloseTableId(
  settled: AutomationOpenBet,
  openBet: AutomationOpenBet | null,
  pendingSignal: AutomationPendingSignal | null,
  session: {
    currentRecovery?: number;
    currentTableId?: number | null;
    postResultHoldActive?: boolean;
    postResultHoldTableId?: number | null;
    showTapeteSignal?: boolean;
    rotativaTrigger?: string;
  },
): number | null {
  if (shouldDeferMesaCloseForUmFatorRecovery(settled, session)) return null;
  if (shouldDeferMesaCloseForFibonacciRecovery(settled, session)) return null;
  if (shouldDeferMesaCloseForCrossingRecovery(settled, session)) return null;
  return mesaTabCloseAfterOpenBetChange(settled, openBet, pendingSignal);
}

function isRotatingRoomBridgePath(pathname: string): boolean {
  return (
    pathname === "/back-office" ||
    pathname === "/back-office/" ||
    pathname === "/sala-rotativa-um-fator" ||
    pathname.startsWith("/sala-rotativa")
  );
}

type BridgeInnerProps = {
  bridgeActive: boolean;
};

function RotatingRoomExtensionBridgeInner({ bridgeActive }: BridgeInnerProps) {
  const [configTick, setConfigTick] = useState(0);

  useEffect(() => {
    const sync = () => setConfigTick((x) => x + 1);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
    return () => window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, sync);
  }, []);

  const tableIds = useMemo(() => {
    void configTick;
    const live = getLiveRouletteTableIds();
    const resolved = resolveRotatingRoomTableIds(live);
    return resolved.length > 0 ? resolved : [...ROTATING_ROOM_FIXED_TABLE_IDS];
  }, [configTick]);

  const histories = useRotatingRoomHistories(tableIds);
  const { state: globalAutomation } = useRouletteAutomationSim();
  const { openBet, pendingSignal } = useAutomationAlignedBet();
  const session = useAutomationAlignedRotativaSession(tableIds, histories, { observeOnly: true });
  const prevOpenBetRef = useRef<AutomationOpenBet | null>(null);
  const lastSettledOpenBetRef = useRef<AutomationOpenBet | null>(null);
  const pendingSignalRef = useRef<AutomationPendingSignal | null>(null);
  const sessionRef = useRef(session);
  const mesaCloseDedupeRef = useRef<string | null>(null);
  const prevPostResultHoldRef = useRef(false);
  const bridgeArmedAtRef = useRef(0);
  const openBetClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sawOpenBetRef = useRef(false);

  pendingSignalRef.current = pendingSignal;
  sessionRef.current = session;

  useEffect(() => {
    if (!bridgeActive) return;
    emitRotatingRoomExtensionCancelCloseMesa();
    clearExtensionLastEmitKey();
    bridgeArmedAtRef.current = Date.now();
    prevOpenBetRef.current = openBet;
    sawOpenBetRef.current = openBet != null;
    lastSettledOpenBetRef.current = null;
    if (openBetClearTimerRef.current != null) {
      clearTimeout(openBetClearTimerRef.current);
      openBetClearTimerRef.current = null;
    }
    const postHoldActive =
      "postResultHoldActive" in session && session.postResultHoldActive === true;
    prevPostResultHoldRef.current = postHoldActive;
  }, [bridgeActive]);

  useEffect(() => {
    if (!bridgeActive) return;
    const betKey = openBet?.signalId ?? pendingSignal?.signalId;
    if (!betKey) return;
    clearExtensionLastEmitKey();
  }, [bridgeActive, openBet?.signalId, pendingSignal?.signalId]);

  useEffect(() => {
    if (!bridgeActive) {
      prevOpenBetRef.current = null;
      lastSettledOpenBetRef.current = null;
      mesaCloseDedupeRef.current = null;
      prevPostResultHoldRef.current = false;
      bridgeArmedAtRef.current = 0;
      sawOpenBetRef.current = false;
      if (openBetClearTimerRef.current != null) {
        clearTimeout(openBetClearTimerRef.current);
        openBetClearTimerRef.current = null;
      }
      return;
    }

    if (bridgeArmedAtRef.current === 0) {
      bridgeArmedAtRef.current = Date.now();
      prevOpenBetRef.current = openBet;
      sawOpenBetRef.current = openBet != null;
      return;
    }

    const inGrace = Date.now() - bridgeArmedAtRef.current < BRIDGE_CLOSE_GRACE_MS;

    const postHoldActive =
      "postResultHoldActive" in session && session.postResultHoldActive === true;
    const postHoldTableId =
      "postResultHoldTableId" in session &&
      typeof session.postResultHoldTableId === "number"
        ? session.postResultHoldTableId
        : null;

    const prevOpenBet = prevOpenBetRef.current;
    const crossingSession = isCrossingRotativaSession(session);

    if (
      !inGrace &&
      !crossingSession &&
      postHoldActive &&
      !prevPostResultHoldRef.current &&
      postHoldTableId != null &&
      (prevOpenBet?.tableId === postHoldTableId ||
        lastSettledOpenBetRef.current?.tableId === postHoldTableId)
    ) {
      const signalId =
        prevOpenBet?.signalId ?? lastSettledOpenBetRef.current?.signalId ?? "";
      emitMesaCloseOnce(mesaCloseDedupeRef, `hold-start:${postHoldTableId}:${signalId}`, postHoldTableId);
    }

    if (
      !inGrace &&
      !crossingSession &&
      prevPostResultHoldRef.current &&
      !postHoldActive &&
      postHoldTableId != null &&
      (lastSettledOpenBetRef.current?.tableId === postHoldTableId ||
        sawOpenBetRef.current)
    ) {
      emitMesaCloseOnce(
        mesaCloseDedupeRef,
        `hold-end:${postHoldTableId}`,
        postHoldTableId,
      );
    }
    prevPostResultHoldRef.current = postHoldActive;

    if (openBet) {
      sawOpenBetRef.current = true;
      if (openBetClearTimerRef.current != null) {
        clearTimeout(openBetClearTimerRef.current);
        openBetClearTimerRef.current = null;
      }
      lastSettledOpenBetRef.current = null;
    }

    if (!inGrace && sawOpenBetRef.current && prevOpenBet?.tableId && openBet) {
      const closeTableId = resolveMesaCloseTableId(prevOpenBet, openBet, pendingSignal, session);
      if (closeTableId != null) {
        emitMesaCloseOnce(
          mesaCloseDedupeRef,
          `open:${prevOpenBet.signalId ?? closeTableId}`,
          closeTableId,
        );
      }
    }

    if (openBet?.signalId && openBet.signalId !== prevOpenBet?.signalId) {
      mesaCloseDedupeRef.current = null;
      emitRotatingRoomExtensionCancelCloseMesa(openBet.tableId);
    }

    if (!openBet && prevOpenBet?.tableId) {
      lastSettledOpenBetRef.current = prevOpenBet;
    }

    prevOpenBetRef.current = openBet;
  }, [bridgeActive, openBet, pendingSignal, session]);

  /** Agenda fecho quando openBet liquida — não depende de novo giro para re-render. */
  useEffect(() => {
    if (!bridgeActive) return;

    if (openBet) return;

    const settled = lastSettledOpenBetRef.current;
    if (!settled?.tableId || !sawOpenBetRef.current) return;

    const inGrace = Date.now() - bridgeArmedAtRef.current < BRIDGE_CLOSE_GRACE_MS;
    if (inGrace) return;

    if (openBetClearTimerRef.current != null) {
      clearTimeout(openBetClearTimerRef.current);
    }

    lastSettledOpenBetRef.current = settled;

    openBetClearTimerRef.current = setTimeout(() => {
      openBetClearTimerRef.current = null;
      const closeTableId = resolveMesaCloseTableId(
        settled,
        null,
        pendingSignalRef.current,
        sessionRef.current,
      );
      if (closeTableId == null) return;
      emitMesaCloseOnce(
        mesaCloseDedupeRef,
        `open:${settled.signalId ?? closeTableId}`,
        closeTableId,
      );
    }, OPEN_BET_CLEAR_STABLE_MS);

    return () => {
      if (openBetClearTimerRef.current != null) {
        clearTimeout(openBetClearTimerRef.current);
        openBetClearTimerRef.current = null;
      }
    };
  }, [bridgeActive, openBet, pendingSignal?.tableId, pendingSignal?.signalId, pendingSignal?.recovery]);

  useEffect(() => {
    if (!bridgeActive) return;
    const postResultHoldUntilMs =
      "postResultHoldUntilMs" in session &&
      typeof session.postResultHoldUntilMs === "number" &&
      Number.isFinite(session.postResultHoldUntilMs)
        ? session.postResultHoldUntilMs
        : null;
    const extensionHoldBet =
      isCrossingRotativaSession(session) &&
      "postResultHoldActive" in session &&
      session.postResultHoldActive === true &&
      !openBet
        ? pendingSignalFromCrossingExtensionBridge(
            {
              showTapeteSignal: "showTapeteSignal" in session && session.showTapeteSignal === true,
              currentTableId:
                "currentTableId" in session && typeof session.currentTableId === "number"
                  ? session.currentTableId
                  : null,
              currentRecovery:
                "currentRecovery" in session && typeof session.currentRecovery === "number"
                  ? session.currentRecovery
                  : 0,
              activeCrossing: "activeCrossing" in session ? session.activeCrossing ?? null : null,
              cycleSpinsWithoutWin:
                "cycleSpinsWithoutWin" in session &&
                typeof session.cycleSpinsWithoutWin === "number"
                  ? session.cycleSpinsWithoutWin
                  : 0,
              cycleSeq:
                "cycleSeq" in session && typeof session.cycleSeq === "number" ? session.cycleSeq : 0,
              cycleFingerprint:
                "cycleFingerprint" in session && typeof session.cycleFingerprint === "string"
                  ? session.cycleFingerprint
                  : null,
              postResultHoldUntilMs,
              postResultHoldTableId:
                "postResultHoldTableId" in session &&
                typeof session.postResultHoldTableId === "number"
                  ? session.postResultHoldTableId
                  : null,
              postResultHoldReason:
                "postResultHoldReason" in session &&
                (session.postResultHoldReason === "draw" ||
                  session.postResultHoldReason === "loss")
                  ? session.postResultHoldReason
                  : null,
              cycleOppositeAbsence:
                "cycleOppositeAbsence" in session && session.cycleOppositeAbsence === true,
            },
            globalAutomation.balance,
            histories,
          )
        : null;
    const bet = openBet ?? pendingSignal ?? extensionHoldBet;
    if (!bet?.signalId || bet.tableId == null) return;

    const payload = buildExtensionBridgeFromAutomationBet(bet, globalAutomation.balance, {
      postResultHoldUntilMs,
    });
    if (!payload) return;

    const emitKey = payload.fingerprint;
    if (readExtensionLastEmitKey() === emitKey) return;
    writeExtensionLastEmitKey(emitKey);
    emitRotatingRoomExtensionCancelCloseMesa(bet.tableId);
    emitRotatingRoomExtensionBridge(payload);
  }, [
    bridgeActive,
    openBet,
    pendingSignal,
    globalAutomation.balance,
    session,
  ]);

  return null;
}

/** Envia sinais da sala rotativa à extensão Chrome — fonte única: automação global (openBet / pendingSignal). */
export function RotatingRoomExtensionBridgeGlobal() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { present: extensionPresent, prefs: extensionPrefs } = useRotatingRoomExtensionPresent();
  const [localBridgeOn, setLocalBridgeOn] = useState(readRotatingRoomExtensionEnabled);

  useEffect(() => {
    const sync = () => setLocalBridgeOn(readRotatingRoomExtensionEnabled());
    window.addEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, sync);
    return () => window.removeEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, sync);
  }, []);

  useEffect(() => {
    if (typeof extensionPrefs?.bridgeEnabled === "boolean") {
      setLocalBridgeOn(extensionPrefs.bridgeEnabled);
    }
  }, [extensionPrefs?.bridgeEnabled]);

  const autoBridge = isRotatingRoomBridgePath(pathname);
  const extensionBridgeOn =
    extensionPresent &&
    (extensionPrefs?.bridgeEnabled !== undefined
      ? extensionPrefs.bridgeEnabled !== false
      : localBridgeOn);
  const bridgeActive = autoBridge && extensionPresent && extensionBridgeOn;

  return <RotatingRoomExtensionBridgeInner bridgeActive={bridgeActive} />;
}
