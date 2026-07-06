import type { GlobalAutomationConfig } from "@/lib/back-office/automation-config";
import type { FibonacciZoneKind } from "@/lib/roulette/rotatingRoomFibonacciStrategy";
import {
  fibonacciAutoAbsenceSpinsFromMax,
  normalizeFibonacciZoneAbsenceSpins,
  setServerFibonacciZoneAbsenceSpins,
} from "@/lib/roulette/fibonacciAbsencePrefs";
import {
  normalizeRepeticaoZoneAbsenceSpins,
  setServerRepeticaoZoneAbsenceSpins,
} from "@/lib/roulette/repeticaoAbsencePrefs";
import { buildZoneAbsenceFilterStats } from "@/lib/roulette/zoneAbsenceFilterStats";
import { getAutomationConfig, saveAutomationConfig } from "@/lib/server/automationSim/config";

function maxForZoneKind(
  histories: Record<number, readonly number[]>,
  mode: "fibonacci" | "repeticao",
  zoneKind: FibonacciZoneKind,
): number {
  const stats = buildZoneAbsenceFilterStats(histories);
  const block = stats[mode];
  return zoneKind === "dozen" ? block.maxAbsenceInWindowDozen : block.maxAbsenceInWindowColumn;
}

export function fibonacciAutoAbsencePatchFromHistories(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): Partial<GlobalAutomationConfig> | null {
  if (!config.fibonacciDozenAbsenceAuto && !config.fibonacciColumnAbsenceAuto) {
    return null;
  }

  const patch: Partial<GlobalAutomationConfig> = {};
  let changed = false;

  if (config.fibonacciDozenAbsenceAuto) {
    const max = maxForZoneKind(histories, "fibonacci", "dozen");
    if (max > 0) {
      const next = fibonacciAutoAbsenceSpinsFromMax(max);
      if (next !== config.fibonacciDozenAbsenceSpins) {
        patch.fibonacciDozenAbsenceSpins = next;
        changed = true;
      }
    }
  }

  if (config.fibonacciColumnAbsenceAuto) {
    const max = maxForZoneKind(histories, "fibonacci", "column");
    if (max > 0) {
      const next = fibonacciAutoAbsenceSpinsFromMax(max);
      if (next !== config.fibonacciColumnAbsenceSpins) {
        patch.fibonacciColumnAbsenceSpins = next;
        changed = true;
      }
    }
  }

  return changed ? patch : null;
}

export function applyFibonacciAutoAbsenceRuntime(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): GlobalAutomationConfig {
  const patch = fibonacciAutoAbsencePatchFromHistories(config, histories);
  if (!patch) return config;
  const next = { ...config, ...patch, updatedAt: Date.now() };
  setServerFibonacciZoneAbsenceSpins(normalizeFibonacciZoneAbsenceSpins(next));
  return next;
}

export function repeticaoAutoAbsencePatchFromHistories(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): Partial<GlobalAutomationConfig> | null {
  if (!config.repeticaoDozenAbsenceAuto && !config.repeticaoColumnAbsenceAuto) {
    return null;
  }

  const patch: Partial<GlobalAutomationConfig> = {};
  let changed = false;

  if (config.repeticaoDozenAbsenceAuto) {
    const max = maxForZoneKind(histories, "repeticao", "dozen");
    if (max > 0) {
      const next = fibonacciAutoAbsenceSpinsFromMax(max);
      if (next !== config.repeticaoDozenAbsenceSpins) {
        patch.repeticaoDozenAbsenceSpins = next;
        changed = true;
      }
    }
  }

  if (config.repeticaoColumnAbsenceAuto) {
    const max = maxForZoneKind(histories, "repeticao", "column");
    if (max > 0) {
      const next = fibonacciAutoAbsenceSpinsFromMax(max);
      if (next !== config.repeticaoColumnAbsenceSpins) {
        patch.repeticaoColumnAbsenceSpins = next;
        changed = true;
      }
    }
  }

  return changed ? patch : null;
}

export function applyRepeticaoAutoAbsenceRuntime(
  config: GlobalAutomationConfig,
  histories: Record<number, readonly number[]>,
): GlobalAutomationConfig {
  const patch = repeticaoAutoAbsencePatchFromHistories(config, histories);
  if (!patch) return config;
  const next = { ...config, ...patch, updatedAt: Date.now() };
  setServerRepeticaoZoneAbsenceSpins(normalizeRepeticaoZoneAbsenceSpins(next));
  return next;
}

export function refreshZoneFibonacciAutoAbsenceForHistories(
  histories: Record<number, readonly number[]>,
): void {
  let config = getAutomationConfig();
  const fibPatch = fibonacciAutoAbsencePatchFromHistories(config, histories);
  if (fibPatch) {
    config = applyFibonacciAutoAbsenceRuntime({ ...config, ...fibPatch }, histories);
    void saveAutomationConfig(fibPatch);
  }

  const repPatch = repeticaoAutoAbsencePatchFromHistories(config, histories);
  if (repPatch) {
    config = applyRepeticaoAutoAbsenceRuntime({ ...config, ...repPatch }, histories);
    void saveAutomationConfig(repPatch);
  }
}
