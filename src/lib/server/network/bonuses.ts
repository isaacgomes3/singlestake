import { and, eq, sql } from "drizzle-orm";



import type { NetworkBonusesData } from "@/lib/back-office/network-types";

import { getDb } from "@/lib/server/db/client";

import { ledgerEntries, walletAccounts } from "@/lib/server/db/schema";

import { buildBinaryPointsDashboard } from "@/lib/server/network/binary-engine";

import {

  buildSponsorChildrenMap,

  countActiveUsers,

  getActivePackageAmounts,

  getUnilevelLevels,

  loadAllUsers,

  sumVolumeForUsers,

} from "@/lib/server/network/unilevel";



export async function buildNetworkBonusesData(
  userId: string,
): Promise<NetworkBonusesData> {

  const db = getDb();



  const [binaryPoints, allUsers, packageAmounts, wallets, affiliateCredits, binaryCredits] =

    await Promise.all([

      buildBinaryPointsDashboard(userId),

      loadAllUsers(),

      getActivePackageAmounts(),

      db.query.walletAccounts.findMany({ where: eq(walletAccounts.userId, userId) }),

      db

        .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)` })

        .from(ledgerEntries)

        .where(

          and(

            eq(ledgerEntries.userId, userId),

            eq(ledgerEntries.bucket, "afiliados"),

            eq(ledgerEntries.entryType, "credit"),

          ),

        ),

      db

        .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)` })

        .from(ledgerEntries)

        .where(

          and(

            eq(ledgerEntries.userId, userId),

            eq(ledgerEntries.referenceType, "binary_bonus"),

            eq(ledgerEntries.entryType, "credit"),

          ),

        ),

    ]);



  const bySponsor = buildSponsorChildrenMap(allUsers);

  const direct = bySponsor.get(userId) ?? [];

  const networkLevels = getUnilevelLevels(userId, bySponsor, 5);

  const networkIds = networkLevels.flat().map((u) => u.id);



  const totalLeft = binaryPoints.availableLeft;
  const totalRight = binaryPoints.availableRight;
  const estimatedPayout = binaryPoints.potentialPayout;



  const affiliateWallet = wallets.find((w) => w.bucket === "afiliados");



  return {

    binaryPoints,

    binary: {
      globallyActive: binaryPoints.globallyActive,
      availableLeft: binaryPoints.availableLeft,
      availableRight: binaryPoints.availableRight,
      pendingLeft: binaryPoints.pendingLeft,
      pendingRight: binaryPoints.pendingRight,
      leftPoints: totalLeft,
      rightPoints: totalRight,
      estimatedPayout,
      paidTotal: binaryCredits[0]?.total ?? 0,
      walletBalance: affiliateWallet?.availableBalance ?? 0,
    },

    team: {
      activeInNetwork: countActiveUsers(networkIds, packageAmounts),
      networkVolume: sumVolumeForUsers(networkIds, packageAmounts),
      directActive: countActiveUsers(
        direct.map((u) => u.id),
        packageAmounts,
      ),
      directCount: direct.length,
      affiliateEarnings: affiliateCredits[0]?.total ?? 0,
      walletBalance: affiliateWallet?.availableBalance ?? 0,
    },

  };

}


