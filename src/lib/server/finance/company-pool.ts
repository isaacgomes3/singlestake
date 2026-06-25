import { eq } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { users } from "@/lib/server/db/schema";
import { creditWallet, getWalletBalance } from "@/lib/server/finance/wallet";

const COMPANY_USER_KEY = "company_user_id";

export async function resolveCompanyUserId(): Promise<string> {
  const db = getDb();
  const row = await db.query.systemSettings.findFirst({
    where: (t, { eq: e }) => e(t.key, COMPANY_USER_KEY),
  });
  if (row) {
    try {
      const id = JSON.parse(row.valueJson) as string;
      if (id) return id;
    } catch {
      /* fallback */
    }
  }

  const admin = await db.query.users.findFirst({
    where: eq(users.role, "admin"),
  });
  if (!admin) throw new Error("COMPANY_USER_NOT_FOUND");
  return admin.id;
}

export async function creditCompanyPool(input: {
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
}): Promise<void> {
  const companyUserId = await resolveCompanyUserId();
  let wallet = await getWalletBalance(companyUserId, "empresa");
  if (!wallet) {
    const db = getDb();
    const { randomUUID } = await import("node:crypto");
    const { walletAccounts } = await import("@/lib/server/db/schema");
    await db.insert(walletAccounts).values({
      id: randomUUID(),
      userId: companyUserId,
      bucket: "empresa",
      availableBalance: 0,
      blockedBalance: 0,
      updatedAt: new Date(),
    });
  }

  await creditWallet({
    userId: companyUserId,
    bucket: "empresa",
    amount: input.amount,
    description: input.description,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
  });
}

export async function setCompanyUserId(userId: string): Promise<void> {
  const db = getDb();
  const { systemSettings: settings } = await import("@/lib/server/db/schema");
  const { sql } = await import("drizzle-orm");
  await db
    .insert(settings)
    .values({
      key: COMPANY_USER_KEY,
      valueJson: JSON.stringify(userId),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        valueJson: sql`excluded.value_json`,
        updatedAt: new Date(),
      },
    });
}
