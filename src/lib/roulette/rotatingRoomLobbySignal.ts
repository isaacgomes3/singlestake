import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";

export type RotatingRoomLobbySession = RotatingRoomCrossingSession | RotatingRoomUmFatorSession;

/** Mesa em foco na sala rotativa (iframe, cartão lobby, badge de sinal). */
export function rotatingRoomLobbyFocusTableId(session: RotatingRoomLobbySession): number | null {
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
  strategy: "dois2fatores" | "um1fator",
  session: RotatingRoomLobbySession,
): boolean {
  if (rotatingRoomLobbyFocusTableId(session) !== tableId) return false;
  if (
    strategy === "dois2fatores" &&
    "crossingScan" in session &&
    session.crossingScan.some((row) => row.tableId === tableId && row.status === "active")
  ) {
    return true;
  }
  return rotatingRoomLobbyHasSignal(session);
}
