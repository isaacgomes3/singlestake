import { randomUUID } from "node:crypto";

import type { PackageKind } from "@/lib/back-office/product-constants";
import {
  getPackageSplit,
  SUBSCRIPTION_COMPANY_SHARE,
  SUBSCRIPTION_NETWORK_SHARE,
} from "@/lib/back-office/product-constants";
import { REFERRAL_LEVELS } from "@/lib/back-office/constants";
import { creditCompanyPool } from "@/lib/server/finance/company-pool";
import {
  getSponsorChain,
  isAffiliateServicesActive,
  recordMissedCredit,
} from "@/lib/server/finance/subscription-access";
import { creditWallet } from "@/lib/server/finance/wallet";

export type PackageSplitAmounts = {
  affiliateAmount: number;
  automationBase: number;
  companyAmount: number;
};

export function calculatePackageSplit(amount: number, kind: PackageKind): PackageSplitAmounts {
  const split = getPackageSplit(kind);
  return {
    affiliateAmount: roundMoney(amount * split.afiliados),
    automationBase: roundMoney(amount * split.automacao),
    companyAmount: roundMoney(amount * split.empresa),
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const REFERRAL_WEIGHT = REFERRAL_LEVELS.reduce((sum, l) => sum + l.percent, 0);

export async function distributeAffiliatePool(input: {
  buyerUserId: string;
  poolAmount: number;
  referenceType: string;
  referenceId: string;
  descriptionPrefix: string;
}): Promise<void> {
  if (input.poolAmount <= 0) return;

  const sponsors = await getSponsorChain(input.buyerUserId, REFERRAL_LEVELS.length);

  for (let i = 0; i < REFERRAL_LEVELS.length; i++) {
    const level = REFERRAL_LEVELS[i]!;
    const sponsorId = sponsors[i];
    if (!sponsorId) continue;

    const share = roundMoney((input.poolAmount * level.percent) / REFERRAL_WEIGHT);
    if (share <= 0) continue;

    const active = await isAffiliateServicesActive(sponsorId);
    const description = `${input.descriptionPrefix} — nível ${level.level}`;

    if (active) {
      await creditWallet({
        userId: sponsorId,
        bucket: "afiliados",
        amount: share,
        description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      });
    } else {
      await recordMissedCredit({
        userId: sponsorId,
        amount: share,
        reason: description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      });
    }
  }
}

export async function distributeSubscriptionPayment(input: {
  payerUserId: string;
  amount: number;
  referenceId: string;
}): Promise<void> {
  const networkPool = roundMoney(input.amount * SUBSCRIPTION_NETWORK_SHARE);
  const companyAmount = roundMoney(input.amount * SUBSCRIPTION_COMPANY_SHARE);

  await creditCompanyPool({
    amount: companyAmount,
    description: "Mensalidade — carteira empresa (50%)",
    referenceType: "subscription",
    referenceId: input.referenceId,
  });

  await distributeAffiliatePool({
    buyerUserId: input.payerUserId,
    poolAmount: networkPool,
    referenceType: "subscription",
    referenceId: input.referenceId,
    descriptionPrefix: "Mensalidade — bónus rede",
  });
}

export async function applyPackagePurchaseSplit(input: {
  buyerUserId: string;
  userPackageId: string;
  amounts: PackageSplitAmounts;
  packageName: string;
}): Promise<void> {
  await creditCompanyPool({
    amount: input.amounts.companyAmount,
    description: `Pacote ${input.packageName} — empresa (50%)`,
    referenceType: "package",
    referenceId: input.userPackageId,
  });

  await distributeAffiliatePool({
    buyerUserId: input.buyerUserId,
    poolAmount: input.amounts.affiliateAmount,
    referenceType: "package",
    referenceId: input.userPackageId,
    descriptionPrefix: `Pacote ${input.packageName} — afiliados`,
  });
}
