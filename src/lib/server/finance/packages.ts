import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import {
  ADHESION_DAYS,
  CATALOG_EXCLUDED_PACKAGE_IDS,
  MAX_PROFIT_MULTIPLIER,
  START_PACKAGE_ID,
  validateAutomationDepositAmount,
} from "@/lib/back-office/product-constants";
import type { PackageKind } from "@/lib/back-office/product-constants";
import { getDb } from "@/lib/server/db/client";
import { investmentPackages, userPackages, users } from "@/lib/server/db/schema";
import {
  applyPackagePurchaseSplit,
  calculatePackageSplit,
} from "@/lib/server/finance/package-split";
import { debitWallet, getWalletBalance } from "@/lib/server/finance/wallet";
import { isCatalogPackagePixAvailableAsync } from "@/lib/server/finance/package-pix";

import type { PackageDto, UserPackageDto } from "@/lib/back-office/product-types";

export async function listAvailablePackages(): Promise<PackageDto[]> {
  const db = getDb();
  const rows = await db.query.investmentPackages.findMany({
    where: eq(investmentPackages.active, true),
  });
  const filtered = rows.filter((row) => !CATALOG_EXCLUDED_PACKAGE_IDS.has(row.id));
  const pixFlags = await Promise.all(
    filtered.map((row) => isCatalogPackagePixAvailableAsync(row.id)),
  );
  return filtered.map((row, index) => ({
    id: row.id,
    name: row.name,
    amount: row.minAmount,
    minAmount: row.minAmount,
    maxAmount: row.maxAmount,
    allowsCustomAmount: row.minAmount !== row.maxAmount,
    packageKind: row.packageKind as PackageKind,
    active: row.active,
    pixAvailable: pixFlags[index] ?? false,
  }));
}

async function userHasActiveStart(userId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.userPackages.findFirst({
    where: and(
      eq(userPackages.userId, userId),
      eq(userPackages.packageId, START_PACKAGE_ID),
      eq(userPackages.status, "active"),
    ),
  });
  return !!row;
}

function resolvePurchaseAmount(
  pkg: typeof investmentPackages.$inferSelect,
  customAmount?: number,
): { ok: true; amount: number } | { ok: false; error: string } {
  const isFlex = pkg.minAmount !== pkg.maxAmount;

  if (isFlex) {
    if (customAmount == null || !Number.isFinite(customAmount)) {
      return {
        ok: false,
        error: "Informe o valor do depósito de automação (múltiplos de R$ 250).",
      };
    }
    const validationError = validateAutomationDepositAmount(customAmount);
    if (validationError) return { ok: false, error: validationError };
    if (customAmount < pkg.minAmount || customAmount > pkg.maxAmount) {
      return {
        ok: false,
        error: `Valor fora do intervalo permitido (R$ ${pkg.minAmount.toFixed(2)} – R$ ${pkg.maxAmount.toFixed(2)}).`,
      };
    }
    return { ok: true, amount: customAmount };
  }

  const amount = pkg.minAmount;
  if (pkg.packageKind === "automation") {
    const validationError = validateAutomationDepositAmount(amount);
    if (validationError) return { ok: false, error: validationError };
  }
  return { ok: true, amount };
}

export async function validatePackagePurchase(input: {
  userId: string;
  packageId: string;
  amount?: number;
}): Promise<
  { ok: true; amount: number; packageName: string } | { ok: false; error: string }
> {
  const db = getDb();
  const pkg = await db.query.investmentPackages.findFirst({
    where: and(eq(investmentPackages.id, input.packageId), eq(investmentPackages.active, true)),
  });
  if (!pkg) return { ok: false, error: "Pacote não encontrado ou inactivo." };

  const kind = pkg.packageKind as PackageKind;
  if (kind === "automation") {
    const hasStart = await userHasActiveStart(input.userId);
    if (!hasStart) {
      return {
        ok: false,
        error: "É necessário ter o Pacote Start R$ 50 activo antes de depositar em automação.",
      };
    }
  }

  const resolved = resolvePurchaseAmount(pkg, input.amount);
  if (!resolved.ok) return resolved;
  return { ok: true, amount: resolved.amount, packageName: pkg.name };
}

export async function listUserPackages(userId: string): Promise<UserPackageDto[]> {
  const db = getDb();
  const rows = await db.query.userPackages.findMany({
    where: eq(userPackages.userId, userId),
    orderBy: [desc(userPackages.createdAt)],
    with: { pkg: true },
  });

  return rows.map((row) => ({
    id: row.id,
    packageId: row.packageId,
    packageName: row.pkg.name,
    amount: row.amount,
    affiliateAmount: row.affiliateAmount,
    automationBase: row.automationBase,
    companyAmount: row.companyAmount,
    totalEarned: row.totalEarned,
    maxProfit: row.maxProfit,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    adhesionEndsAt: row.adhesionEndsAt.toISOString(),
  }));
}

export type ActivatePackageInput = {
  userId: string;
  packageId: string;
  amount: number;
  skipWalletDebit?: boolean;
  payerUserId?: string;
};

