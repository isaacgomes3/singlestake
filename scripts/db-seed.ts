/**
 * Dados iniciais: pacotes, config MMN, utilizador admin.
 * Uso: npm run db:seed
 */
import "./load-local-env";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import {
  DEFAULT_BINARY_CONFIG,
  REFERRAL_LEVELS,
  RESIDUAL_LEVELS,
} from "../src/lib/back-office/constants";
import { PRODUCT_PACKAGES, ADHESION_DAYS, DEFAULT_SUBSCRIPTION_AMOUNT, MAX_PROFIT_MULTIPLIER, START_PACKAGE_AMOUNT, START_PACKAGE_ID } from "../src/lib/back-office/product-constants";
import { hashPassword } from "../src/lib/server/auth/password";
import { setCompanyUserId } from "../src/lib/server/finance/company-pool";
import { calculatePackageSplit } from "../src/lib/server/finance/package-split";
import { closeDb, getDb } from "../src/lib/server/db/client";
import {
  auditLogs,
  binaryTreeNodes,
  investmentPackages,
  ledgerEntries,
  subscriptions,
  systemSettings,
  userPackages,
  users,
  walletAccounts,
} from "../src/lib/server/db/schema";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@singlestake.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "123456";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Admin Demo";
const COMPANY_EMAIL = process.env.SEED_COMPANY_EMAIL ?? "caixa@singlestake.local";
const COMPANY_NAME = process.env.SEED_COMPANY_NAME ?? "Caixa Empresa";

const WALLET_BUCKETS = ["rendimentos", "afiliados", "automacao", "empresa"] as const;

function makeReferralCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

async function seedAdminDemoPackages(userId: string, now: number) {
  const db = getDb();
  const adhesionEnds = new Date(now + ADHESION_DAYS * 86_400_000);
  const startedAt = new Date(now - 30 * 86_400_000);

  const startSplit = calculatePackageSplit(START_PACKAGE_AMOUNT, "start");
  await db.insert(userPackages).values({
    id: randomUUID(),
    userId,
    packageId: START_PACKAGE_ID,
    amount: START_PACKAGE_AMOUNT,
    affiliateAmount: startSplit.affiliateAmount,
    automationBase: startSplit.automationBase,
    companyAmount: startSplit.companyAmount,
    totalEarned: 0,
    maxProfit: START_PACKAGE_AMOUNT * MAX_PROFIT_MULTIPLIER,
    status: "active",
    startedAt,
    termEndsAt: adhesionEnds,
    adhesionEndsAt: adhesionEnds,
    createdAt: new Date(now),
  });

  const autoAmount = 1000;
  const autoSplit = calculatePackageSplit(autoAmount, "automation");
  await db.insert(userPackages).values({
    id: randomUUID(),
    userId,
    packageId: "auto-1000",
    amount: autoAmount,
    affiliateAmount: autoSplit.affiliateAmount,
    automationBase: autoSplit.automationBase,
    companyAmount: autoSplit.companyAmount,
    totalEarned: 0,
    maxProfit: autoAmount * MAX_PROFIT_MULTIPLIER,
    status: "active",
    startedAt,
    termEndsAt: adhesionEnds,
    adhesionEndsAt: adhesionEnds,
    createdAt: new Date(now),
  });
}

async function upsertSetting(key: string, value: unknown, now: number) {
  const db = getDb();
  await db
    .insert(systemSettings)
    .values({
      key,
      valueJson: JSON.stringify(value),
      updatedAt: new Date(now),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        valueJson: sql`excluded.value_json`,
        updatedAt: new Date(now),
      },
    });
}

