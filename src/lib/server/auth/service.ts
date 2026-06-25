import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { hashPassword, verifyPassword } from "@/lib/server/auth/password";
import { findBinaryPlacement } from "@/lib/server/network/placement";
import { getDb } from "@/lib/server/db/client";
import {
  binaryTreeNodes,
  users,
  walletAccounts,
} from "@/lib/server/db/schema";
import { provisionSubscriptionForNewUser } from "@/lib/server/finance/subscription-access";

const WALLET_BUCKETS = ["rendimentos", "afiliados", "automacao", "empresa"] as const;

function makeReferralCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  referralCode: string;
};

function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    referralCode: row.referralCode,
  };
}

async function provisionNewUser(
  input: {
    name: string;
    email: string;
    passwordHash: string;
    role?: "user" | "admin";
    sponsorId?: string | null;
    masterUserId?: string | null;
    binaryPlacement?: { parentId: string; side: "left" | "right" } | null;
  },
): Promise<PublicUser> {
  const db = getDb();
  const now = new Date();
  const userId = randomUUID();

  await db.insert(users).values({
    id: userId,
    name: input.name.trim(),
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    role: input.role ?? "user",
    referralCode: makeReferralCode(),
    sponsorId: input.sponsorId ?? null,
    masterUserId: input.masterUserId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  for (const bucket of WALLET_BUCKETS) {
    await db.insert(walletAccounts).values({
      id: randomUUID(),
      userId,
      bucket,
      availableBalance: 0,
      blockedBalance: 0,
      updatedAt: now,
    });
  }

  await provisionSubscriptionForNewUser(userId);

  let binaryParentId: string | null = null;
  let binarySide: "left" | "right" | null = null;
  if (input.binaryPlacement) {
    binaryParentId = input.binaryPlacement.parentId;
    binarySide = input.binaryPlacement.side;
  } else if (input.sponsorId) {
    const placement = await findBinaryPlacement(input.sponsorId);
    binaryParentId = placement.parentId;
    binarySide = placement.side;
  }

  await db.insert(binaryTreeNodes).values({
    userId,
    parentId: binaryParentId,
    side: binarySide,
    placedAt: now,
  });

  const created = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!created) throw new Error("USER_CREATE_FAILED");
  return toPublicUser(created);
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return { ok: false, error: "E-mail inválido." };
  }

  const row = await db.query.users.findFirst({ where: eq(users.email, normalized) });
  if (!row || !verifyPassword(password, row.passwordHash)) {
    return { ok: false, error: "E-mail ou senha incorretos." };
  }

  return { ok: true, user: toPublicUser(row) };
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  sponsorReferralCode?: string | null;
}): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { ok: false, error: "Informe o seu nome." };
  if (!email.includes("@")) return { ok: false, error: "E-mail inválido." };
  if (input.password.length < 6) {
    return { ok: false, error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { ok: false, error: "Este e-mail já está cadastrado." };

  let sponsorId: string | null = null;
  const ref = input.sponsorReferralCode?.trim().toUpperCase();
  if (ref) {
    const sponsor = await db.query.users.findFirst({ where: eq(users.referralCode, ref) });
    if (!sponsor) return { ok: false, error: "Código de indicação inválido." };
    sponsorId = sponsor.id;
  }

  const user = await provisionNewUser({
    name,
    email,
    passwordHash: hashPassword(input.password),
    sponsorId,
  });

  return { ok: true, user };
}
