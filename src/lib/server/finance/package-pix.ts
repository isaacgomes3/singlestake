import { randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import {
  AUTOMATION_PIX_PACKAGE_ID,
  START_PACKAGE_AMOUNT,
  START_PACKAGE_ID,
} from "@/lib/back-office/product-constants";

import { getDb } from "@/lib/server/db/client";
import { packagePixOrders, userPackages, users } from "@/lib/server/db/schema";
import { readEfiPixConfig } from "@/lib/server/finance/efi-config";
import { createImmediatePixCharge, getPixChargeStatus } from "@/lib/server/finance/efi-pay-client";
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
  /** efi = cobrança automática; static = copia e cola fixo no .env */
  mode: "efi" | "static";
  pixFixedAmount: number | null;
};

function toDto(row: typeof packagePixOrders.$inferSelect): PackagePixOrderDto {
  const staticMode = row.txid.startsWith("static-");
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
    mode: staticMode ? "static" : "efi",
    pixFixedAmount: staticMode ? parsePixPayloadAmount(payload) : null,
  };
}

export async function createPackagePixOrder(input: {
  userId: string;
  packageId: string;
  amount?: number;
  /** Fluxo de activação de conta (Start R$ 50 no cadastro). */
  forAccountActivation?: boolean;
}): Promise<{ ok: true; order: PackagePixOrderDto } | { ok: false; error: string }> {
  if (!input.forAccountActivation) {
    if (input.packageId === START_PACKAGE_ID) {
      return {
        ok: false,
        error: "O Pacote Start R$ 50 é activado no cadastro da conta.",
      };
    }
    if (input.packageId !== AUTOMATION_PIX_PACKAGE_ID) {
      return {
        ok: false,
        error: "PIX disponível apenas para Automação R$ 250.",
      };
    }
  }

  const validated = await validatePackagePurchase(input);
  if (!validated.ok) return validated;

  const efiConfig = readEfiPixConfig();
  const staticPayload = readStaticPixCopiaColaForAmount(validated.amount);

  if (!staticPayload && !efiConfig) {
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
      error: "PIX não configurado. Defina PIX_COPIA_COLA_50 / PIX_COPIA_COLA_250 ou credenciais Efi Pay.",
    };
  }

  const orderId = randomUUID();
  const expirationSeconds = 3600;
  const expiresAt = new Date(Date.now() + expirationSeconds * 1000);
  const db = getDb();

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
  return readEfiPixConfig() != null || isStaticPixConfigured();
}

/** PIX no catálogo — apenas Automação R$ 250. */
export function isCatalogPackagePixAvailable(packageId: string): boolean {
  if (packageId !== AUTOMATION_PIX_PACKAGE_ID) return false;
  if (!isPixCheckoutEnabled()) return false;
  return readStaticPixCopiaColaForAmount(250) != null || readEfiPixConfig() != null;
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
