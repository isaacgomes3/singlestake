import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import {
  DEPOSIT_CREDIT_BUCKET,
  DEPOSIT_METHODS,
  MIN_DEPOSIT_AMOUNT,
  type DepositMethod,
} from "@/lib/server/finance/constants";
import { isValidCpf, normalizeCpf } from "@/lib/server/finance/cpf";
import {
  buildPaymentExternalId,
  lucPagueiCreatePixDeposit,
} from "@/lib/server/finance/luc-paguei-client";
import { buildPixQrArtifactsFromEmv, isPixEmvPayload, normalizePixEmvPayload } from "@/lib/server/finance/pix-qr";
import {
  getPaymentGatewaySettings,
  isLucPagueiGatewayReady,
} from "@/lib/server/finance/payment-gateway-settings";
import { creditWallet } from "@/lib/server/finance/wallet";
import { getDb } from "@/lib/server/db/client";
import { auditLogs, deposits, users } from "@/lib/server/db/schema";

export type DepositDto = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  method: string;
  status: "pending" | "approved" | "rejected";
  externalRef: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type DepositPixDto = DepositDto & {
  pixCopyPaste: string | null;
  qrCodeBase64: string | null;
};

function toPixDto(
  row: typeof deposits.$inferSelect,
  user: { name: string; email: string },
): DepositPixDto {
  return {
    ...toDto(row, user),
    pixCopyPaste: row.pixCopyPaste,
    qrCodeBase64: row.qrCodeBase64,
  };
}

function toDto(
  row: typeof deposits.$inferSelect,
  user: { name: string; email: string },
): DepositDto {
  return {
    id: row.id,
    userId: row.userId,
    userName: user.name,
    userEmail: user.email,
    amount: row.amount,
    method: row.method,
    status: row.status,
    externalRef: row.externalRef,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  };
}

export async function listDeposits(input: {
  userId: string;
  isAdmin: boolean;
}): Promise<DepositDto[]> {
  const db = getDb();
  const rows = input.isAdmin
    ? await db.query.deposits.findMany({
        orderBy: [desc(deposits.createdAt)],
        limit: 100,
        with: { user: true },
      })
    : await db.query.deposits.findMany({
        where: eq(deposits.userId, input.userId),
        orderBy: [desc(deposits.createdAt)],
        limit: 50,
        with: { user: true },
      });

  return rows.map((row) =>
    toDto(row, { name: row.user.name, email: row.user.email }),
  );
}

export async function createDeposit(input: {
  userId: string;
  amount: number;
  method?: string;
  externalRef?: string;
}): Promise<{ ok: true; deposit: DepositDto } | { ok: false; error: string }> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_AMOUNT) {
    return { ok: false, error: `Valor mínimo de depósito: R$ ${MIN_DEPOSIT_AMOUNT.toFixed(2)}.` };
  }

  const method = (input.method ?? "pix").toLowerCase();
  if (!DEPOSIT_METHODS.includes(method as DepositMethod)) {
    return { ok: false, error: "Método de depósito inválido." };
  }

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!user) return { ok: false, error: "Utilizador não encontrado." };

  const id = randomUUID();
  const now = new Date();
  await db.insert(deposits).values({
    id,
    userId: input.userId,
    amount,
    method,
    status: "pending",
    externalRef: input.externalRef?.trim() || null,
    createdAt: now,
  });

  const row = await db.query.deposits.findFirst({
    where: eq(deposits.id, id),
    with: { user: true },
  });
  if (!row) return { ok: false, error: "Não foi possível criar o depósito." };

  return { ok: true, deposit: toDto(row, { name: row.user.name, email: row.user.email }) };
}

export async function processDeposit(input: {
  depositId: string;
  actorUserId: string;
  actorName: string;
  action: "approve" | "reject";
}): Promise<{ ok: true; deposit: DepositDto } | { ok: false; error: string }> {
  const db = getDb();
  const row = await db.query.deposits.findFirst({
    where: eq(deposits.id, input.depositId),
    with: { user: true },
  });

  if (!row) return { ok: false, error: "Depósito não encontrado." };
  if (row.status !== "pending") {
    return { ok: false, error: "Este depósito já foi processado." };
  }

  const now = new Date();

  if (input.action === "reject") {
    await db
      .update(deposits)
      .set({ status: "rejected", processedAt: now })
      .where(eq(deposits.id, row.id));

    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorUserId: input.actorUserId,
      actorLabel: input.actorName,
      action: "deposit.reject",
      target: row.user.email,
      detail: `Depósito ${row.id} · R$ ${row.amount.toFixed(2)}`,
      createdAt: now,
    });

    const updated = await db.query.deposits.findFirst({
      where: eq(deposits.id, row.id),
      with: { user: true },
    });
    if (!updated) return { ok: false, error: "Erro ao actualizar depósito." };
    return {
      ok: true,
      deposit: toDto(updated, { name: updated.user.name, email: updated.user.email }),
    };
  }

  await creditWallet({
    userId: row.userId,
    bucket: DEPOSIT_CREDIT_BUCKET,
    amount: row.amount,
    description: `Depósito ${row.method.toUpperCase()} aprovado`,
    referenceType: "deposit",
    referenceId: row.id,
  });

  await db
    .update(deposits)
    .set({ status: "approved", processedAt: now })
    .where(eq(deposits.id, row.id));

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorUserId: input.actorUserId,
    actorLabel: input.actorName,
    action: "deposit.approve",
    target: row.user.email,
    detail: `Depósito ${row.id} · R$ ${row.amount.toFixed(2)}`,
    createdAt: now,
  });

  const updated = await db.query.deposits.findFirst({
    where: eq(deposits.id, row.id),
    with: { user: true },
  });
  if (!updated) return { ok: false, error: "Erro ao actualizar depósito." };
  return {
    ok: true,
    deposit: toDto(updated, { name: updated.user.name, email: updated.user.email }),
  };
}

