import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";
import { buildRotatingRoomGatilhoTriggerReport } from "@/lib/roulette/umFatorTriggerTiers";
import {
  ABSENCE_FILTER_STATS_MAX_EVENTS,
  ABSENCE_FILTER_STATS_SPIN_WINDOW,
  type ZoneAbsenceFilterStatsBlock,
} from "@/lib/roulette/zoneAbsenceFilterStats";
import type { CrossingAbsenceFilterStats } from "@/lib/roulette/crossingAbsenceFilterStats";
import type { CrossingOppositeAbsenceFilterStats } from "@/lib/roulette/crossingOppositeAbsenceFilterStats";
import { emptyCrossingReturnStreakStats } from "@/lib/roulette/crossingReturnStreakStats";
import {
  buildIce3fOccurrenceStats,
  emptyIce3fOccurrenceStats,
  ICE3F_OCCURRENCE_TABLE_ID,
} from "@/lib/roulette/ice3fOccurrenceStats";
import {
  buildIce3fRepetitionStats,
  emptyIce3fRepetitionStats,
} from "@/lib/roulette/ice3fRepetitionStats";
import { reconcileHistoryWithApiSnapshot } from "@/lib/roulette/historyReconcile";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import { getExtensionSourceStatus } from "@/lib/server/extensionSource";
import { getAutomationConfig, initAutomationConfig } from "@/lib/server/automationSim/config";
import { getStrategyGlobalState } from "@/lib/server/strategyGlobal/persistence";
import { getRouletteHubHistories } from "@/lib/server/rouletteHub";

function sessionAccuracyPct(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total <= 0) return null;
  return (100 * wins) / total;
}

function emptyZoneBlock(): ZoneAbsenceFilterStatsBlock {
  return {
    spinWindow: ABSENCE_FILTER_STATS_SPIN_WINDOW,
    maxEvents: ABSENCE_FILTER_STATS_MAX_EVENTS,
    maxAbsenceInWindow: 0,
    maxAbsenceInWindowDozen: 0,
    maxAbsenceInWindowColumn: 0,
    filters: [],
  };
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
  const emptyCrossing: CrossingAbsenceFilterStats = {
    corAltura: emptyZoneBlock(),
    alturaParidade: emptyZoneBlock(),
  };
  const emptyOpposite: CrossingOppositeAbsenceFilterStats = {
    corAltura: emptyZoneBlock(),
    alturaParidade: emptyZoneBlock(),
  };
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
      fibonacci: emptyZoneBlock(),
      repeticao: emptyZoneBlock(),
      crossing: emptyCrossing,
      crossingOpposite: emptyOpposite,
      crossingReturnStreak: emptyCrossingReturnStreakStats(),
    },
  };
}

export function buildAutomationTriggerStatsDto(): AutomationStatsDto {
  const state = getStrategyGlobalState();
  const ice3fStats = state.tres3fatores?.stats ?? emptyRotatingRoomSessionStats(5);
  const wins = Math.max(0, ice3fStats.wins ?? 0);
  const losses = Math.max(0, ice3fStats.losses ?? 0);
  const extension = getExtensionSourceStatus();
  const config = getAutomationConfig();
  const enabledTriggers = config.enabledTriggers;
  const historyPersisted = state.tableHistories[String(ICE3F_OCCURRENCE_TABLE_ID)] ?? [];
  const hub201 = getRouletteHubHistories()[ICE3F_OCCURRENCE_TABLE_ID] ?? [];
  const history201 = reconcileHistoryWithApiSnapshot(historyPersisted, hub201);

  let ice3fOccurrences = emptyIce3fOccurrenceStats(ICE3F_OCCURRENCE_TABLE_ID);
  let ice3fRepetitions = emptyIce3fRepetitionStats(ICE3F_OCCURRENCE_TABLE_ID);
  try {
    ice3fOccurrences = buildIce3fOccurrenceStats(history201, {
      tableId: ICE3F_OCCURRENCE_TABLE_ID,
      maxPerNumber: 3,
    });
    ice3fRepetitions = buildIce3fRepetitionStats(history201, {
      tableId: ICE3F_OCCURRENCE_TABLE_ID,
      maxPerNumber: 3,
    });
  } catch (err) {
    console.warn("[AutomationStats] ice3fOccurrences/repetitions falhou — fallback vazio:", err);
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
    ice3fRepetitions,
    ...deprecatedLegacyBlocks(),
  };
}

export async function buildAutomationTriggerStatsDtoAsync(): Promise<AutomationStatsDto> {
  await initAutomationConfig();
  return buildAutomationTriggerStatsDto();
}
