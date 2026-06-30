import {
  normalizeCrossingPatternKindStats,
  normalizeUmFatorMatchTierStats,
  umFatorMatchTierAproveitamentoPct,
} from "@/lib/roulette/entryWinBreakdown";
import type {
  CrossingPatternKindStats,
  RotatingRoomSessionStats,
  UmFatorMatchTierBucket,
  UmFatorMatchTierStats,
} from "@/lib/roulette/rotatingRoomStrategy";
import type { CrossingPatternKind } from "@/lib/roulette/doisFatoresPatternCrossing";
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

/** Gatilho 2 Fatores · padrões de cruzamento (activação global). */
export const ROTATING_ROOM_CROSSING_GATILHO_ID = "crossing" as const;

export type CrossingPatternGatilhoId =
  | "crossing-primary"
  | "crossing-secondary"
  | "crossing-tertiary";

export type RotatingRoomGatilhoReportId =
  | UmFatorTriggerMatchTier
  | CrossingPatternGatilhoId
  | "fibonacci";

export type CrossingPatternKindDefinition = {
  id: CrossingPatternGatilhoId;
  patternKind: CrossingPatternKind;
  statsKey: keyof CrossingPatternKindStats;
  labelKey: string;
};

/** Catálogo dos 3 gatilhos 2 Fatores por padrão de cruzamento. */
export const CROSSING_PATTERN_KIND_DEFINITIONS: readonly CrossingPatternKindDefinition[] = [
  { id: "crossing-primary", patternKind: "primary", statsKey: "primary", labelKey: "crossingPrimary" },
  {
    id: "crossing-secondary",
    patternKind: "secondary",
    statsKey: "secondary",
    labelKey: "crossingSecondary",
  },
  { id: "crossing-tertiary", patternKind: "tertiary", statsKey: "tertiary", labelKey: "crossingTertiary" },
] as const;

export type UmFatorTriggerTierReportRow = {
  id: RotatingRoomGatilhoReportId;
  labelKey: string;
  wins: number;
  losses: number;
  total: number;
  accuracyPct: number | null;
  enabled: boolean;
  /** Interruptor de activação no painel (só em linhas configuráveis). */
  toggleable: boolean;
};

export function buildUmFatorTriggerTierReport(
  stats: RotatingRoomSessionStats | undefined,
  enabledTriggers?: Partial<Record<UmFatorTriggerMatchTier, boolean>>,
): UmFatorTriggerTierReportRow[] {
  const tier = normalizeUmFatorMatchTierStats(stats?.umFatorMatchTier);
  return UM_FATOR_TRIGGER_TIER_DEFINITIONS.map((def) =>
    rowFromBucket(def, tier[def.statsKey], enabledTriggers?.[def.id] !== false, true),
  );
}

function buildCrossingPatternKindReport(
  crossingStats: RotatingRoomSessionStats | undefined,
  crossingEnabled: boolean,
): UmFatorTriggerTierReportRow[] {
  const kindStats = normalizeCrossingPatternKindStats(crossingStats?.crossingPatternKind);
  return CROSSING_PATTERN_KIND_DEFINITIONS.map((def, index) =>
    rowFromBucket(
      def,
      kindStats[def.statsKey],
      crossingEnabled,
      index === 0,
    ),
  );
}

export function buildFibonacciGatilhoReportRow(
  stats: RotatingRoomSessionStats | undefined,
  enabled: boolean,
): UmFatorTriggerTierReportRow {
  const wins = Math.max(0, stats?.wins ?? 0);
  const losses = Math.max(0, stats?.losses ?? 0);
  return rowFromBucket(
    { id: "fibonacci", labelKey: "fibonacci" },
    { wins, losses },
    enabled,
    true,
  );
}

export function buildRotatingRoomGatilhoTriggerReport(
  umStats: RotatingRoomSessionStats | undefined,
  crossingStats: RotatingRoomSessionStats | undefined,
  enabledTriggers?: Partial<Record<UmFatorTriggerMatchTier | "crossing" | "fibonacci", boolean>>,
  fibonacciStats?: RotatingRoomSessionStats,
): UmFatorTriggerTierReportRow[] {
  const crossingEnabled = enabledTriggers?.crossing !== false;
  const fibonacciEnabled = enabledTriggers?.fibonacci !== false;
  return [
    buildFibonacciGatilhoReportRow(fibonacciStats, fibonacciEnabled),
    ...buildCrossingPatternKindReport(crossingStats, crossingEnabled),
    ...buildUmFatorTriggerTierReport(umStats, enabledTriggers),
  ];
}

function rowFromBucket(
  def: { id: string; labelKey: string },
  bucket: UmFatorMatchTierBucket,
  enabled: boolean,
  toggleable: boolean,
): UmFatorTriggerTierReportRow {
  const wins = Math.max(0, bucket.wins);
  const losses = Math.max(0, bucket.losses);
  return {
    id: def.id as RotatingRoomGatilhoReportId,
    labelKey: def.labelKey,
    wins,
    losses,
    total: wins + losses,
    accuracyPct: umFatorMatchTierAproveitamentoPct({ wins, losses }),
    enabled,
    toggleable,
  };
}
