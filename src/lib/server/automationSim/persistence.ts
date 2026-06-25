import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  freshAutomationSimState,
  parseAutomationSimState,
  type RouletteAutomationSimState,
} from "@/lib/back-office/rouletteAutomationSim";

const PERSIST_DEBOUNCE_MS = 600;

declare global {
  // eslint-disable-next-line no-var
  var __automationSimPersisted: RouletteAutomationSimState | undefined;
  // eslint-disable-next-line no-var
  var __automationSimSaveTimer: ReturnType<typeof setTimeout> | undefined;
  // eslint-disable-next-line no-var
  var __automationSimRevision: number | undefined;
}

function storagePath(): string {
  const custom = process.env.ROULETTE_AUTOMATION_SIM_PATH?.trim();
  if (custom) return custom;
  return join(process.cwd(), "data", "roulette-automation-sim.json");
}

export function getAutomationSimRevision(): number {
  return globalThis.__automationSimRevision ?? 0;
}

export function bumpAutomationSimRevision(): number {
  const next = getAutomationSimRevision() + 1;
  globalThis.__automationSimRevision = next;
  return next;
}

export function getAutomationSimState(): RouletteAutomationSimState {
  if (!globalThis.__automationSimPersisted) {
    globalThis.__automationSimPersisted = freshAutomationSimState();
  }
  return globalThis.__automationSimPersisted;
}

export function replaceAutomationSimState(state: RouletteAutomationSimState): void {
  globalThis.__automationSimPersisted = state;
  bumpAutomationSimRevision();
  schedulePersist(state);
}

export function schedulePersist(state: RouletteAutomationSimState): void {
  if (globalThis.__automationSimSaveTimer) {
    clearTimeout(globalThis.__automationSimSaveTimer);
  }
  globalThis.__automationSimSaveTimer = setTimeout(() => {
    globalThis.__automationSimSaveTimer = undefined;
    void persistAutomationSimState(state);
  }, PERSIST_DEBOUNCE_MS);
}

export async function persistAutomationSimState(state: RouletteAutomationSimState): Promise<void> {
  const path = storagePath();
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(state, null, 0), "utf8");
  } catch (err) {
    console.error("[AutomationSim] falha ao gravar:", err);
  }
}

export async function initAutomationSimState(): Promise<RouletteAutomationSimState> {
  const path = storagePath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = parseAutomationSimState(JSON.parse(raw));
    if (parsed) {
      globalThis.__automationSimPersisted = parsed;
      bumpAutomationSimRevision();
      return parsed;
    }
  } catch {
    /* ficheiro inexistente ou inválido */
  }
  const fresh = freshAutomationSimState();
  globalThis.__automationSimPersisted = fresh;
  bumpAutomationSimRevision();
  return fresh;
}
