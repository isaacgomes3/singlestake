import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { DEFAULT_SUBSCRIPTION_AMOUNT } from "@/lib/back-office/product-constants";
import { getDb } from "@/lib/server/db/client";
import { subscriptions } from "@/lib/server/db/schema";
import { distributeSubscriptionPayment } from "@/lib/server/finance/package-split";
import {
  getSubscriptionAccess,
  listMissedCredits,
  refreshExpiredSubscriptions,
} from "@/lib/server/finance/subscription-access";
import { debitWallet, getWalletBalance } from "@/lib/server/finance/wallet";

import type { SubscriptionDto } from "@/lib/back-office/product-types";

export async function getSubscriptionDetails(userId: string): Promise<SubscriptionDto> {
  await refreshExpiredSubscriptions();
  const access = await getSubscriptionAccess(userId);
  const missed = await listMissedCredits(userId);
  const missedTotal = missed.reduce((sum, row) => sum + row.amount, 0);

  return {
    status: access.status,
    active: access.active,
    amount: access.amount,
    graceEndsAt: access.graceEndsAt,
    renewsAt: access.renewsAt,
    daysUntilDue: access.daysUntilDue,
    missedCredits: missed.map((row) => ({
      amount: row.amount,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    })),
    missedTotal,
  };
}

export async function paySubscription(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await refreshExpiredSubscriptions();
  const db = getDb();
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!row) return { ok: false, error: "Subscrição não encontrada." };

  const amount = row.amount ?? DEFAULT_SUBSCRIPTION_AMOUNT;
  const wallet = await getWalletBalance(userId, "rendimentos");
  if (!wallet || wallet.availableBalance < amount) {
    return {
      ok: false,
      error: `Saldo insuficiente. Mensalidade: R$ ${amount.toFixed(2)}.`,
    };
  }

  const paymentId = randomUUID();
  const now = new Date();
  const renewsAt = new Date(now.getTime() + 30 * 86_400_000);

  await debitWallet({
    userId,
    bucket: "rendimentos",
    amount,
    description: "Pagamento mensalidade",
    referenceType: "subscription",
    referenceId: paymentId,
  });

  await distributeSubscriptionPayment({
    payerUserId: userId,
    amount,
    referenceId: paymentId,
  });

  await db
    .update(subscriptions)
    .set({
      status: "active",
      amount,
      renewsAt,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, row.id));

  return { ok: true };
}
