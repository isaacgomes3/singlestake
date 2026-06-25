import { eq } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { subscriptions, userPackages, users } from "@/lib/server/db/schema";

export type UnilevelUser = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  qualification: (typeof users.$inferSelect)["qualification"];
  sponsorId: string | null;
  createdAt: Date;
};

export async function loadAllUsers(): Promise<UnilevelUser[]> {
  const db = getDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      referralCode: users.referralCode,
      qualification: users.qualification,
      sponsorId: users.sponsorId,
      createdAt: users.createdAt,
    })
    .from(users);
}

export function buildSponsorChildrenMap(all: UnilevelUser[]): Map<string, UnilevelUser[]> {
  const map = new Map<string, UnilevelUser[]>();
  for (const user of all) {
    if (!user.sponsorId) continue;
    const list = map.get(user.sponsorId) ?? [];
    list.push(user);
    map.set(user.sponsorId, list);
  }
  return map;
}

export function getUnilevelLevels(
  userId: string,
  bySponsor: Map<string, UnilevelUser[]>,
  maxLevel: number,
): UnilevelUser[][] {
  const levels: UnilevelUser[][] = [];
  let current = bySponsor.get(userId) ?? [];

  for (let level = 1; level <= maxLevel; level++) {
    levels.push(current);
    const next: UnilevelUser[] = [];
    for (const member of current) {
      next.push(...(bySponsor.get(member.id) ?? []));
    }
    current = next;
  }

  return levels;
}

export async function getActivePackageAmounts(): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ userId: userPackages.userId, amount: userPackages.amount })
    .from(userPackages)
    .where(eq(userPackages.status, "active"));

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.userId, (map.get(row.userId) ?? 0) + row.amount);
  }
  return map;
}

export async function getSubscriptionStatuses(): Promise<
  Map<string, "grace" | "active" | "pending" | "expired">
> {
  const db = getDb();
  const rows = await db.select({ userId: subscriptions.userId, status: subscriptions.status }).from(subscriptions);
  return new Map(rows.map((r) => [r.userId, r.status]));
}

export function sumVolumeForUsers(userIds: string[], packageAmounts: Map<string, number>): number {
  let total = 0;
  for (const id of userIds) {
    total += packageAmounts.get(id) ?? 0;
  }
  return total;
}

export function countActiveUsers(userIds: string[], packageAmounts: Map<string, number>): number {
  let count = 0;
  for (const id of userIds) {
    if ((packageAmounts.get(id) ?? 0) > 0) count++;
  }
  return count;
}
