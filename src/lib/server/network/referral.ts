import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import type { UserReferralRecord } from "@/lib/back-office/admin-types";
import { buildReferralLink } from "@/lib/referral/build-link";
import { getDb } from "@/lib/server/db/client";
import { users } from "@/lib/server/db/schema";

function makeReferralCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}


function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Garante código único para um utilizador (útil em seeds ou migrações). */
export async function ensureUserReferralCode(userId: string): Promise<string> {
  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) throw new Error("USER_NOT_FOUND");
  if (row.referralCode?.trim()) return row.referralCode;

  let code = makeReferralCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await db.query.users.findFirst({ where: eq(users.referralCode, code) });
    if (!clash) break;
    code = makeReferralCode();
  }

  await db
    .update(users)
    .set({ referralCode: code, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return code;
}

export async function listUsersWithReferralLinks(origin: string): Promise<UserReferralRecord[]> {
  const db = getDb();
  const rows = await db.query.users.findMany({
    orderBy: [asc(users.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    referralCode: row.referralCode,
    referralLink: row.referralCode ? buildReferralLink(row.referralCode, origin) : "",
    createdAt: formatDate(row.createdAt),
  }));
}
