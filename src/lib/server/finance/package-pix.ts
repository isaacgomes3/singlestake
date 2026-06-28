import { randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import {
  PRODUCT_PACKAGES,
  START_PACKAGE_AMOUNT,
  START_PACKAGE_ID,
} from "@/lib/back-office/product-constants";

import { getDb } from "@/lib/server/db/client";
import { packagePixOrders, userPackages, users, investmentPackages } from "@/lib/server/db/schema";
import { readEfiPixConfig } from "@/lib/server/finance/efi-config";
import { createImmediatePixCharge, getPixChargeStatus } from "@/lib/server/finance/efi-pay-client";
import { isValidCpf, normalizeCpf } from "@/lib/server/finance/cpf";
import {
  buildPaymentExternalId,
  lucPagueiCreatePixDeposit,
} from "@/lib/server/finance/luc-paguei-client";
import {
  getPaymentGatewaySettings,
  isLucPagueiGatewayReady,
} from "@/lib/server/finance/payment-gateway-settings";
import { generatePixQrBase64, parsePixPayloadAmount } from "@/lib/server/finance/pix-qr";
import {
  isStaticPixConfigured,
  listConfiguredStaticPixAmounts,
  readStaticPixCopiaColaForAmount,
} from "@/lib/server/finance/pix-static";
import {
  activatePackageAfterPayment,
  validatePackagePurchase,
} from "@/lib/server/finance/packages";

import type { UserPackageDto } from "@/lib/back-office/product-types";

const TXID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateTxid(): string {
  let txid = "stake37";
  while (txid.length < 26) {
    txid += TXID_CHARS[randomBytes(1)[0]! % TXID_CHARS.length];
  }
  return txid.slice(0, 35);
}

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
  /** efi | static | lucpaguei */
  mode: "efi" | "static" | "lucpaguei";
  pixFixedAmount: number | null;
};

function toDto(row: typeof packagePixOrders.$inferSelect): PackagePixOrderDto {
  const staticMode = row.txid.startsWith("static-");
  const lucMode = row.txid.startsWith("PKG-");
  const payload = row.pixCopyPaste ?? "";
  return {
    id: row.id,
    packageId: row.packageId,
    amount: row.amount,
    status: row.status,
    txid: row.txid,
    pixCopyPaste: row.pixCopyPaste,
    qrCodeBase64: row.qrCodeBase64,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    userPackageId: row.userPackageId,
    mode: staticMode ? "static" : lucMode ? "lucpaguei" : "efi",
    pixFixedAmount: staticMode ? parsePixPayloadAmount(payload) : null,
  };
}

