import { and, desc, eq, sql } from "drizzle-orm";

import type { BackOfficeOverview } from "@/lib/back-office/types";
import { BINARY_START_PACKAGE_ID } from "@/lib/back-office/binary-constants";
import type { WalletBucket } from "@/lib/server/finance/constants";
import { WITHDRAWABLE_BUCKETS } from "@/lib/server/finance/constants";
import { getDb } from "@/lib/server/db/client";
import { buildAffiliatesData } from "@/lib/server/network/affiliates";
import { getPersonalAutomationWalletBalance } from "@/lib/server/finance/global-automation-capital";
import {
  deposits,
  ledgerEntries,
  subscriptions,
  userPackages,
  users,
  walletAccounts,
  withdrawals,
} from "@/lib/server/db/schema";

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatLedgerDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function buildBackOfficeOverview(
  userId: string,
  referralCode: string,
  origin: string,
): Promise<BackOfficeOverview> {
  const db = getDb();

  const wallets = await db.query.walletAccounts.findMany({
    where: eq(walletAccounts.userId, userId),
  });

  const withdrawableBuckets = new Set<WalletBucket>(WITHDRAWABLE_BUCKETS);
  const personalAutomacao = await getPersonalAutomationWalletBalance(userId);
  const availableBalance = wallets
    .filter((w) => withdrawableBuckets.has(w.bucket as WalletBucket))
    .reduce(
      (sum, w) =>
        sum + (w.bucket === "automacao" ? personalAutomacao : w.availableBalance),
      0,
    );
  const blockedBalance = wallets
    .filter((w) => withdrawableBuckets.has(w.bucket as WalletBucket))
    .reduce(
      (sum, w) => sum + (w.bucket === "automacao" ? 0 : w.blockedBalance),
      0,
    );
  const earningsBalance = wallets.find((w) => w.bucket === "rendimentos")?.availableBalance ?? 0;

  const ledger = await db.query.ledgerEntries.findMany({
    where: eq(ledgerEntries.userId, userId),
    orderBy: [desc(ledgerEntries.createdAt)],
    limit: 12,
  });

  const todayStart = startOfTodayMs();
  const dailyEarnings = ledger
    .filter((e) => e.entryType === "credit" && e.createdAt.getTime() >= todayStart)
    .reduce((sum, e) => sum + e.amount, 0);

  const networkEarningsSum = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.userId, userId),
        eq(ledgerEntries.bucket, "afiliados"),
        eq(ledgerEntries.entryType, "credit"),
      ),
    );

  const depositedSum = await db
    .select({ total: sql<number>`coalesce(sum(${deposits.amount}), 0)` })
    .from(deposits)
    .where(and(eq(deposits.userId, userId), eq(deposits.status, "approved")));

  const withdrawnSum = await db
    .select({ total: sql<number>`coalesce(sum(${withdrawals.amount}), 0)` })
    .from(withdrawals)
    .where(
      and(eq(withdrawals.userId, userId), sql`${withdrawals.status} in ('approved', 'paid')`),
    );

  const activePackage = await db.query.userPackages.findFirst({
    where: and(eq(userPackages.userId, userId), eq(userPackages.status, "active")),
    orderBy: [desc(userPackages.createdAt)],
  });

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  const activePackages = await db.query.userPackages.findMany({
    where: and(eq(userPackages.userId, userId), eq(userPackages.status, "active")),
  });

  const investedBase = activePackages.reduce((sum, p) => sum + p.automationBase, 0);
  const earnedOnBase = activePackages.reduce((sum, p) => sum + p.totalEarned, 0);
  const automacaoWallet = personalAutomacao;
  const hasStartPack = activePackages.some((p) => p.packageId === BINARY_START_PACKAGE_ID);
  const displayBalance =
    automacaoWallet > 0 ? automacaoWallet : investedBase + earnedOnBase;

  const automation = {
    investedBase,
    earnedOnBase,
    walletBalance: automacaoWallet,
    displayBalance,
    hasStartPack,
  };

  const [affiliates] = await Promise.all([buildAffiliatesData(userId, referralCode, origin)]);

  const referralLink = affiliates.referralLink;

  const recentEntries = ledger.slice(0, 8).map((entry) => ({
    date: formatLedgerDate(entry.createdAt),
    description: entry.description,
    type: entry.entryType === "credit" ? ("Crédito" as const) : ("Débito" as const),
    amount: entry.amount,
  }));

  return {
    availableBalance,
    blockedBalance,
    dailyEarnings,
    accumulatedEarnings: networkEarningsSum[0]?.total ?? 0,
    totalDeposited: depositedSum[0]?.total ?? 0,
    totalWithdrawn: withdrawnSum[0]?.total ?? 0,
    packageStatus: activePackage?.status ?? "none",
    subscriptionStatus: subscription?.status ?? "pending",
    affiliateCount: affiliates.totals.directCount,
    networkVolume: affiliates.totals.networkVolume,
    nextQualifications: [],
    earningsBalance,
    directReferrals: affiliates.totals.directCount,
    activePlanValue: activePackage?.amount ?? 0,
    referralLink,
    recentEntries,
    marketChart: [],
    automation,
  };
}
