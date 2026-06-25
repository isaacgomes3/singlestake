import type { PackageKind } from "@/lib/back-office/product-constants";

export type PackageDto = {
  id: string;
  name: string;
  amount: number;
  minAmount: number;
  maxAmount: number;
  allowsCustomAmount: boolean;
  packageKind: PackageKind;
  active: boolean;
};

export type UserPackageDto = {
  id: string;
  packageId: string;
  packageName: string;
  amount: number;
  affiliateAmount: number;
  automationBase: number;
  companyAmount: number;
  totalEarned: number;
  maxProfit: number;
  status: string;
  startedAt: string;
  adhesionEndsAt: string;
};

export type SubscriptionDto = {
  status: "grace" | "active" | "pending" | "expired";
  active: boolean;
  amount: number;
  graceEndsAt: string | null;
  renewsAt: string | null;
  daysUntilDue: number | null;
  missedCredits: { amount: number; reason: string; createdAt: string }[];
  missedTotal: number;
};