async function resolvePayerCpf(
  userId: string,
  cpfOverride?: string,
): Promise<{ ok: true; cpf: string } | { ok: false; error: string }> {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return { ok: false, error: "Utilizador não encontrado." };

  const candidate = cpfOverride?.trim() ? normalizeCpf(cpfOverride) : user.cpf ?? "";
  if (!candidate) {
    return { ok: false, error: "Informe um CPF válido para gerar o PIX." };
  }
  if (!isValidCpf(candidate)) {
    return { ok: false, error: "CPF inválido. O gateway rejeita documentos incorrectos." };
  }

  if (cpfOverride?.trim() && candidate !== user.cpf) {
    await db.update(users).set({ cpf: candidate, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  return { ok: true, cpf: candidate };
}

export async function createPackagePixOrder(input: {
  userId: string;
  packageId: string;
  amount?: number;
  /** Fluxo de activação de conta (Start R$ 50 no cadastro). */
  forAccountActivation?: boolean;
  /** CPF do pagador (11 dígitos) — obrigatório com Luc Paguei. */
  cpfDocument?: string;
}): Promise<{ ok: true; order: PackagePixOrderDto } | { ok: false; error: string }> {
  if (!input.forAccountActivation) {
    if (input.packageId === START_PACKAGE_ID) {
      return {
        ok: false,
        error: "O Pacote Start R$ 50 é activado no cadastro da conta.",
      };
    }
  }

  const validated = await validatePackagePurchase(input);
  if (!validated.ok) return validated;

  const db = getDb();
  const pkgRow = await db.query.investmentPackages.findFirst({
    where: eq(investmentPackages.id, input.packageId),
  });
  if (!pkgRow || pkgRow.packageKind !== "automation") {
    return { ok: false, error: "PIX disponível apenas para pacotes de automação." };
  }

  const lucReady = await isLucPagueiGatewayReady();
  const efiConfig = readEfiPixConfig();
  const staticPayload = readStaticPixCopiaColaForAmount(validated.amount);

  if (!lucReady && !staticPayload && !efiConfig) {
    if (isStaticPixConfigured()) {
      const available = listConfiguredStaticPixAmounts();
      const hint =
        available.length > 0
          ? ` Valores com PIX fixo: ${available.map((a) => `R$ ${a.toFixed(2)}`).join(", ")}.`
          : "";
      return {
        ok: false,
        error: `Sem PIX copia e cola para R$ ${validated.amount.toFixed(2)}.${hint}`,
      };
    }
    return {
      ok: false,
      error:
        "PIX não configurado. Active o gateway Luc Paguei no admin ou defina PIX_COPIA_COLA / Efi Pay.",
    };
  }

  const orderId = randomUUID();
  const expirationSeconds = 3600;
  const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

  if (lucReady) {
    const payerCpf = await resolvePayerCpf(input.userId, input.cpfDocument);
    if (!payerCpf.ok) return payerCpf;

    const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
    if (!user) return { ok: false, error: "Utilizador não encontrado." };

    const externalId = buildPaymentExternalId("PKG", input.userId);

    await db.insert(packagePixOrders).values({
      id: orderId,
      userId: input.userId,
      packageId: input.packageId,
      amount: validated.amount,
      status: "pending",
      txid: externalId,
      expiresAt,
      createdAt: new Date(),
    });

    const gateway = await getPaymentGatewaySettings();
    const chargeResult = await lucPagueiCreatePixDeposit({
      settings: gateway,
      amount: validated.amount,
      externalId,
      payer: {
        name: user.name,
        email: user.email,
        document: payerCpf.cpf,
      },
    });

    if (!chargeResult.ok) {
      await db.delete(packagePixOrders).where(eq(packagePixOrders.id, orderId));
      return chargeResult;
    }

    let qrCodeBase64 = chargeResult.charge.qrCodeBase64;
    if (!qrCodeBase64) {
      try {
        qrCodeBase64 = await generatePixQrBase64(chargeResult.charge.pixCode);
      } catch {
        qrCodeBase64 = null;
      }
    }

    await db
      .update(packagePixOrders)
      .set({
        pixCopyPaste: chargeResult.charge.pixCode,
        qrCodeBase64,
        gatewayTransactionId: chargeResult.charge.transactionId,
      })
      .where(eq(packagePixOrders.id, orderId));

    const row = await db.query.packagePixOrders.findFirst({ where: eq(packagePixOrders.id, orderId) });
    if (!row) return { ok: false, error: "Erro ao registar pedido PIX." };
    return { ok: true, order: toDto(row) };
  }

  if (staticPayload) {
    const pixFixedAmount = parsePixPayloadAmount(staticPayload);
    let qrCodeBase64: string;
    try {
      qrCodeBase64 = await generatePixQrBase64(staticPayload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao gerar QR Code.";
      return { ok: false, error: msg };
    }

    await db.insert(packagePixOrders).values({
      id: orderId,
      userId: input.userId,
      packageId: input.packageId,
      amount: validated.amount,
      status: "pending",
      txid: `static-${orderId.replace(/-/g, "").slice(0, 26)}`,
      pixCopyPaste: staticPayload,
      qrCodeBase64,
      expiresAt,
      createdAt: new Date(),
    });

    const row = await db.query.packagePixOrders.findFirst({ where: eq(packagePixOrders.id, orderId) });
    if (!row) return { ok: false, error: "Erro ao registar pedido PIX." };

    const order = toDto(row);
    if (pixFixedAmount != null && Math.abs(pixFixedAmount - validated.amount) > 0.009) {
      console.warn(
        `[package-pix] valor pacote R$ ${validated.amount} ≠ PIX fixo R$ ${pixFixedAmount}`,
      );
    }
    return { ok: true, order };
  }

  if (!efiConfig) {
    return { ok: false, error: "Credenciais Efi Pay não configuradas para este valor." };
  }

  const txid = generateTxid();
  let charge;
  try {
    charge = await createImmediatePixCharge({
      config: efiConfig!,
      txid,
      amount: validated.amount,
      description: `STAKE37 — ${validated.packageName}`,
      expirationSeconds,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao gerar PIX.";
    return { ok: false, error: msg };
  }

  await db.insert(packagePixOrders).values({
    id: orderId,
    userId: input.userId,
    packageId: input.packageId,
    amount: validated.amount,
    status: "pending",
    txid: charge.txid,
    pixCopyPaste: charge.pixCopyPaste,
    qrCodeBase64: charge.qrCodeBase64.replace(/^data:image\/png;base64,/, ""),
    expiresAt,
    createdAt: new Date(),
  });

  const row = await db.query.packagePixOrders.findFirst({ where: eq(packagePixOrders.id, orderId) });
  if (!row) return { ok: false, error: "Erro ao registar pedido PIX." };
  return { ok: true, order: toDto(row) };
}

async function fulfillPaidOrder(orderId: string): Promise<UserPackageDto | null> {
  const db = getDb();
  const row = await db.query.packagePixOrders.findFirst({
    where: eq(packagePixOrders.id, orderId),
  });
  if (!row || row.status !== "pending") return null;

  const result = await activatePackageAfterPayment({
    userId: row.userId,
    packageId: row.packageId,
    amount: row.amount,
    skipWalletDebit: true,
  });

  if (!result.ok) {
    console.error("[package-pix] fulfill failed:", result.error, orderId);
    return null;
  }

  await db
    .update(packagePixOrders)
    .set({
      status: "paid",
      paidAt: new Date(),
      userPackageId: result.userPackage.id,
    })
    .where(eq(packagePixOrders.id, orderId));

  return result.userPackage;
}

/** Usado pelo webhook Luc Paguei. */
export async function fulfillPackagePixOrderById(orderId: string): Promise<boolean> {
  const pkg = await fulfillPaidOrder(orderId);
  return pkg != null;
}

export async function approvePackagePixOrder(input: {
  orderId: string;
  actorUserId: string;
}): Promise<
  | { ok: true; order: PackagePixOrderDto; userPackage: UserPackageDto }
  | { ok: false; error: string }
> {
  const db = getDb();
  const row = await db.query.packagePixOrders.findFirst({
    where: eq(packagePixOrders.id, input.orderId),
  });
  if (!row) return { ok: false, error: "Pedido não encontrado." };
  if (row.status !== "pending") return { ok: false, error: "Pedido já processado." };

  const pkg = await fulfillPaidOrder(row.id);
  if (!pkg) return { ok: false, error: "Não foi possível activar o pacote." };

  const updated = await db.query.packagePixOrders.findFirst({
    where: eq(packagePixOrders.id, row.id),
  });
  if (!updated) return { ok: false, error: "Erro ao actualizar pedido." };

  console.info("[package-pix] aprovado manualmente por", input.actorUserId, row.id);
  return { ok: true, order: toDto(updated), userPackage: pkg };
}

export async function syncPackagePixOrder(input: {
  orderId: string;
  userId: string;
}): Promise<
  | { ok: true; order: PackagePixOrderDto; userPackage?: UserPackageDto }
  | { ok: false; error: string }
> {
  const db = getDb();
  const row = await db.query.packagePixOrders.findFirst({
    where: and(eq(packagePixOrders.id, input.orderId), eq(packagePixOrders.userId, input.userId)),
  });
  if (!row) return { ok: false, error: "Pedido não encontrado." };

  if (row.status === "paid") {
    return { ok: true, order: toDto(row) };
  }

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    await db
      .update(packagePixOrders)
      .set({ status: "expired" })
      .where(eq(packagePixOrders.id, row.id));
    return { ok: false, error: "PIX expirado. Gere um novo código." };
  }

  if (row.txid.startsWith("static-")) {
    return { ok: true, order: toDto(row) };
  }

  if (row.txid.startsWith("PKG-")) {
    return { ok: true, order: toDto(row) };
  }

  const config = readEfiPixConfig();
  if (config && row.status === "pending") {
    try {
      const remote = await getPixChargeStatus(config, row.txid);
      if (remote.paid) {
        const pkg = await fulfillPaidOrder(row.id);
        const updated = await db.query.packagePixOrders.findFirst({
          where: eq(packagePixOrders.id, row.id),
        });
        if (!updated) return { ok: false, error: "Erro ao actualizar pedido." };
        return { ok: true, order: toDto(updated), userPackage: pkg ?? undefined };
      }
    } catch (error) {
      console.warn("[package-pix] sync status:", error);
    }
  }

  return { ok: true, order: toDto(row) };
}

export async function handleEfiPixWebhook(body: unknown): Promise<void> {
  const pixList = (body as { pix?: Array<{ txid?: string }> })?.pix;
  if (!Array.isArray(pixList) || pixList.length === 0) return;

  const db = getDb();
  for (const item of pixList) {
    const txid = item.txid?.trim();
    if (!txid) continue;

    const row = await db.query.packagePixOrders.findFirst({
      where: eq(packagePixOrders.txid, txid),
    });
    if (!row || row.status !== "pending") continue;

    await fulfillPaidOrder(row.id);
  }
}

export function isPixCheckoutEnabled(): boolean {
  return isStaticPixConfigured() || readEfiPixConfig() != null;
}

export async function isPixCheckoutEnabledAsync(): Promise<boolean> {
  if (await isLucPagueiGatewayReady()) return true;
  return isPixCheckoutEnabled();
}

function isPixAvailableForAmountSync(amount: number): boolean {
  if (readEfiPixConfig() != null) return true;
  if (readStaticPixCopiaColaForAmount(amount) != null) return true;
  return false;
}

async function isPixAvailableForAmountAsync(amount: number): Promise<boolean> {
  if (await isLucPagueiGatewayReady()) return true;
  return isPixAvailableForAmountSync(amount);
}

/** PIX no catálogo — todos os pacotes de automação activos. */
export function isCatalogPackagePixAvailable(packageId: string): boolean {
  if (packageId === START_PACKAGE_ID) return false;
  const pkg = PRODUCT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg || pkg.packageKind !== "automation" || !pkg.active) return false;
  if (pkg.minAmount === pkg.maxAmount) {
    return isPixAvailableForAmountSync(pkg.minAmount);
  }
  return isStaticPixConfigured() || readEfiPixConfig() != null;
}

export async function isCatalogPackagePixAvailableAsync(packageId: string): Promise<boolean> {
  if (packageId === START_PACKAGE_ID) return false;
  if (!(await isPixCheckoutEnabledAsync())) return false;

  const db = getDb();
  const pkg = await db.query.investmentPackages.findFirst({
    where: eq(investmentPackages.id, packageId),
  });
  if (!pkg || pkg.packageKind !== "automation" || !pkg.active) return false;

  return true;
}

/** @deprecated use isPixCheckoutEnabled */
export function isEfiPixConfigured(): boolean {
  return isPixCheckoutEnabled();
}

export type PendingActivationRow = {
  userId: string;
  userName: string;
  userEmail: string;
  userCreatedAt: string;
  orderId: string | null;
  orderAmount: number | null;
  orderStatus: PackagePixOrderDto["status"] | null;
  orderCreatedAt: string | null;
};

export async function getOrCreateStartPackPixOrder(input: {
  userId: string;
  cpfDocument?: string;
}): Promise<{ ok: true; order: PackagePixOrderDto } | { ok: false; error: string }> {
  const { userHasActiveStartPack } = await import("@/lib/server/finance/account-access");
  if (await userHasActiveStartPack(input.userId)) {
    return { ok: false, error: "Conta já activada com Pacote Start." };
  }

  const db = getDb();
  const pending = await db.query.packagePixOrders.findFirst({
    where: and(
      eq(packagePixOrders.userId, input.userId),
      eq(packagePixOrders.packageId, START_PACKAGE_ID),
      eq(packagePixOrders.status, "pending"),
    ),
    orderBy: [desc(packagePixOrders.createdAt)],
  });

  if (pending && (!pending.expiresAt || pending.expiresAt.getTime() > Date.now())) {
    return { ok: true, order: toDto(pending) };
  }

  return createPackagePixOrder({
    userId: input.userId,
    packageId: START_PACKAGE_ID,
    forAccountActivation: true,
    cpfDocument: input.cpfDocument,
  });
}

export async function listPendingAccountActivations(): Promise<PendingActivationRow[]> {
  const db = getDb();
  const allUsers = await db.query.users.findMany({
    where: eq(users.role, "user"),
    orderBy: [desc(users.createdAt)],
  });

  const rows: PendingActivationRow[] = [];
  const { userHasActiveStartPack } = await import("@/lib/server/finance/account-access");

  for (const user of allUsers) {
    if (await userHasActiveStartPack(user.id)) continue;

    const order = await db.query.packagePixOrders.findFirst({
      where: and(
        eq(packagePixOrders.userId, user.id),
        eq(packagePixOrders.packageId, START_PACKAGE_ID),
        eq(packagePixOrders.status, "pending"),
      ),
      orderBy: [desc(packagePixOrders.createdAt)],
    });

    rows.push({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userCreatedAt: user.createdAt.toISOString(),
      orderId: order?.id ?? null,
      orderAmount: order?.amount ?? null,
      orderStatus: order ? (order.status as PackagePixOrderDto["status"]) : null,
      orderCreatedAt: order?.createdAt.toISOString() ?? null,
    });
  }

  return rows;
}

export async function adminActivateStartPackManual(input: {
  userId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userHasActiveStartPack } = await import("@/lib/server/finance/account-access");
  if (await userHasActiveStartPack(input.userId)) {
    return { ok: false, error: "Utilizador já possui Pacote Start activo." };
  }

  const result = await activatePackageAfterPayment({
    userId: input.userId,
    packageId: START_PACKAGE_ID,
    amount: START_PACKAGE_AMOUNT,
    skipWalletDebit: true,
  });

  if (!result.ok) return { ok: false, error: result.error };

  console.info("[account-access] start activado manualmente por", input.actorUserId, input.userId);
  return { ok: true };
}
