import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useRotatingRoomClickBotLearning } from "@/hooks/useRotatingRoomClickBotLearning";
import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import { useRotatingRoomHistories } from "@/hooks/useRotatingRoomHistories";
import { useRotatingRoomRotativaSession } from "@/hooks/useRotatingRoomRotativaSession";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import { getLiveRouletteTableIds, ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import {
  ROTATING_ROOM_FIXED_TABLE_IDS,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import { buildRotatingRoomMesaCatalog } from "@/lib/roulette/rotatingRoomExtensionBridge";
import {
  isRotatingRoomLobbyWait,
  rotatingRoomLobbyFocusTableId,
  ROTATING_ROOM_LOBBY_WAIT_EMBED_URL,
} from "@/lib/roulette/rotatingRoomLobbySignal";

function isRotatingRoomBridgePath(pathname: string): boolean {
  return (
    pathname === "/back-office" ||
    pathname === "/back-office/" ||
    pathname.startsWith("/back-office/operacoes") ||
    pathname.startsWith("/casino-mesa") ||
    pathname === "/sala-rotativa-um-fator" ||
    pathname.startsWith("/sala-rotativa")
  );
}

type BridgeInnerProps = {
  bridgeActive: boolean;
};

/** Só monta com extensão presente — evita motores de placar duplicados na visão geral. */
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
  const session = useRotatingRoomRotativaSession(tableIds, histories, {
    preferLocalSession: false,
    observeOnly: true,
  });

  const mesaEmbedUrl = useMemo(() => {
    if (isRotatingRoomLobbyWait(session)) return ROTATING_ROOM_LOBBY_WAIT_EMBED_URL;
    const focusId = rotatingRoomLobbyFocusTableId(session) ?? session.currentTableId;
    if (focusId == null) return null;
    const catalog = buildRotatingRoomMesaCatalog();
    return catalog.find((e) => e.tableId === focusId)?.url ?? getCasinoEmbedUrlForTable(focusId);
  }, [session]);

  useRotatingRoomClickBotLearning({
    session,
    enabled: bridgeActive,
    mode: "extension",
    mesaEmbedUrl,
    automationBalance: globalAutomation.balance,
  });

  return null;
}

/** Envia sinais da sala rotativa (1 Fator + cruzamento 2F) à extensão Chrome. */
export function RotatingRoomExtensionBridgeGlobal() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { present: extensionPresent, prefs: extensionPrefs } = useRotatingRoomExtensionPresent();

  const autoBridge = isRotatingRoomBridgePath(pathname);
  const extensionBridgeOn =
    extensionPresent &&
    (extensionPrefs?.bridgeEnabled === undefined || extensionPrefs.bridgeEnabled !== false);
  const bridgeActive = autoBridge && extensionPresent && extensionBridgeOn;

  if (!autoBridge || !extensionPresent) return null;

  return <RotatingRoomExtensionBridgeInner bridgeActive={bridgeActive} />;
}
