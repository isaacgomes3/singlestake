import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { BINARY_MAX_LEVELS, BINARY_START_PACKAGE_ID } from "@/lib/back-office/binary-constants";
import { hashPassword } from "@/lib/server/auth/password";
import { getDb } from "@/lib/server/db/client";
import {
  binaryTreeNodes,
  userPackages,
  users,
  walletAccounts,
} from "@/lib/server/db/schema";
import { provisionSubscriptionForNewUser } from "@/lib/server/finance/subscription-access";
import { resolvePrimaryUserId } from "@/lib/server/network/binary-engine";
import {
  findLegPlacementAtLevel,
  getBinaryPositionRelativeTo,
} from "@/lib/server/network/placement";

const WALLET_BUCKETS = ["rendimentos", "afiliados", "automacao", "empresa"] as const;

export type SubAccountView = {
  id: string;
  name: string;
  email: string;
  level: number;
  legSide: "left" | "right";
  hasActiveStart: boolean;
  placedAt: string;
};

function makeReferralCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

function makeSubAccountEmail(masterId: string, level: number, legSide: string): string {
  const token = randomUUID().slice(0, 8);
  return `sub.${masterId.slice(0, 8)}.L${level}.${legSide}.${token}@subs.singlestake.local`;
}

export async function listQualificationSubAccounts(
  userId: string,
): Promise<SubAccountView[]> {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return [];

  const primaryId = resolvePrimaryUserId(user);
  const [subs, nodes] = await Promise.all([
    db.query.users.findMany({ where: eq(users.masterUserId, primaryId) }),
    db.query.binaryTreeNodes.findMany(),
  ]);

  const startRows = await db
    .select({ userId: userPackages.userId })
    .from(userPackages)
    .where(
      and(
        eq(userPackages.packageId, BINARY_START_PACKAGE_ID),
        eq(userPackages.status, "active"),
      ),
    );
  const startUsers = new Set(startRows.map((r) => r.userId));

  return subs
    .map((sub) => {
      const node = nodes.find((n) => n.userId === sub.id);
      const position = getBinaryPositionRelativeTo(primaryId, sub.id, nodes);
      return {
        id: sub.id,
        name: sub.name,
        email: sub.email,
        level: position?.level ?? 0,
        legSide: position?.legSide ?? ("left" as const),
        hasActiveStart: startUsers.has(sub.id),
        placedAt: node?.placedAt?.toISOString() ?? sub.createdAt.toISOString(),
      };
    })
    .sort((a, b) => a.level - b.level || a.legSide.localeCompare(b.legSide));
}

export async function createQualificationSubAccount(input: {
  masterUserId: string;
  name: string;
  password: string;
  level: number;
  legSide: "left" | "right";
}):
  | {
      ok: true;
      subAccount: SubAccountView;
      credentials: { email: string; password: string };
    }
  | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Informe um nome para a sub-conta." };
  if (input.password.length < 6) {
    return { ok: false, error: "A senha deve ter pelo menos 6 caracteres." };
  }
  if (input.level < 1 || input.level > BINARY_MAX_LEVELS) {
    return { ok: false, error: `Nível inválido (1–${BINARY_MAX_LEVELS}).` };
  }

  const db = getDb();
  const master = await db.query.users.findFirst({ where: eq(users.id, input.masterUserId) });
  if (!master) return { ok: false, error: "Utilizador não encontrado." };
  if (master.masterUserId) {
    return { ok: false, error: "Sub-contas não podem criar outras sub-contas. Use a conta principal." };
  }

  const primaryId = master.id;
  const nodes = await db.query.binaryTreeNodes.findMany();
  const placement = findLegPlacementAtLevel(primaryId, input.legSide, input.level, nodes);
  if (!placement) {
    return {
      ok: false,
      error: `Sem posição livre na perna ${input.legSide === "left" ? "esquerda" : "direita"} no nível ${input.level}.`,
    };
  }

  const email = makeSubAccountEmail(primaryId, input.level, input.legSide);
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { ok: false, error: "Erro ao gerar e-mail. Tente novamente." };

  const now = new Date();
  const userId = randomUUID();

  await db.insert(users).values({
    id: userId,
    name,
    email,
    passwordHash: hashPassword(input.password),
    role: "user",
    referralCode: makeReferralCode(),
    sponsorId: primaryId,
    masterUserId: primaryId,
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

  await db.insert(binaryTreeNodes).values({
    userId,
    parentId: placement.parentId,
    side: placement.side,
    placedAt: now,
  });

  const subAccount: SubAccountView = {
    id: userId,
    name,
    email,
    level: input.level,
    legSide: input.legSide,
    hasActiveStart: false,
    placedAt: now.toISOString(),
  };

  return {
    ok: true,
    subAccount,
    credentials: { email, password: input.password },
  };
}

export async function purchaseStartForSubAccount(input: {
  masterUserId: string;
  subAccountId: string;
}): Promise<
  | { ok: true; subAccount: SubAccountView }
  | { ok: false; error: string }
> {
  const db = getDb();

  const master = await db.query.users.findFirst({ where: eq(users.id, input.masterUserId) });
  if (!master) return { ok: false, error: "Utilizador não encontrado." };
  if (master.masterUserId) {
    return { ok: false, error: "Use a conta principal para activar sub-contas." };
  }

  const sub = await db.query.users.findFirst({ where: eq(users.id, input.subAccountId) });
  if (!sub || sub.masterUserId !== input.masterUserId) {
    return { ok: false, error: "Sub-conta não encontrada ou não pertence à sua conta." };
  }

  const existingStart = await db.query.userPackages.findFirst({
    where: and(
      eq(userPackages.userId, sub.id),
      eq(userPackages.packageId, BINARY_START_PACKAGE_ID),
      eq(userPackages.status, "active"),
    ),
  });
  if (existingStart) {
    return { ok: false, error: "Esta sub-conta já tem o Pacote Start activo." };
  }

  const { purchasePackage } = await import("@/lib/server/finance/packages");
  const result = await purchasePackage({
    userId: sub.id,
    packageId: BINARY_START_PACKAGE_ID,
    payerUserId: input.masterUserId,
  });

  if (!result.ok) return result;

  const items = await listQualificationSubAccounts(input.masterUserId);
  const updated = items.find((row) => row.id === sub.id);
  if (!updated) return { ok: false, error: "Pacote activado, mas erro ao actualizar lista." };

  return { ok: true, subAccount: updated };
}
