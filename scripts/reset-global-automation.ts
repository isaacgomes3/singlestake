/**
 * Repõe automação global: saldo R$ 50.000, histórico limpo, extrato sem liquidações.
 * Uso local: npm run reset:global-automation
 * VPS: cd /var/www/stake37 && npx tsx scripts/reset-global-automation.ts && pm2 restart singlestake singlestake-automation
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

import { ROULETTE_AUTOMATION_INITIAL_BANK } from "../src/lib/back-office/rouletteAutomationSim";
import { resetGlobalAutomationCycle } from "../src/lib/server/automationSim/reset-cycle";
import { closeDb } from "../src/lib/server/db/client";
import { parseRouletteTableIdsFromEnv } from "../src/lib/server/rouletteSocket";

const root = resolve(import.meta.dirname, "..");

for (const file of [".env", ".env.automation"]) {
  const path = resolve(root, file);
  if (existsSync(path)) config({ path, override: false });
}

async function main() {
  const tableIds = parseRouletteTableIdsFromEnv();
  if (tableIds.length === 0) {
    console.error("ROULETTE_TABLE_IDS não definido — abortado.");
    process.exit(1);
  }

  const result = await resetGlobalAutomationCycle({
    liveTableIds: tableIds,
    broadcast: false,
  });

  console.log("Automação global reiniciada:");
  console.log(`  Saldo operacional: R$ ${result.balance.toFixed(2)} (capital R$ ${ROULETTE_AUTOMATION_INITIAL_BANK.toFixed(0)})`);
  console.log(`  Liquidações removidas do extrato: ${result.settlementsRemoved}`);
  console.log(`  Rondas no histórico: ${result.snapshot.state.rounds.length}`);
  console.log("\nFicheiros actualizados:");
  for (const p of result.paths.simPaths) console.log(`  sim: ${p}`);
  for (const p of result.paths.strategyPaths) console.log(`  strategy: ${p}`);
  for (const p of result.paths.configPaths) console.log(`  config: ${p}`);
  console.log("\nNa VPS, reinicie os processos: pm2 restart singlestake singlestake-automation");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