async function main() {
  const db = getDb();
  const now = Date.now();

  for (const pkg of PRODUCT_PACKAGES) {
    await db
      .insert(investmentPackages)
      .values({
        id: pkg.id,
        name: pkg.name,
        minAmount: pkg.minAmount,
        maxAmount: pkg.maxAmount,
        dailyYieldPct: 0,
        termDays: ADHESION_DAYS,
        packageKind: pkg.packageKind,
        active: pkg.active,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: investmentPackages.id,
        set: {
          name: pkg.name,
          minAmount: pkg.minAmount,
          maxAmount: pkg.maxAmount,
          termDays: ADHESION_DAYS,
          packageKind: pkg.packageKind,
          active: pkg.active,
          updatedAt: new Date(now),
        },
      });
  }

  const legacyIds = ["bronze", "prata", "ouro"];
  for (const legacyId of legacyIds) {
    await db
      .update(investmentPackages)
      .set({ active: false, updatedAt: new Date(now) })
      .where(eq(investmentPackages.id, legacyId));
  }

  await upsertSetting("referral_levels", REFERRAL_LEVELS, now);
  await upsertSetting("residual_levels", RESIDUAL_LEVELS, now);
  await upsertSetting("binary_bonus", DEFAULT_BINARY_CONFIG, now);

  const existingCompany = await db.query.users.findFirst({
    where: eq(users.email, COMPANY_EMAIL.toLowerCase()),
  });
  let companyId = existingCompany?.id;
  if (!companyId) {
    companyId = randomUUID();
    await db.insert(users).values({
      id: companyId,
      name: COMPANY_NAME,
      email: COMPANY_EMAIL.toLowerCase(),
      passwordHash: hashPassword(randomUUID()),
      role: "admin",
      referralCode: makeReferralCode(),
      qualification: "imperial",
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
    for (const bucket of WALLET_BUCKETS) {
      await db.insert(walletAccounts).values({
        id: randomUUID(),
        userId: companyId,
        bucket,
        availableBalance: 0,
        blockedBalance: 0,
        updatedAt: new Date(now),
      });
    }
  }

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, ADMIN_EMAIL.toLowerCase()),
  });

  let adminId = existingAdmin?.id;

  if (!adminId) {
    adminId = randomUUID();
    await db.insert(users).values({
      id: adminId,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash: hashPassword(ADMIN_PASSWORD),
      role: "admin",
      referralCode: makeReferralCode(),
      qualification: "imperial",
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });

    for (const bucket of WALLET_BUCKETS) {
      await db.insert(walletAccounts).values({
        id: randomUUID(),
        userId: adminId,
        bucket,
        availableBalance: bucket === "rendimentos" ? 1250.5 : 0,
        blockedBalance: 0,
        updatedAt: new Date(now),
      });
    }

    await seedAdminDemoPackages(adminId, now);

    const graceEnds = new Date(now + 30 * 86_400_000);
    await db.insert(subscriptions).values({
      id: randomUUID(),
      userId: adminId,
      status: "active",
      amount: DEFAULT_SUBSCRIPTION_AMOUNT,
      graceEndsAt: graceEnds,
      renewsAt: new Date(now + 30 * 86_400_000),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });

    await db.insert(binaryTreeNodes).values({
      userId: adminId,
      parentId: null,
      side: null,
      placedAt: new Date(now),
    });

    await db.insert(ledgerEntries).values([
      {
        id: randomUUID(),
        userId: adminId,
        bucket: "rendimentos",
        entryType: "credit",
        amount: 320,
        description: "Rendimento diário — Automação R$ 1.000",
        createdAt: new Date(now - 86_400_000),
      },
      {
        id: randomUUID(),
        userId: adminId,
        bucket: "afiliados",
        entryType: "credit",
        amount: 85,
        description: "Bónus indicação nível 1",
        createdAt: new Date(now - 2 * 86_400_000),
      },
    ]);

    await db.insert(auditLogs).values({
      id: randomUUID(),
      actorUserId: adminId,
      actorLabel: ADMIN_NAME,
      action: "seed.database",
      detail: "Base de dados inicializada",
      createdAt: new Date(now),
    });
  } else {
    const legacyPackages = await db.query.userPackages.findMany({
      where: and(
        eq(userPackages.userId, adminId),
        inArray(userPackages.packageId, ["bronze", "prata", "ouro"]),
      ),
    });
    if (legacyPackages.length > 0) {
      await db
        .delete(userPackages)
        .where(
          and(
            eq(userPackages.userId, adminId),
            inArray(userPackages.packageId, ["bronze", "prata", "ouro"]),
          ),
        );
      await seedAdminDemoPackages(adminId, now);
      console.log("  Pacotes demo do admin actualizados (Start + Automação R$ 1.000).");
    }
  }

  if (companyId) {
    await setCompanyUserId(companyId);
  }

  console.log("Seed concluído.");
  console.log("  Admin:", ADMIN_EMAIL);
  console.log("  Caixa empresa:", COMPANY_EMAIL);
  console.log("  Senha:", ADMIN_PASSWORD);
  console.log("  User id:", adminId);

  const { ensureUserReferralCode } = await import("../src/lib/server/network/referral");
  const allUsers = await db.query.users.findMany();
  for (const u of allUsers) {
    if (!u.referralCode?.trim()) {
      const code = await ensureUserReferralCode(u.id);
      console.log("  Código gerado para", u.email, "→", code);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
