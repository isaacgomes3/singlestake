import { and, eq, notInArray, sql } from "drizzle-orm";

import { computeMaxProfit, computeTotalReturnCap } from "@/lib/back-office/product-constants";
import { getDb } from "@/lib/server/db/client";
import { ledgerEntries, userPackages } from "@/lib/server/db/schema";

/** Créditos que não contam para o teto de lucro. */
const NON_EARNING_REFERENCE_TYPES = ["deposit", "withdrawal", "withdrawal-rollback"];

export type ProfitCapStatus = {
  invested: number;
  /** Teto de lucro (200% de cada pacote/cota) — ganhos máximos além do capital. */
  cap: number;
  /** Capital + lucro máximo (ex.: Start R$50 → R$150). */
  totalReturnCap: number;
  earned: number;
  remaining: number;
};

export async function getProfitCapStatus(userId: string): Promise<ProfitCapStatus> {
  const db = getDb();

  const packages = await db.query.userPackages.findMany({
    where: eq(userPackages.userId, userId),
  });

  const invested = packages.reduce((sum, p) => sum + p.amount, 0);
  const cap = packages.reduce((sum, p) => sum + computeMaxProfit(p.amount), 0);
  const totalReturnCap = packages.reduce((sum, p) => sum + computeTotalReturnCap(p.amount), 0);
  const packageEarned = packages.reduce((sum, p) => sum + p.totalEarned, 0);

  const affiliateEarned = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.userId, userId),
        eq(ledgerEntries.entryType, "credit"),
        eq(ledgerEntries.bucket, "afiliados"),
        notInArray(ledgerEntries.referenceType, NON_EARNING_REFERENCE_TYPES),
      ),
    );

  const earned = packageEarned + (affiliateEarned[0]?.total ?? 0);
  const remaining = Math.max(0, cap - earned);

  return { invested, cap, totalReturnCap, earned, remaining };
}

export async function capPayoutAmount(userId: string, requested: number): Promise<number> {
  if (requested <= 0) return 0;
  const status = await getProfitCapStatus(userId);
  if (status.cap <= 0) return 0;
  return Math.min(requested, status.remaining);
}
