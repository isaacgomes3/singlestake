import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import {
  MIN_WITHDRAWAL_AMOUNT,
  WITHDRAWABLE_BUCKETS,
  type WalletBucket,
} from "@/lib/server/finance/constants";
import { isAffiliateServicesActive } from "@/lib/server/finance/subscription-access";
import { debitWallet, getWalletBalance, creditWallet } from "@/lib/server/finance/wallet";
import { getPersonalAutomationWalletBalance } from "@/lib/server/finance/global-automation-capital";
import { isValidCpf, normalizeCpf } from "@/lib/server/finance/cpf";
import {
  buildPaymentExternalId,
  lucPagueiWithdrawPix,
} from "@/lib/server/finance/luc-paguei-client";
import {
  getPaymentGatewaySettings,
  isLucPagueiGatewayReady,
} from "@/lib/server/finance/payment-gateway-settings";
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

async function creditWalletRollback(row: typeof withdrawals.$inferSelect & { user: { email: string } }) {
  await creditWallet({
    userId: row.userId,
    bucket: row.bucket as WalletBucket,
    amount: row.amount,
    description: `Estorno — falha saque gateway (${row.bucket})`,
    referenceType: "withdrawal-rollback",
    referenceId: row.id,
  });
}

/** Webhook confirma PIX enviado ao cliente. */
export async function confirmWithdrawalPaidFromGateway(
  withdrawalId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const row = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.id, withdrawalId),
    with: { user: true },
  });
  if (!row) return { ok: false, error: "Saque não encontrado." };
  if (row.status === "paid") return { ok: true };
  if (row.status !== "approved" && row.status !== "pending") {
    return { ok: false, error: "Estado inválido para confirmação." };
  }

  const now = new Date();

  if (row.status === "pending") {
    try {
      await debitWallet({
        userId: row.userId,
        bucket: row.bucket as WalletBucket,
        amount: row.amount,
        description: `Saque PIX confirmado (${row.bucket})`,
        referenceType: "withdrawal",
        referenceId: row.id,
      });
    } catch {
      return { ok: false, error: "Saldo insuficiente para confirmar saque." };
    }
  }

  await db
    .update(withdrawals)
    .set({ status: "paid", processedAt: now })
    .where(eq(withdrawals.id, row.id));

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorUserId: null,
    actorLabel: "Luc Paguei",
    action: "withdrawal.paid.gateway",
    target: row.user.email,
    detail: `Saque ${row.id} · PIX enviado`,
    createdAt: now,
  });

  return { ok: true };
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

  const pixResolved = await (
    await import("@/lib/server/admin/users")
  ).resolveUserPixKeyForWithdrawal(input.userId, input.pixKey);
  if (!pixResolved.ok) return pixResolved;
  const pixKey = pixResolved.pixKey;

  const wallet = await getWalletBalance(input.userId, bucket);
  const availableBalance =
    bucket === "automacao"
      ? await getPersonalAutomationWalletBalance(input.userId)
      : (wallet?.availableBalance ?? 0);
  if (!wallet || availableBalance < amount) {
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

    const externalRef = buildPaymentExternalId("SAQ", row.userId);
    let gatewayTransactionId: string | null = null;
    let nextStatus: typeof row.status = "approved";

    if (await isLucPagueiGatewayReady()) {
      const userCpf = row.user.cpf;
      if (!userCpf || !isValidCpf(userCpf)) {
        return {
          ok: false,
          error: "Utilizador sem CPF válido — necessário para saque automático via gateway.",
        };
      }

      const gateway = await getPaymentGatewaySettings();
      const withdraw = await lucPagueiWithdrawPix({
        settings: gateway,
        amount: row.amount,
        externalId: externalRef,
        pixKey: row.pixKey ?? "",
        name: row.user.name,
        taxId: userCpf,
        description: `Saque ${row.id}`,
      });

      if (!withdraw.ok) {
        await creditWalletRollback(row);
        return withdraw;
      }

      gatewayTransactionId = withdraw.result.transactionId;
      nextStatus = "approved";
    }

    await db
      .update(withdrawals)
      .set({
        status: nextStatus,
        processedAt: now,
        externalRef,
        gatewayTransactionId,
      })
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
