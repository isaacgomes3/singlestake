import { and, desc, eq } from "drizzle-orm";

import {
  WALLET_BUCKETS,
  type WalletBucket,
} from "@/lib/back-office/finance-constants";
import { getDb } from "@/lib/server/db/client";
import { ledgerEntries } from "@/lib/server/db/schema";

export type LedgerEntryDto = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bucket: WalletBucket;
  entryType: "credit" | "debit";
  amount: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

function toDto(
  row: typeof ledgerEntries.$inferSelect,
  user: { name: string; email: string },
): LedgerEntryDto {
  return {
    id: row.id,
    userId: row.userId,
    userName: user.name,
    userEmail: user.email,
    bucket: row.bucket as WalletBucket,
    entryType: row.entryType,
    amount: row.amount,
    description: row.description,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt.toISOString(),
  };
}

export type ListLedgerFilters = {
  userId: string;
  isAdmin: boolean;
  bucket?: WalletBucket;
  entryType?: "credit" | "debit";
  limit?: number;
};

export async function listLedgerEntries(filters: ListLedgerFilters): Promise<LedgerEntryDto[]> {
  const db = getDb();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);

  const conditions = [];
  if (!filters.isAdmin) {
    conditions.push(eq(ledgerEntries.userId, filters.userId));
  }
  if (filters.bucket) {
    conditions.push(eq(ledgerEntries.bucket, filters.bucket));
  }
  if (filters.entryType) {
    conditions.push(eq(ledgerEntries.entryType, filters.entryType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.query.ledgerEntries.findMany({
    where: whereClause,
    orderBy: [desc(ledgerEntries.createdAt)],
    limit,
    with: { user: true },
  });

  return rows.map((row) => toDto(row, { name: row.user.name, email: row.user.email }));
}

export function parseLedgerBucket(raw: string | null): WalletBucket | undefined {
  if (!raw) return undefined;
  return WALLET_BUCKETS.includes(raw as WalletBucket) ? (raw as WalletBucket) : undefined;
}

export function parseLedgerEntryType(raw: string | null): "credit" | "debit" | undefined {
  if (raw === "credit" || raw === "debit") return raw;
  return undefined;
}
