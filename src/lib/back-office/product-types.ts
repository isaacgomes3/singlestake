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
  /** Checkout PIX disponível para este item no catálogo. */
  pixAvailable?: boolean;
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

export type PackagePixOrderDto = {
  id: string;
  packageId: string;
  amount: number;
  status: "pending" | "paid" | "expired" | "cancelled";
  txid: string;
  pixCopyPaste: string | null;
  qrCodeBase64: string | null;
  expiresAt: string | null;
  userPackageId: string | null;
  mode?: "efi" | "static";
  pixFixedAmount?: number | null;
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
