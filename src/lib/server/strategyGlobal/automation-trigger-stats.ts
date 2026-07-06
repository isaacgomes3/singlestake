import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import { buildRotatingRoomGatilhoTriggerReport } from "@/lib/roulette/umFatorTriggerTiers";
import { normalizeFibonacciZoneKindStats, umFatorMatchTierAproveitamentoPct } from "@/lib/roulette/entryWinBreakdown";
import { normalizeFibonacciZoneAbsenceSpins } from "@/lib/roulette/fibonacciAbsencePrefs";
import { normalizeRepeticaoZoneAbsenceSpins } from "@/lib/roulette/repeticaoAbsencePrefs";
import { buildZoneAbsenceFilterStats, emptyZoneAbsenceFilterStats } from "@/lib/roulette/zoneAbsenceFilterStats";
import {
  buildCrossingAbsenceFilterStats,
  emptyCrossingAbsenceFilterStats,
} from "@/lib/roulette/crossingAbsenceFilterStats";
import {
  buildCrossingOppositeAbsenceFilterStats,
  emptyCrossingOppositeAbsenceFilterStats,
} from "@/lib/roulette/crossingOppositeAbsenceFilterStats";
import {
  buildCrossingReturnStreakStats,
  emptyCrossingReturnStreakStats,
  lowestReturnStreakFilterWithMaxWinsOne,
} from "@/lib/roulette/crossingReturnStreakStats";
import { normalizeCrossingAxisAbsenceSpins } from "@/lib/roulette/crossingAbsencePrefs";
import { normalizeCrossingOppositeAxisAbsenceSpins } from "@/lib/roulette/crossingOppositeAbsencePrefs";
import { normalizeCrossingAbsenceAxisStats, normalizeCrossingOppositeAbsenceAxisStats } from "@/lib/roulette/entryWinBreakdown";
import { getExtensionSourceStatus } from "@/lib/server/extensionSource";
import { getAutomationConfig, initAutomationConfig, saveAutomationConfig } from "@/lib/server/automationSim/config";
import {
  applyCrossingAutoAbsenceRuntime,
  crossingAutoAbsencePatchFromHistories,
} from "@/lib/server/automationSim/crossing-auto-absence";
import {
  applyCrossingOppositeAutoAbsenceRuntime,
  crossingOppositeAutoAbsencePatchFromHistories,
} from "@/lib/server/automationSim/crossing-opposite-auto-absence";
import { getStrategyGlobalState } from "@/lib/server/strategyGlobal/persistence";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import type { RotatingRoomGatilhoEnableMap } from "@/lib/roulette/umFatorTriggerEnable";

function sessionAccuracyPct(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total <= 0) return null;
  return (100 * wins) / total;
}

function fibonacciZoneStatsRow(
  stats: RotatingRoomSessionStats | undefined,
  kind: "dozen" | "column",
  enabled: boolean,
  absenceSpins: number,
): AutomationStatsDto["fibonacci"]["dozen"] {
  const bucket = normalizeFibonacciZoneKindStats(stats?.fibonacciZoneKind)[kind];
  const wins = Math.max(0, bucket.wins);
  const losses = Math.max(0, bucket.losses);
  return {
    wins,
    losses,
    total: wins + losses,
    accuracyPct: umFatorMatchTierAproveitamentoPct({ wins, losses }),
    enabled,
    absenceSpins,
  };
}

function fibonacciStatsFromState(
  fibonacciStats: RotatingRoomSessionStats | undefined,
  enabledTriggers: RotatingRoomGatilhoEnableMap,
  config: ReturnType<typeof getAutomationConfig>,
): AutomationStatsDto["fibonacci"] {
  const masterOn = enabledTriggers.fibonacci !== false;
  const absenceByZone = normalizeFibonacciZoneAbsenceSpins(config);
  return {
    enabled: masterOn,
    absenceSpins: absenceByZone.dozen,
    dozen: fibonacciZoneStatsRow(
      fibonacciStats,
      "dozen",
      enabledTriggers.fibonacciDozen !== false,
      absenceByZone.dozen,
    ),
    column: fibonacciZoneStatsRow(
      fibonacciStats,
      "column",
      enabledTriggers.fibonacciColumn !== false,
      absenceByZone.column,
    ),
  };
}

function repeticaoZoneStatsRow(
  stats: RotatingRoomSessionStats | undefined,
  kind: "dozen" | "column",
  enabled: boolean,
  absenceSpins: number,
): AutomationStatsDto["repeticao"]["dozen"] {
  const bucket = normalizeFibonacciZoneKindStats(stats?.repeticaoZoneKind)[kind];
  const wins = Math.max(0, bucket.wins);
  const losses = Math.max(0, bucket.losses);
  return {
    wins,
    losses,
    total: wins + losses,
    accuracyPct: umFatorMatchTierAproveitamentoPct({ wins, losses }),
    enabled,
    absenceSpins,
  };
}

