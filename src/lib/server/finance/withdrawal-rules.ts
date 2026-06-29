import { and, eq, gte, lt, ne } from "drizzle-orm";

import {
  MAX_WITHDRAWALS_PER_USER_PER_DAY,
  MIN_WITHDRAWAL_AMOUNT,
} from "@/lib/back-office/finance-constants";
import type { WalletBucket } from "@/lib/back-office/finance-constants";
import { getDb } from "@/lib/server/db/client";
import { ledgerEntries, withdrawals } from "@/lib/server/db/schema";
import { debitCompanyAffiliatePool } from "@/lib/server/finance/company-pool";
import { debitWallet } from "@/lib/server/finance/wallet";

const SAO_PAULO_TZ = "America/Sao_Paulo";

export function isWithdrawalBusinessDay(now: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TZ,
    weekday: "short",
  }).format(now);
  return weekday !== "Sat" && weekday !== "Sun";
}

/** Início e fim do dia civil em São Paulo (para limites diários). */
export function saoPauloDayBounds(now: Date = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const start = new Date(`${year}-${month}-${day}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function countUserWithdrawalsToday(userId: string, now: Date = new Date()): Promise<number> {
  const { start, end } = saoPauloDayBounds(now);
  const db = getDb();
  const rows = await db
    .select({ id: withdrawals.id })
    .from(withdrawals)
    .where(
      and(
        eq(withdrawals.userId, userId),
        gte(withdrawals.createdAt, start),
        lt(withdrawals.createdAt, end),
        ne(withdrawals.status, "rejected"),
      ),
    );
  return rows.length;
}

export async function hasWithdrawalDebit(withdrawalId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.ledgerEntries.findFirst({
    where: and(
      eq(ledgerEntries.referenceType, "withdrawal"),
      eq(ledgerEntries.referenceId, withdrawalId),
      eq(ledgerEntries.entryType, "debit"),
    ),
  });
  return row != null;
}

/** Debita carteira (e pool afiliados) uma única vez por pedido de saque. */
export async function ensureWithdrawalDebited(row: {
  id: string;
  userId: string;
  bucket: string;
  amount: number;
}): Promise<void> {
  if (await hasWithdrawalDebit(row.id)) return;

  await debitWallet({
    userId: row.userId,
    bucket: row.bucket as WalletBucket,
    amount: row.amount,
    description: `Saque PIX solicitado (${row.bucket})`,
    referenceType: "withdrawal",
    referenceId: row.id,
  });

  if (row.bucket === "afiliados") {
    await debitCompanyAffiliatePool({
      amount: row.amount,
      description: `Saque afiliados — ${row.id}`,
      referenceType: "withdrawal",
      referenceId: row.id,
    });
  }
}

export function validateWithdrawalRequest(input: {
  amount: number;
  now?: Date;
}): { ok: true } | { ok: false; error: string } {
  const now = input.now ?? new Date();
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
    return {
      ok: false,
      error: `Valor mínimo de saque: R$ ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}.`,
    };
  }

  if (!isWithdrawalBusinessDay(now)) {
    return {
      ok: false,
      error: "Saques disponíveis apenas de segunda a sexta-feira.",
    };
  }

  return { ok: true };
}

export async function validateWithdrawalDailyLimit(
  userId: string,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const pending = await db.query.withdrawals.findFirst({
    where: and(eq(withdrawals.userId, userId), eq(withdrawals.status, "pending")),
  });
  if (pending) {
    return {
      ok: false,
      error: "Já existe um saque pendente. Aguarde aprovação ou rejeição.",
    };
  }

  const count = await countUserWithdrawalsToday(userId, now);
  if (count >= MAX_WITHDRAWALS_PER_USER_PER_DAY) {
    return {
      ok: false,
      error: "Já existe um pedido de saque hoje. Apenas 1 solicitação por dia.",
    };
  }
  return { ok: true };
}
