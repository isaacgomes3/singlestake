import type { GlobalAutomationConfig } from "@/lib/back-office/automation-config";
import {
  normalizeCrossingOppositeAxisAbsenceSpins,
  setServerCrossingOppositeAxisAbsenceSpins,
} from "@/lib/roulette/crossingOppositeAbsencePrefs";
import {
  buildCrossingReturnStreakStats,
  lowestReturnStreakFilterWithMaxWinsOne,
} from "@/lib/roulette/crossingReturnStreakStats";

export function crossingOppositeAutoAbsencePatchFromHistories(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): Partial<GlobalAutomationConfig> | null {
  if (
    !config.crossingCorAlturaOppositeAbsenceAuto &&
    !config.crossingAlturaParidadeOppositeAbsenceAuto
  ) {
    return null;
  }

  const returnStreak = buildCrossingReturnStreakStats(histories);
  const patch: Partial<GlobalAutomationConfig> = {};
  let changed = false;

  if (config.crossingCorAlturaOppositeAbsenceAuto) {
    const next = lowestReturnStreakFilterWithMaxWinsOne(returnStreak.corAltura);
    if (next != null && next !== config.crossingCorAlturaOppositeAbsenceSpins) {
      patch.crossingCorAlturaOppositeAbsenceSpins = next;
      changed = true;
    }
  }

  if (config.crossingAlturaParidadeOppositeAbsenceAuto) {
    const next = lowestReturnStreakFilterWithMaxWinsOne(returnStreak.alturaParidade);
    if (next != null && next !== config.crossingAlturaParidadeOppositeAbsenceSpins) {
      patch.crossingAlturaParidadeOppositeAbsenceSpins = next;
      changed = true;
    }
  }

  return changed ? patch : null;
}

export function applyCrossingOppositeAutoAbsenceRuntime(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): GlobalAutomationConfig {
  const patch = crossingOppositeAutoAbsencePatchFromHistories(config, histories);
  if (!patch) return config;
  const next = { ...config, ...patch, updatedAt: Date.now() };
  setServerCrossingOppositeAxisAbsenceSpins(normalizeCrossingOppositeAxisAbsenceSpins(next));
  return next;
}
