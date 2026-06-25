import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { WalletBucket } from "@/lib/back-office/finance-constants";
import { getDb } from "@/lib/server/db/client";
import { ledgerEntries, walletAccounts } from "@/lib/server/db/schema";

export type WalletBalance = {
  bucket: WalletBucket;
  availableBalance: number;
  blockedBalance: number;
};

export async function getWalletBalances(userId: string): Promise<WalletBalance[]> {
  const db = getDb();
  const rows = await db.query.walletAccounts.findMany({
    where: eq(walletAccounts.userId, userId),
  });
  return rows.map((row) => ({
    bucket: row.bucket as WalletBucket,
    availableBalance: row.availableBalance,
    blockedBalance: row.blockedBalance,
  }));
}

export async function getWalletBalance(
  userId: string,
  bucket: WalletBucket,
): Promise<WalletBalance | null> {
  const db = getDb();
  const row = await db.query.walletAccounts.findFirst({
    where: and(eq(walletAccounts.userId, userId), eq(walletAccounts.bucket, bucket)),
  });
  if (!row) return null;
  return {
    bucket: row.bucket as WalletBucket,
    availableBalance: row.availableBalance,
    blockedBalance: row.blockedBalance,
  };
}

export async function creditWallet(input: {
  userId: string;
  bucket: WalletBucket;
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
}): Promise<void> {
  if (input.amount <= 0) throw new Error("INVALID_AMOUNT");

  const db = getDb();
  await db.transaction(async (tx) => {
    const account = await tx.query.walletAccounts.findFirst({
      where: and(
        eq(walletAccounts.userId, input.userId),
        eq(walletAccounts.bucket, input.bucket),
      ),
    });
    if (!account) throw new Error("WALLET_NOT_FOUND");

    const now = new Date();
    await tx
      .update(walletAccounts)
      .set({
        availableBalance: account.availableBalance + input.amount,
        updatedAt: now,
      })
      .where(eq(walletAccounts.id, account.id));

    await tx.insert(ledgerEntries).values({
      id: randomUUID(),
      userId: input.userId,
      bucket: input.bucket,
      entryType: "credit",
      amount: input.amount,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdAt: now,
    });
  });
}

export async function debitWallet(input: {
  userId: string;
  bucket: WalletBucket;
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
}): Promise<void> {
  if (input.amount <= 0) throw new Error("INVALID_AMOUNT");

  const db = getDb();
  await db.transaction(async (tx) => {
    const account = await tx.query.walletAccounts.findFirst({
      where: and(
        eq(walletAccounts.userId, input.userId),
        eq(walletAccounts.bucket, input.bucket),
      ),
    });
    if (!account) throw new Error("WALLET_NOT_FOUND");
    if (account.availableBalance < input.amount) throw new Error("INSUFFICIENT_BALANCE");

    const now = new Date();
    await tx
      .update(walletAccounts)
      .set({
        availableBalance: account.availableBalance - input.amount,
        updatedAt: now,
      })
      .where(eq(walletAccounts.id, account.id));

    await tx.insert(ledgerEntries).values({
      id: randomUUID(),
      userId: input.userId,
      bucket: input.bucket,
      entryType: "debit",
      amount: input.amount,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdAt: now,
    });
  });
}
