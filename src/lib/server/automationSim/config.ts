import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  DEFAULT_GLOBAL_AUTOMATION_CONFIG,
  normalizeGlobalAutomationConfig,
  type GlobalAutomationConfig,
} from "@/lib/back-office/automation-config";

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
  }
  return globalThis.__automationConfigCache;
}

export async function initAutomationConfig(): Promise<GlobalAutomationConfig> {
  const path = storagePath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = normalizeGlobalAutomationConfig(JSON.parse(raw));
    globalThis.__automationConfigCache = parsed;
    return parsed;
  } catch {
    const fresh = { ...DEFAULT_GLOBAL_AUTOMATION_CONFIG, updatedAt: Date.now() };
    globalThis.__automationConfigCache = fresh;
    return fresh;
  }
}

export async function saveAutomationConfig(
  patch: Partial<GlobalAutomationConfig>,
): Promise<GlobalAutomationConfig> {
  const current = getAutomationConfig();
  const next = normalizeGlobalAutomationConfig({
    ...current,
    ...patch,
    updatedAt: Date.now(),
  });
  globalThis.__automationConfigCache = next;
  const path = storagePath();
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(next, null, 2), "utf8");
  } catch (err) {
    console.error("[AutomationConfig] falha ao gravar:", err);
  }
  return next;
}
