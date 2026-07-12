import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import { buildRotatingRoomGatilhoTriggerReport } from "@/lib/roulette/umFatorTriggerTiers";
import { emptyZoneAbsenceFilterStats } from "@/lib/roulette/zoneAbsenceFilterStats";
import { emptyCrossingAbsenceFilterStats } from "@/lib/roulette/crossingAbsenceFilterStats";
import { emptyCrossingOppositeAbsenceFilterStats } from "@/lib/roulette/crossingOppositeAbsenceFilterStats";
import { emptyCrossingReturnStreakStats } from "@/lib/roulette/crossingReturnStreakStats";
import {
  buildIce3fOccurrenceStats,
  emptyIce3fOccurrenceStats,
  ICE3F_OCCURRENCE_TABLE_ID,
} from "@/lib/roulette/ice3fOccurrenceStats";
import { getExtensionSourceStatus } from "@/lib/server/extensionSource";
import { getAutomationConfig, initAutomationConfig } from "@/lib/server/automationSim/config";
import { getStrategyGlobalState } from "@/lib/server/strategyGlobal/persistence";

function sessionAccuracyPct(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total <= 0) return null;
  return (100 * wins) / total;
}

function emptyZoneRow(): AutomationStatsDto["fibonacci"]["dozen"] {
  return {
    wins: 0,
    losses: 0,
    total: 0,
    accuracyPct: null,
    enabled: false,
    absenceSpins: 12,
    absenceAuto: false,
    maxAbsenceInWindow: 0,
  };
}

function deprecatedLegacyBlocks(): Pick<
  AutomationStatsDto,
  | "fibonacci"
  | "repeticao"
  | "crossingAbsence"
  | "crossingOppositeAbsence"
  | "tableCrossingAbsenceTriggers"
  | "tableCrossingOppositeAbsenceTriggers"
  | "absenceFilterStats"
> {
  const emptyZone = emptyZoneAbsenceFilterStats();
  return {
    fibonacci: {
      enabled: false,
      absenceSpins: 12,
      dozen: emptyZoneRow(),
      column: emptyZoneRow(),
    },
    repeticao: {
      enabled: false,
      absenceSpins: 12,
      dozen: emptyZoneRow(),
      column: emptyZoneRow(),
    },
    crossingAbsence: {
      corAltura: emptyZoneRow(),
      alturaParidade: emptyZoneRow(),
    },
    crossingOppositeAbsence: {
      corAltura: emptyZoneRow(),
      alturaParidade: emptyZoneRow(),
    },
    tableCrossingAbsenceTriggers: [],
    tableCrossingOppositeAbsenceTriggers: [],
    absenceFilterStats: {
      ...emptyZone,
      crossing: emptyCrossingAbsenceFilterStats(),
      crossingOpposite: emptyCrossingOppositeAbsenceFilterStats(),
      crossingReturnStreak: emptyCrossingReturnStreakStats(),
    },
  };
}

export function buildAutomationTriggerStatsDto(): AutomationStatsDto {
  const state = getStrategyGlobalState();
  const ice3fStats = state.tres3fatores.stats;
  const wins = Math.max(0, ice3fStats.wins);
  const losses = Math.max(0, ice3fStats.losses);
  const extension = getExtensionSourceStatus();
  const config = getAutomationConfig();
  const enabledTriggers = config.enabledTriggers;
  const history201 = state.tableHistories[String(ICE3F_OCCURRENCE_TABLE_ID)] ?? [];

  let ice3fOccurrences = emptyIce3fOccurrenceStats(ICE3F_OCCURRENCE_TABLE_ID);
  try {
    ice3fOccurrences = buildIce3fOccurrenceStats(history201, {
      tableId: ICE3F_OCCURRENCE_TABLE_ID,
    });
  } catch (err) {
    console.warn("[AutomationStats] ice3fOccurrences falhou — fallback vazio:", err);
  }

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
      undefined,
      undefined,
      enabledTriggers,
      undefined,
      undefined,
      undefined,
      undefined,
      ice3fStats,
    ),
    ice3fOccurrences,
    ...deprecatedLegacyBlocks(),
  };
}

export async function buildAutomationTriggerStatsDtoAsync(): Promise<AutomationStatsDto> {
  await initAutomationConfig();
  return buildAutomationTriggerStatsDto();
}
