/**
 * Rede qualificadora Isaac: admin total + 2 contas L1 + 4 contas L2.
 * Start R$ 50 activo sem pagamento; pontos binários sem bónus em saldo.
 *
 * Uso: npm run db:seed-isaac
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import {
  ADHESION_DAYS,
  DEFAULT_SUBSCRIPTION_AMOUNT,
  MAX_PROFIT_MULTIPLIER,
  START_PACKAGE_AMOUNT,
  START_PACKAGE_ID,
} from "../src/lib/back-office/product-constants";
import { hashPassword } from "../src/lib/server/auth/password";
import { closeDb, getDb } from "../src/lib/server/db/client";
import {
  binaryTreeNodes,
  subscriptions,
  systemSettings,
  userPackages,
  users,
  walletAccounts,
} from "../src/lib/server/db/schema";
import { setCompanyUserId } from "../src/lib/server/finance/company-pool";
import { calculatePackageSplit } from "../src/lib/server/finance/package-split";
import { provisionSubscriptionForNewUser } from "../src/lib/server/finance/subscription-access";
import { rebuildBinaryPointsFromHistory } from "../src/lib/server/network/binary-engine";
import { findLegPlacementAtLevel } from "../src/lib/server/network/placement";

const ISAAC_EMAIL = (process.env.ISAAC_EMAIL ?? "isaacgomes3@gmail.com").toLowerCase();
const ISAAC_NAME = process.env.ISAAC_NAME ?? "Isaac Gomes";
const ISAAC_PASSWORD = process.env.ISAAC_PASSWORD;
const SLOT_PASSWORD = process.env.ISAAC_NETWORK_SLOT_PASSWORD ?? "Start50Qual!";
const SETTINGS_KEY = "isaac_network_slots";

const WALLET_BUCKETS = ["rendimentos", "afiliados", "automacao", "empresa"] as const;

type LegSide = "left" | "right";

type SlotDef = {
  key: string;
  name: string;
  email: string;
  level: number;
  legSide: LegSide;
};

const SLOTS: SlotDef[] = [
  {
    key: "l1-left",
    name: "Qualificador L1 Esquerda",
    email: "qual.l1.left@isaac-net.singlestake.local",
    level: 1,
    legSide: "left",
  },
  {
    key: "l1-right",
    name: "Qualificador L1 Direita",
    email: "qual.l1.right@isaac-net.singlestake.local",
    level: 1,
    legSide: "right",
  },
  {
    key: "l2-left-a",
    name: "Qualificador L2 Esquerda A",
    email: "qual.l2.left.a@isaac-net.singlestake.local",
    level: 2,
    legSide: "left",
  },
  {
    key: "l2-left-b",
    name: "Qualificador L2 Esquerda B",
    email: "qual.l2.left.b@isaac-net.singlestake.local",
    level: 2,
    legSide: "left",
  },
  {
    key: "l2-right-a",
    name: "Qualificador L2 Direita A",
    email: "qual.l2.right.a@isaac-net.singlestake.local",
    level: 2,
    legSide: "right",
  },
  {
    key: "l2-right-b",
    name: "Qualificador L2 Direita B",
    email: "qual.l2.right.b@isaac-net.singlestake.local",
    level: 2,
    legSide: "right",
  },
];

function makeReferralCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
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

async function ensureWallets(userId: string, now: number) {
  const db = getDb();
  for (const bucket of WALLET_BUCKETS) {
    const existing = await db.query.walletAccounts.findFirst({
      where: and(eq(walletAccounts.userId, userId), eq(walletAccounts.bucket, bucket)),
    });
    if (!existing) {
      await db.insert(walletAccounts).values({
        id: randomUUID(),
        userId,
        bucket,
        availableBalance: 0,
        blockedBalance: 0,
        updatedAt: new Date(now),
      });
    }
  }
}

async function activateStartWithoutPayment(userId: string, now: number) {
  const db = getDb();
  const existing = await db.query.userPackages.findFirst({
    where: and(
      eq(userPackages.userId, userId),
      eq(userPackages.packageId, START_PACKAGE_ID),
      eq(userPackages.status, "active"),
    ),
  });
  if (existing) return;

  const adhesionEnds = new Date(now + ADHESION_DAYS * 86_400_000);
  const startedAt = new Date(now);
  const split = calculatePackageSplit(START_PACKAGE_AMOUNT, "start");

  await db.insert(userPackages).values({
    id: randomUUID(),
    userId,
    packageId: START_PACKAGE_ID,
    amount: START_PACKAGE_AMOUNT,
    affiliateAmount: split.affiliateAmount,
    automationBase: split.automationBase,
    companyAmount: split.companyAmount,
    totalEarned: 0,
    maxProfit: START_PACKAGE_AMOUNT * MAX_PROFIT_MULTIPLIER,
    status: "active",
    startedAt,
    termEndsAt: adhesionEnds,
    adhesionEndsAt: adhesionEnds,
    createdAt: new Date(now),
  });
}

async function activateSubscriptionWithoutPayment(userId: string, now: number) {
  const db = getDb();
  await provisionSubscriptionForNewUser(userId);

  const renewsAt = new Date(now + 365 * 86_400_000);
  const graceEnds = renewsAt;

  await db
    .update(subscriptions)
    .set({
      status: "active",
      amount: DEFAULT_SUBSCRIPTION_AMOUNT,
      graceEndsAt: graceEnds,
      renewsAt,
      updatedAt: new Date(now),
    })
    .where(eq(subscriptions.userId, userId));
}

async function ensureBinaryRoot(userId: string, now: number) {
  const db = getDb();
  const node = await db.query.binaryTreeNodes.findFirst({
    where: eq(binaryTreeNodes.userId, userId),
  });
  if (!node) {
    await db.insert(binaryTreeNodes).values({
      userId,
      parentId: null,
      side: null,
      placedAt: new Date(now),
    });
    return;
  }
  if (node.parentId) {
    console.warn(
      `  Aviso: ${ISAAC_EMAIL} não é raiz da árvore binária (tem patrocinador na árvore). Sub-contas serão colocadas abaixo do nó dele.`,
    );
  }
}

async function ensureIsaac(now: number): Promise<string> {
  const db = getDb();
  let isaac = await db.query.users.findFirst({ where: eq(users.email, ISAAC_EMAIL) });

  if (!isaac) {
    if (!ISAAC_PASSWORD || ISAAC_PASSWORD.length < 6) {
      throw new Error(
        `Conta ${ISAAC_EMAIL} não existe. Defina ISAAC_PASSWORD (mín. 6 caracteres) para criar.`,
      );
    }
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      name: ISAAC_NAME,
      email: ISAAC_EMAIL,
      passwordHash: hashPassword(ISAAC_PASSWORD),
      role: "admin",
      referralCode: makeReferralCode(),
      qualification: "imperial",
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
    isaac = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!isaac) throw new Error("Falha ao criar conta Isaac.");
    console.log("  Conta Isaac criada.");
  } else {
    await db
      .update(users)
      .set({
        role: "admin",
        qualification: "imperial",
        updatedAt: new Date(now),
      })
      .where(eq(users.id, isaac.id));
    console.log("  Isaac promovido a admin (qualificação imperial).");
  }

  await ensureWallets(isaac.id, now);
  await ensureBinaryRoot(isaac.id, now);
  await activateSubscriptionWithoutPayment(isaac.id, now);
  await activateStartWithoutPayment(isaac.id, now);
  await setCompanyUserId(isaac.id);

  return isaac.id;
}

async function ensureQualificationSlot(
  masterId: string,
  slot: SlotDef,
  password: string,
  now: number,
): Promise<{ userId: string; email: string; created: boolean }> {
  const db = getDb();
  const byEmail = await db.query.users.findFirst({ where: eq(users.email, slot.email) });
  if (byEmail) {
    if (byEmail.masterUserId !== masterId) {
      throw new Error(`E-mail ${slot.email} já pertence a outra conta principal.`);
    }
    await activateSubscriptionWithoutPayment(byEmail.id, now);
    await activateStartWithoutPayment(byEmail.id, now);
    return { userId: byEmail.id, email: byEmail.email, created: false };
  }

  const nodes = await db.query.binaryTreeNodes.findMany();
  const placement = findLegPlacementAtLevel(masterId, slot.legSide, slot.level, nodes);
  if (!placement) {
    throw new Error(
      `Sem posição livre para ${slot.key} (nível ${slot.level}, perna ${slot.legSide}).`,
    );
  }

  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    name: slot.name,
    email: slot.email,
    passwordHash: hashPassword(password),
    role: "user",
    referralCode: makeReferralCode(),
    sponsorId: masterId,
    masterUserId: masterId,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });

  await ensureWallets(userId, now);
  await provisionSubscriptionForNewUser(userId);

  await db.insert(binaryTreeNodes).values({
    userId,
    parentId: placement.parentId,
    side: placement.side,
    placedAt: new Date(now),
  });

  await activateSubscriptionWithoutPayment(userId, now);
  await activateStartWithoutPayment(userId, now);

  return { userId, email: slot.email, created: true };
}

async function main() {
  const now = Date.now();
  const db = getDb();

  console.log("A configurar rede Isaac…");
  console.log("  Master:", ISAAC_EMAIL);

  const masterId = await ensureIsaac(now);

  const slotRecords: Record<
    string,
    { userId: string; email: string; level: number; leg: LegSide; name: string }
  > = {};

  for (const slot of SLOTS) {
    const result = await ensureQualificationSlot(masterId, slot, SLOT_PASSWORD, now);
    slotRecords[slot.key] = {
      userId: result.userId,
      email: result.email,
      level: slot.level,
      leg: slot.legSide,
      name: slot.name,
    };
    console.log(
      `  ${result.created ? "Criada" : "Actualizada"}: ${slot.key} → ${result.email} (${result.userId})`,
    );
  }

  const points = await rebuildBinaryPointsFromHistory();
  console.log(
    `  Pontos binários recalculados: ${points.purchases} compras, ${points.pointsRows} linhas de perna.`,
  );

  const master = await db.query.users.findFirst({ where: eq(users.id, masterId) });

  await upsertSetting(
    SETTINGS_KEY,
    {
      masterEmail: ISAAC_EMAIL,
      masterUserId: masterId,
      masterReferralCode: master?.referralCode ?? null,
      defaultSlotPassword: SLOT_PASSWORD,
      slots: slotRecords,
      seededAt: new Date(now).toISOString(),
      notes:
        "Contas qualificadoras reservadas. Start activo sem pagamento; activação gera pontos, não bónus em saldo.",
    },
    now,
  );

  console.log("\nRede Isaac concluída.");
  console.log("  Admin:", ISAAC_EMAIL, `(${masterId})`);
  console.log("  Código indicação:", master?.referralCode);
  console.log("  Senha slots qualificadores:", SLOT_PASSWORD);
  console.log("  IDs guardados em system_settings →", SETTINGS_KEY);
  console.log("\nÁrvore:");
  console.log("        Isaac");
  console.log("       /     \\");
  console.log("   l1-left  l1-right");
  console.log("   /    \\    /    \\");
  console.log(" l2-a l2-b l2-a l2-b");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
