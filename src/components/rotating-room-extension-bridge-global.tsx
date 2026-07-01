import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { useRotatingRoomRotativaSession } from "@/hooks/useRotatingRoomRotativaSession";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import {
  buildExtensionBridgeFromAutomationBet,
  emitRotatingRoomExtensionBridge,
  emitRotatingRoomExtensionCloseMesa,
  mesaUrlForTableId,
  resolveMesaTabCloseTableId,
  type MesaTabTrack,
} from "@/lib/roulette/rotatingRoomExtensionBridge";
import {
  alignRotatingRoomSessionWithAutomationBet,
} from "@/lib/roulette/rotatingRoomLobbySignal";
import {
  clearExtensionLastEmitKey,
  readExtensionLastEmitKey,
  readRotatingRoomExtensionEnabled,
  ROTATING_ROOM_EXTENSION_PREFS_EVENT,
  writeExtensionLastEmitKey,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";

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
  const mesaTabTrackRef = useRef<MesaTabTrack | null>(null);
  const mesaCloseDedupeRef = useRef<string | null>(null);
  const prevPostResultHoldRef = useRef(false);
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
    clearExtensionLastEmitKey();
  }, [bridgeActive]);

  useEffect(() => {
    if (!bridgeActive) return;
    const betKey = openBet?.signalId ?? pendingSignal?.signalId;
    if (!betKey) return;
    clearExtensionLastEmitKey();
  }, [bridgeActive, openBet?.signalId, pendingSignal?.signalId]);

  useEffect(() => {
    if (!bridgeActive) {
      mesaTabTrackRef.current = null;
      mesaCloseDedupeRef.current = null;
      prevPostResultHoldRef.current = false;
      return;
    }

    const postHoldActive =
      "postResultHoldActive" in session && session.postResultHoldActive === true;
    const postHoldTableId =
      "postResultHoldTableId" in session &&
      typeof session.postResultHoldTableId === "number"
        ? session.postResultHoldTableId
        : null;

    if (postHoldActive && !prevPostResultHoldRef.current && postHoldTableId != null) {
      const dedupeKey = `hold:${postHoldTableId}`;
      if (mesaCloseDedupeRef.current !== dedupeKey) {
        mesaCloseDedupeRef.current = dedupeKey;
        emitRotatingRoomExtensionCloseMesa(postHoldTableId, mesaUrlForTableId(postHoldTableId));
        mesaTabTrackRef.current = null;
      }
    }
    prevPostResultHoldRef.current = postHoldActive;

    const closeTableId = resolveMesaTabCloseTableId(
      mesaTabTrackRef.current,
      openBet,
      pendingSignal,
    );
    if (closeTableId != null) {
      const dedupeKey = `bet:${closeTableId}`;
      if (mesaCloseDedupeRef.current !== dedupeKey) {
        mesaCloseDedupeRef.current = dedupeKey;
        emitRotatingRoomExtensionCloseMesa(closeTableId, mesaUrlForTableId(closeTableId));
        if (mesaTabTrackRef.current?.tableId === closeTableId) {
          mesaTabTrackRef.current = null;
        }
      }
    }

    const activeBet = openBet ?? pendingSignal;
    if (activeBet?.tableId != null && activeBet.signalId) {
      mesaTabTrackRef.current = {
        tableId: activeBet.tableId,
        signalId: activeBet.signalId,
        recovery: activeBet.recovery,
      };
    }
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
