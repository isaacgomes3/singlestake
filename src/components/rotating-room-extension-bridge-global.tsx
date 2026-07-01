import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { useRotatingRoomRotativaSession } from "@/hooks/useRotatingRoomRotativaSession";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import type { AutomationOpenBet } from "@/lib/back-office/rouletteAutomationSim";
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
} from "@/lib/roulette/rotatingRoomExtensionBridge";
import { alignRotatingRoomSessionWithAutomationBet } from "@/lib/roulette/rotatingRoomLobbySignal";
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

function isRotatingRoomBridgePath(pathname: string): boolean {
  return (
    pathname.startsWith("/back-office") ||
    pathname === "/casino-mesa" ||
    pathname.startsWith("/casino-mesa") ||
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
  const { state: globalAutomation, openBet, pendingSignal } = useRouletteAutomationSim();
  const prevOpenBetRef = useRef<AutomationOpenBet | null>(null);
  const mesaCloseDedupeRef = useRef<string | null>(null);
  const prevPostResultHoldRef = useRef(false);
  const bridgeArmedAtRef = useRef(0);
  const openBetClearedAtRef = useRef(0);
  const sawOpenBetRef = useRef(false);

  const rawSession = useRotatingRoomRotativaSession(tableIds, histories, {
    preferLocalSession: false,
    observeOnly: true,
  });

  const session = useMemo(
    () =>
      alignRotatingRoomSessionWithAutomationBet(
        rawSession,
        openBet ?? pendingSignal,
      ),
    [rawSession, openBet, pendingSignal],
  );

  useEffect(() => {
    if (!bridgeActive) return;
    emitRotatingRoomExtensionCancelCloseMesa();
    clearExtensionLastEmitKey();
    bridgeArmedAtRef.current = Date.now();
    prevOpenBetRef.current = openBet;
    sawOpenBetRef.current = openBet != null;
    openBetClearedAtRef.current = 0;
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
      mesaCloseDedupeRef.current = null;
      prevPostResultHoldRef.current = false;
      bridgeArmedAtRef.current = 0;
      openBetClearedAtRef.current = 0;
      sawOpenBetRef.current = false;
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

    if (
      !inGrace &&
      sawOpenBetRef.current &&
      postHoldActive &&
      !prevPostResultHoldRef.current &&
      postHoldTableId != null &&
      prevOpenBetRef.current?.tableId === postHoldTableId
    ) {
      const dedupeKey = `hold:${postHoldTableId}:${prevOpenBetRef.current?.signalId ?? ""}`;
      if (mesaCloseDedupeRef.current !== dedupeKey) {
        mesaCloseDedupeRef.current = dedupeKey;
        emitRotatingRoomExtensionCloseMesa(postHoldTableId, mesaUrlForTableId(postHoldTableId));
      }
    }
    prevPostResultHoldRef.current = postHoldActive;

    if (openBet) {
      sawOpenBetRef.current = true;
      openBetClearedAtRef.current = 0;
    }

    const prevOpenBet = prevOpenBetRef.current;
    let closeTableId: number | null = null;

    if (!inGrace && sawOpenBetRef.current && prevOpenBet?.tableId) {
      if (!openBet) {
        if (!openBetClearedAtRef.current) {
          openBetClearedAtRef.current = Date.now();
        } else if (Date.now() - openBetClearedAtRef.current >= OPEN_BET_CLEAR_STABLE_MS) {
          closeTableId = mesaTabCloseAfterOpenBetChange(
            prevOpenBet,
            openBet,
            pendingSignal,
          );
        }
      } else {
        closeTableId = mesaTabCloseAfterOpenBetChange(
          prevOpenBet,
          openBet,
          pendingSignal,
        );
      }
    }

    if (closeTableId != null) {
      const dedupeKey = `open:${prevOpenBet?.signalId ?? closeTableId}`;
      if (mesaCloseDedupeRef.current !== dedupeKey) {
        mesaCloseDedupeRef.current = dedupeKey;
        emitRotatingRoomExtensionCloseMesa(closeTableId, mesaUrlForTableId(closeTableId));
      }
    }

    if (openBet?.signalId && openBet.signalId !== prevOpenBet?.signalId) {
      mesaCloseDedupeRef.current = null;
      emitRotatingRoomExtensionCancelCloseMesa(openBet.tableId);
    }

    prevOpenBetRef.current = openBet;
  }, [bridgeActive, openBet, pendingSignal, session]);

  useEffect(() => {
    if (!bridgeActive) return;
    const bet = openBet ?? pendingSignal;
    if (!bet?.signalId || bet.tableId == null) return;

    const payload = buildExtensionBridgeFromAutomationBet(bet, globalAutomation.balance);
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