export async function activatePackageAfterPayment(
  input: ActivatePackageInput,
): Promise<{ ok: true; userPackage: UserPackageDto } | { ok: false; error: string }> {
  const db = getDb();
  const pkg = await db.query.investmentPackages.findFirst({
    where: and(eq(investmentPackages.id, input.packageId), eq(investmentPackages.active, true)),
  });
  if (!pkg) return { ok: false, error: "Pacote não encontrado ou inactivo." };

  const kind = pkg.packageKind as PackageKind;
  if (kind === "automation") {
    const hasStart = await userHasActiveStart(input.userId);
    if (!hasStart) {
      return {
        ok: false,
        error: "É necessário ter o Pacote Start R$ 50 activo antes de depositar em automação.",
      };
    }
  }

  const amount = input.amount;
  const payerId = input.payerUserId ?? input.userId;

  if (!input.skipWalletDebit) {
    const wallet = await getWalletBalance(payerId, "rendimentos");
    if (!wallet || wallet.availableBalance < amount) {
      return {
        ok: false,
        error: `Saldo insuficiente. Necessário R$ ${amount.toFixed(2)} na carteira de caixa.`,
      };
    }
  }

  const split = calculatePackageSplit(amount, kind);
  const now = new Date();
  const adhesionEnds = new Date(now.getTime() + ADHESION_DAYS * 86_400_000);
  const userPackageId = randomUUID();

  if (!input.skipWalletDebit) {
    const buyer =
      payerId === input.userId
        ? null
        : await db.query.users.findFirst({ where: eq(users.id, input.userId) });
    const debitDescription =
      payerId === input.userId
        ? `Compra — ${pkg.name}`
        : `Compra — ${pkg.name} (sub-conta: ${buyer?.name ?? input.userId.slice(0, 8)})`;

    await debitWallet({
      userId: payerId,
      bucket: "rendimentos",
      amount,
      description: debitDescription,
      referenceType: "package",
      referenceId: userPackageId,
    });
  }

  await db.insert(userPackages).values({
    id: userPackageId,
    userId: input.userId,
    packageId: pkg.id,
    amount,
    affiliateAmount: split.affiliateAmount,
    automationBase: kind === "automation" ? amount : 0,
    companyAmount: split.companyAmount,
    totalEarned: 0,
    maxProfit: amount * MAX_PROFIT_MULTIPLIER,
    status: "active",
    startedAt: now,
    termEndsAt: adhesionEnds,
    adhesionEndsAt: adhesionEnds,
    createdAt: now,
  });

  await applyPackagePurchaseSplit({
    buyerUserId: input.userId,
    userPackageId,
    purchaseAmount: amount,
    amounts: split,
    packageName: pkg.name,
    packageKind: kind,
  });

  const isStartPackage = input.packageId === START_PACKAGE_ID;
  let binaryPointsHandled = false;

  if (isStartPackage) {
    const { tryAutoPlaceDirectAfterStartActivation } = await import(
      "@/lib/server/network/direct-placement"
    );
    const placement = await tryAutoPlaceDirectAfterStartActivation(input.userId);
    if (placement.placed) {
      binaryPointsHandled = true;
    } else if (placement.error) {
      console.warn("[packages] auto-place Start pendente:", placement.error, input.userId);
    }
  }

  if (!binaryPointsHandled && kind !== "automation") {
    const { onPackagePurchaseBinary } = await import("@/lib/server/network/binary-engine");
    await onPackagePurchaseBinary({ buyerUserId: input.userId, amount });
  }

  const created = await db.query.userPackages.findFirst({
    where: eq(userPackages.id, userPackageId),
    with: { pkg: true },
  });
  if (!created) return { ok: false, error: "Erro ao registar pacote." };

  return {
    ok: true,
    userPackage: {
      id: created.id,
      packageId: created.packageId,
      packageName: created.pkg.name,
      amount: created.amount,
      affiliateAmount: created.affiliateAmount,
      automationBase: created.automationBase,
      companyAmount: created.companyAmount,
      totalEarned: created.totalEarned,
      maxProfit: created.maxProfit,
      status: created.status,
      startedAt: created.startedAt.toISOString(),
      adhesionEndsAt: created.adhesionEndsAt.toISOString(),
    },
  };
}

export async function purchasePackage(input: {
  userId: string;
  packageId: string;
  /** Quem paga (por defeito o próprio comprador). */
  payerUserId?: string;
  /** Obrigatório para pacotes de automação com valor livre (`automacao`). */
  amount?: number;
}): Promise<{ ok: true; userPackage: UserPackageDto } | { ok: false; error: string }> {
  if (input.packageId === START_PACKAGE_ID) {
    return {
      ok: false,
      error: "O Pacote Start R$ 50 é activado no cadastro da conta.",
    };
  }

  const validated = await validatePackagePurchase(input);
  if (!validated.ok) return validated;

  return activatePackageAfterPayment({
    userId: input.userId,
    packageId: input.packageId,
    amount: validated.amount,
    payerUserId: input.payerUserId,
  });
}
