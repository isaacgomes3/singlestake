import { eq, sql } from "drizzle-orm";

import type { WalletBucket } from "@/lib/back-office/finance-constants";
import { getDb } from "@/lib/server/db/client";
import { ledgerEntries, walletAccounts } from "@/lib/server/db/schema";

/** Recalcula saldos a partir do livro razão (após limpeza de bónus). */
export async function rebuildAllWalletBalancesFromLedger(): Promise<{ accounts: number }> {
  const db = getDb();
  const accounts = await db.query.walletAccounts.findMany();
  const now = new Date();

  for (const account of accounts) {
    const sums = await db
      .select({
        credits: sql<number>`coalesce(sum(case when ${ledgerEntries.entryType} = 'credit' then ${ledgerEntries.amount} else 0 end), 0)`,
        debits: sql<number>`coalesce(sum(case when ${ledgerEntries.entryType} = 'debit' then ${ledgerEntries.amount} else 0 end), 0)`,
      })
      .from(ledgerEntries)
      .where(
        sql`${ledgerEntries.userId} = ${account.userId} and ${ledgerEntries.bucket} = ${account.bucket}`,
      );

    const balance = (sums[0]?.credits ?? 0) - (sums[0]?.debits ?? 0);
    await db
      .update(walletAccounts)
      .set({
        availableBalance: Math.round(balance * 100) / 100,
        blockedBalance: 0,
        updatedAt: now,
      })
      .where(eq(walletAccounts.id, account.id));
  }

  return { accounts: accounts.length };
}

export async function zeroWalletBucketForAllUsers(
  bucket: WalletBucket,
): Promise<{ accounts: number }> {
  const db = getDb();
  const accounts = await db.query.walletAccounts.findMany({
    where: eq(walletAccounts.bucket, bucket),
  });
  const now = new Date();
  for (const account of accounts) {
    await db
      .update(walletAccounts)
      .set({ availableBalance: 0, blockedBalance: 0, updatedAt: now })
      .where(eq(walletAccounts.id, account.id));
  }
  return { accounts: accounts.length };
}
