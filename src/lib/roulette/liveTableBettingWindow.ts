import { readLiveTableSpinTimesAligned } from "@/lib/roulette/historyStorage";

/** Tempo médio (s) entre o resultado e o fecho das apostas no próximo giro. */
export const LIVE_TABLE_BETTING_WINDOW_SEC = 20;

/**
 * Tempo mínimo restante para a sala rotativa trocar de mesa e ainda haver margem
 * para carregar a página e efectuar a entrada.
 */
export const ROTATING_ROOM_MIN_BETTING_TIME_REMAINING_SEC = 11;

/** Espera mínima (s) após o giro DGA antes da extensão clicar na mesa. */
export const EXTENSION_PRE_BET_WAIT_SEC = 11;

/**
 * Tempo mínimo restante para **armar** formação Um Fator (só detectar + sinalizar).
 * Mais permissivo que {@link ROTATING_ROOM_MIN_BETTING_TIME_REMAINING_SEC} — troca de mesa no iframe.
 */
export const UM_FATOR_ARM_MIN_BETTING_TIME_REMAINING_SEC = 3;

/** 2 Fatores — 1.º sinal / entrada só com ≥ este tempo restante no giro (extensão + automação). */
export const CROSSING_FIRST_SIGNAL_MIN_BETTING_TIME_REMAINING_SEC = 8;

/**
 * 2 Fatores em gale/reentrada — após hold de 8s sobra pouca janela; limiar mais baixo que a 1.ª entrada.
 */
export const CROSSING_RECOVERY_MIN_BETTING_TIME_REMAINING_SEC = 6;

/** Limiar de janela para pending 2F conforme fase do ciclo. */
export function crossingMinBettingTimeRemainingSec(
  recovery: number,
  cycleSpinsWithoutWin = 0,
): number {
  return recovery > 0 || cycleSpinsWithoutWin > 0
    ? CROSSING_RECOVERY_MIN_BETTING_TIME_REMAINING_SEC
    : CROSSING_FIRST_SIGNAL_MIN_BETTING_TIME_REMAINING_SEC;
}

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

/** Janela ainda aberta o suficiente para armar alerta Um Fator nesta mesa (≥11s). */
export function tableArmableForUmFatorFormation(
  tableId: number,
  historyNewestFirst: readonly number[],
  nowMs?: number,
): boolean {
  return tableAcceptableForRotatingRoomEntry(tableId, historyNewestFirst, nowMs);
}
