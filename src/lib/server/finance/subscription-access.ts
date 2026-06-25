import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  DEFAULT_SUBSCRIPTION_AMOUNT,
  SUBSCRIPTION_GRACE_DAYS,
} from "@/lib/back-office/product-constants";
import { getDb } from "@/lib/server/db/client";
import { missedCredits, subscriptions, users } from "@/lib/server/db/schema";

export type SubscriptionAccess = {
  active: boolean;
  status: "grace" | "active" | "pending" | "expired";
  graceEndsAt: string | null;
  renewsAt: string | null;
  amount: number;
  daysUntilDue: number | null;
};

export async function getSubscriptionAccess(userId: string): Promise<SubscriptionAccess> {
  const db = getDb();
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  const now = Date.now();
  const amount = row?.amount ?? DEFAULT_SUBSCRIPTION_AMOUNT;

  if (!row) {
    return {
      active: false,
      status: "pending",
      graceEndsAt: null,
      renewsAt: null,
      amount,
      daysUntilDue: null,
    };
  }

  const graceEnds = row.graceEndsAt?.getTime() ?? 0;
  const renewsAt = row.renewsAt?.getTime() ?? 0;

  if (row.status === "grace" && graceEnds > now) {
    return {
      active: true,
      status: "grace",
      graceEndsAt: row.graceEndsAt?.toISOString() ?? null,
      renewsAt: row.renewsAt?.toISOString() ?? null,
      amount,
      daysUntilDue: Math.ceil((graceEnds - now) / 86_400_000),
    };
  }

  if (row.status === "active" && renewsAt > now) {
    return {
      active: true,
      status: "active",
      graceEndsAt: row.graceEndsAt?.toISOString() ?? null,
      renewsAt: row.renewsAt?.toISOString() ?? null,
      amount,
      daysUntilDue: Math.ceil((renewsAt - now) / 86_400_000),
    };
  }

  return {
    active: false,
    status: row.status === "grace" ? "expired" : row.status,
    graceEndsAt: row.graceEndsAt?.toISOString() ?? null,
    renewsAt: row.renewsAt?.toISOString() ?? null,
    amount,
    daysUntilDue: null,
  };
}

export async function isAffiliateServicesActive(userId: string): Promise<boolean> {
  const access = await getSubscriptionAccess(userId);
  return access.active;
}

export async function provisionSubscriptionForNewUser(userId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  const graceEnds = new Date(now.getTime() + SUBSCRIPTION_GRACE_DAYS * 86_400_000);

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (existing) return;

  await db.insert(subscriptions).values({
    id: randomUUID(),
    userId,
    status: "grace",
    amount: DEFAULT_SUBSCRIPTION_AMOUNT,
    graceEndsAt: graceEnds,
    renewsAt: graceEnds,
    createdAt: now,
    updatedAt: now,
  });
}

export async function refreshExpiredSubscriptions(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const rows = await db.query.subscriptions.findMany();

  for (const row of rows) {
    if (row.status === "grace" && row.graceEndsAt && row.graceEndsAt <= now) {
      await db
        .update(subscriptions)
        .set({ status: "expired", updatedAt: now })
        .where(eq(subscriptions.id, row.id));
    } else if (row.status === "active" && row.renewsAt && row.renewsAt <= now) {
      await db
        .update(subscriptions)
        .set({ status: "expired", updatedAt: now })
        .where(eq(subscriptions.id, row.id));
    }
  }
}

export async function recordMissedCredit(input: {
  userId: string;
  amount: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(missedCredits).values({
    id: randomUUID(),
    userId: input.userId,
    amount: input.amount,
    reason: input.reason,
    referenceType: input.referenceType ?? null,
    referenceId: input.referenceId ?? null,
    createdAt: new Date(),
  });
}

export async function listMissedCredits(userId: string) {
  const db = getDb();
  return db.query.missedCredits.findMany({
    where: eq(missedCredits.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 50,
  });
}

export async function getSponsorChain(userId: string, maxLevels: number): Promise<string[]> {
  const db = getDb();
  const chain: string[] = [];
  let currentId: string | null = userId;

  for (let i = 0; i < maxLevels; i++) {
    if (!currentId) break;
    const row = await db.query.users.findFirst({ where: eq(users.id, currentId) });
    if (!row?.sponsorId) break;
    chain.push(row.sponsorId);
    currentId = row.sponsorId;
  }

  return chain;
}
