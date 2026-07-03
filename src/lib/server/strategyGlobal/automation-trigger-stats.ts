import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import { buildRotatingRoomGatilhoTriggerReport } from "@/lib/roulette/umFatorTriggerTiers";
import { normalizeFibonacciZoneKindStats, umFatorMatchTierAproveitamentoPct } from "@/lib/roulette/entryWinBreakdown";
import { normalizeFibonacciZoneAbsenceSpins } from "@/lib/roulette/fibonacciAbsencePrefs";
import { normalizeRepeticaoZoneAbsenceSpins } from "@/lib/roulette/repeticaoAbsencePrefs";
import { buildZoneAbsenceFilterStats, emptyZoneAbsenceFilterStats } from "@/lib/roulette/zoneAbsenceFilterStats";
import { getExtensionSourceStatus } from "@/lib/server/extensionSource";
import { getAutomationConfig, initAutomationConfig } from "@/lib/server/automationSim/config";
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
    return buildZoneAbsenceFilterStats(rotatingTableHistoriesFromState(state));
  } catch (err) {
    console.warn("[AutomationStats] absenceFilterStats falhou — fallback vazio:", err);
    return emptyZoneAbsenceFilterStats();
  }
}

export function buildAutomationTriggerStatsDto(): AutomationStatsDto {
  const state = getStrategyGlobalState();
  const stats = state.um1fator.stats;
  const crossingStats = state.dois2fatores.stats;
  const wins = Math.max(0, stats.wins);
  const losses = Math.max(0, stats.losses);
  const extension = getExtensionSourceStatus();
  const enabledTriggers = getAutomationConfig().enabledTriggers;
  const config = getAutomationConfig();

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
    absenceFilterStats: safeAbsenceFilterStats(state),
  };
}

export async function buildAutomationTriggerStatsDtoAsync(): Promise<AutomationStatsDto> {
  await initAutomationConfig();
  return buildAutomationTriggerStatsDto();
}
