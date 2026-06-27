import { doisFatoresFactorLabel } from "@/lib/roulette/doisFatoresStrategy";
import {
  formatStakeBrl,
  stakeForRecovery,
} from "@/lib/back-office/rouletteAutomationSim";
import {
  pragmaticExteriorBetKeyFromFactor,
  type PragmaticExteriorBetKey,
} from "@/lib/roulette/pragmaticExteriorBetMap";
import { getLiveRouletteTableIds } from "@/lib/roulette/liveTableConfig";
import {
  lobbyTableDisplayName,
  resolveRotatingRoomTableIds,
} from "@/lib/roulette/lobbyTables";
import {
  casinoEmbedProviderFromUrl,
  type CasinoEmbedProvider,
} from "@/lib/roulette/casinoEmbedProviderHint";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import { ROTATING_ROOM_LOBBY_WAIT_EMBED_URL } from "@/lib/roulette/rotatingRoomLobbySignal";
import type { RotatingRoomClickBotAction } from "@/lib/roulette/rotatingRoomClickBotLearning";
import type { RotatingRoomClickBotSessionSlice } from "@/lib/roulette/rotatingRoomClickBotLearning";
import { readRotatingRoomExtensionRealMode, readEffectiveUmFatorMaxRecovery } from "@/lib/roulette/rotatingRoomExtensionPrefs";
import type { RotatingUmFatorIndication } from "@/lib/roulette/rotatingUmFatorSimHarness";

export const ROTATING_ROOM_EXTENSION_MESSAGE_TYPE = "game-odds-glow/rotating-room-extension" as const;
export const ROTATING_ROOM_EXTENSION_PING_TYPE = "game-odds-glow/rotating-room-extension-ping" as const;
export const ROTATING_ROOM_EXTENSION_PONG_TYPE = "game-odds-glow/rotating-room-extension-pong" as const;
export const ROTATING_ROOM_EXTENSION_ACK_TYPE = "game-odds-glow/rotating-room-extension-ack" as const;
export const ROTATING_ROOM_EXTENSION_STATS_TYPE = "game-odds-glow/rotating-room-extension-stats" as const;
export const ROTATING_ROOM_EXTENSION_EMIT_EVENT = "singlestake-extension-emit" as const;
export const ROTATING_ROOM_EXTENSION_PRESENT_EVENT = "singlestake-extension-present" as const;
export const ROTATING_ROOM_EXTENSION_VERSION = 1 as const;

export type RotatingRoomExtensionPrefs = {
  maxRecovery: number;
  wins: number;
  losses: number;
  recoveries?: number;
  executionMode?: "demo" | "real";
  bridgeEnabled?: boolean;
};

export type RotatingRoomExtensionContext = {
  sessionMode: RotatingRoomClickBotSessionSlice["sessionMode"];
  prepareTableId: number | null;
  currentTableId: number | null;
  mesaEmbedUrl: string | null;
  /** playtech | pragmatic — derivado de mesaEmbedUrl para a extensão escolher o separador certo. */
  mesaProvider: CasinoEmbedProvider;
  factor1Label: string | null;
  factor2Label: string | null;
  factor1BetKey: PragmaticExteriorBetKey | null;
  factor2BetKey: PragmaticExteriorBetKey | null;
  singleFactorMode: boolean;
  signalId: string | null;
  /** Banca do quadro global (informativo). Stake fixa: R$ 50 × 2^gale. */
  automationBalance: number | null;
  /** @deprecated Informativo — não usar para apostar; ver automationBalance. */
  stakeAmount: number | null;
  currentRecovery: number | null;
  /** @deprecated A extensão deriva baseStake de automationBalance. */
  baseStake: number | null;
  maxRecovery: number;
  /** demo | real — prioridade sobre o modo do popup da extensão. */
  executionMode: "demo" | "real";
  /** Aguarde no Lobby — navegar para poker em vez de mesa de roleta. */
  lobbyWait?: boolean;
  /** Mesas da sala rotativa com URL individual guardada (localStorage / env). */
  mesaCatalog: RotatingRoomMesaCatalogEntry[];
};

