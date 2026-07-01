import { desc, eq } from "drizzle-orm";

import type { AdminUserDetail } from "@/lib/back-office/admin-types";
import { buildReferralLink } from "@/lib/referral/build-link";
import { hashPassword } from "@/lib/server/auth/password";
import { maskPixKey } from "@/lib/server/admin/users";
import { getDb } from "@/lib/server/db/client";
import {
  deposits,
  investmentPackages,
  ledgerEntries,
  packagePixOrders,
  users,
  withdrawals,
} from "@/lib/server/db/schema";
import { getPersonalAutomationWalletBalance } from "@/lib/server/finance/global-automation-capital";
import { getUserAutomationDepositedTotal } from "@/lib/server/finance/packages";
import { getWalletBalances } from "@/lib/server/finance/wallet";

function formatIso(d: Date): string {
  return d.toISOString();
}

export async function getAdminUserDetail(
  userId: string,
  origin: string,
): Promise<AdminUserDetail | null> {
  const db = getDb();
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      packages: { with: { pkg: true }, orderBy: (t, { desc: d }) => [d(t.createdAt)] },
      subscription: true,
      sponsor: { columns: { id: true, name: true, email: true } },
    },
  });
  if (!row || row.accountStatus === "deleted") return null;

  const [wallets, personalAutomacao, automationDepositedTotal, ledgerRows, depositRows, withdrawalRows, pixOrders] =
    await Promise.all([
      getWalletBalances(userId),
      getPersonalAutomationWalletBalance(userId),
      getUserAutomationDepositedTotal(userId),
      db.query.ledgerEntries.findMany({
        where: eq(ledgerEntries.userId, userId),
        orderBy: [desc(ledgerEntries.createdAt)],
        limit: 40,
      }),
      db.query.deposits.findMany({
        where: eq(deposits.userId, userId),
        orderBy: [desc(deposits.createdAt)],
        limit: 20,
      }),
      db.query.withdrawals.findMany({
        where: eq(withdrawals.userId, userId),
        orderBy: [desc(withdrawals.createdAt)],
        limit: 20,
      }),
      db.query.packagePixOrders.findMany({
        where: eq(packagePixOrders.userId, userId),
        orderBy: [desc(packagePixOrders.createdAt)],
        limit: 20,
      }),
    ]);

  const packageIds = [...new Set(pixOrders.map((o) => o.packageId))];
  const packageMeta =
    packageIds.length > 0
      ? await db.query.investmentPackages.findMany({
          where: (t, { inArray: inn }) => inn(t.id, packageIds),
        })
      : [];
  const packageNameById = new Map(packageMeta.map((p) => [p.id, p.name]));

  const walletRows = wallets.map((w) =>
    w.bucket === "automacao" ? { ...w, availableBalance: personalAutomacao } : w,
  );

  const activePackages = row.packages.filter((p) => p.status === "active");

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    cpf: row.cpf,
    referralCode: row.referralCode,
    referralLink: buildReferralLink(row.referralCode, origin),
    qualification: row.qualification,
    accountStatus: (row.accountStatus ?? "active") as AdminUserDetail["accountStatus"],
    accountActive:
      row.role === "admin" ||
      activePackages.some((p) => p.packageId === "start" || p.pkg.packageKind === "start"),
    automationActive: activePackages.some((p) => p.pkg.packageKind === "automation"),
    pixKey: row.pixKey,
    pixKeyMasked: maskPixKey(row.pixKey),
    pixKeySetAt: row.pixKeySetAt ? formatIso(row.pixKeySetAt) : null,
    allowPixKeyEdit: row.allowPixKeyEdit === true,
    pixKeyLocked: !!row.pixKey?.trim() && !row.allowPixKeyEdit,
    createdAt: formatIso(row.createdAt),
    updatedAt: formatIso(row.updatedAt),
    sponsor: row.sponsor
      ? { id: row.sponsor.id, name: row.sponsor.name, email: row.sponsor.email }
      : null,
    subscription: row.subscription
      ? {
          status: row.subscription.status,
          amount: row.subscription.amount,
          graceEndsAt: row.subscription.graceEndsAt
            ? formatIso(row.subscription.graceEndsAt)
            : null,
          renewsAt: row.subscription.renewsAt ? formatIso(row.subscription.renewsAt) : null,
        }
      : null,
    packages: row.packages.map((p) => ({
      id: p.id,
      packageId: p.packageId,
      packageName: p.pkg.name,
      packageKind: p.pkg.packageKind,
      amount: p.amount,
      automationBase: p.automationBase,
      totalEarned: p.totalEarned,
      maxProfit: p.maxProfit,
      status: p.status,
      startedAt: formatIso(p.startedAt),
      termEndsAt: formatIso(p.termEndsAt),
    })),
    wallets: walletRows,
    automationDepositedTotal,
    automationBalance: personalAutomacao,
    ledger: ledgerRows.map((e) => ({
      id: e.id,
      bucket: e.bucket,
      entryType: e.entryType,
      amount: e.amount,
      description: e.description,
      createdAt: formatIso(e.createdAt),
    })),
    deposits: depositRows.map((d) => ({
      id: d.id,
      amount: d.amount,
      method: d.method,
      status: d.status,
      createdAt: formatIso(d.createdAt),
    })),
    withdrawals: withdrawalRows.map((w) => ({
      id: w.id,
      amount: w.amount,
      bucket: w.bucket,
      status: w.status,
      createdAt: formatIso(w.createdAt),
    })),
    pixOrders: pixOrders.map((o) => ({
      id: o.id,
      packageId: o.packageId,
      packageName: packageNameById.get(o.packageId) ?? o.packageId,
      amount: o.amount,
      status: o.status,
      hasQrCode: !!o.qrCodeBase64,
      qrCodeBase64: o.qrCodeBase64,
      pixCopyPaste: o.pixCopyPaste,
      createdAt: formatIso(o.createdAt),
      paidAt: o.paidAt ? formatIso(o.paidAt) : null,
    })),
  };
}

export async function updateAdminUserProfile(input: {
  userId: string;
  name?: string;
  email?: string;
  cpf?: string | null;
  qualification?: AdminUserDetail["qualification"];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!row) return { ok: false, error: "Utilizador não encontrado." };
  if (row.accountStatus === "deleted") return { ok: false, error: "Conta removida." };

  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Nome inválido." };
    patch.name = name;
  }
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) return { ok: false, error: "E-mail inválido." };
    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing && existing.id !== input.userId) {
      return { ok: false, error: "E-mail já em uso." };
    }
    patch.email = email;
  }
  if (input.cpf !== undefined) {
    patch.cpf = input.cpf?.replace(/\D/g, "") || null;
  }
  if (input.qualification !== undefined) {
    patch.qualification = input.qualification;
  }

  await db.update(users).set(patch).where(eq(users.id, input.userId));
  return { ok: true };
}

export async function adminResetUserPassword(input: {
  userId: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const password = input.password.trim();
  if (password.length < 6) {
    return { ok: false, error: "A senha deve ter pelo menos 6 caracteres." };
  }
  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
  if (!row) return { ok: false, error: "Utilizador não encontrado." };
  if (row.accountStatus === "deleted") return { ok: false, error: "Conta removida." };

  await db
    .update(users)
    .set({ passwordHash: hashPassword(password), updatedAt: new Date() })
    .where(eq(users.id, input.userId));
  return { ok: true };
}
