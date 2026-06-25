import { QUALIFICATION_RANKS } from "@/lib/back-office/constants";
import type { QualificationProgress, QualificationRequirement } from "@/lib/back-office/network-types";
import type { QualificationRank } from "@/lib/back-office/types";
import {
  buildSponsorChildrenMap,
  getActivePackageAmounts,
  getSubscriptionStatuses,
  getUnilevelLevels,
  loadAllUsers,
  sumVolumeForUsers,
  countActiveUsers,
} from "@/lib/server/network/unilevel";

const REQUIREMENTS: QualificationRequirement[] = [
  {
    rank: "bronze",
    label: "Bronze",
    minDirect: 0,
    minDirectActive: 0,
    minNetworkVolume: 0,
    requiresSubscription: false,
  },
  {
    rank: "prata",
    label: "Prata",
    minDirect: 2,
    minDirectActive: 2,
    minNetworkVolume: 1_000,
    requiresSubscription: true,
  },
  {
    rank: "ouro",
    label: "Ouro",
    minDirect: 5,
    minDirectActive: 3,
    minNetworkVolume: 5_000,
    requiresSubscription: true,
  },
  {
    rank: "diamante",
    label: "Diamante",
    minDirect: 10,
    minDirectActive: 5,
    minNetworkVolume: 20_000,
    requiresSubscription: true,
  },
  {
    rank: "imperial",
    label: "Imperial",
    minDirect: 20,
    minDirectActive: 10,
    minNetworkVolume: 50_000,
    requiresSubscription: true,
  },
];

const RANK_ORDER: QualificationRank[] = QUALIFICATION_RANKS.map((r) => r.id);

function rankIndex(rank: QualificationRank): number {
  return RANK_ORDER.indexOf(rank);
}

function meetsRequirement(
  req: QualificationRequirement,
  progress: QualificationProgress["progress"],
): boolean {
  if (progress.directCount < req.minDirect) return false;
  if (progress.directActive < req.minDirectActive) return false;
  if (progress.networkVolume < req.minNetworkVolume) return false;
  if (req.requiresSubscription && !progress.subscriptionActive) return false;
  return true;
}

function computeMissing(
  req: QualificationRequirement,
  progress: QualificationProgress["progress"],
): string[] {
  const missing: string[] = [];
  if (progress.directCount < req.minDirect) {
    missing.push(`${req.minDirect - progress.directCount} indicado(s) directo(s)`);
  }
  if (progress.directActive < req.minDirectActive) {
    missing.push(`${req.minDirectActive - progress.directActive} directo(s) com pacote activo`);
  }
  if (progress.networkVolume < req.minNetworkVolume) {
    const gap = req.minNetworkVolume - progress.networkVolume;
    missing.push(`R$ ${gap.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de volume na rede`);
  }
  if (req.requiresSubscription && !progress.subscriptionActive) {
    missing.push("Mensalidade activa");
  }
  return missing;
}

export async function buildQualificationProgress(
  userId: string,
  storedRank: QualificationRank,
): Promise<QualificationProgress> {
  const [allUsers, packageAmounts, subscriptions] = await Promise.all([
    loadAllUsers(),
    getActivePackageAmounts(),
    getSubscriptionStatuses(),
  ]);

  const bySponsor = buildSponsorChildrenMap(allUsers);
  const direct = bySponsor.get(userId) ?? [];
  const directIds = direct.map((u) => u.id);
  const networkLevels = getUnilevelLevels(userId, bySponsor, 5);
  const networkIds = networkLevels.flat().map((u) => u.id);

  const progress = {
    directCount: direct.length,
    directActive: countActiveUsers(directIds, packageAmounts),
    networkVolume: sumVolumeForUsers(networkIds, packageAmounts),
    subscriptionActive: subscriptions.get(userId) === "active",
  };

  let earnedRank: QualificationRank = "bronze";
  for (const req of REQUIREMENTS) {
    if (meetsRequirement(req, progress)) {
      earnedRank = req.rank;
    }
  }

  const current = rankIndex(storedRank) >= rankIndex(earnedRank) ? storedRank : earnedRank;
  const currentIdx = rankIndex(current);
  const nextRank = currentIdx < RANK_ORDER.length - 1 ? RANK_ORDER[currentIdx + 1]! : null;
  const nextReq = nextRank ? REQUIREMENTS.find((r) => r.rank === nextRank) : null;

  const currentLabel = QUALIFICATION_RANKS.find((r) => r.id === current)?.label ?? current;
  const nextLabel = nextRank
    ? (QUALIFICATION_RANKS.find((r) => r.id === nextRank)?.label ?? nextRank)
    : null;

  return {
    current,
    currentLabel,
    requirements: REQUIREMENTS,
    progress,
    nextRank,
    nextLabel,
    missingForNext: nextReq ? computeMissing(nextReq, progress) : [],
  };
}
