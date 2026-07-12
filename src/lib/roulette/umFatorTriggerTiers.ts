import {
  normalizeCrossingAbsenceAxisStats,
  normalizeCrossingOppositeAbsenceAxisStats,
  normalizeCrossingPatternKindStats,
  normalizeUmFatorMatchTierStats,
  umFatorMatchTierAproveitamentoPct,
} from "@/lib/roulette/entryWinBreakdown";
import type {
  CrossingAbsenceAxisStats,
  CrossingOppositeAbsenceAxisStats,
  CrossingPatternKindStats,
  RotatingRoomSessionStats,
  UmFatorMatchTierBucket,
  UmFatorMatchTierStats,
} from "@/lib/roulette/rotatingRoomStrategy";
import type { CrossingPatternKind } from "@/lib/roulette/doisFatoresPatternCrossing";
import type { UmFatorTriggerMatchTier } from "@/lib/roulette/umFatorStrategy";
import type { RotatingRoomGatilhoEnableMap } from "@/lib/roulette/umFatorTriggerEnable";

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

export type CrossingAbsenceAxisGatilhoId = "crossing-cor-altura" | "crossing-altura-paridade";

export type CrossingOppositeAbsenceAxisGatilhoId =
  | "crossing-opposite-cor-altura"
  | "crossing-opposite-altura-paridade";

export type RotatingRoomGatilhoReportId =
  | UmFatorTriggerMatchTier
  | CrossingPatternGatilhoId
  | CrossingAbsenceAxisGatilhoId
  | CrossingOppositeAbsenceAxisGatilhoId
  | "fibonacci"
  | "repeticao"
  | "rotacao"
  | "kto2fcruzamento"
  | "tres3fatores";

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

export type CrossingAbsenceAxisDefinition = {
  id: CrossingAbsenceAxisGatilhoId;
  statsKey: keyof CrossingAbsenceAxisStats;
  labelKey: string;
};

/** Catálogo dos gatilhos 2 Fatores por ausência de cruzamento. */
export const CROSSING_ABSENCE_AXIS_DEFINITIONS: readonly CrossingAbsenceAxisDefinition[] = [
  { id: "crossing-cor-altura", statsKey: "corAltura", labelKey: "crossingCorAltura" },
  {
    id: "crossing-altura-paridade",
    statsKey: "alturaParidade",
    labelKey: "crossingAlturaParidade",
  },
] as const;

export type CrossingOppositeAbsenceAxisDefinition = {
  id: CrossingOppositeAbsenceAxisGatilhoId;
  statsKey: keyof CrossingOppositeAbsenceAxisStats;
  labelKey: string;
};