function repeticaoStatsFromState(
  repeticaoStats: RotatingRoomSessionStats | undefined,
  enabledTriggers: RotatingRoomGatilhoEnableMap,
  config: ReturnType<typeof getAutomationConfig>,
): AutomationStatsDto["repeticao"] {
  const masterOn = enabledTriggers.repeticao === true;
  const absenceByZone = normalizeRepeticaoZoneAbsenceSpins(config);
  return {
    enabled: masterOn,
    absenceSpins: absenceByZone.dozen,
    dozen: repeticaoZoneStatsRow(
      repeticaoStats,
      "dozen",
      enabledTriggers.repeticaoDozen !== false && masterOn,
      absenceByZone.dozen,
    ),
    column: repeticaoZoneStatsRow(
      repeticaoStats,
      "column",
      enabledTriggers.repeticaoColumn !== false && masterOn,
      absenceByZone.column,
    ),
  };
}

function crossingAbsenceAxisStatsRow(
  stats: RotatingRoomSessionStats | undefined,
  kind: "corAltura" | "alturaParidade",
  enabled: boolean,
  absenceSpins: number,
  absenceAuto: boolean,
  maxAbsenceInWindow: number,
): AutomationStatsDto["crossingAbsence"]["corAltura"] {
  const bucket = normalizeCrossingAbsenceAxisStats(stats?.crossingAbsenceAxis)[kind];
  const wins = Math.max(0, bucket.wins);
  const losses = Math.max(0, bucket.losses);
  return {
    wins,
    losses,
    total: wins + losses,
    accuracyPct: umFatorMatchTierAproveitamentoPct({ wins, losses }),
    enabled,
    absenceSpins,
    absenceAuto,
    maxAbsenceInWindow,
  };
}

function crossingOppositeAbsenceAxisStatsRow(
  stats: RotatingRoomSessionStats | undefined,
  kind: "corAltura" | "alturaParidade",
  enabled: boolean,
  absenceSpins: number,
  absenceAuto: boolean,
  maxAbsenceInWindow: number,
): AutomationStatsDto["crossingOppositeAbsence"]["corAltura"] {
  const bucket = normalizeCrossingOppositeAbsenceAxisStats(stats?.crossingOppositeAbsenceAxis)[kind];
  const wins = Math.max(0, bucket.wins);
  const losses = Math.max(0, bucket.losses);
  return {
    wins,
    losses,
    total: wins + losses,
    accuracyPct: umFatorMatchTierAproveitamentoPct({ wins, losses }),
    enabled,
    absenceSpins,
    absenceAuto,
    maxAbsenceInWindow,
  };
}

function crossingAbsenceStatsFromState(
  crossingStats: RotatingRoomSessionStats | undefined,
  enabledTriggers: RotatingRoomGatilhoEnableMap,
  config: ReturnType<typeof getAutomationConfig>,
  absenceFilter: AutomationStatsDto["absenceFilterStats"]["crossing"],
): AutomationStatsDto["crossingAbsence"] {
  const absenceByAxis = normalizeCrossingAxisAbsenceSpins(config);
  return {
    corAltura: crossingAbsenceAxisStatsRow(
      crossingStats,
      "corAltura",
      enabledTriggers.crossingCorAltura === true,
      absenceByAxis.corAltura,
      config.crossingCorAlturaAbsenceAuto === true,
      absenceFilter.corAltura.maxAbsenceInWindow,
    ),
    alturaParidade: crossingAbsenceAxisStatsRow(
      crossingStats,
      "alturaParidade",
      enabledTriggers.crossingAlturaParidade === true,
      absenceByAxis.alturaParidade,
      config.crossingAlturaParidadeAbsenceAuto === true,
      absenceFilter.alturaParidade.maxAbsenceInWindow,
    ),
  };
}

