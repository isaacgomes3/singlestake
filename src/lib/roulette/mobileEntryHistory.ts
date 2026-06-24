import { doisFatoresFactorLabel, type DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";
import {
  formatMobileLastNumbersChain,
  mobileSignalConfidenceFromBucketGap,
} from "@/lib/roulette/mobileSignalUi";
import type { StrategyGlobalKind, StrategyGlobalLedgerEntry } from "@/lib/roulette/strategyGlobalTypes";

export type MobileEntryHistoryItem = {
  id: string;
  ts: number;
  tableId: number;
  won: boolean;
  recovery: number;
  resultNumber: number | null;
  factorsLabel: string;
  triggerChain: string;
  confidence: string;
  galeWon: number | null;
};

function compactFactorLabel(f: DoisFatoresFactor): string {
  return doisFatoresFactorLabel(f).replace(/\s+/g, " ").trim();
}

export function mobileFactorsLabel(
  factor1: DoisFatoresFactor | undefined,
  factor2: DoisFatoresFactor | undefined,
  singleFactor: boolean,
): string {
  if (!factor1) return "—";
  if (singleFactor || !factor2) return compactFactorLabel(factor1);
  return `${compactFactorLabel(factor1)} • ${compactFactorLabel(factor2)}`;
}

export function mobileEntryHistoryFromLedger(
  entries: readonly StrategyGlobalLedgerEntry[],
  singleFactor: boolean,
  limit = 8,
): MobileEntryHistoryItem[] {
  return entries
    .filter((e) => e.kind === "win" || e.kind === "loss")
    .slice(-limit)
    .reverse()
    .map((entry) => ({
      id: `${entry.ts}-${entry.tableId}-${entry.kind}`,
      ts: entry.ts,
      tableId: entry.tableId,
      won: entry.won,
      recovery: entry.recovery,
      resultNumber: entry.resultNumber ?? null,
      factorsLabel: mobileFactorsLabel(entry.factor1, entry.factor2, singleFactor),
      triggerChain: formatMobileLastNumbersChain(entry.triggerNumbers ?? []),
      confidence: mobileSignalConfidenceFromBucketGap(entry.bucketGap ?? 0),
      galeWon: entry.won ? Math.min(entry.recovery + 1, 5) : null,
    }));
}

export function strategyKindIsSingleFactor(kind: StrategyGlobalKind): boolean {
  return kind === "um1fator";
}
