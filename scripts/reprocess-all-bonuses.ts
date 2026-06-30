/**
 * Reprocessa todos os bónus conforme as regras actuais.
 *
 * Uso (com backup da BD):
 *   npx tsx scripts/reprocess-all-bonuses.ts
 *   npx tsx scripts/reprocess-all-bonuses.ts --dry-run
 *   npx tsx scripts/reprocess-all-bonuses.ts --skip-yield
 */
import "dotenv/config";

import { and, eq, inArray, notInArray } from "drizzle-orm";

import { MAX_PROFIT_MULTIPLIER } from "@/lib/back-office/product-constants";
import { getDb } from "@/lib/server/db/client";
import {
  binaryLegPoints,
  ledgerEntries,
  missedCredits,
  userPackages,
} from "@/lib/server/db/schema";
import { runDailyAutomationYield } from "@/lib/server/finance/automation-yield";
import {
  applyPackagePurchaseSplit,
  calculatePackageSplit,
  distributeSubscriptionPayment,
} from "@/lib/server/finance/package-split";
import { resolveCompanyUserId } from "@/lib/server/finance/company-pool";
import { rebuildAllWalletBalancesFromLedger } from "@/lib/server/finance/wallet-rebuild";
import {
  rebuildBinaryPointsFromHistory,
  settleAllPendingBinaryMatches,
} from "@/lib/server/network/binary-engine";

const BONUS_REFERENCE_TYPES = [
  "binary_bonus",
  "automation_yield",
  "subscription_residual",
  "package_referral",
] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipYield = process.argv.includes("--skip-yield");
  const db = getDb();

  console.log(dryRun ? "=== DRY RUN ===" : "=== REPROCESSAR BÓNUS ===");

  const packages = await db.query.userPackages.findMany({
    orderBy: (t, { asc }) => [asc(t.createdAt)],
    with: { pkg: true },
  });
  const subscriptionDebits = await db.query.ledgerEntries.findMany({
    where: and(
      eq(ledgerEntries.entryType, "debit"),
      eq(ledgerEntries.referenceType, "subscription"),
    ),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  console.log(`Pacotes: ${packages.length}`);
  console.log(`Pagamentos mensalidade: ${subscriptionDebits.length}`);

  if (dryRun) {
    console.log("Nada alterado (dry-run).");
    return;
  }

  let companyUserId: string | null = null;
  try {
    companyUserId = await resolveCompanyUserId();
  } catch {
    console.warn("Conta empresa não configurada — carteiras admin ignoradas no purge.");
  }

  console.log("\n1. Limpar créditos de bónus no ledger…");
  await db.delete(missedCredits);
  await db.delete(binaryLegPoints);

  await db.delete(ledgerEntries).where(
    inArray(ledgerEntries.referenceType, [...BONUS_REFERENCE_TYPES, "package"]),
  );

  await db.delete(ledgerEntries).where(
    and(
      inArray(ledgerEntries.bucket, ["afiliados", "automacao"]),
      eq(ledgerEntries.entryType, "credit"),
      notInArray(ledgerEntries.referenceType, ["withdrawal-rollback"]),
    ),
  );

  if (companyUserId) {
    await db.delete(ledgerEntries).where(
      and(
        eq(ledgerEntries.userId, companyUserId),
        inArray(ledgerEntries.bucket, ["empresa", "afiliados", "automacao"]),
      ),
    );
  }

  console.log("2. Repor totalEarned e automationBase nos pacotes…");
  for (const row of packages) {
    const kind = row.pkg.packageKind;
    await db
      .update(userPackages)
      .set({
        totalEarned: 0,
        automationBase: kind === "automation" ? row.amount : 0,
        maxProfit: row.amount * MAX_PROFIT_MULTIPLIER,
        status: "active",
      })
      .where(eq(userPackages.id, row.id));
  }

  console.log("3. Reaplicar splits de compras…");
  for (const row of packages) {
    const kind = row.pkg.packageKind as "start" | "automation";
    const split = calculatePackageSplit(row.amount, kind);
    await applyPackagePurchaseSplit({
      buyerUserId: row.userId,
      userPackageId: row.id,
      purchaseAmount: row.amount,
      amounts: split,
      packageName: row.pkg.name,
      packageKind: kind,
    });
  }

  console.log("4. Reaplicar mensalidades pagas…");
  for (const debit of subscriptionDebits) {
    await distributeSubscriptionPayment({
      payerUserId: debit.userId,
      amount: debit.amount,
      referenceId: debit.referenceId ?? debit.id,
    });
  }

  console.log("5. Recalcular pontos binários…");
  const binary = await rebuildBinaryPointsFromHistory();
  console.log(`   Compras: ${binary.purchases} · linhas: ${binary.pointsRows}`);

  const settled = await settleAllPendingBinaryMatches();
  console.log(`   Liquidações tentadas: ${settled.levelsProcessed}`);

  if (!skipYield) {
    console.log("6. Simular rendimentos diários (pacotes automação)…");
    const automationPkgs = packages.filter((p) => p.pkg.packageKind === "automation");
    if (automationPkgs.length > 0) {
      const first = automationPkgs[0]!.startedAt;
      const last = new Date();
      let day = new Date(first);
      day.setHours(0, 0, 0, 0);
      let days = 0;
      while (day <= last) {
        await runDailyAutomationYield();
        day = new Date(day.getTime() + 86_400_000);
        days++;
        if (days > 400) break;
      }
      console.log(`   Dias simulados: ${days}`);
    } else {
      console.log("   Sem pacotes de automação.");
    }
  }

  console.log("7. Sincronizar saldos das carteiras…");
  const rebuilt = await rebuildAllWalletBalancesFromLedger();
  console.log(`   Contas: ${rebuilt.accounts}`);

  console.log("\nConcluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
