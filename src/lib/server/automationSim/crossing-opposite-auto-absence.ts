import type { GlobalAutomationConfig } from "@/lib/back-office/automation-config";
import {
  crossingOppositeAutoAbsenceSpinsFromMax,
  normalizeCrossingOppositeAxisAbsenceSpins,
  setServerCrossingOppositeAxisAbsenceSpins,
} from "@/lib/roulette/crossingOppositeAbsencePrefs";
import { buildCrossingAbsenceFilterStats } from "@/lib/roulette/crossingAbsenceFilterStats";

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

  const crossing = buildCrossingAbsenceFilterStats(histories);
  const patch: Partial<GlobalAutomationConfig> = {};
  let changed = false;

  if (config.crossingCorAlturaOppositeAbsenceAuto) {
    const max = crossing.corAltura.maxAbsenceInWindow;
    if (max > 0) {
      const next = crossingOppositeAutoAbsenceSpinsFromMax(max);
      if (next !== config.crossingCorAlturaOppositeAbsenceSpins) {
        patch.crossingCorAlturaOppositeAbsenceSpins = next;
        changed = true;
      }
    }
  }

  if (config.crossingAlturaParidadeOppositeAbsenceAuto) {
    const max = crossing.alturaParidade.maxAbsenceInWindow;
    if (max > 0) {
      const next = crossingOppositeAutoAbsenceSpinsFromMax(max);
      if (next !== config.crossingAlturaParidadeOppositeAbsenceSpins) {
        patch.crossingAlturaParidadeOppositeAbsenceSpins = next;
        changed = true;
      }
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
