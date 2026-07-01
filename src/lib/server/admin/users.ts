import { and, asc, eq } from "drizzle-orm";

import type { AdminUserRecord } from "@/lib/back-office/admin-types";
import {
  AUTOMATION_DEPOSIT_STEP,
  AUTOMATION_PIX_PACKAGE_ID,
  START_PACKAGE_ID,
} from "@/lib/back-office/product-constants";
import { buildReferralLink } from "@/lib/referral/build-link";
import { getDb } from "@/lib/server/db/client";
import { investmentPackages, sessions, userPackages, users } from "@/lib/server/db/schema";
import { userHasActiveStartPack } from "@/lib/server/finance/account-access";
import { activatePackageAfterPayment } from "@/lib/server/finance/packages";

export type UserAccountStatus = "active" | "blocked" | "deleted";

export type PixKeyProfile = {
  pixKey: string | null;
  pixKeySetAt: string | null;
  locked: boolean;
  allowEdit: boolean;
  canEdit: boolean;
};

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function maskPixKey(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 6) return "••••••";
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-3)}`;
}

export function isPixKeyLocked(row: {
  pixKey: string | null;
  allowPixKeyEdit: boolean;
}): boolean {
  return !!row.pixKey?.trim() && !row.allowPixKeyEdit;
}

export async function assertUserAccountActive(userId: string): Promise<
  | { ok: true; status: UserAccountStatus }
  | { ok: false; error: string; status: UserAccountStatus }
> {
  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row) return { ok: false, error: "Utilizador não encontrado.", status: "deleted" };
  const status = (row.accountStatus ?? "active") as UserAccountStatus;
  if (status === "blocked") {
    return { ok: false, error: "Conta bloqueada. Contacte o suporte.", status };
  }
  if (status === "deleted") {
    return { ok: false, error: "Conta removida.", status };
  }
  return { ok: true, status };
}

async function invalidateUserSessions(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function userHasActiveAutomationPack(userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.query.userPackages.findMany({
    where: and(eq(userPackages.userId, userId), eq(userPackages.status, "active")),
    with: { pkg: true },
  });
  return rows.some((row) => row.pkg.packageKind === "automation");
}

export async function listAdminUserRecords(origin: string): Promise<AdminUserRecord[]> {
  const db = getDb();
  const rows = await db.query.users.findMany({
    orderBy: [asc(users.createdAt)],
    with: {
      packages: {
        where: eq(userPackages.status, "active"),
        with: { pkg: true },
      },
    },
  });

  return rows.map((row) => {
    const activePackages = row.packages ?? [];
    const accountActive =
      row.role === "admin" ||
      activePackages.some((pkg) => pkg.packageId === START_PACKAGE_ID);
    const automationActive = activePackages.some((pkg) => pkg.pkg.packageKind === "automation");
    const status = (row.accountStatus ?? "active") as UserAccountStatus;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      referralCode: row.referralCode,
      referralLink: row.referralCode ? buildReferralLink(row.referralCode, origin) : "",
      createdAt: formatDate(row.createdAt),
      accountStatus: status,
      accountActive,
      automationActive,
      pixKeyMasked: maskPixKey(row.pixKey),
      pixKeyLocked: isPixKeyLocked(row),
      allowPixKeyEdit: row.allowPixKeyEdit === true,
    };
  });
}

async function loadTargetUser(userId: string) {
  const db = getDb();
  return db.query.users.findFirst({ where: eq(users.id, userId) });
}

export async function adminBlockUser(input: {
  userId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = await loadTargetUser(input.userId);
  if (!target) return { ok: false, error: "Utilizador não encontrado." };
  if (target.role === "admin") return { ok: false, error: "Não é possível bloquear um administrador." };
  if (target.accountStatus === "deleted") {
    return { ok: false, error: "Conta já foi removida." };
  }

  const db = getDb();
  await db
    .update(users)
    .set({ accountStatus: "blocked", updatedAt: new Date() })
    .where(eq(users.id, input.userId));
  await invalidateUserSessions(input.userId);
  console.info("[admin-users] bloqueado", input.userId, "por", input.actorUserId);
  return { ok: true };
}

export async function adminUnblockUser(input: {
  userId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = await loadTargetUser(input.userId);
  if (!target) return { ok: false, error: "Utilizador não encontrado." };
  if (target.accountStatus === "deleted") {
    return { ok: false, error: "Conta removida — não pode ser desbloqueada." };
  }

  const db = getDb();
  await db
    .update(users)
    .set({ accountStatus: "active", updatedAt: new Date() })
    .where(eq(users.id, input.userId));
  console.info("[admin-users] desbloqueado", input.userId, "por", input.actorUserId);
  return { ok: true };
}

export async function adminDeleteUser(input: {
  userId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = await loadTargetUser(input.userId);
  if (!target) return { ok: false, error: "Utilizador não encontrado." };
  if (target.role === "admin") return { ok: false, error: "Não é possível remover um administrador." };
  if (target.accountStatus === "deleted") {
    return { ok: false, error: "Conta já foi removida." };
  }

  const db = getDb();
  const now = new Date();
  await db
    .update(users)
    .set({
      accountStatus: "deleted",
      name: "Conta removida",
      email: `deleted_${target.id.slice(0, 8)}_${Date.now()}@removed.local`,
      pixKey: null,
      pixKeySetAt: null,
      allowPixKeyEdit: false,
      updatedAt: now,
    })
    .where(eq(users.id, input.userId));
  await invalidateUserSessions(input.userId);
  console.info("[admin-users] removido", input.userId, "por", input.actorUserId);
  return { ok: true };
}

export async function adminActivateAutomationManual(input: {
  userId: string;
  actorUserId: string;
  amount?: number;
  packageId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = await loadTargetUser(input.userId);
  if (!target) return { ok: false, error: "Utilizador não encontrado." };
  if (target.accountStatus !== "active") {
    return { ok: false, error: "Conta inactiva ou bloqueada." };
  }
  if (!(await userHasActiveStartPack(input.userId))) {
    return { ok: false, error: "Active primeiro o Pacote Start do utilizador." };
  }

  const amount = input.amount ?? AUTOMATION_DEPOSIT_STEP;
  const packageId = input.packageId ?? AUTOMATION_PIX_PACKAGE_ID;

  const db = getDb();
  const pkg = await db.query.investmentPackages.findFirst({
    where: and(eq(investmentPackages.id, packageId), eq(investmentPackages.active, true)),
  });
  if (!pkg || pkg.packageKind !== "automation") {
    return { ok: false, error: "Pacote de automação inválido." };
  }
  if (amount < pkg.minAmount || amount > pkg.maxAmount) {
    return {
      ok: false,
      error: `Valor deve estar entre R$ ${pkg.minAmount} e R$ ${pkg.maxAmount}.`,
    };
  }

  const result = await activatePackageAfterPayment({
    userId: input.userId,
    packageId,
    amount,
    skipWalletDebit: true,
  });
  if (!result.ok) return result;

  console.info(
    "[admin-users] automação activada manualmente",
    input.userId,
    amount,
    "por",
    input.actorUserId,
  );
  return { ok: true };
}

export async function adminSetAllowPixKeyEdit(input: {
  userId: string;
  actorUserId: string;
  allowed: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = await loadTargetUser(input.userId);
  if (!target) return { ok: false, error: "Utilizador não encontrado." };
  if (target.accountStatus === "deleted") {
    return { ok: false, error: "Conta removida." };
  }

  const db = getDb();
  await db
    .update(users)
    .set({ allowPixKeyEdit: input.allowed, updatedAt: new Date() })
    .where(eq(users.id, input.userId));
  console.info(
    "[admin-users] allowPixKeyEdit",
    input.allowed,
    input.userId,
    "por",
    input.actorUserId,
  );
  return { ok: true };
}

export async function adminSetUserPixKey(input: {
  userId: string;
  actorUserId: string;
  pixKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const pixKey = input.pixKey.trim();
  if (!pixKey) return { ok: false, error: "Informe a chave PIX." };

  const target = await loadTargetUser(input.userId);
  if (!target) return { ok: false, error: "Utilizador não encontrado." };
  if (target.accountStatus === "deleted") {
    return { ok: false, error: "Conta removida." };
  }

  const db = getDb();
  const now = new Date();
  await db
    .update(users)
    .set({
      pixKey,
      pixKeySetAt: now,
      allowPixKeyEdit: false,
      updatedAt: now,
    })
    .where(eq(users.id, input.userId));

  console.info("[admin-users] pixKey definida por admin", input.userId, "por", input.actorUserId);
  return { ok: true };
}

export async function getPixKeyProfile(userId: string): Promise<PixKeyProfile | null> {
  const row = await loadTargetUser(userId);
  if (!row || row.accountStatus === "deleted") return null;

  const locked = isPixKeyLocked(row);
  const allowEdit = row.allowPixKeyEdit === true;

  return {
    pixKey: row.pixKey,
    pixKeySetAt: row.pixKeySetAt?.toISOString() ?? null,
    locked,
    allowEdit,
    canEdit: !locked || allowEdit,
  };
}

export async function saveUserPixKey(input: {
  userId: string;
  pixKey: string;
}): Promise<{ ok: true; profile: PixKeyProfile } | { ok: false; error: string }> {
  const pixKey = input.pixKey.trim();
  if (!pixKey) return { ok: false, error: "Informe a chave PIX." };

  const row = await loadTargetUser(input.userId);
  if (!row) return { ok: false, error: "Utilizador não encontrado." };
  if (row.accountStatus !== "active") {
    return { ok: false, error: "Conta inactiva ou bloqueada." };
  }

  const hasExisting = !!row.pixKey?.trim();
  if (hasExisting && isPixKeyLocked(row)) {
    return {
      ok: false,
      error: "Chave PIX bloqueada. Solicite autorização ao administrador para alterar.",
    };
  }

  const db = getDb();
  const now = new Date();
  await db
    .update(users)
    .set({
      pixKey,
      pixKeySetAt: hasExisting ? row.pixKeySetAt ?? now : now,
      allowPixKeyEdit: false,
      updatedAt: now,
    })
    .where(eq(users.id, input.userId));

  const profile = await getPixKeyProfile(input.userId);
  if (!profile) return { ok: false, error: "Erro ao guardar chave PIX." };
  return { ok: true, profile };
}

export async function resolveUserPixKeyForWithdrawal(
  userId: string,
  pixKeyOverride?: string,
): Promise<{ ok: true; pixKey: string } | { ok: false; error: string }> {
  const row = await loadTargetUser(userId);
  if (!row) return { ok: false, error: "Utilizador não encontrado." };

  const saved = row.pixKey?.trim();
  if (saved) return { ok: true, pixKey: saved };

  const override = pixKeyOverride?.trim();
  if (!override) {
    return {
      ok: false,
      error: "Registe a sua chave PIX no perfil antes de solicitar saque.",
    };
  }

  const savedResult = await saveUserPixKey({ userId, pixKey: override });
  if (!savedResult.ok) return savedResult;
  return { ok: true, pixKey: override };
}
