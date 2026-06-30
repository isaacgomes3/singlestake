import { and, desc, eq, notInArray } from "drizzle-orm";

import {
  USER_LEDGER_FILTER_BUCKETS,
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

const BUCKET_NAME_IN_DESCRIPTION =
  /(?:rendimentos|afiliados|automacao|empresa|binario|residual|operacoes)/i;

/** Remove referências internas a carteiras/pools nas descrições do extrato do utilizador. */
export function sanitizeLedgerDescriptionForUser(description: string): string {
  let out = description
    .replace(/\s*—\s*carteira\s+[^—]+/gi, "")
    .replace(/\s*carteira\s+(?:empresa|automação|automacao|afiliados)\b[^—]*/gi, "")
    .replace(/\s*—\s*pool\s+(?:rede|indicação|indicacao|afiliados)[^—]*/gi, "")
    .replace(/\s*\([^)]*\)\s*$/i, (match) =>
      BUCKET_NAME_IN_DESCRIPTION.test(match) ? "" : match,
    );

  out = out.trim();
  if (out) return out;

  const beforeDash = description.split("—")[0]?.trim();
  return beforeDash || description;
}

export function isUserLedgerFilterBucket(bucket: WalletBucket): boolean {
  return (USER_LEDGER_FILTER_BUCKETS as readonly WalletBucket[]).includes(bucket);
}

function toDto(
  row: typeof ledgerEntries.$inferSelect,
  user: { name: string; email: string },
  forUserView: boolean,
): LedgerEntryDto {
  return {
    id: row.id,
    userId: row.userId,
    userName: user.name,
    userEmail: user.email,
    bucket: row.bucket as WalletBucket,
    entryType: row.entryType,
    amount: row.amount,
    description: forUserView ? sanitizeLedgerDescriptionForUser(row.description) : row.description,
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
  const forUserView = !filters.isAdmin;

  if (forUserView) {
    conditions.push(eq(ledgerEntries.userId, filters.userId));
    conditions.push(notInArray(ledgerEntries.bucket, ["empresa"]));
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

  return rows.map((row) =>
    toDto(row, { name: row.user.name, email: row.user.email }, forUserView),
  );
}

export function parseLedgerBucket(raw: string | null): WalletBucket | undefined {
  if (!raw) return undefined;
  return WALLET_BUCKETS.includes(raw as WalletBucket) ? (raw as WalletBucket) : undefined;
}

export function parseLedgerEntryType(raw: string | null): "credit" | "debit" | undefined {
  if (raw === "credit" || raw === "debit") return raw;
  return undefined;
}
