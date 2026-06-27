import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";

export type RotatingRoomLobbySession = (RotatingRoomCrossingSession | RotatingRoomUmFatorSession) & {
  postResultHoldUntilMs?: number | null;
  postResultHoldTableId?: number | null;
};

/** Iframe enquanto não há mesa em foco («Aguarde no Lobby»). */
export const ROTATING_ROOM_LOBBY_WAIT_EMBED_URL = "https://br4.bet.br/play/pragmatic/poker";

/** Flash de vitória/derrota antes de «Aguarde no Lobby». */
export const ROTATING_ROOM_ROUND_FLASH_MS = 2800;

/** Pausa extra após o flash antes de navegar para o lobby (poker). */
export const ROTATING_ROOM_LOBBY_RETURN_DELAY_MS = 2000;

/** Tempo total após o resultado até «Aguarde no Lobby». */
export const ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT =
  ROTATING_ROOM_ROUND_FLASH_MS + ROTATING_ROOM_LOBBY_RETURN_DELAY_MS;

/** Tempo mínimo no lobby antes de armar nova indicação (após o poker carregar). */
export const ROTATING_ROOM_LOBBY_COOLDOWN_MS = 3000;

/** Tempo que a extensão aguarda após navegar para poker/roleta (background.js). */
export const ROTATING_ROOM_LOBBY_NAV_SETTLE_MS = 6500;

/** Timestamp até ao qual novas entradas ficam bloqueadas após ciclo concluído. */
export function rotatingRoomLobbyCooldownUntilMs(fromMs: number = Date.now()): number {
  return (
    fromMs +
    ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT +
    ROTATING_ROOM_LOBBY_NAV_SETTLE_MS +
    ROTATING_ROOM_LOBBY_COOLDOWN_MS
  );
}

export function isRotatingRoomLobbyCooldownActive(
  lobbyCooldownUntilMs: number | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return (
    typeof lobbyCooldownUntilMs === "number" &&
    Number.isFinite(lobbyCooldownUntilMs) &&
    nowMs < lobbyCooldownUntilMs
  );
}

/** Vitória/derrota final — ainda na mesa antes de «Aguarde no Lobby» (motor, síncrono). */
export function isRotatingRoomPostResultHoldActive(
  postResultHoldUntilMs: number | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return (
    typeof postResultHoldUntilMs === "number" &&
    Number.isFinite(postResultHoldUntilMs) &&
    nowMs < postResultHoldUntilMs
  );
}

/** Sem indicação, flash ou preparação — estado «Aguarde no Lobby». */
export function isRotatingRoomLobbyWait(session: RotatingRoomLobbySession): boolean {
  return rotatingRoomLobbyFocusTableId(session) == null;
}

/** Mesa em foco na sala rotativa (iframe, cartão lobby, badge de sinal). */
export function rotatingRoomLobbyFocusTableId(session: RotatingRoomLobbySession): number | null {
  if (
    isRotatingRoomPostResultHoldActive(session.postResultHoldUntilMs) &&
    session.postResultHoldTableId != null
  ) {
    return session.postResultHoldTableId;
  }
  if (session.roundFlash?.tableId != null) return session.roundFlash.tableId;
  if (session.showTapeteSignal && session.currentTableId != null) return session.currentTableId;
  if (session.prepareTableId != null) return session.prepareTableId;
  return null;
}

/** Indicação activa na sala rotativa (mesmo critério do cartão Sala Rotativa). */
export function rotatingRoomLobbyHasSignal(session: RotatingRoomLobbySession): boolean {
  if (session.roundFlash != null) return true;
  if (session.showTapeteSignal) return true;
  return session.sessionMode === "prepare" && session.prepareTableId != null;
}

/** Mesa do lobby com sinal activo — só a mesa em foco na sessão global da sala rotativa. */
export function lobbyTableHasRotatingRoomSignal(
  tableId: number,
  _strategy: "um1fator",
  session: RotatingRoomLobbySession,
): boolean {
  if (rotatingRoomLobbyFocusTableId(session) !== tableId) return false;
  return rotatingRoomLobbyHasSignal(session);
}
