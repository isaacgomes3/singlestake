/**
 * Fibonacci e Repetição — mesma família operacional (stakes 1-1-2-3-5-8-13-21, payout 2:1).
 * Só muda a leitura do gatilho (ausência de zona vs ausência de repetição).
 */
import type { StrategyGlobalKind, StrategyGlobalSnapshot } from "@/lib/roulette/strategyGlobalTypes";
import {
  evaluateFibonacciRound,
  fibonacciActiveFromSignalId,
  type FibonacciZone,
  type RotatingRoomFibonacciActive,
} from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import {
  repeticaoActiveFromSignalId,
  type RotatingRoomRepeticaoMachineState,
  type RotatingRoomRepeticaoActive,
} from "@/lib/roulette/rotatingRoomRepeticaoStrategy";
import type { RotatingRoomFibonacciMachineState } from "@/lib/roulette/rotatingRoomFibonacciStrategy";

export type ZoneFibonacciStrategyKind = Extract<StrategyGlobalKind, "fibonacci" | "repeticao">;

export type ZoneFibonacciSessionSlice = Pick<
  StrategyGlobalSnapshot["fibonacci"],
  "showTapeteSignal" | "currentTableId" | "currentRecovery" | "cycleSeq"
>;

/** Igual a `ROTATING_ROOM_FIBONACCI_MAX_RECOVERY` — literal para evitar TDZ em ciclo ESM. */
export const ZONE_FIBONACCI_MAX_RECOVERY = 7;

export function isZoneFibonacciStrategy(
  strategy?: StrategyGlobalKind | string | null,
): strategy is ZoneFibonacciStrategyKind {
  return strategy === "fibonacci" || strategy === "repeticao";
}

/** Inferir estratégia Fib/Repetição só pelo signalId (ex.: `rep:227:…` ou `227:column:…`). */
export function zoneFibonacciStrategyFromSignalId(
  signalId?: string | null,
): ZoneFibonacciStrategyKind | null {
  const id = signalId?.trim() ?? "";
  if (!id) return null;
  if (id.startsWith("rep:")) return "repeticao";
  if (fibonacciActiveFromSignalId(id)) return "fibonacci";
  return null;
}

export function isZoneFibonacciSignalId(signalId?: string | null): boolean {
  return zoneFibonacciStrategyFromSignalId(signalId) != null;
}

/** Aposta aberta / liquidação — strategy explícita ou inferida do signalId. */
export function isZoneFibonacciBet(bet: {
  strategy?: StrategyGlobalKind | string | null;
  signalId?: string | null;
  activeFibonacci?: unknown;
  activeRepeticao?: unknown;
}): bet is { strategy: ZoneFibonacciStrategyKind } {
  if (isZoneFibonacciStrategy(bet.strategy)) return true;
  if (bet.activeRepeticao != null) return true;
  if (bet.activeFibonacci != null) return true;
  return isZoneFibonacciSignalId(bet.signalId);
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

/** Ciclo activo (entrada ou gale) — Fibonacci. */
export function fibonacciMachineInCycle(machine: Pick<RotatingRoomFibonacciMachineState, "cycleTableId" | "cycleZone">): boolean {
  return machine.cycleTableId != null && machine.cycleZone != null;
}

/** Ciclo activo (entrada ou gale) — Repetição. */
export function repeticaoMachineInCycle(
  machine: Pick<RotatingRoomRepeticaoMachineState, "cycleTableId" | "cycleZone">,
): boolean {
  return machine.cycleTableId != null && machine.cycleZone != null;
}

/** Uma indicação de cada vez — bloqueia nova entrada enquanto Fib ou Rep estiver em jogo. */
export function anyZoneFibonacciMachineInCycle(
  fibonacci: Pick<RotatingRoomFibonacciMachineState, "cycleTableId" | "cycleZone">,
  repeticao: Pick<RotatingRoomRepeticaoMachineState, "cycleTableId" | "cycleZone">,
): boolean {
  return fibonacciMachineInCycle(fibonacci) || repeticaoMachineInCycle(repeticao);
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
