/**
 * Estado inicial limpo da automação global no sandbox local (banca R$ 50.000).
 * Uso: npm run seed:local-automation
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import "./load-local-env";

import {
  freshAutomationSimState,
  ROULETTE_AUTOMATION_INITIAL_BANK,
} from "../src/lib/back-office/rouletteAutomationSim";
import { localDataDir } from "./load-local-env";

function strategyGlobalFresh() {
  return {
    revision: 0,
    ledger: { um1fator: [] as unknown[] },
    tableHistories: {} as Record<string, number[]>,
    um1fator: {
      activeByTable: {} as Record<string, unknown>,
      lastSignalByTable: {} as Record<string, unknown>,
    },
  };
}

async function seedFinanceCapital() {
  const { ensureGlobalAutomationCapitalRegistered } = await import(
    "../src/lib/server/finance/global-automation-capital"
  );
  const result = await ensureGlobalAutomationCapitalRegistered();
  return result;
}

async function main() {
  const dataDir = localDataDir();
  mkdirSync(dataDir, { recursive: true });

  const simPath =
    process.env.ROULETTE_AUTOMATION_SIM_PATH?.trim() ||
    resolve(dataDir, "roulette-automation-sim.json");
  const strategyPath =
    process.env.ROULETTE_STRATEGY_GLOBAL_PATH?.trim() ||
    resolve(dataDir, "roulette-strategy-global.json");

  const now = Date.now();
  const simState = {
    ...freshAutomationSimState(now),
    capitalRegisteredAt: now,
    cycleOpeningBalance: ROULETTE_AUTOMATION_INITIAL_BANK,
    balance: ROULETTE_AUTOMATION_INITIAL_BANK,
  };

  for (const path of [simPath, strategyPath]) {
    mkdirSync(dirname(path), { recursive: true });
  }

  writeFileSync(simPath, JSON.stringify(simState, null, 2), "utf8");
  writeFileSync(strategyPath, JSON.stringify(strategyGlobalFresh(), null, 2), "utf8");

  console.log("Ficheiros JSON locais reiniciados:");
  console.log(`  ${simPath}`);
  console.log(`  ${strategyPath}`);

  try {
    const { balance, registeredAt } = await seedFinanceCapital();
    console.log(`\nCapital automação global na BD: R$ ${balance.toFixed(2)} (registado ${new Date(registeredAt).toISOString()})`);
  } catch (err) {
    console.warn("\nAviso: capital na BD não registado (corra setup:local primeiro):", err);
  }

  console.log("\nAutomação local pronta para testes.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
