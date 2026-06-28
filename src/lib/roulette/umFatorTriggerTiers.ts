import {
  normalizeUmFatorMatchTierStats,
  umFatorMatchTierAproveitamentoPct,
} from "@/lib/roulette/entryWinBreakdown";
import type {
  RotatingRoomSessionStats,
  UmFatorMatchTierBucket,
  UmFatorMatchTierStats,
} from "@/lib/roulette/rotatingRoomStrategy";
import type { UmFatorTriggerMatchTier } from "@/lib/roulette/umFatorStrategy";

/** Chave i18n em `automationStats.triggers.*` — adicione entradas ao registar novos gatilhos. */
export type UmFatorTriggerTierDefinition = {
  id: UmFatorTriggerMatchTier;
  statsKey: keyof UmFatorMatchTierStats;
  labelKey: string;
};

/**
 * Catálogo de gatilhos 1 Fator. Novos gatilhos: alargar o tipo, as estatísticas e acrescentar aqui.
 */
export const UM_FATOR_TRIGGER_TIER_DEFINITIONS: readonly UmFatorTriggerTierDefinition[] = [
  { id: "two", statsKey: "twoEqualFactors", labelKey: "twoFactors" },
  { id: "three", statsKey: "threeEqualFactors", labelKey: "threeFactors" },
] as const;

export type UmFatorTriggerTierReportRow = {
  id: UmFatorTriggerMatchTier;
  labelKey: string;
  wins: number;
  losses: number;
  total: number;
  accuracyPct: number | null;
};

export function buildUmFatorTriggerTierReport(
  stats: RotatingRoomSessionStats | undefined,
): UmFatorTriggerTierReportRow[] {
  const tier = normalizeUmFatorMatchTierStats(stats?.umFatorMatchTier);
  return UM_FATOR_TRIGGER_TIER_DEFINITIONS.map((def) => rowFromBucket(def, tier[def.statsKey]));
}

function rowFromBucket(
  def: UmFatorTriggerTierDefinition,
  bucket: UmFatorMatchTierBucket,
): UmFatorTriggerTierReportRow {
  const wins = Math.max(0, bucket.wins);
  const losses = Math.max(0, bucket.losses);
  return {
    id: def.id,
    labelKey: def.labelKey,
    wins,
    losses,
    total: wins + losses,
    accuracyPct: umFatorMatchTierAproveitamentoPct({ wins, losses }),
  };
}
