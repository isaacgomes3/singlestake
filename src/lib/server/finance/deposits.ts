import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import {
  DEPOSIT_CREDIT_BUCKET,
  DEPOSIT_METHODS,
  MIN_DEPOSIT_AMOUNT,
  type DepositMethod,
} from "@/lib/server/finance/constants";
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