export type RotatingRoomMesaCatalogEntry = {
  tableId: number;
  label: string;
  url: string;
};

export function buildRotatingRoomMesaCatalog(): RotatingRoomMesaCatalogEntry[] {
  if (typeof window === "undefined") return [];
  const liveIds = getLiveRouletteTableIds();
  const tableIds = resolveRotatingRoomTableIds(liveIds);
  const entries: RotatingRoomMesaCatalogEntry[] = [];
  for (const tableId of tableIds) {
    const url = getCasinoEmbedUrlForTable(tableId);
    if (!url) continue;
    entries.push({
      tableId,
      label: lobbyTableDisplayName(tableId),
      url,
    });
  }
  return entries;
}

export type RotatingRoomExtensionBridgePayload = {
  type: typeof ROTATING_ROOM_EXTENSION_MESSAGE_TYPE;
  version: typeof ROTATING_ROOM_EXTENSION_VERSION;
  fingerprint: string;
  actions: RotatingRoomClickBotAction[];
  context: RotatingRoomExtensionContext;
};

export function buildRotatingRoomExtensionContext(
  session: RotatingRoomClickBotSessionSlice,
  mesaEmbedUrlOverride?: string | null,
  automationBalance?: number | null,
): RotatingRoomExtensionContext {
  const lobbyWait = session.lobbyWait === true;
  const focusTableId = lobbyWait
    ? null
    : session.showTapeteSignal && session.currentTableId != null
      ? session.currentTableId
      : session.prepareTableId;
  const crossing = session.activeCrossing;
  const mesaCatalog = buildRotatingRoomMesaCatalog();
  const mesaFromCatalog =
    focusTableId != null
      ? mesaCatalog.find((e) => e.tableId === focusTableId)?.url ?? null
      : null;
  const mesaEmbedUrl = lobbyWait
    ? ROTATING_ROOM_LOBBY_WAIT_EMBED_URL
    : (mesaEmbedUrlOverride && mesaEmbedUrlOverride.trim()) ||
      mesaFromCatalog ||
      (focusTableId != null ? getCasinoEmbedUrlForTable(focusTableId) : null);
  const recovery =
    typeof session.currentRecovery === "number" && Number.isFinite(session.currentRecovery)
      ? Math.max(0, Math.floor(session.currentRecovery))
      : 0;
  const realMode = readRotatingRoomExtensionRealMode();
  const balance =
    typeof automationBalance === "number" && Number.isFinite(automationBalance) && automationBalance > 0
      ? automationBalance
      : null;
  return {
    sessionMode: session.sessionMode,
    prepareTableId: lobbyWait ? null : session.prepareTableId,
    currentTableId: lobbyWait ? null : session.currentTableId,
    mesaEmbedUrl,
    mesaProvider: casinoEmbedProviderFromUrl(mesaEmbedUrl),
    factor1Label: crossing ? doisFatoresFactorLabel(crossing.factor1) : null,
    factor2Label:
      crossing && !session.singleFactorMode ? doisFatoresFactorLabel(crossing.factor2) : null,
    factor1BetKey: crossing ? pragmaticExteriorBetKeyFromFactor(crossing.factor1) : null,
    factor2BetKey:
      crossing && !session.singleFactorMode
        ? pragmaticExteriorBetKeyFromFactor(crossing.factor2)
        : null,
    singleFactorMode: session.singleFactorMode === true,
    signalId: session.signalId ?? null,
    automationBalance: balance,
    stakeAmount: stakeForRecovery(recovery),
    currentRecovery: recovery,
    baseStake: null,
    maxRecovery: readEffectiveUmFatorMaxRecovery(),
    executionMode: realMode ? "real" : "demo",
    lobbyWait,
    mesaCatalog,
  };
}

