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

export type BinaryTreeNodeDetails = {
  email: string;
  joinedAt: string;
  hasActiveStart: boolean;
  packageAmount: number;
};

export type BinaryTreeNodeView = {
  userId: string | null;
  /** Id na árvore binária quando o slot aparece vazio (ex.: conta removida). */
  treeUserId?: string | null;
  name: string;
  side: "left" | "right" | null;
  level: number;
  isEmpty: boolean;
  /** Tem descendentes na BD além do que está visível — clique para expandir. */
  canExpand: boolean;
  children: BinaryTreeNodeView[];
  details?: BinaryTreeNodeDetails;
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

/** Indicado directo do utilizador — com perna na árvore quando já posicionado. */
export type BinaryDirectPlacement = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  hasActiveStart: boolean;
  /** Aguarda escolha manual de perna pelo patrocinador. */
  placementPending: boolean;
  side: "left" | "right" | null;
  placedAt: string | null;
};

export type NextDirectSidePreference = {
  /** Valor persistido na base de dados (null = ainda não escolheu). */
  stored: "left" | "right" | null;
  /** Perna preferida para UI (guardada ou sugerida por volume). */
  selected: "left" | "right";
  /** Há posição livre na perna para posicionar indicado pendente. */
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
  /** Todos os indicados directos (posicionados e pendentes). */
  myDirects: BinaryDirectPlacement[];
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
    availableLeft: number;
    availableRight: number;
    pendingLeft: number;
    pendingRight: number;
    /** @deprecated Use availableLeft */
    leftPoints: number;
    /** @deprecated Use availableRight */
    rightPoints: number;
    estimatedPayout: number;
    paidTotal: number;
    walletBalance: number;
  };
  team: {
    activeInNetwork: number;
    networkVolume: number;
    directActive: number;
    directCount: number;
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
