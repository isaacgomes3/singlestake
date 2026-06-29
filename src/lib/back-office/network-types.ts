import type { QualificationRank, ReferralLevel } from "@/lib/back-office/types";

export type AffiliateMember = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  qualification: QualificationRank;
  joinedAt: string;
  hasActivePackage: boolean;
  packageAmount: number;
  subscriptionStatus: "grace" | "active" | "pending" | "expired";
};

export type IndirectLevelSummary = {
  level: number;
  percent: number;
  count: number;
  activeCount: number;
  volume: number;
};

export type AffiliatesData = {
  referralCode: string;
  referralLink: string;
  levels: ReferralLevel[];
  direct: AffiliateMember[];
  indirect: IndirectLevelSummary[];
  totals: {
    directCount: number;
    networkCount: number;
    networkVolume: number;
    activeInNetwork: number;
  };
};

export type BinaryTreeNodeView = {
  userId: string;
  name: string;
  side: "left" | "right" | null;
  children: BinaryTreeNodeView[];
};

export type PendingDirectPlacement = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  hasActiveStart: boolean;
  pending: boolean;
  leftSlotAvailable: boolean;
  rightSlotAvailable: boolean;
};

export type NextDirectSidePreference = {
  /** Valor persistido na base de dados (null = ainda não escolheu). */
  stored: "left" | "right" | null;
  /** Perna efectiva para UI (guardada ou sugerida por pernas livres / volume). */
  selected: "left" | "right" | null;
  leftAvailable: boolean;
  rightAvailable: boolean;
};

export type BinaryNetworkData = {
  root: BinaryTreeNodeView;
  legs: {
    left: { count: number; volume: number };
    right: { count: number; volume: number };
    weakerVolume: number;
  };
  placement: {
    parentName: string | null;
    side: "left" | "right" | null;
    placedAt: string | null;
    pending: boolean;
  };
  nextDirectSide: NextDirectSidePreference;
  pendingDirects: PendingDirectPlacement[];
  binaryQualified: boolean;
};

export type QualificationRequirement = {
  rank: QualificationRank;
  label: string;
  minDirect: number;
  minDirectActive: number;
  minNetworkVolume: number;
  requiresSubscription: boolean;
};

export type QualificationProgress = {
  current: QualificationRank;
  currentLabel: string;
  requirements: QualificationRequirement[];
  progress: {
    directCount: number;
    directActive: number;
    networkVolume: number;
    subscriptionActive: boolean;
  };
  nextRank: QualificationRank | null;
  nextLabel: string | null;
  missingForNext: string[];
};

export type NetworkBonusesData = {
  binaryPoints: import("@/lib/server/network/binary-engine").BinaryPointsDashboard;
  binary: {
    globallyActive: boolean;
    leftPoints: number;
    rightPoints: number;
    estimatedPayout: number;
    paidTotal: number;
    walletBalance: number;
  };
  team: {
    activeInNetwork: number;
    networkVolume: number;
    directActive: number;
    qualification: QualificationRank;
    affiliateEarnings: number;
    walletBalance: number;
  };
};

export type SubAccountView = {
  id: string;
  name: string;
  email: string;
  level: number;
  legSide: "left" | "right";
  hasActiveStart: boolean;
  placedAt: string;
};
