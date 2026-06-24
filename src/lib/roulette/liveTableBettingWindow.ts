import { readLiveTableSpinTimesAligned } from "@/lib/roulette/historyStorage";

/** Tempo médio (s) entre o resultado e o fecho das apostas no próximo giro. */
export const LIVE_TABLE_BETTING_WINDOW_SEC = 20;

/**
 * Tempo mínimo restante para a sala rotativa trocar de mesa e ainda haver margem
 * para carregar a página e efectuar a entrada.
 */
export const ROTATING_ROOM_MIN_BETTING_TIME_REMAINING_SEC = 10;

/**
 * Segundos restantes para apostar no giro actual da mesa (0 = janela fechada / a girar).
 * Sem marca temporal no último giro → assume janela completa (optimista).
 */
export function liveTableBettingRemainingSec(
  tableId: number,
  historyNewestFirst: readonly number[],
  nowMs: number = Date.now(),
  bettingWindowSec: number = LIVE_TABLE_BETTING_WINDOW_SEC,
): number {
  if (historyNewestFirst.length === 0) return 0;
  const times = readLiveTableSpinTimesAligned(tableId, historyNewestFirst.length);
  const t0 = times[0] ?? null;
  if (t0 == null) return bettingWindowSec;
  const elapsedSec = Math.max(0, (nowMs - t0) / 1000);
  return Math.max(0, bettingWindowSec - elapsedSec);
}

/** Mesa com tempo suficiente para entrar antes do fecho das apostas. */
export function tableAcceptableForRotatingRoomEntry(
  tableId: number,
  historyNewestFirst: readonly number[],
  minRemainingSec: number = ROTATING_ROOM_MIN_BETTING_TIME_REMAINING_SEC,
  nowMs?: number,
): boolean {
  return (
    liveTableBettingRemainingSec(tableId, historyNewestFirst, nowMs) >= minRemainingSec
  );
}
