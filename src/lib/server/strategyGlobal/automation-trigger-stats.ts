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
} from "@/lib/roulette/crossingReturnStreakStats";
import { normalizeCrossingAxisAbsenceSpins } from "@/lib/roulette/crossingAbsencePrefs";
import { normalizeCrossingOppositeAxisAbsenceSpins } from "@/lib/roulette/crossingOppositeAbsencePrefs";
import { normalizeCrossingAbsenceAxisStats, normalizeCrossingOppositeAbsenceAxisStats } from "@/lib/roulette/entryWinBreakdown";
import { getExtensionSourceStatus } from "@/lib/server/extensionSource";
import { getAutomationConfig, initAutomationConfig, saveAutomationConfig } from "@/lib/server/automationSim/config";
import {
  applyCrossingAutoAbsenceRuntime,
  averageCrossingAbsenceSpinsPerTable,
  averagePerTableMaxCrossingAbsenceInWindow,
  buildTableCrossingAbsenceTriggerRows,
} from "@/lib/server/automationSim/crossing-auto-absence";
import {
  applyCrossingOppositeAutoAbsenceRuntime,
  averageCrossingOppositeAbsenceSpinsPerTable,
  averagePerTableMaxCrossingOppositeAbsenceInWindow,
  buildTableCrossingOppositeAbsenceTriggerRows,
} from "@/lib/server/automationSim/crossing-opposite-auto-absence";
import {
  applyFibonacciAutoAbsenceRuntime,
  applyRepeticaoAutoAbsenceRuntime,
  fibonacciAutoAbsencePatchFromHistories,
  repeticaoAutoAbsencePatchFromHistories,
} from "@/lib/server/automationSim/zone-fibonacci-auto-absence";
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
  absenceAuto: boolean,
  maxAbsenceInWindow: number,
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
    absenceAuto,
    maxAbsenceInWindow,
  };
}

function fibonacciStatsFromState(
  fibonacciStats: RotatingRoomSessionStats | undefined,
  enabledTriggers: RotatingRoomGatilhoEnableMap,
  config: ReturnType<typeof getAutomationConfig>,
  absenceFilter: AutomationStatsDto["absenceFilterStats"]["fibonacci"],
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
      config.fibonacciDozenAbsenceAuto === true,
      absenceFilter.maxAbsenceInWindowDozen,
    ),
    column: fibonacciZoneStatsRow(
      fibonacciStats,
      "column",
      enabledTriggers.fibonacciColumn !== false,
      absenceByZone.column,
      config.fibonacciColumnAbsenceAuto === true,
      absenceFilter.maxAbsenceInWindowColumn,
    ),
  };
}

function repeticaoZoneStatsRow(
  stats: RotatingRoomSessionStats | undefined,
  kind: "dozen" | "column",
  enabled: boolean,
  absenceSpins: number,
  absenceAuto: boolean,
  maxAbsenceInWindow: number,
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
    absenceAuto,
    maxAbsenceInWindow,
  };
}

function repeticaoStatsFromState(
  repeticaoStats: RotatingRoomSessionStats | undefined,
  enabledTriggers: RotatingRoomGatilhoEnableMap,
  config: ReturnType<typeof getAutomationConfig>,
  absenceFilter: AutomationStatsDto["absenceFilterStats"]["repeticao"],
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
      config.repeticaoDozenAbsenceAuto === true,
      absenceFilter.maxAbsenceInWindowDozen,
    ),
    column: repeticaoZoneStatsRow(
      repeticaoStats,
      "column",
      enabledTriggers.repeticaoColumn !== false && masterOn,
      absenceByZone.column,
      config.repeticaoColumnAbsenceAuto === true,
      absenceFilter.maxAbsenceInWindowColumn,
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
  histories: Record<number, readonly number[]>,
  absenceFilter: AutomationStatsDto["absenceFilterStats"]["crossing"],
): AutomationStatsDto["crossingAbsence"] {
  const absenceByAxis = normalizeCrossingAxisAbsenceSpins(config);
  const corAuto = config.crossingCorAlturaAbsenceAuto === true;
  const altAuto = config.crossingAlturaParidadeAbsenceAuto === true;
  return {
    corAltura: crossingAbsenceAxisStatsRow(
      crossingStats,
      "corAltura",
      enabledTriggers.crossingCorAltura === true,
      corAuto
        ? averageCrossingAbsenceSpinsPerTable(config, histories, "corAltura")
        : absenceByAxis.corAltura,
      corAuto,
      corAuto
        ? averagePerTableMaxCrossingAbsenceInWindow(histories, "corAltura")
        : absenceFilter.corAltura.maxAbsenceInWindow,
    ),
    alturaParidade: crossingAbsenceAxisStatsRow(
      crossingStats,
      "alturaParidade",
      enabledTriggers.crossingAlturaParidade === true,
      altAuto
        ? averageCrossingAbsenceSpinsPerTable(config, histories, "alturaParidade")
        : absenceByAxis.alturaParidade,
      altAuto,
      altAuto
        ? averagePerTableMaxCrossingAbsenceInWindow(histories, "alturaParidade")
        : absenceFilter.alturaParidade.maxAbsenceInWindow,
    ),
  };
}

