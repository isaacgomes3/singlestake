import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  DEFAULT_GLOBAL_AUTOMATION_CONFIG,
  normalizeGlobalAutomationConfig,
  type GlobalAutomationConfig,
} from "@/lib/back-office/automation-config";
import {
  normalizeFibonacciZoneAbsenceSpins,
  setServerFibonacciZoneAbsenceSpins,
} from "@/lib/roulette/fibonacciAbsencePrefs";
import {
  normalizeRotatingRoomGatilhoEnable,
  setRotatingRoomGatilhoEnabled,
} from "@/lib/roulette/umFatorTriggerEnable";

function syncTriggerEnableRuntime(config: GlobalAutomationConfig): void {
  setRotatingRoomGatilhoEnabled(config.enabledTriggers);
  setServerFibonacciZoneAbsenceSpins(normalizeFibonacciZoneAbsenceSpins(config));
}

declare global {
  // eslint-disable-next-line no-var
  var __automationConfigCache: GlobalAutomationConfig | undefined;
}

function storagePath(): string {
  const custom = process.env.ROULETTE_AUTOMATION_CONFIG_PATH?.trim();
  if (custom) return custom;
  return join(process.cwd(), "data", "roulette-automation-config.json");
}

export function getAutomationConfig(): GlobalAutomationConfig {
  if (!globalThis.__automationConfigCache) {
    globalThis.__automationConfigCache = { ...DEFAULT_GLOBAL_AUTOMATION_CONFIG };
    syncTriggerEnableRuntime(globalThis.__automationConfigCache);
  }
  return globalThis.__automationConfigCache;
}

export async function initAutomationConfig(): Promise<GlobalAutomationConfig> {
  const path = storagePath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = normalizeGlobalAutomationConfig(JSON.parse(raw));
    globalThis.__automationConfigCache = parsed;
    syncTriggerEnableRuntime(parsed);
    return parsed;
  } catch {
    const fresh = { ...DEFAULT_GLOBAL_AUTOMATION_CONFIG, updatedAt: Date.now() };
    globalThis.__automationConfigCache = fresh;
    syncTriggerEnableRuntime(fresh);
    return fresh;
  }
}

export async function saveAutomationConfig(
  patch: Partial<GlobalAutomationConfig>,
): Promise<GlobalAutomationConfig> {
  const current = getAutomationConfig();
  const enabledTriggers = patch.enabledTriggers
    ? normalizeRotatingRoomGatilhoEnable({
        ...current.enabledTriggers,
        ...patch.enabledTriggers,
      })
    : current.enabledTriggers;
  const next = normalizeGlobalAutomationConfig({
    ...current,
    ...patch,
    enabledTriggers,
    updatedAt: Date.now(),
  });
  globalThis.__automationConfigCache = next;
  syncTriggerEnableRuntime(next);
  const path = storagePath();
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    console.error("[AutomationConfig] falha ao gravar:", err);
  }
  return next;
}
