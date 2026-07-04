import type { GlobalAutomationConfig } from "@/lib/back-office/automation-config";
import {
  crossingAutoAbsenceSpinsFromMax,
  normalizeCrossingAxisAbsenceSpins,
  setServerCrossingAxisAbsenceSpins,
} from "@/lib/roulette/crossingAbsencePrefs";
import { buildCrossingAbsenceFilterStats } from "@/lib/roulette/crossingAbsenceFilterStats";

export function crossingAutoAbsencePatchFromHistories(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): Partial<GlobalAutomationConfig> | null {
  if (!config.crossingCorAlturaAbsenceAuto && !config.crossingAlturaParidadeAbsenceAuto) {
    return null;
  }

  const crossing = buildCrossingAbsenceFilterStats(histories);
  const patch: Partial<GlobalAutomationConfig> = {};
  let changed = false;

  if (config.crossingCorAlturaAbsenceAuto) {
    const max = crossing.corAltura.maxAbsenceInWindow;
    if (max > 0) {
      const next = crossingAutoAbsenceSpinsFromMax(max);
      if (next !== config.crossingCorAlturaAbsenceSpins) {
        patch.crossingCorAlturaAbsenceSpins = next;
        changed = true;
      }
    }
  }

  if (config.crossingAlturaParidadeAbsenceAuto) {
    const max = crossing.alturaParidade.maxAbsenceInWindow;
    if (max > 0) {
      const next = crossingAutoAbsenceSpinsFromMax(max);
      if (next !== config.crossingAlturaParidadeAbsenceSpins) {
        patch.crossingAlturaParidadeAbsenceSpins = next;
        changed = true;
      }
    }
  }

  return changed ? patch : null;
}

/** Actualiza giros efectivos quando o modo automático está activo (gatilho = máx. na janela). */
export function applyCrossingAutoAbsenceRuntime(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): GlobalAutomationConfig {
  const patch = crossingAutoAbsencePatchFromHistories(config, histories);
  if (!patch) return config;
  const next = { ...config, ...patch, updatedAt: Date.now() };
  setServerCrossingAxisAbsenceSpins(normalizeCrossingAxisAbsenceSpins(next));
  return next;
}