function crossingOppositeAbsenceStatsFromState(
  crossingStats: RotatingRoomSessionStats | undefined,
  enabledTriggers: RotatingRoomGatilhoEnableMap,
  config: ReturnType<typeof getAutomationConfig>,
  histories: Record<number, readonly number[]>,
  oppositeFilter: AutomationStatsDto["absenceFilterStats"]["crossingOpposite"],
): AutomationStatsDto["crossingOppositeAbsence"] {
  const absenceByAxis = normalizeCrossingOppositeAxisAbsenceSpins(config);
  const corAuto = config.crossingCorAlturaOppositeAbsenceAuto === true;
  const altAuto = config.crossingAlturaParidadeOppositeAbsenceAuto === true;
  return {
    corAltura: crossingOppositeAbsenceAxisStatsRow(
      crossingStats,
      "corAltura",
      enabledTriggers.crossingCorAlturaOpposite === true,
      corAuto
        ? averageCrossingOppositeAbsenceSpinsPerTable(config, histories, "corAltura")
        : absenceByAxis.corAltura,
      corAuto,
      corAuto
        ? averagePerTableMaxCrossingOppositeAbsenceInWindow(histories, "corAltura")
        : oppositeFilter.corAltura.maxAbsenceInWindow,
    ),
    alturaParidade: crossingOppositeAbsenceAxisStatsRow(
      crossingStats,
      "alturaParidade",
      enabledTriggers.crossingAlturaParidadeOpposite === true,
      altAuto
        ? averageCrossingOppositeAbsenceSpinsPerTable(config, histories, "alturaParidade")
        : absenceByAxis.alturaParidade,
      altAuto,
      altAuto
        ? averagePerTableMaxCrossingOppositeAbsenceInWindow(histories, "alturaParidade")
        : oppositeFilter.alturaParidade.maxAbsenceInWindow,
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
  if (config.crossingCorAlturaAbsenceAuto || config.crossingAlturaParidadeAbsenceAuto) {
    applyCrossingAutoAbsenceRuntime(config, histories);
  }
  if (
    config.crossingCorAlturaOppositeAbsenceAuto ||
    config.crossingAlturaParidadeOppositeAbsenceAuto
  ) {
    applyCrossingOppositeAutoAbsenceRuntime(config, histories);
  }
  const fibAutoPatch = fibonacciAutoAbsencePatchFromHistories(config, histories);
  if (fibAutoPatch) {
    config = applyFibonacciAutoAbsenceRuntime({ ...config, ...fibAutoPatch }, histories);
    void saveAutomationConfig(fibAutoPatch);
  }
  const repAutoPatch = repeticaoAutoAbsencePatchFromHistories(config, histories);
  if (repAutoPatch) {
    config = applyRepeticaoAutoAbsenceRuntime({ ...config, ...repAutoPatch }, histories);
    void saveAutomationConfig(repAutoPatch);
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
      state.kto2fcruzamento.stats,
      state.tres3fatores.stats,
    ),
    fibonacci: fibonacciStatsFromState(
      state.fibonacci.stats,
      enabledTriggers,
      config,
      absenceFilterStats.fibonacci,
    ),
    repeticao: repeticaoStatsFromState(
      state.repeticao.stats,
      enabledTriggers,
      config,
      absenceFilterStats.repeticao,
    ),
    crossingAbsence: crossingAbsenceStatsFromState(
      crossingStats,
      enabledTriggers,
      config,
      histories,
      absenceFilterStats.crossing,
    ),
    crossingOppositeAbsence: crossingOppositeAbsenceStatsFromState(
      crossingStats,
      enabledTriggers,
      config,
      histories,
      absenceFilterStats.crossingOpposite,
    ),
    tableCrossingAbsenceTriggers: buildTableCrossingAbsenceTriggerRows(config, histories),
    tableCrossingOppositeAbsenceTriggers: buildTableCrossingOppositeAbsenceTriggerRows(
      config,
      histories,
    ),
    absenceFilterStats,
  };
}

export async function buildAutomationTriggerStatsDtoAsync(): Promise<AutomationStatsDto> {
  await initAutomationConfig();
  return buildAutomationTriggerStatsDto();
}
