import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { REFERRAL_LEVELS, RESIDUAL_LEVELS, RESIDUAL_WEIGHT } from "@/lib/back-office/constants";
import type { PackageKind } from "@/lib/back-office/product-constants";
import {
  AUTOMATION_DIRECT_REFERRAL_PCT,
  calculateCompanyAutomationPaymentSplit,
  calculateStartSubscriptionCompanySplit,
} from "@/lib/back-office/product-constants";
import {
  creditCompanyBucket,
  debitCompanyAffiliatePool,
} from "@/lib/server/finance/company-pool";
import { capPayoutAmount } from "@/lib/server/finance/profit-cap";
import {
  getSponsorChain,
  isAffiliateServicesActive,
  recordMissedCredit,
} from "@/lib/server/finance/subscription-access";
import { getDb } from "@/lib/server/db/client";
import { users } from "@/lib/server/db/schema";
import { creditWallet } from "@/lib/server/finance/wallet";

export type PackageSplitAmounts = {
  /** Pool de indicação (carteira afiliados admin) */
  affiliateAmount: number;
  /** Carteira automação admin (só pacotes automação) */
  automacaoAmount: number;
  /** Carteira empresa admin */
  companyAmount: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const REFERRAL_WEIGHT = REFERRAL_LEVELS.reduce((sum, l) => sum + l.percent, 0);

export function calculatePackageSplit(amount: number, kind: PackageKind): PackageSplitAmounts {
  if (kind === "start") {
    const split = calculateStartSubscriptionCompanySplit(amount);
    return {
      affiliateAmount: split.afiliadosPoolAmount,
      automacaoAmount: 0,
      companyAmount: split.empresaAmount,
    };
  }
  const split = calculateCompanyAutomationPaymentSplit(amount);
  return {
    affiliateAmount: split.afiliadosPoolAmount,
    automacaoAmount: split.automacaoAmount,
    companyAmount: split.empresaAmount,
  };
}

async function paySponsorFromAffiliatePool(input: {
  sponsorId: string;
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
}): Promise<void> {
  if (input.amount <= 0) return;

  const db = getDb();
  const sponsor = await db.query.users.findFirst({
    where: eq(users.id, input.sponsorId),
  });
  if (sponsor?.role === "admin") return;

  const capped = await capPayoutAmount(input.sponsorId, input.amount);
  if (capped <= 0) return;

  const active = await isAffiliateServicesActive(input.sponsorId);
  if (active) {
    await creditWallet({
      userId: input.sponsorId,
      bucket: "afiliados",
      amount: capped,
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    });
    await debitCompanyAffiliatePool({
      amount: capped,
      description: `Saída pool afiliados — ${input.description}`,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    });
  } else {
    await recordMissedCredit({
      userId: input.sponsorId,
      amount: capped,
      reason: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    });
  }
}

/** Indicação pacote Start / automação — 5 níveis (10%, 5%, 3%, 1%, 1% do pool). */
export async function distributeReferralPool(input: {
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

    await paySponsorFromAffiliatePool({
      sponsorId,
      amount: share,
      description: `${input.descriptionPrefix} — nível ${level.level}`,
      referenceType: "package_referral",
      referenceId: input.referenceId,
    });
  }
}

/** Automação — só patrocinador directo, 10% do valor da cota (respeita teto de ganhos). */
export async function distributeAutomationDirectReferral(input: {
  buyerUserId: string;
  purchaseAmount: number;
  referenceId: string;
  packageName: string;
}): Promise<void> {
  if (input.purchaseAmount <= 0) return;

  const sponsors = await getSponsorChain(input.buyerUserId, 1);
  const sponsorId = sponsors[0];
  if (!sponsorId) return;

  const share = roundMoney((input.purchaseAmount * AUTOMATION_DIRECT_REFERRAL_PCT) / 100);
  if (share <= 0) return;

  await paySponsorFromAffiliatePool({
    sponsorId,
    amount: share,
    description: `Pacote ${input.packageName} — indicação directa (${AUTOMATION_DIRECT_REFERRAL_PCT}%)`,
    referenceType: "package_referral",
    referenceId: input.referenceId,
  });
}

/** Residual mensalidade — 10 níveis (% directo sobre parte rede). */
export async function distributeResidualPool(input: {
  payerUserId: string;
  poolAmount: number;
  referenceId: string;
}): Promise<void> {
  if (input.poolAmount <= 0) return;

  const sponsors = await getSponsorChain(input.payerUserId, RESIDUAL_LEVELS.length);

  for (let i = 0; i < RESIDUAL_LEVELS.length; i++) {
    const level = RESIDUAL_LEVELS[i]!;
    const sponsorId = sponsors[i];
    if (!sponsorId) continue;

    const share = roundMoney((input.poolAmount * level.percent) / RESIDUAL_WEIGHT);
    if (share <= 0) continue;

    await paySponsorFromAffiliatePool({
      sponsorId,
      amount: share,
      description: `Mensalidade — residual nível ${level.level}`,
      referenceType: "subscription_residual",
      referenceId: input.referenceId,
    });
  }
}

export async function distributeSubscriptionPayment(input: {
  payerUserId: string;
  amount: number;
  referenceId: string;
}): Promise<void> {
  const split = calculateStartSubscriptionCompanySplit(input.amount);

  await creditCompanyBucket({
    bucket: "empresa",
    amount: split.empresaAmount,
    description: "Mensalidade — carteira empresa",
    referenceType: "subscription",
    referenceId: input.referenceId,
  });

  await creditCompanyBucket({
    bucket: "afiliados",
    amount: split.afiliadosPoolAmount,
    description: "Mensalidade — pool rede (residual)",
    referenceType: "subscription",
    referenceId: input.referenceId,
  });

  await distributeResidualPool({
    payerUserId: input.payerUserId,
    poolAmount: split.afiliadosPoolAmount,
    referenceId: input.referenceId,
  });
}

export async function applyPackagePurchaseSplit(input: {
  buyerUserId: string;
  userPackageId: string;
  purchaseAmount: number;
  amounts: PackageSplitAmounts;
  packageName: string;
  packageKind: PackageKind;
}): Promise<void> {
  const refId = input.userPackageId;

  if (input.amounts.companyAmount > 0) {
    await creditCompanyBucket({
      bucket: "empresa",
      amount: input.amounts.companyAmount,
      description: `Pacote ${input.packageName} — carteira empresa`,
      referenceType: "package",
      referenceId: refId,
    });
  }

  if (input.amounts.automacaoAmount > 0) {
    await creditCompanyBucket({
      bucket: "automacao",
      amount: input.amounts.automacaoAmount,
      description: `Pacote ${input.packageName} — carteira automação (admin)`,
      referenceType: "package",
      referenceId: refId,
    });
  }

  if (input.amounts.affiliateAmount > 0) {
    await creditCompanyBucket({
      bucket: "afiliados",
      amount: input.amounts.affiliateAmount,
      description: `Pacote ${input.packageName} — pool indicação`,
      referenceType: "package",
      referenceId: refId,
    });

    if (input.packageKind === "automation") {
      await distributeAutomationDirectReferral({
        buyerUserId: input.buyerUserId,
        purchaseAmount: input.purchaseAmount,
        referenceId: refId,
        packageName: input.packageName,
      });
    } else {
      await distributeReferralPool({
        buyerUserId: input.buyerUserId,
        poolAmount: input.amounts.affiliateAmount,
        referenceType: "package_referral",
        referenceId: refId,
        descriptionPrefix: `Pacote ${input.packageName} — indicação`,
      });
    }
  }
}

/** @deprecated alias */
export const distributeAffiliatePool = distributeReferralPool;