export function isRotatingRoomExtensionBridgePayload(
  data: unknown,
): data is RotatingRoomExtensionBridgePayload {
  if (data === null || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === ROTATING_ROOM_EXTENSION_MESSAGE_TYPE &&
    o.version === ROTATING_ROOM_EXTENSION_VERSION &&
    typeof o.fingerprint === "string" &&
    Array.isArray(o.actions) &&
    o.context !== null &&
    typeof o.context === "object"
  );
}

export function emitRotatingRoomExtensionBridge(
  payload: Pick<RotatingRoomExtensionBridgePayload, "fingerprint" | "actions" | "context">,
): void {
  if (typeof window === "undefined") return;
  const message: RotatingRoomExtensionBridgePayload = {
    type: ROTATING_ROOM_EXTENSION_MESSAGE_TYPE,
    version: ROTATING_ROOM_EXTENSION_VERSION,
    ...payload,
  };
  window.postMessage(message, window.location.origin);
  window.dispatchEvent(
    new CustomEvent(ROTATING_ROOM_EXTENSION_EMIT_EVENT, {
      detail: { fingerprint: message.fingerprint, actions: message.actions },
    }),
  );
}

export function pingRotatingRoomExtension(): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    { type: ROTATING_ROOM_EXTENSION_PING_TYPE, version: ROTATING_ROOM_EXTENSION_VERSION },
    window.location.origin,
  );
}

export function syncRotatingRoomExtensionStats(
  wins: number,
  losses: number,
  recoveries?: number,
): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    {
      type: ROTATING_ROOM_EXTENSION_STATS_TYPE,
      version: ROTATING_ROOM_EXTENSION_VERSION,
      wins: Math.max(0, wins),
      losses: Math.max(0, losses),
      recoveries: Math.max(0, recoveries ?? 0),
    },
    window.location.origin,
  );
}

export function isRotatingRoomExtensionPong(
  data: unknown,
): data is { type: typeof ROTATING_ROOM_EXTENSION_PONG_TYPE; prefs?: RotatingRoomExtensionPrefs } {
  if (data === null || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return o.type === ROTATING_ROOM_EXTENSION_PONG_TYPE && o.version === ROTATING_ROOM_EXTENSION_VERSION;
}

export { isLikelyExtensionBridgeOrigin } from "@/lib/app-domains";

/** Converte indicação da estratégia (sim ou ao vivo) no payload da extensão Chrome. */
export function buildExtensionBridgeFromUmFatorIndication(
  indication: RotatingUmFatorIndication,
  automationBalance?: number | null,
): Pick<RotatingRoomExtensionBridgePayload, "fingerprint" | "actions" | "context"> | null {
  if (
    indication.action !== "bet" ||
    indication.tableId == null ||
    !indication.exteriorBetKey ||
    !indication.signalId
  ) {
    return null;
  }

  return {
    fingerprint: indication.signalId,
    actions: [
      {
        kind: "click",
        target: "factor-1",
        label: indication.alertLabel ?? indication.exteriorBetKey,
        reason: `Um Fator · ${indication.tableLabel} · ${formatStakeBrl(indication.stake)} · gale ${indication.recovery}`,
      },
    ],
    context: {
      sessionMode: "active",
      prepareTableId: null,
      currentTableId: indication.tableId,
      mesaEmbedUrl: getCasinoEmbedUrlForTable(indication.tableId),
      mesaProvider: casinoEmbedProviderFromUrl(getCasinoEmbedUrlForTable(indication.tableId)),
      factor1Label: indication.alertLabel,
      factor2Label: null,
      factor1BetKey: indication.exteriorBetKey,
      factor2BetKey: null,
      singleFactorMode: true,
      signalId: indication.signalId,
      automationBalance:
        typeof automationBalance === "number" && Number.isFinite(automationBalance) && automationBalance > 0
          ? automationBalance
          : null,
      stakeAmount: indication.stake,
      currentRecovery: indication.recovery,
      baseStake: null,
      maxRecovery: readEffectiveUmFatorMaxRecovery(),
      executionMode: readRotatingRoomExtensionRealMode() ? "real" : "demo",
      mesaCatalog: buildRotatingRoomMesaCatalog(),
    },
  };
}
