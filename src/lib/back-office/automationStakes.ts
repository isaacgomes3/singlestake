import type { StrategyGlobalLedgerEntry } from "@/lib/roulette/strategyGlobalTypes";
import { UM_FATOR_MAX_RECOVERY } from "@/lib/roulette/umFatorStrategy";
import { stakeUnitsAtRecovery } from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import { isZoneFibonacciStrategy } from "@/lib/roulette/zoneFibonacciFamily";
import { stakeForKto2fRecovery } from "@/lib/roulette/rotatingRoomKto2fStrategy";
import { stakeForIce3fAutomation } from "@/lib/roulette/rotatingRoomIce3fStrategy";

/** Stake base da automação e extensão: R$ 50 → 100 → 200 → 400 → 800 → 1600. */
export const EXTENSION_REAL_BASE_STAKE = 50;
export const ROULETTE_AUTOMATION_BASE_STAKE = EXTENSION_REAL_BASE_STAKE;

/** baseStake × 2^recuperação (máx. rec5). */
export function stakeForRecovery(
  recovery: number,
  _balance?: number,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): number {
  const level = Math.max(0, Math.floor(recovery));
  if (level > UM_FATOR_MAX_RECOVERY) return baseStake;
  return baseStake * 2 ** level;
}

/** baseStake × nível Fibonacci (1-1-2-3-5-8-13-21). */
export function stakeForFibonacciRecovery(
  recovery: number,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): number {
  return baseStake * stakeUnitsAtRecovery(Math.max(0, Math.floor(recovery)));
}

export function resolveLedgerEntryStake(
  entry: StrategyGlobalLedgerEntry,
  _balance?: number,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): number {
  if (typeof entry.stake === "number" && entry.stake > 0 && Number.isFinite(entry.stake)) {
    return entry.stake;
  }
  if (isZoneFibonacciStrategy(entry.strategy)) {
    return stakeForFibonacciRecovery(entry.recovery, baseStake);
  }
  if (entry.strategy === "kto2fcruzamento") {
    return stakeForKto2fRecovery(entry.recovery);
  }
  if (entry.strategy === "tres3fatores") {
    // Ficha × 3 factores × 2^gale (entrada 1u). Preferir entry.stake quando existir.
    const unitScale = 2 ** Math.max(0, Math.floor(entry.recovery));
    return stakeForIce3fAutomation(unitScale, baseStake);
  }
  return stakeForRecovery(entry.recovery, undefined, baseStake);
}
