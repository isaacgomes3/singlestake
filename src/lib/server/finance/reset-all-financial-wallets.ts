import { randomUUID } from "node:crypto";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import { resolveCompanyUserId } from "@/lib/server/finance/company-pool";
import {
  GLOBAL_AUTOMATION_BUCKET,
  GLOBAL_AUTOMATION_LEDGER_REF_TYPES,
  getGlobalAutomationWalletBalance,
} from "@/lib/server/finance/global-automation-capital";
import { rebuildAllWalletBalancesFromLedger } from "@/lib/server/finance/wallet-rebuild";
import { getDb } from "@/lib/server/db/client";
import { auditLogs, ledgerEntries, withdrawals } from "@/lib/server/db/schema";

export type ResetAllFinancialWalletsResult = {
  ledgerRemoved: number;
  ledgerKept: number;
  walletsRebuilt: number;
  pendingWithdrawalsRejected: number;
  automationBalance: number;
};

/**
 * Zera todas as carteiras financeiras (utilizadores + empresa/admin).
 * Mantém apenas o extrato da automação global (capital + liquidações operacionais).
 * Não altera ficheiros JSON da automação (`roulette-automation-sim`, strategy global).
 */
export async function resetAllFinancialWalletsExceptGlobalAutomation(options?: {
  actorUserId?: string | null;
  actorLabel?: string;
}): Promise<ResetAllFinancialWalletsResult> {
  const db = getDb();
  const companyUserId = await resolveCompanyUserId();
  const now = new Date();

  const keptRows = await db.query.ledgerEntries.findMany({
    where: and(
      eq(ledgerEntries.userId, companyUserId),
      eq(ledgerEntries.bucket, GLOBAL_AUTOMATION_BUCKET),
      inArray(ledgerEntries.referenceType, [...GLOBAL_AUTOMATION_LEDGER_REF_TYPES]),
    ),
    columns: { id: true },
  });
  const keptIds = keptRows.map((row) => row.id);
  const ledgerKept = keptIds.length;

  const countBefore = await db
    .select({ count: sql<number>`count(*)` })
    .from(ledgerEntries);
  const totalBefore = Number(countBefore[0]?.count ?? 0);

  if (keptIds.length > 0) {
    await db.delete(ledgerEntries).where(notInArray(ledgerEntries.id, keptIds));
  } else {
    await db.delete(ledgerEntries);
  }

  const ledgerRemoved = Math.max(0, totalBefore - ledgerKept);

  const pendingWithdrawals = await db.query.withdrawals.findMany({
    where: eq(withdrawals.status, "pending"),
    columns: { id: true },
  });

  if (pendingWithdrawals.length > 0) {
    await db
      .update(withdrawals)
      .set({ status: "rejected", processedAt: now })
      .where(eq(withdrawals.status, "pending"));
  }

  const { accounts: walletsRebuilt } = await rebuildAllWalletBalancesFromLedger();

  const automationBalance = await getGlobalAutomationWalletBalance();

  if (options?.actorLabel) {
    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorUserId: options.actorUserId ?? null,
      actorLabel: options.actorLabel,
      action: "finance.reset_all_wallets",
      target: "wallet_accounts",
      detail: JSON.stringify({
        ledgerRemoved,
        ledgerKept,
        walletsRebuilt,
        pendingWithdrawalsRejected: pendingWithdrawals.length,
        automationBalance,
      }),
      createdAt: now,
    });
  }

  return {
    ledgerRemoved,
    ledgerKept,
    walletsRebuilt,
    pendingWithdrawalsRejected: pendingWithdrawals.length,
    automationBalance,
  };
}

/** Resumo dos saldos após reset — útil para verificação. */
export async function summarizeWalletBalances(): Promise<{
  totalAvailable: number;
  byBucket: Record<string, number>;
  automationBalance: number;
}> {
  const db = getDb();
  const rows = await db.query.walletAccounts.findMany();
  const byBucket: Record<string, number> = {};
  let totalAvailable = 0;
  for (const row of rows) {
    byBucket[row.bucket] = (byBucket[row.bucket] ?? 0) + row.availableBalance;
    totalAvailable += row.availableBalance;
  }
  const automationBalance = await getGlobalAutomationWalletBalance();
  return {
    totalAvailable: Math.round(totalAvailable * 100) / 100,
    byBucket,
    automationBalance,
  };
}
