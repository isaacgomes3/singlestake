import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import {
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWABLE_BUCKETS,
  type WalletBucket,
} from "@/lib/server/finance/constants";
import { isAffiliateServicesActive } from "@/lib/server/finance/subscription-access";
import { debitWallet, getWalletBalance } from "@/lib/server/finance/wallet";
import { getDb } from "@/lib/server/db/client";
import { auditLogs, users, withdrawals } from "@/lib/server/db/schema";

export type WithdrawalDto = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  bucket: WalletBucket;
  status: "pending" | "approved" | "rejected" | "paid";
  pixKey: string | null;
  createdAt: string;
  processedAt: string | null;
};

function toDto(
  row: typeof withdrawals.$inferSelect,
  user: { name: string; email: string },
): WithdrawalDto {
  return {
    id: row.id,
    userId: row.userId,
    userName: user.name,
    userEmail: user.email,
    amount: row.amount,
    bucket: row.bucket as WalletBucket,
    status: row.status,
    pixKey: row.pixKey,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  };
}

export async function listWithdrawals(input: {
  userId: string;
  isAdmin: boolean;
}): Promise<WithdrawalDto[]> {
  const db = getDb();
  const rows = input.isAdmin
    ? await db.query.withdrawals.findMany({
        orderBy: [desc(withdrawals.createdAt)],
        limit: 100,
        with: { user: true },
      })
    : await db.query.withdrawals.findMany({
        where: eq(withdrawals.userId, input.userId),
        orderBy: [desc(withdrawals.createdAt)],
        limit: 50,
        with: { user: true },
      });

  return rows.map((row) =>
    toDto(row, { name: row.user.name, email: row.user.email }),
  );
}

export async function createWithdrawal(input: {
  userId: string;
  amount: number;
  bucket: string;
  pixKey?: string;
}): Promise<{ ok: true; withdrawal: WithdrawalDto } | { ok: false; error: string }> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
    return { ok: false, error: `Valor mínimo de saque: R$ ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}.` };
  }

  const bucket = input.bucket as WalletBucket;
  if (!WITHDRAWABLE_BUCKETS.includes(bucket)) {
    return { ok: false, error: "Origem do saldo inválida." };
  }

  if (bucket === "afiliados" || bucket === "automacao") {
    const active = await isAffiliateServicesActive(input.userId);
    if (!active) {
      return {
        ok: false,
        error: "Mensalidade vencida. Regularize para sacar desta carteira.",
      };
    }
  }

  const pixKey = input.pixKey?.trim();
  if (!pixKey) return { ok: false, error: "Informe a chave PIX para receber o saque." };

  const wallet = await getWalletBalance(input.userId, bucket);
  if (!wallet || wallet.availableBalance < amount) {
    return { ok: false, error: "Saldo disponível insuficiente nesta carteira." };
  }

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!user) return { ok: false, error: "Utilizador não encontrado." };

  const id = randomUUID();
  const now = new Date();
  await db.insert(withdrawals).values({
    id,
    userId: input.userId,
    amount,
    bucket,
    status: "pending",
    pixKey,
    createdAt: now,
  });

  const row = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.id, id),
    with: { user: true },
  });
  if (!row) return { ok: false, error: "Não foi possível criar o saque." };

  return {
    ok: true,
    withdrawal: toDto(row, { name: row.user.name, email: row.user.email }),
  };
}

export async function processWithdrawal(input: {
  withdrawalId: string;
  actorUserId: string;
  actorName: string;
  action: "approve" | "reject" | "paid";
}): Promise<{ ok: true; withdrawal: WithdrawalDto } | { ok: false; error: string }> {
  const db = getDb();
  const row = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.id, input.withdrawalId),
    with: { user: true },
  });

  if (!row) return { ok: false, error: "Saque não encontrado." };

  const now = new Date();

  if (input.action === "reject") {
    if (row.status !== "pending") {
      return { ok: false, error: "Só é possível rejeitar saques pendentes." };
    }
    await db
      .update(withdrawals)
      .set({ status: "rejected", processedAt: now })
      .where(eq(withdrawals.id, row.id));

    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorUserId: input.actorUserId,
      actorLabel: input.actorName,
      action: "withdrawal.reject",
      target: row.user.email,
      detail: `Saque ${row.id} · R$ ${row.amount.toFixed(2)}`,
      createdAt: now,
    });
  } else if (input.action === "approve") {
    if (row.status !== "pending") {
      return { ok: false, error: "Só é possível aprovar saques pendentes." };
    }

    try {
      await debitWallet({
        userId: row.userId,
        bucket: row.bucket as WalletBucket,
        amount: row.amount,
        description: `Saque PIX aprovado (${row.bucket})`,
        referenceType: "withdrawal",
        referenceId: row.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "INSUFFICIENT_BALANCE") {
        return { ok: false, error: "Saldo insuficiente para aprovar este saque." };
      }
      throw err;
    }

    await db
      .update(withdrawals)
      .set({ status: "approved", processedAt: now })
      .where(eq(withdrawals.id, row.id));

    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorUserId: input.actorUserId,
      actorLabel: input.actorName,
      action: "withdrawal.approve",
      target: row.user.email,
      detail: `Saque ${row.id} · R$ ${row.amount.toFixed(2)}`,
      createdAt: now,
    });
  } else {
    if (row.status !== "approved") {
      return { ok: false, error: "Só é possível marcar como pago saques aprovados." };
    }
    await db
      .update(withdrawals)
      .set({ status: "paid", processedAt: now })
      .where(eq(withdrawals.id, row.id));

    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorUserId: input.actorUserId,
      actorLabel: input.actorName,
      action: "withdrawal.paid",
      target: row.user.email,
      detail: `Saque ${row.id} · PIX enviado`,
      createdAt: now,
    });
  }

  const updated = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.id, row.id),
    with: { user: true },
  });
  if (!updated) return { ok: false, error: "Erro ao actualizar saque." };
  return {
    ok: true,
    withdrawal: toDto(updated, { name: updated.user.name, email: updated.user.email }),
  };
}
