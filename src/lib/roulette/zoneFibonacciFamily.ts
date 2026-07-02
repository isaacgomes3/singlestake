/**
 * Fibonacci e Repetição — mesma família operacional (stakes 1-1-2-3-5-8-13-21, payout 2:1).
 * Só muda a leitura do gatilho (ausência de zona vs ausência de repetição).
 */
import type { StrategyGlobalKind, StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";
import {
  evaluateFibonacciRound,
  fibonacciActiveFromSignalId,
  ROTATING_ROOM_FIBONACCI_MAX_RECOVERY,
  type FibonacciZone,
  type RotatingRoomFibonacciActive,
} from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import {
  repeticaoActiveFromSignalId,
  type RotatingRoomRepeticaoActive,
} from "@/lib/roulette/rotatingRoomRepeticaoStrategy";

export type ZoneFibonacciStrategyKind = Extract<StrategyGlobalKind, "fibonacci" | "repeticao">;

export type ZoneFibonacciSessionSlice = Pick<
  StrategyGlobalSnapshot["fibonacci"],
  "showTapeteSignal" | "currentTableId" | "currentRecovery" | "cycleSeq"
>;

export const ZONE_FIBONACCI_MAX_RECOVERY = ROTATING_ROOM_FIBONACCI_MAX_RECOVERY;

export function isZoneFibonacciStrategy(
  strategy?: StrategyGlobalKind | string | null,
): strategy is ZoneFibonacciStrategyKind {
  return strategy === "fibonacci" || strategy === "repeticao";
}

export function zoneFibonacciLedgerTag(strategy: ZoneFibonacciStrategyKind): "Fibo" | "Rep" {
  return strategy === "repeticao" ? "Rep" : "Fibo";
}

/** Passo da sequência (1-indexed): entrada → «Sinal»; recuperação → «Fibo 2» / «Rep 2». */
export function zoneFibonacciStepLabel(
  strategy: ZoneFibonacciStrategyKind,
  recovery: number,
  kind: "win" | "loss" | "recovery",
): string {
  const tag = zoneFibonacciLedgerTag(strategy);
  if (kind === "recovery" || recovery > 0 || kind === "loss") {
    return `${tag} ${recovery + 1}`;
  }
  return "Sinal";
}

export function zoneFibonacciSnapshotFromGlobal(
  snapshot: StrategyGlobalSnapshot,
  strategy: ZoneFibonacciStrategyKind,
): ZoneFibonacciSessionSlice {
  return strategy === "repeticao" ? snapshot.repeticao : snapshot.fibonacci;
}

export function zoneFibonacciSessionEnded(session: ZoneFibonacciSessionSlice): boolean {
  return !session.showTapeteSignal && session.currentRecovery === 0;
}

export function repeticaoActiveAsFibonacci(
  active: RotatingRoomRepeticaoActive,
): RotatingRoomFibonacciActive {
  return { ...active, absenceGap: active.streakGap };
}

export function activeFibonacciViewFromBet(bet: {
  strategy?: StrategyGlobalKind;
  signalId?: string;
  activeFibonacci?: RotatingRoomFibonacciActive | null;
  activeRepeticao?: RotatingRoomRepeticaoActive | null;
}): RotatingRoomFibonacciActive | null {
  if (!isZoneFibonacciStrategy(bet.strategy)) return null;
  if (bet.strategy === "fibonacci") {
    return bet.activeFibonacci ?? fibonacciActiveFromSignalId(bet.signalId ?? "") ?? null;
  }
  const rep = bet.activeRepeticao ?? repeticaoActiveFromSignalId(bet.signalId ?? "");
  return rep ? repeticaoActiveAsFibonacci(rep) : null;
}

export function activeZoneFromBet(bet: {
  strategy?: StrategyGlobalKind;
  signalId?: string;
  activeFibonacci?: RotatingRoomFibonacciActive | null;
  activeRepeticao?: RotatingRoomRepeticaoActive | null;
}): FibonacciZone | null {
  return activeFibonacciViewFromBet(bet)?.zone ?? null;
}

export function evaluateZoneFibonacciRound(resultNumber: number, zone: FibonacciZone): "W" | "L" {
  return evaluateFibonacciRound(resultNumber, zone);
}

export function ledgerKindForZoneFibonacciLoss(recovery: number): "loss" | "recovery" {
  return recovery >= ZONE_FIBONACCI_MAX_RECOVERY ? "loss" : "recovery";
}
