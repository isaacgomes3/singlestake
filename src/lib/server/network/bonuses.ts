import { and, eq, sql } from "drizzle-orm";



import type { NetworkBonusesData } from "@/lib/back-office/network-types";

import type { QualificationRank } from "@/lib/back-office/types";

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

  _userName: string,

  qualification: QualificationRank,

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



  const totalLeft = binaryPoints.levels.reduce((s, l) => s + l.left.available, 0);

  const totalRight = binaryPoints.levels.reduce((s, l) => s + l.right.available, 0);

  const estimatedPayout = binaryPoints.levels.reduce((s, l) => s + l.potentialPayout, 0);



  const affiliateWallet = wallets.find((w) => w.bucket === "afiliados");



  return {

    binaryPoints,

    binary: {

      globallyActive: binaryPoints.globallyActive,

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

      qualification,

      affiliateEarnings: affiliateCredits[0]?.total ?? 0,

      walletBalance: affiliateWallet?.availableBalance ?? 0,

    },

  };

}


