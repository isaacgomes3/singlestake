import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useRotatingRoomClickBotLearning } from "@/hooks/useRotatingRoomClickBotLearning";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { useRotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import { buildRotatingRoomMesaCatalog } from "@/lib/roulette/rotatingRoomExtensionBridge";
import { rotatingRoomLobbyFocusTableId } from "@/lib/roulette/rotatingRoomLobbySignal";
import {
  readRotatingRoomExtensionEnabled,
  ROTATING_ROOM_EXTENSION_ENABLED_KEY,
  ROTATING_ROOM_EXTENSION_PREFS_EVENT,
  writeRotatingRoomExtensionEnabled,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";

function isRotatingRoomBridgePath(pathname: string): boolean {
  return (
    pathname.startsWith("/back-office") ||
    pathname.startsWith("/casino-mesa") ||
    pathname === "/sala-rotativa-um-fator" ||
    pathname.startsWith("/sala-rotativa")
  );
}

/** Envia sinais Um Fator à extensão Chrome em todas as páginas da sala rotativa. */
export function RotatingRoomExtensionBridgeGlobal() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [extensionEnabled, setExtensionEnabled] = useState(readRotatingRoomExtensionEnabled);

  const autoBridge = isRotatingRoomBridgePath(pathname);

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
  const session = useRotatingRoomUmFatorSession(tableIds, histories, {
    preferLocalSession: true,
  });

  const mesaEmbedUrl = useMemo(() => {
    const focusId = rotatingRoomLobbyFocusTableId(session) ?? session.currentTableId;
    if (focusId == null) return null;
    const catalog = buildRotatingRoomMesaCatalog();
    return catalog.find((e) => e.tableId === focusId)?.url ?? getCasinoEmbedUrlForTable(focusId);
  }, [session]);

  useEffect(() => {
    if (!autoBridge) return;
    if (!readRotatingRoomExtensionEnabled()) writeRotatingRoomExtensionEnabled(true);
  }, [autoBridge]);

  useEffect(() => {
    const syncEnabled = () => setExtensionEnabled(readRotatingRoomExtensionEnabled());
    const onStorage = (event: StorageEvent) => {
      if (event.key === ROTATING_ROOM_EXTENSION_ENABLED_KEY) syncEnabled();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, syncEnabled);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, syncEnabled);
    };
  }, []);

  const bridgeActive =
    autoBridge && (extensionEnabled || readRotatingRoomExtensionEnabled());

  useRotatingRoomClickBotLearning({
    session,
    enabled: bridgeActive,
    mode: "extension",
    mesaEmbedUrl,
  });

  return null;
}
