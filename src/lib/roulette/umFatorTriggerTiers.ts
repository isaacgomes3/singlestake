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
  { id: "three", statsKey: "threeEqualFactors", labelKey: "threeFactors" },
] as const;

/** Gatilho 2 Fatores · padrões de cruzamento (primário/secundário/terciário). */
export const ROTATING_ROOM_CROSSING_GATILHO_ID = "crossing" as const;

export type UmFatorTriggerTierReportRow = {
  id: UmFatorTriggerMatchTier | typeof ROTATING_ROOM_CROSSING_GATILHO_ID;
  labelKey: string;
  wins: number;
  losses: number;
  total: number;
  accuracyPct: number | null;
  enabled: boolean;
};

export function buildUmFatorTriggerTierReport(
  stats: RotatingRoomSessionStats | undefined,
  enabledTriggers?: Partial<Record<UmFatorTriggerMatchTier, boolean>>,
): UmFatorTriggerTierReportRow[] {
  const tier = normalizeUmFatorMatchTierStats(stats?.umFatorMatchTier);
  return UM_FATOR_TRIGGER_TIER_DEFINITIONS.map((def) =>
    rowFromBucket(def, tier[def.statsKey], enabledTriggers?.[def.id] !== false),
  );
}

export function buildRotatingRoomGatilhoTriggerReport(
  umStats: RotatingRoomSessionStats | undefined,
  crossingStats: RotatingRoomSessionStats | undefined,
  enabledTriggers?: Partial<Record<UmFatorTriggerMatchTier | "crossing", boolean>>,
): UmFatorTriggerTierReportRow[] {
  const crossingWins = Math.max(0, crossingStats?.wins ?? 0);
  const crossingLosses = Math.max(0, crossingStats?.losses ?? 0);
  const crossingTotal = crossingWins + crossingLosses;
  const crossingRow: UmFatorTriggerTierReportRow = {
    id: ROTATING_ROOM_CROSSING_GATILHO_ID,
    labelKey: "crossingPattern",
    wins: crossingWins,
    losses: crossingLosses,
    total: crossingTotal,
    accuracyPct:
      crossingTotal > 0 ? Math.round((1000 * crossingWins) / crossingTotal) / 10 : null,
    enabled: enabledTriggers?.crossing !== false,
  };
  return [crossingRow, ...buildUmFatorTriggerTierReport(umStats, enabledTriggers)];
}

function rowFromBucket(
  def: UmFatorTriggerTierDefinition,
  bucket: UmFatorMatchTierBucket,
  enabled: boolean,
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
    enabled,
  };
}
