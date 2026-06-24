import { doisFatoresFactorLabel } from "@/lib/roulette/doisFatoresStrategy";
import {
  pragmaticExteriorBetKeyFromFactor,
  type PragmaticExteriorBetKey,
} from "@/lib/roulette/pragmaticExteriorBetMap";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import type { RotatingRoomClickBotAction } from "@/lib/roulette/rotatingRoomClickBotLearning";
import type { RotatingRoomClickBotSessionSlice } from "@/lib/roulette/rotatingRoomClickBotLearning";

/** Mensagem da app → content script da extensão (mesma janela, `window.postMessage`). */
export const ROTATING_ROOM_EXTENSION_MESSAGE_TYPE = "game-odds-glow/rotating-room-extension" as const;
export const ROTATING_ROOM_EXTENSION_PING_TYPE = "game-odds-glow/rotating-room-extension-ping" as const;
export const ROTATING_ROOM_EXTENSION_PONG_TYPE = "game-odds-glow/rotating-room-extension-pong" as const;
export const ROTATING_ROOM_EXTENSION_VERSION = 1 as const;

export type RotatingRoomExtensionContext = {
  sessionMode: RotatingRoomClickBotSessionSlice["sessionMode"];
  prepareTableId: number | null;
  currentTableId: number | null;
  mesaEmbedUrl: string | null;
  factor1Label: string | null;
  factor2Label: string | null;
  /** Chave Pragmatic para clique (ex. odd = Ímpar) */
  factor1BetKey: PragmaticExteriorBetKey | null;
  factor2BetKey: PragmaticExteriorBetKey | null;
};

export type RotatingRoomExtensionBridgePayload = {
  type: typeof ROTATING_ROOM_EXTENSION_MESSAGE_TYPE;
  version: typeof ROTATING_ROOM_EXTENSION_VERSION;
  fingerprint: string;
  actions: RotatingRoomClickBotAction[];
  context: RotatingRoomExtensionContext;
};

export function buildRotatingRoomExtensionContext(
  session: RotatingRoomClickBotSessionSlice,
): RotatingRoomExtensionContext {
  const focusTableId =
    session.showTapeteSignal && session.currentTableId != null
      ? session.currentTableId
      : session.prepareTableId;
  const crossing = session.activeCrossing;
  return {
    sessionMode: session.sessionMode,
    prepareTableId: session.prepareTableId,
    currentTableId: session.currentTableId,
    mesaEmbedUrl: focusTableId != null ? getCasinoEmbedUrlForTable(focusTableId) : null,
    factor1Label: crossing ? doisFatoresFactorLabel(crossing.factor1) : null,
    factor2Label: crossing ? doisFatoresFactorLabel(crossing.factor2) : null,
    factor1BetKey: crossing ? pragmaticExteriorBetKeyFromFactor(crossing.factor1) : null,
    factor2BetKey: crossing ? pragmaticExteriorBetKeyFromFactor(crossing.factor2) : null,
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

/** Envia plano de cliques para a extensão (se instalada e activa na página). */
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
}

/** Ping para detectar se o content script da extensão está injectado nesta página. */
export function pingRotatingRoomExtension(): void {
  if (typeof window === "undefined") return;
  window.postMessage(
    { type: ROTATING_ROOM_EXTENSION_PING_TYPE, version: ROTATING_ROOM_EXTENSION_VERSION },
    window.location.origin,
  );
}

/** Origens onde o content script da extensão corre por defeito (manifest). */
export function isLikelyExtensionBridgeOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    if (u.hostname === "roleta.poupexplay.com" || u.hostname.endsWith(".poupexplay.com")) return true;
    return false;
  } catch {
    return false;
  }
}
