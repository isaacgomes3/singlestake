import type { AffiliatesData, AffiliateMember } from "@/lib/back-office/network-types";
import { buildReferralLink } from "@/lib/referral/build-link";
import { getReferralLevels } from "@/lib/server/network/settings";
import {
  buildSponsorChildrenMap,
  getActivePackageAmounts,
  getSubscriptionStatuses,
  getUnilevelLevels,
  loadAllUsers,
  sumVolumeForUsers,
  countActiveUsers,
} from "@/lib/server/network/unilevel";

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toMember(
  user: Awaited<ReturnType<typeof loadAllUsers>>[number],
  packageAmounts: Map<string, number>,
  subscriptions: Map<string, "grace" | "active" | "pending" | "expired">,
): AffiliateMember {
  const amount = packageAmounts.get(user.id) ?? 0;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    referralCode: user.referralCode,
    qualification: user.qualification,
    joinedAt: formatDate(user.createdAt),
    hasActivePackage: amount > 0,
    packageAmount: amount,
    subscriptionStatus: subscriptions.get(user.id) ?? "pending",
  };
}

export async function buildAffiliatesData(
  userId: string,
  referralCode: string,
  origin: string,
): Promise<AffiliatesData> {
  const levels = await getReferralLevels();
  const maxLevel = Math.max(...levels.map((l) => l.level), 5);

  const [allUsers, packageAmounts, subscriptions] = await Promise.all([
    loadAllUsers(),
    getActivePackageAmounts(),
    getSubscriptionStatuses(),
  ]);

  const bySponsor = buildSponsorChildrenMap(allUsers);
  const directUsers = bySponsor.get(userId) ?? [];
  const unilevelLevels = getUnilevelLevels(userId, bySponsor, maxLevel);

  const allNetworkIds = unilevelLevels.flat().map((u) => u.id);
  const networkVolume = sumVolumeForUsers(allNetworkIds, packageAmounts);
  const activeInNetwork = countActiveUsers(allNetworkIds, packageAmounts);

  const percentByLevel = new Map(levels.map((l) => [l.level, l.percent]));

  const indirect = unilevelLevels.map((members, index) => {
    const level = index + 1;
    const ids = members.map((m) => m.id);
    return {
      level,
      percent: percentByLevel.get(level) ?? 0,
      count: members.length,
      activeCount: countActiveUsers(ids, packageAmounts),
      volume: sumVolumeForUsers(ids, packageAmounts),
    };
  });

  return {
    referralCode,
    referralLink: referralCode ? buildReferralLink(referralCode, origin) : "",
    levels,
    direct: directUsers.map((u) => toMember(u, packageAmounts, subscriptions)),
    indirect,
    totals: {
      directCount: directUsers.length,
      networkCount: allNetworkIds.length,
      networkVolume,
      activeInNetwork,
    },
  };
}
