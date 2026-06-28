import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import { buildUmFatorTriggerTierReport } from "@/lib/roulette/umFatorTriggerTiers";
import { getExtensionSourceStatus } from "@/lib/server/extensionSource";
import { getStrategyGlobalState } from "@/lib/server/strategyGlobal/persistence";

function sessionAccuracyPct(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total <= 0) return null;
  return (100 * wins) / total;
}

export function buildAutomationTriggerStatsDto(): AutomationStatsDto {
  const state = getStrategyGlobalState();
  const stats = state.um1fator.stats;
  const wins = Math.max(0, stats.wins);
  const losses = Math.max(0, stats.losses);
  const extension = getExtensionSourceStatus();

  return {
    updatedAt: state.updatedAt,
    source: extension.active ? "extension" : state.revision > 0 ? "server" : null,
    session: {
      wins,
      losses,
      total: wins + losses,
      accuracyPct: sessionAccuracyPct(wins, losses),
    },
    triggers: buildUmFatorTriggerTierReport(stats),
  };
}