function crossingOppositeAbsenceStatsFromState(
  crossingStats: RotatingRoomSessionStats | undefined,
  enabledTriggers: RotatingRoomGatilhoEnableMap,
  config: ReturnType<typeof getAutomationConfig>,
  returnStreak: AutomationStatsDto["absenceFilterStats"]["crossingReturnStreak"],
): AutomationStatsDto["crossingOppositeAbsence"] {
  const absenceByAxis = normalizeCrossingOppositeAxisAbsenceSpins(config);
  return {
    corAltura: crossingOppositeAbsenceAxisStatsRow(
      crossingStats,
      "corAltura",
      enabledTriggers.crossingCorAlturaOpposite === true,
      absenceByAxis.corAltura,
      config.crossingCorAlturaOppositeAbsenceAuto === true,
      lowestReturnStreakFilterWithMaxWinsOne(returnStreak.corAltura) ?? 0,
    ),
    alturaParidade: crossingOppositeAbsenceAxisStatsRow(
      crossingStats,
      "alturaParidade",
      enabledTriggers.crossingAlturaParidadeOpposite === true,
      absenceByAxis.alturaParidade,
      config.crossingAlturaParidadeOppositeAbsenceAuto === true,
      lowestReturnStreakFilterWithMaxWinsOne(returnStreak.alturaParidade) ?? 0,
    ),
  };
}

function rotatingTableHistoriesFromState(
  state: ReturnType<typeof getStrategyGlobalState>,
): Record<number, readonly number[]> {
  const out: Record<number, readonly number[]> = {};
  for (const id of state.rotatingRoomTableIds) {
    const list = state.tableHistories[String(id)];
    if (list?.length) out[id] = list;
  }
  return out;
}

function safeAbsenceFilterStats(
  state: ReturnType<typeof getStrategyGlobalState>,
): AutomationStatsDto["absenceFilterStats"] {
  try {
    const histories = rotatingTableHistoriesFromState(state);
    const zone = buildZoneAbsenceFilterStats(histories);
    const crossing = buildCrossingAbsenceFilterStats(histories);
    const crossingOpposite = buildCrossingOppositeAbsenceFilterStats(histories);
    const crossingReturnStreak = buildCrossingReturnStreakStats(histories);
    return { ...zone, crossing, crossingOpposite, crossingReturnStreak };
  } catch (err) {
    console.warn("[AutomationStats] absenceFilterStats falhou — fallback vazio:", err);
    const empty = emptyZoneAbsenceFilterStats();
    return {
      ...empty,
      crossing: emptyCrossingAbsenceFilterStats(),
      crossingOpposite: emptyCrossingOppositeAbsenceFilterStats(),
      crossingReturnStreak: emptyCrossingReturnStreakStats(),
    };
  }
}

export function buildAutomationTriggerStatsDto(): AutomationStatsDto {
  const state = getStrategyGlobalState();
  const stats = state.um1fator.stats;
  const crossingStats = state.dois2fatores.stats;
  const wins = Math.max(0, stats.wins);
  const losses = Math.max(0, stats.losses);
  const extension = getExtensionSourceStatus();
  let config = getAutomationConfig();
  const absenceFilterStats = safeAbsenceFilterStats(state);
  const histories = rotatingTableHistoriesFromState(state);
  const autoPatch = crossingAutoAbsencePatchFromHistories(config, histories);
  if (autoPatch) {
    config = applyCrossingAutoAbsenceRuntime({ ...config, ...autoPatch }, histories);
    void saveAutomationConfig(autoPatch);
  }
  const oppositeAutoPatch = crossingOppositeAutoAbsencePatchFromHistories(config, histories);
  if (oppositeAutoPatch) {
    config = applyCrossingOppositeAutoAbsenceRuntime({ ...config, ...oppositeAutoPatch }, histories);
    void saveAutomationConfig(oppositeAutoPatch);
  }
  const enabledTriggers = config.enabledTriggers;

  return {
    updatedAt: state.updatedAt,
    source: extension.active ? "extension" : state.revision > 0 ? "server" : null,
    session: {
      wins,
      losses,
      total: wins + losses,
      accuracyPct: sessionAccuracyPct(wins, losses),
    },
    triggers: buildRotatingRoomGatilhoTriggerReport(
      stats,
      crossingStats,
      enabledTriggers,
      state.fibonacci.stats,
      state.rotacao.stats,
      state.repeticao.stats,
    ),
    fibonacci: fibonacciStatsFromState(
      state.fibonacci.stats,
      enabledTriggers,
      config,
    ),
    repeticao: repeticaoStatsFromState(
      state.repeticao.stats,
      enabledTriggers,
      config,
    ),
    crossingAbsence: crossingAbsenceStatsFromState(
      crossingStats,
      enabledTriggers,
      config,
      absenceFilterStats.crossing,
    ),
    crossingOppositeAbsence: crossingOppositeAbsenceStatsFromState(
      crossingStats,
      enabledTriggers,
      config,
      absenceFilterStats.crossingReturnStreak,
    ),
    absenceFilterStats,
  };
}

export async function buildAutomationTriggerStatsDtoAsync(): Promise<AutomationStatsDto> {
  await initAutomationConfig();
  return buildAutomationTriggerStatsDto();
}
