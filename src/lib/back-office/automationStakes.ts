import type { StrategyGlobalLedgerEntry } from "@/lib/roulette/strategyGlobalTypes";
import { UM_FATOR_MAX_RECOVERY } from "@/lib/roulette/umFatorStrategy";

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

export function resolveLedgerEntryStake(
  entry: StrategyGlobalLedgerEntry,
  _balance?: number,
  baseStake = ROULETTE_AUTOMATION_BASE_STAKE,
): number {
  if (typeof entry.stake === "number" && entry.stake > 0 && Number.isFinite(entry.stake)) {
    return entry.stake;
  }
  return stakeForRecovery(entry.recovery, undefined, baseStake);
}
