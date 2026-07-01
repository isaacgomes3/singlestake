import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import { buildRotatingRoomGatilhoTriggerReport } from "@/lib/roulette/umFatorTriggerTiers";
import { normalizeFibonacciZoneKindStats, umFatorMatchTierAproveitamentoPct } from "@/lib/roulette/entryWinBreakdown";
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
  };
}

function fibonacciStatsFromState(
  fibonacciStats: RotatingRoomSessionStats | undefined,
  enabledTriggers: RotatingRoomGatilhoEnableMap,
  absenceSpins: number,
): AutomationStatsDto["fibonacci"] {
  const masterOn = enabledTriggers.fibonacci !== false;
  return {
    enabled: masterOn,
    absenceSpins,
    dozen: fibonacciZoneStatsRow(
      fibonacciStats,
      "dozen",
      enabledTriggers.fibonacciDozen !== false,
    ),
    column: fibonacciZoneStatsRow(
      fibonacciStats,
      "column",
      enabledTriggers.fibonacciColumn !== false,
    ),
  };
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
    ),
    fibonacci: fibonacciStatsFromState(
      state.fibonacci.stats,
      enabledTriggers,
      config.fibonacciAbsenceSpins,
    ),
  };
}

export async function buildAutomationTriggerStatsDtoAsync(): Promise<AutomationStatsDto> {
  await initAutomationConfig();
  return buildAutomationTriggerStatsDto();
}
