import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomFibonacciSession } from "@/hooks/useRotatingRoomFibonacciSession";
import type { RotatingRoomRotativaSession } from "@/hooks/useRotatingRoomRotativaSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import { fibonacciActiveFromSignalId } from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import { repeticaoActiveFromSignalId } from "@/lib/roulette/rotatingRoomRepeticaoStrategy";
import { rotacaoActiveToCrossing } from "@/lib/roulette/rotatingRoomRotacaoStrategy";
import { activeCrossingFromAutomationBet } from "@/lib/roulette/automationBetCrossing";

export type RotatingRoomLobbySession = (
  | RotatingRoomCrossingSession
  | RotatingRoomFibonacciSession
  | RotatingRoomUmFatorSession
  | RotatingRoomRotativaSession
) & {
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

/** Fibonacci em recuperação na mesma mesa — aguardar após o giro antes de nova ficha. */
export const ROTATING_ROOM_FIBONACCI_RECOVERY_BET_DELAY_MS = 5000;

/** Rotação — aguardar após o giro antes do próximo clique na ficha. */
export const ROTATING_ROOM_ROTACAO_BET_DELAY_MS = 5000;

/** Rotação com aba aberta (gale) — base + 3s extra para a UI assentar. */
export const ROTATING_ROOM_ROTACAO_RECOVERY_BET_DELAY_MS =
  ROTATING_ROOM_ROTACAO_BET_DELAY_MS + 3000;

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

/** Alinha o cartão da sala com entrada em jogo da automação financeira (quando o motor ainda não expõe mesa). */
export function alignRotatingRoomSessionWithAutomationBet<
  T extends RotatingRoomLobbySession & { rotativaTrigger?: "umFator" | "crossing" | "fibonacci" | "repeticao" | "rotacao" },
>(
  session: T,
  bet:
    | {
        tableId: number;
        recovery: number;
        strategy?: "um1fator" | "dois2fatores" | "fibonacci" | "repeticao" | "rotacao";
        signalId?: string;
        alertLabel?: string;
        umActive?: import("@/lib/roulette/umFatorStrategy").UmFatorActive;
        rotacaoActive?: import("@/lib/roulette/rotatingRoomRotacaoStrategy").RotacaoActive;
        activeCrossing?: DoisFatoresActive | null;
        activeFibonacci?: import("@/lib/roulette/rotatingRoomFibonacciStrategy").RotatingRoomFibonacciActive;
        activeRepeticao?: import("@/lib/roulette/rotatingRoomRepeticaoStrategy").RotatingRoomRepeticaoActive;
      }
    | null
    | undefined,
  options?: {
    /** Só alinha quando a aposta é desta estratégia (evita sinal de 1F/2F sobrepor Fibonacci). */
    roomStrategy?: "um1fator" | "dois2fatores" | "fibonacci" | "repeticao" | "rotacao";
  },
): T {
  if (!bet?.tableId) return session;

  const roomStrategy = options?.roomStrategy;
  if (roomStrategy) {
    const betStrategy =
      bet.strategy ?? (bet.umActive ? "um1fator" : bet.activeCrossing ? "dois2fatores" : null);
    if (betStrategy && betStrategy !== roomStrategy) return session;
  }

  if (bet.strategy === "fibonacci" || bet.strategy === "repeticao") {
    const fibSession = session as T & {
      fibonacciMode?: boolean;
      showTapeteSignal?: boolean;
      activeFibonacci?: import("@/lib/roulette/rotatingRoomFibonacciStrategy").RotatingRoomFibonacciActive | null;
    };
    if (
      fibSession.fibonacciMode &&
      fibSession.showTapeteSignal &&
      fibSession.activeFibonacci != null
    ) {
      return session;
    }
    const activeFibonacci =
      bet.activeFibonacci ??
      (bet.activeRepeticao
        ? { ...bet.activeRepeticao, absenceGap: bet.activeRepeticao.streakGap }
        : null) ??
      (bet.signalId
        ? bet.strategy === "repeticao"
          ? repeticaoActiveFromSignalId(bet.signalId)
          : fibonacciActiveFromSignalId(bet.signalId)
        : null);
    if (!activeFibonacci) return session;
    return {
      ...session,
      currentTableId: bet.tableId,
      showTapeteSignal: true,
      prepareTableId: null,
      currentRecovery: bet.recovery,
      activeFibonacci,
      activeCrossing: null,
      sessionMode: "active",
      rotativaTrigger: bet.strategy,
    } as T;
  }

  if (bet.strategy === "rotacao" && bet.rotacaoActive) {
    const activeCrossing = rotacaoActiveToCrossing(bet.rotacaoActive);
    return {
      ...session,
      currentTableId: bet.tableId,
      showTapeteSignal: true,
      prepareTableId: null,
      currentRecovery: bet.recovery,
      activeCrossing,
      sessionMode: "active",
      rotativaTrigger: "rotacao",
    } as T;
  }

  const betCrossing = activeCrossingFromAutomationBet(bet);
  const sameActiveBet =
    session.showTapeteSignal === true &&
    session.currentTableId === bet.tableId &&
    (session.activeCrossing != null || betCrossing != null);
  if (sameActiveBet && betCrossing != null && session.activeCrossing != null) {
    return session;
  }

  const isCrossing = bet.strategy === "dois2fatores";
  const alignedCrossing: DoisFatoresActive | null =
    betCrossing ?? session.activeCrossing ?? null;

  return {
    ...session,
    currentTableId: bet.tableId,
    showTapeteSignal: true,
    prepareTableId: null,
    currentRecovery: bet.recovery,
    activeCrossing: alignedCrossing,
    ...(bet.umActive ? { umActive: bet.umActive } : {}),
    sessionMode: "active",
    ...(isCrossing ? { rotativaTrigger: "crossing" as const } : { rotativaTrigger: "umFator" as const }),
  };
}
