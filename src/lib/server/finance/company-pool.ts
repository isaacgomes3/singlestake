import { eq } from "drizzle-orm";

import type { WalletBucket } from "@/lib/back-office/finance-constants";
import { getDb } from "@/lib/server/db/client";
import { users, walletAccounts } from "@/lib/server/db/schema";
import { creditWallet, debitWallet, getWalletBalance } from "@/lib/server/finance/wallet";

const COMPANY_USER_KEY = "company_user_id";

const COMPANY_BUCKETS: WalletBucket[] = ["empresa", "afiliados", "automacao"];

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

async function ensureCompanyWallet(companyUserId: string, bucket: WalletBucket): Promise<void> {
  const wallet = await getWalletBalance(companyUserId, bucket);
  if (wallet) return;
  const db = getDb();
  const { randomUUID } = await import("node:crypto");
  await db.insert(walletAccounts).values({
    id: randomUUID(),
    userId: companyUserId,
    bucket,
    availableBalance: 0,
    blockedBalance: 0,
    updatedAt: new Date(),
  });
}

export async function creditCompanyBucket(input: {
  bucket: Extract<WalletBucket, "empresa" | "afiliados" | "automacao">;
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
}): Promise<void> {
  if (input.amount <= 0) return;
  const companyUserId = await resolveCompanyUserId();
  await ensureCompanyWallet(companyUserId, input.bucket);
  await creditWallet({
    userId: companyUserId,
    bucket: input.bucket,
    amount: input.amount,
    description: input.description,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
  });
}

/** Saques de afiliados debitam o caixa afiliados da empresa. */
export async function debitCompanyAffiliatePool(input: {
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
}): Promise<void> {
  if (input.amount <= 0) return;
  const companyUserId = await resolveCompanyUserId();
  await ensureCompanyWallet(companyUserId, "afiliados");
  await debitWallet({
    userId: companyUserId,
    bucket: "afiliados",
    amount: input.amount,
    description: input.description,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
  });
}

/** @deprecated Use creditCompanyBucket({ bucket: "empresa", ... }) */
export async function creditCompanyPool(input: {
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
}): Promise<void> {
  await creditCompanyBucket({ bucket: "empresa", ...input });
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

export async function getCompanyBucketBalances(): Promise<
  Record<(typeof COMPANY_BUCKETS)[number], number>
> {
  const companyUserId = await resolveCompanyUserId();
  const out = { empresa: 0, afiliados: 0, automacao: 0 } as Record<
    (typeof COMPANY_BUCKETS)[number],
    number
  >;
  for (const bucket of COMPANY_BUCKETS) {
    const w = await getWalletBalance(companyUserId, bucket);
    out[bucket] = w?.availableBalance ?? 0;
  }
  return out;
}
