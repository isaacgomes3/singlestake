import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { DEFAULT_GLOBAL_AUTOMATION_CONFIG } from "@/lib/back-office/automation-config";
import {
  finalizeAutomationSimState,
  freshAutomationSimState,
  ROULETTE_AUTOMATION_INITIAL_BANK,
  AUTOMATION_EXTRACT_FORMAT_VERSION,
} from "@/lib/back-office/rouletteAutomationSim";
import type { AutomationSimApiSnapshot } from "@/lib/roulette/automationSimTypes";
import { broadcastAutomationSim } from "@/lib/server/automationSim/broadcast";
import {
  buildAutomationSimSnapshot,
  resetAutomationSimEngineFlags,
} from "@/lib/server/automationSim/engine";
import { saveAutomationConfig } from "@/lib/server/automationSim/config";
import {
  persistAutomationSimState,
  replaceAutomationSimState,
} from "@/lib/server/automationSim/persistence";
import {
  ensureGlobalAutomationCapitalRegistered,
  resetGlobalAutomationOperationsToInitial,
} from "@/lib/server/finance/global-automation-capital";
import {
  getStrategyGlobalSnapshotOrThrow,
  wipeStrategyGlobalState,
} from "@/lib/server/strategyGlobal/engine";
import { emptyStrategyGlobalState } from "@/lib/server/strategyGlobal/persistence";

export function buildFreshAutomationSimState(registeredAt: number) {
  const now = Date.now();
  const base = freshAutomationSimState(now);
  return finalizeAutomationSimState(
    {
      ...base,
      capitalRegisteredAt: registeredAt,
      cycleOpeningBalance: ROULETTE_AUTOMATION_INITIAL_BANK,
      balance: ROULETTE_AUTOMATION_INITIAL_BANK,
      rounds: [],
      processedKeys: [],
      spinCounter: 0,
      openBet: null,
      chart: [],
      extractFormatVersion: AUTOMATION_EXTRACT_FORMAT_VERSION,
    },
    ROULETTE_AUTOMATION_INITIAL_BANK,
  );
}

export function collectAutomationStoragePaths(cwd = process.cwd()): {
  simPaths: string[];
  strategyPaths: string[];
  configPaths: string[];
} {
  const simPaths = new Set<string>();
  const strategyPaths = new Set<string>();
  const configPaths = new Set<string>();

  const add = (set: Set<string>, raw: string | undefined, fallback: string) => {
    set.add(resolve(cwd, raw?.trim() || fallback));
  };

  add(simPaths, process.env.ROULETTE_AUTOMATION_SIM_PATH, "data/roulette-automation-sim.json");
  add(
    strategyPaths,
    process.env.ROULETTE_STRATEGY_GLOBAL_PATH,
    "data/roulette-strategy-global.json",
  );
  add(
    configPaths,
    process.env.ROULETTE_AUTOMATION_CONFIG_PATH,
    "data/roulette-automation-config.json",
  );
  add(simPaths, undefined, "data/automation/roulette-automation-sim.json");
  add(strategyPaths, undefined, "data/automation/roulette-strategy-global.json");
  add(configPaths, undefined, "data/automation/roulette-automation-config.json");

  return {
    simPaths: [...simPaths],
    strategyPaths: [...strategyPaths],
    configPaths: [...configPaths],
  };
}

/** Grava estado limpo em todos os caminhos conhecidos (back office + subdomínio automação). */
export async function writeAutomationResetFiles(input: {
  tableIds: readonly number[];
  registeredAt: number;
  cwd?: string;
}): Promise<ReturnType<typeof collectAutomationStoragePaths>> {
  const cwd = input.cwd ?? process.cwd();
  const paths = collectAutomationStoragePaths(cwd);
  const simState = buildFreshAutomationSimState(input.registeredAt);
  const strategyState = emptyStrategyGlobalState(input.tableIds);
  const configState = { ...DEFAULT_GLOBAL_AUTOMATION_CONFIG, updatedAt: Date.now() };

  for (const path of paths.simPaths) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(simState), "utf8");
  }
  for (const path of paths.strategyPaths) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(strategyState), "utf8");
  }
  for (const path of paths.configPaths) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(configState, null, 2), "utf8");
  }

  return paths;
}

/** Repõe saldo inicial (R$ 50.000), limpa histórico e extrato de liquidações. */
export async function resetGlobalAutomationCycle(input: {
  liveTableIds: readonly number[];
  broadcast?: boolean;
}): Promise<{
  snapshot: AutomationSimApiSnapshot;
  settlementsRemoved: number;
  balance: number;
  paths: ReturnType<typeof collectAutomationStoragePaths>;
}> {
  const { settlementsRemoved } = await resetGlobalAutomationOperationsToInitial();
  const { registeredAt } = await ensureGlobalAutomationCapitalRegistered();

  wipeStrategyGlobalState(input.liveTableIds);

  const simState = buildFreshAutomationSimState(registeredAt);
  replaceAutomationSimState(simState);
  await persistAutomationSimState(simState);

  await saveAutomationConfig({ paused: false, pauseReason: null, pausedAt: null });
  resetAutomationSimEngineFlags();

  const paths = await writeAutomationResetFiles({
    tableIds: input.liveTableIds,
    registeredAt,
  });

  const strategySnapshot = getStrategyGlobalSnapshotOrThrow();
  const snapshot = buildAutomationSimSnapshot(strategySnapshot);
  if (input.broadcast !== false) {
    broadcastAutomationSim(snapshot);
  }

  return {
    snapshot,
    settlementsRemoved,
    balance: ROULETTE_AUTOMATION_INITIAL_BANK,
    paths,
  };
}