/** Crédito automático via webhook Luc Paguei. */
export async function confirmDepositFromGateway(
  depositId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const row = await db.query.deposits.findFirst({
    where: eq(deposits.id, depositId),
    with: { user: true },
  });
  if (!row) return { ok: false, error: "Depósito não encontrado." };
  if (row.status !== "pending") return { ok: false, error: "Depósito já processado." };

  const now = new Date();
  await creditWallet({
    userId: row.userId,
    bucket: DEPOSIT_CREDIT_BUCKET,
    amount: row.amount,
    description: `Depósito PIX confirmado (gateway)`,
    referenceType: "deposit",
    referenceId: row.id,
  });

  await db
    .update(deposits)
    .set({ status: "approved", processedAt: now })
    .where(eq(deposits.id, row.id));

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorUserId: null,
    actorLabel: "Luc Paguei",
    action: "deposit.approve.gateway",
    target: row.user.email,
    detail: `Depósito ${row.id} · R$ ${row.amount.toFixed(2)}`,
    createdAt: now,
  });

  return { ok: true };
}

/** Depósito PIX dinâmico via Luc Paguei — cria pendente antes da API. */
export async function createDepositPix(input: {
  userId: string;
  amount: number;
  cpfDocument?: string;
}): Promise<{ ok: true; deposit: DepositPixDto } | { ok: false; error: string }> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_AMOUNT) {
    return { ok: false, error: `Valor mínimo de depósito: R$ ${MIN_DEPOSIT_AMOUNT.toFixed(2)}.` };
  }

  if (!(await isLucPagueiGatewayReady())) {
    return { ok: false, error: "Gateway PIX não configurado ou desactivado." };
  }

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!user) return { ok: false, error: "Utilizador não encontrado." };

  const cpfRaw = input.cpfDocument?.trim() ? normalizeCpf(input.cpfDocument) : user.cpf ?? "";
  if (!cpfRaw) return { ok: false, error: "Informe um CPF válido para gerar o PIX." };
  if (!isValidCpf(cpfRaw)) return { ok: false, error: "CPF inválido." };

  if (input.cpfDocument?.trim() && cpfRaw !== user.cpf) {
    await db.update(users).set({ cpf: cpfRaw, updatedAt: new Date() }).where(eq(users.id, user.id));
  }

  const id = randomUUID();
  const externalId = buildPaymentExternalId("DEP", input.userId);
  const now = new Date();

  await db.insert(deposits).values({
    id,
    userId: input.userId,
    amount,
    method: "pix",
    status: "pending",
    externalRef: externalId,
    createdAt: now,
  });

  const gateway = await getPaymentGatewaySettings();
  const charge = await lucPagueiCreatePixDeposit({
    settings: gateway,
    amount,
    externalId,
    payer: { name: user.name, email: user.email, document: cpfRaw },
  });

  if (!charge.ok) {
    await db.delete(deposits).where(eq(deposits.id, id));
    return charge;
  }

  let pixEmv = normalizePixEmvPayload(charge.charge.pixCode);
  if (!isPixEmvPayload(pixEmv)) {
    await db.delete(deposits).where(eq(deposits.id, id));
    return { ok: false, error: "Gateway devolveu código PIX inválido. Tente novamente." };
  }

  let qrCodeBase64: string;
  try {
    ({ emv: pixEmv, qrCodeBase64 } = await buildPixQrArtifactsFromEmv(pixEmv));
  } catch (error) {
    await db.delete(deposits).where(eq(deposits.id, id));
    const msg = error instanceof Error ? error.message : "Erro ao gerar QR Code PIX.";
    return { ok: false, error: msg };
  }

  await db
    .update(deposits)
    .set({
      pixCopyPaste: pixEmv,
      qrCodeBase64,
      gatewayTransactionId: charge.charge.transactionId,
    })
    .where(eq(deposits.id, id));

  const row = await db.query.deposits.findFirst({
    where: eq(deposits.id, id),
    with: { user: true },
  });
  if (!row) return { ok: false, error: "Erro ao registar depósito." };

  return { ok: true, deposit: toPixDto(row, { name: row.user.name, email: row.user.email }) };
}

export async function getDepositById(input: {
  depositId: string;
  userId: string;
  isAdmin: boolean;
}): Promise<{ ok: true; deposit: DepositPixDto } | { ok: false; error: string }> {
  const db = getDb();
  const row = await db.query.deposits.findFirst({
    where: eq(deposits.id, input.depositId),
    with: { user: true },
  });
  if (!row) return { ok: false, error: "Depósito não encontrado." };
  if (!input.isAdmin && row.userId !== input.userId) {
    return { ok: false, error: "Acesso negado." };
  }
  return { ok: true, deposit: toPixDto(row, { name: row.user.name, email: row.user.email }) };
}