/** Catálogo dos gatilhos 2 Fatores por ausência oposta de cruzamento. */
export const CROSSING_OPPOSITE_ABSENCE_AXIS_DEFINITIONS: readonly CrossingOppositeAbsenceAxisDefinition[] =
  [
    {
      id: "crossing-opposite-cor-altura",
      statsKey: "corAltura",
      labelKey: "crossingOppositeCorAltura",
    },
    {
      id: "crossing-opposite-altura-paridade",
      statsKey: "alturaParidade",
      labelKey: "crossingOppositeAlturaParidade",
    },
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

function buildCrossingAbsenceAxisReport(
  crossingStats: RotatingRoomSessionStats | undefined,
  enabledTriggers?: Partial<
    Pick<RotatingRoomGatilhoEnableMap, "crossingCorAltura" | "crossingAlturaParidade">
  >,
): UmFatorTriggerTierReportRow[] {
  const axisStats = normalizeCrossingAbsenceAxisStats(crossingStats?.crossingAbsenceAxis);
  return CROSSING_ABSENCE_AXIS_DEFINITIONS.map((def) =>
    rowFromBucket(
      def,
      axisStats[def.statsKey],
      enabledTriggers?.[def.statsKey === "corAltura" ? "crossingCorAltura" : "crossingAlturaParidade"] ===
        true,
      true,
    ),
  );
}

function buildCrossingOppositeAbsenceAxisReport(
  crossingStats: RotatingRoomSessionStats | undefined,
  enabledTriggers?: Partial<
    Pick<
      RotatingRoomGatilhoEnableMap,
      "crossingCorAlturaOpposite" | "crossingAlturaParidadeOpposite"
    >
  >,
): UmFatorTriggerTierReportRow[] {
  const axisStats = normalizeCrossingOppositeAbsenceAxisStats(
    crossingStats?.crossingOppositeAbsenceAxis,
  );
  return CROSSING_OPPOSITE_ABSENCE_AXIS_DEFINITIONS.map((def) =>
    rowFromBucket(
      def,
      axisStats[def.statsKey],
      enabledTriggers?.[
        def.statsKey === "corAltura" ? "crossingCorAlturaOpposite" : "crossingAlturaParidadeOpposite"
      ] === true,
      true,
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

export function buildRotacaoGatilhoReportRow(
  stats: RotatingRoomSessionStats | undefined,
  enabled: boolean,
): UmFatorTriggerTierReportRow {
  const wins = Math.max(0, stats?.wins ?? 0);
  const losses = Math.max(0, stats?.losses ?? 0);
  return rowFromBucket(
    { id: "rotacao", labelKey: "rotacao" },
    { wins, losses },
    enabled,
    true,
  );
}

export function buildKto2fGatilhoReportRow(
  stats: RotatingRoomSessionStats | undefined,
  enabled: boolean,
): UmFatorTriggerTierReportRow {
  const wins = Math.max(0, stats?.wins ?? 0);
  const losses = Math.max(0, stats?.losses ?? 0);
  return rowFromBucket(
    { id: "kto2fcruzamento", labelKey: "kto2fcruzamento" },
    { wins, losses },
    enabled,
    true,
  );
}

export function buildTres3fatoresGatilhoReportRow(
  stats: RotatingRoomSessionStats | undefined,
  enabled: boolean,
): UmFatorTriggerTierReportRow {
  const wins = Math.max(0, stats?.wins ?? 0);
  const losses = Math.max(0, stats?.losses ?? 0);
  return rowFromBucket(
    { id: "tres3fatores", labelKey: "tres3fatores" },
    { wins, losses },
    enabled,
    true,
  );
}

export function buildRepeticaoGatilhoReportRow(
  stats: RotatingRoomSessionStats | undefined,
  enabled: boolean,
): UmFatorTriggerTierReportRow {
  const wins = Math.max(0, stats?.wins ?? 0);
  const losses = Math.max(0, stats?.losses ?? 0);
  return rowFromBucket(
    { id: "repeticao", labelKey: "repeticao" },
    { wins, losses },
    enabled,
    true,
  );
}

export function buildRotatingRoomGatilhoTriggerReport(
  umStats: RotatingRoomSessionStats | undefined,
  crossingStats: RotatingRoomSessionStats | undefined,
  enabledTriggers?: Partial<
    Record<
      UmFatorTriggerMatchTier | "crossing" | "fibonacci" | "repeticao" | "rotacao" | "kto2fcruzamento" | "tres3fatores",
      boolean
    >
  >,
  fibonacciStats?: RotatingRoomSessionStats,
  rotacaoStats?: RotatingRoomSessionStats,
  repeticaoStats?: RotatingRoomSessionStats,
  kto2fStats?: RotatingRoomSessionStats,
  tres3fStats?: RotatingRoomSessionStats,
): UmFatorTriggerTierReportRow[] {
  const crossingEnabled = enabledTriggers?.crossing !== false;
  const fibonacciEnabled = enabledTriggers?.fibonacci !== false;
  const repeticaoEnabled = enabledTriggers?.repeticao === true;
  const rotacaoEnabled = enabledTriggers?.rotacao === true;
  const kto2fEnabled = enabledTriggers?.kto2fcruzamento === true;
  const tres3fEnabled = enabledTriggers?.tres3fatores === true;
  return [
    buildFibonacciGatilhoReportRow(fibonacciStats, fibonacciEnabled),
    buildRepeticaoGatilhoReportRow(repeticaoStats, repeticaoEnabled),
    buildRotacaoGatilhoReportRow(rotacaoStats, rotacaoEnabled),
    buildKto2fGatilhoReportRow(kto2fStats, kto2fEnabled),
    buildTres3fatoresGatilhoReportRow(tres3fStats, tres3fEnabled),
    ...buildCrossingAbsenceAxisReport(crossingStats, enabledTriggers),
    ...buildCrossingOppositeAbsenceAxisReport(crossingStats, enabledTriggers),
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
