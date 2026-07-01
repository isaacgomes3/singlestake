/**
 * Zera saldos de todas as carteiras financeiras (utilizadores + admin/empresa).
 * Mantém o extrato da automação global (saldo operacional do painel).
 *
 * Uso local:
 *   npm run reset:financial-wallets -- --confirm
 *
 * VPS:
 *   cd /var/www/stake37 && npx tsx scripts/reset-financial-wallets.ts --confirm
 *   pm2 restart singlestake singlestake-automation
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

import {
  resetAllFinancialWalletsExceptGlobalAutomation,
  summarizeWalletBalances,
} from "../src/lib/server/finance/reset-all-financial-wallets";
import { closeDb } from "../src/lib/server/db/client";

const root = resolve(import.meta.dirname, "..");

for (const file of [".env", ".env.automation"]) {
  const path = resolve(root, file);
  if (existsSync(path)) config({ path, override: false });
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const dryRun = process.argv.includes("--dry-run");

  if (!confirm && !dryRun) {
    console.error("Operação destrutiva — use --confirm ou --dry-run para pré-visualizar.");
    process.exit(1);
  }

  const before = await summarizeWalletBalances();
  console.log("Antes:");
  console.log(`  Total carteiras (soma): R$ ${before.totalAvailable.toFixed(2)}`);
  console.log(`  Automação global (mantida): R$ ${before.automationBalance.toFixed(2)}`);
  for (const [bucket, value] of Object.entries(before.byBucket)) {
    if (Math.abs(value) > 0.001) console.log(`    ${bucket}: R$ ${value.toFixed(2)}`);
  }

  if (dryRun) {
    console.log("\nDry-run — nada alterado.");
    return;
  }

  const result = await resetAllFinancialWalletsExceptGlobalAutomation({
    actorLabel: "script:reset-financial-wallets",
  });

  const after = await summarizeWalletBalances();

  console.log("\nConcluído:");
  console.log(`  Linhas removidas do extrato: ${result.ledgerRemoved}`);
  console.log(`  Linhas mantidas (automação global): ${result.ledgerKept}`);
  console.log(`  Carteiras recalculadas: ${result.walletsRebuilt}`);
  console.log(`  Saques pendentes rejeitados: ${result.pendingWithdrawalsRejected}`);
  console.log(`  Saldo automação global: R$ ${result.automationBalance.toFixed(2)}`);
  console.log("\nDepois:");
  console.log(`  Total carteiras (soma): R$ ${after.totalAvailable.toFixed(2)}`);
  for (const [bucket, value] of Object.entries(after.byBucket)) {
    if (Math.abs(value) > 0.001) console.log(`    ${bucket}: R$ ${value.toFixed(2)}`);
  }
  console.log("\nReinicie PM2 na VPS se aplicável: pm2 restart singlestake singlestake-automation");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
