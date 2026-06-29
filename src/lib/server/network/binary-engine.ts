import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  BINARY_MATCH_PAYOUT_PERCENT,
  BINARY_MAX_LEVELS,
  BINARY_START_PACKAGE_ID,
  POINTS_PER_REAL,
} from "@/lib/back-office/binary-constants";
import { getDb } from "@/lib/server/db/client";
import {
  binaryLegPoints,
  binaryTreeNodes,
  userPackages,
  users,
} from "@/lib/server/db/schema";
import { getBinaryPositionRelativeTo } from "@/lib/server/network/placement";
import { capPayoutAmount } from "@/lib/server/finance/profit-cap";
import {
  isAffiliateServicesActive,
  recordMissedCredit,
} from "@/lib/server/finance/subscription-access";
import { creditWallet } from "@/lib/server/finance/wallet";

type Side = "left" | "right";
type ChildIndex = Map<string, { left?: string; right?: string }>;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildChildIndex(nodes: (typeof binaryTreeNodes.$inferSelect)[]): ChildIndex {
  const index: ChildIndex = new Map();
  for (const node of nodes) {
    if (!node.parentId || !node.side) continue;
    const entry = index.get(node.parentId) ?? {};
    if (node.side === "left") entry.left = node.userId;
    else entry.right = node.userId;
    index.set(node.parentId, entry);
  }
  return index;
}

/** Conta principal (sub-contas de qualificação apontam para ela). */
export function resolvePrimaryUserId(user: {
  id: string;
  masterUserId: string | null;
}): string {
  return user.masterUserId ?? user.id;
}

async function loadUsersMap(): Promise<Map<string, typeof users.$inferSelect>> {
  const db = getDb();
  const rows = await db.query.users.findMany();
  return new Map(rows.map((u) => [u.id, u]));
}

async function loadStartUsers(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ userId: userPackages.userId })
    .from(userPackages)
    .where(
      and(
        eq(userPackages.packageId, BINARY_START_PACKAGE_ID),
        eq(userPackages.status, "active"),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}

/** Todos os nós na profundidade `level` dentro da perna (1 = filho directo). */
function nodesAtLegLevel(
  rootUserId: string,
  side: Side,
  level: number,
  childIndex: ChildIndex,
): string[] {
  const direct = childIndex.get(rootUserId)?.[side];
  if (!direct || level < 1) return [];

  let frontier = [direct];
  for (let depth = 1; depth < level; depth++) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      const children = childIndex.get(nodeId);
      if (children?.left) next.push(children.left);
      if (children?.right) next.push(children.right);
    }
    if (next.length === 0) return [];
    frontier = next;
  }
  return frontier;
}

function hasOwnedStartAtLevel(
  primaryUserId: string,
  level: number,
  side: Side,
  childIndex: ChildIndex,
  usersMap: Map<string, typeof users.$inferSelect>,
  startUsers: Set<string>,
): boolean {
  const candidates = nodesAtLegLevel(primaryUserId, side, level, childIndex);
  for (const nodeUserId of candidates) {
    const row = usersMap.get(nodeUserId);
    if (!row) continue;
    const owner = resolvePrimaryUserId(row);
    if (owner === primaryUserId && startUsers.has(nodeUserId)) {
      return true;
    }
  }
  return false;
}

/** Conta qualificadora nível 1 — compras próprias não pontuam o patrocinador. */
export function isLevelOneQualifierChild(
  primaryUserId: string,
  buyerUserId: string,
  childIndex: ChildIndex,
): boolean {
  const children = childIndex.get(primaryUserId);
  if (!children) return false;
  return children.left === buyerUserId || children.right === buyerUserId;
}

export function isBinaryGloballyActive(
  primaryUserId: string,
  childIndex: ChildIndex,
  usersMap: Map<string, typeof users.$inferSelect>,
  startUsers: Set<string>,
): boolean {
  return (
    hasOwnedStartAtLevel(primaryUserId, 1, "left", childIndex, usersMap, startUsers) &&
    hasOwnedStartAtLevel(primaryUserId, 1, "right", childIndex, usersMap, startUsers)
  );
}

export function isLevelQualified(
  primaryUserId: string,
  level: number,
  childIndex: ChildIndex,
  usersMap: Map<string, typeof users.$inferSelect>,
  startUsers: Set<string>,
): boolean {
  return (
    hasOwnedStartAtLevel(primaryUserId, level, "left", childIndex, usersMap, startUsers) &&
    hasOwnedStartAtLevel(primaryUserId, level, "right", childIndex, usersMap, startUsers)
  );
}

async function addLegPoints(
  userId: string,
  level: number,
  side: Side,
  points: number,
): Promise<void> {
  const db = getDb();
  const now = new Date();
  const existing = await db.query.binaryLegPoints.findFirst({
    where: and(
      eq(binaryLegPoints.userId, userId),
      eq(binaryLegPoints.level, level),
      eq(binaryLegPoints.side, side),
    ),
  });

  if (existing) {
    await db
      .update(binaryLegPoints)
      .set({
        totalPoints: existing.totalPoints + points,
        updatedAt: now,
      })
      .where(
        and(
          eq(binaryLegPoints.userId, userId),
          eq(binaryLegPoints.level, level),
          eq(binaryLegPoints.side, side),
        ),
      );
  } else {
    await db.insert(binaryLegPoints).values({
      userId,
      level,
      side,
      totalPoints: points,
      matchedPoints: 0,
      updatedAt: now,
    });
  }
}

async function tryMatchLevel(
  primaryUserId: string,
  level: number,
  childIndex: ChildIndex,
  usersMap: Map<string, typeof users.$inferSelect>,
  startUsers: Set<string>,
): Promise<{ matched: number; paid: number }> {
  /** Binário opera só no nível 1 (pernas esquerda/direita directas qualificadas). */
  if (level !== 1) return { matched: 0, paid: 0 };

  if (!isBinaryGloballyActive(primaryUserId, childIndex, usersMap, startUsers)) {
    return { matched: 0, paid: 0 };
  }

  const subscriptionActive = await isAffiliateServicesActive(primaryUserId);
  if (!subscriptionActive) {
    return { matched: 0, paid: 0 };
  }

  const db = getDb();
  const [leftRow, rightRow] = await Promise.all([
    db.query.binaryLegPoints.findFirst({
      where: and(
        eq(binaryLegPoints.userId, primaryUserId),
        eq(binaryLegPoints.level, level),
        eq(binaryLegPoints.side, "left"),
      ),
    }),
    db.query.binaryLegPoints.findFirst({
      where: and(
        eq(binaryLegPoints.userId, primaryUserId),
        eq(binaryLegPoints.level, level),
        eq(binaryLegPoints.side, "right"),
      ),
    }),
  ]);

  const leftAvail = (leftRow?.totalPoints ?? 0) - (leftRow?.matchedPoints ?? 0);
  const rightAvail = (rightRow?.totalPoints ?? 0) - (rightRow?.matchedPoints ?? 0);
  const maxMatchPoints = Math.min(leftAvail, rightAvail);
  if (maxMatchPoints <= 0) return { matched: 0, paid: 0 };

  const rawPayout = roundMoney((maxMatchPoints * BINARY_MATCH_PAYOUT_PERCENT) / 100);
  const payout = await capPayoutAmount(primaryUserId, rawPayout);
  if (payout <= 0) return { matched: 0, paid: 0 };

  const matchPoints =
    payout < rawPayout
      ? roundMoney((payout * 100) / BINARY_MATCH_PAYOUT_PERCENT)
      : maxMatchPoints;
  const now = new Date();

  if (leftRow) {
    await db
      .update(binaryLegPoints)
      .set({
        matchedPoints: leftRow.matchedPoints + matchPoints,
        updatedAt: now,
      })
      .where(
        and(
          eq(binaryLegPoints.userId, primaryUserId),
          eq(binaryLegPoints.level, level),
          eq(binaryLegPoints.side, "left"),
        ),
      );
  }
  if (rightRow) {
    await db
      .update(binaryLegPoints)
      .set({
        matchedPoints: rightRow.matchedPoints + matchPoints,
        updatedAt: now,
      })
      .where(
        and(
          eq(binaryLegPoints.userId, primaryUserId),
          eq(binaryLegPoints.level, level),
          eq(binaryLegPoints.side, "right"),
        ),
      );
  }

  if (payout > 0) {
    const active = await isAffiliateServicesActive(primaryUserId);
    const description = `Bónus binário nível ${level} — ${BINARY_MATCH_PAYOUT_PERCENT}% de ${matchPoints.toFixed(0)} pts`;
    const refId = randomUUID();

    if (active) {
      await creditWallet({
        userId: primaryUserId,
        bucket: "afiliados",
        amount: payout,
        description,
        referenceType: "binary_bonus",
        referenceId: refId,
      });
    } else {
      await recordMissedCredit({
        userId: primaryUserId,
        amount: payout,
        reason: description,
        referenceType: "binary_bonus",
        referenceId: refId,
      });
    }
  }

  return { matched: matchPoints, paid: payout };
}

async function propagatePointsUpTree(buyerUserId: string, points: number): Promise<void> {
  const db = getDb();
  const nodes = await db.query.binaryTreeNodes.findMany();
  const usersMap = await loadUsersMap();
  const nodeByUser = new Map(nodes.map((n) => [n.userId, n]));
  const childIndex = buildChildIndex(nodes);

  const buyerNode = nodeByUser.get(buyerUserId);
  if (!buyerNode?.side) return;

  let currentId: string | null = buyerUserId;

  while (currentId) {
    const node = nodeByUser.get(currentId);
    if (!node?.parentId || !node.side) break;

    const parentId = node.parentId;
    const parent = usersMap.get(parentId);
    if (!parent) break;

    const primaryId = resolvePrimaryUserId(parent);
    const skipQualifier =
      isLevelOneQualifierChild(primaryId, buyerUserId, childIndex);

    if (!skipQualifier) {
      const legSide =
        getBinaryPositionRelativeTo(primaryId, buyerUserId, nodes)?.legSide ??
        (node.side as Side);
      await addLegPoints(primaryId, 1, legSide, points);
    }
    currentId = parentId;
  }
}

async function settleBinaryMatchesForPurchase(buyerUserId: string): Promise<void> {
  const db = getDb();
  const [nodes, usersMap, startUsers] = await Promise.all([
    db.query.binaryTreeNodes.findMany(),
    loadUsersMap(),
    loadStartUsers(),
  ]);
  const childIndex = buildChildIndex(nodes);
  const nodeByUser = new Map(nodes.map((n) => [n.userId, n]));

  let currentId: string | null = buyerUserId;

  while (currentId) {
    const node = nodeByUser.get(currentId);
    if (!node?.parentId || !node.side) break;

    const parentId = node.parentId;
    const parent = usersMap.get(parentId);
    if (!parent) break;

    const primaryId = resolvePrimaryUserId(parent);
    await tryMatchLevel(primaryId, 1, childIndex, usersMap, startUsers);

    currentId = parentId;
  }
}

/** Propaga pontos na árvore e tenta formar binário em cada nível. */
export async function onPackagePurchaseBinary(input: {
  buyerUserId: string;
  amount: number;
}): Promise<void> {
  const db = getDb();
  const buyerNode = await db.query.binaryTreeNodes.findFirst({
    where: eq(binaryTreeNodes.userId, input.buyerUserId),
  });
  if (!buyerNode?.side) return;

  const points = roundMoney(input.amount * POINTS_PER_REAL);
  if (points <= 0) return;

  await propagatePointsUpTree(input.buyerUserId, points);
  await settleBinaryMatchesForPurchase(input.buyerUserId);
}

/** Recalcula pontos a partir de todas as compras (sem liquidar bónus). */
export async function rebuildBinaryPointsFromHistory(): Promise<{ purchases: number; pointsRows: number }> {
  const db = getDb();
  await db.delete(binaryLegPoints);

  const purchases = await db.query.userPackages.findMany({
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  for (const purchase of purchases) {
    const points = roundMoney(purchase.amount * POINTS_PER_REAL);
    if (points > 0) {
      await propagatePointsUpTree(purchase.userId, points);
    }
  }

  const rows = await db.query.binaryLegPoints.findMany();
  return { purchases: purchases.length, pointsRows: rows.length };
}

/** Tenta liquidar binários pendentes para todos os utilizadores com pontos. */
export async function settleAllPendingBinaryMatches(): Promise<{ levelsProcessed: number }> {
  const db = getDb();
  const [nodes, usersMap, startUsers, pointRows] = await Promise.all([
    db.query.binaryTreeNodes.findMany(),
    loadUsersMap(),
    loadStartUsers(),
    db.query.binaryLegPoints.findMany(),
  ]);
  const childIndex = buildChildIndex(nodes);

  const userLevels = new Map<string, Set<number>>();
  for (const row of pointRows) {
    const set = userLevels.get(row.userId) ?? new Set();
    set.add(row.level);
    userLevels.set(row.userId, set);
  }

  let levelsProcessed = 0;
  for (const [userId] of userLevels) {
    await tryMatchLevel(userId, 1, childIndex, usersMap, startUsers);
    levelsProcessed++;
  }

  return { levelsProcessed };
}

export type BinaryLevelPoints = {
  level: number;
  left: { total: number; matched: number; available: number };
  right: { total: number; matched: number; available: number };
  qualified: boolean;
  canMatch: boolean;
  potentialPayout: number;
};

export type BinaryPointsDashboard = {
  globallyActive: boolean;
  payoutPercent: number;
  pointsPerReal: number;
  /** Pontos disponíveis para match (qualificado + mensalidade activa). */
  availableLeft: number;
  availableRight: number;
  /** Pontos visíveis mas aguardando qualificação binária. */
  pendingLeft: number;
  pendingRight: number;
  potentialPayout: number;
  levels: BinaryLevelPoints[];
  profitCap: {
    invested: number;
    cap: number;
    earned: number;
    remaining: number;
  };
};

export async function buildBinaryPointsDashboard(
  userId: string,
): Promise<BinaryPointsDashboard> {
  const db = getDb();
  const { getProfitCapStatus } = await import("@/lib/server/finance/profit-cap");

  const [user, nodes, usersMap, startUsers] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.binaryTreeNodes.findMany(),
    loadUsersMap(),
    loadStartUsers(),
  ]);

  const primaryId = user ? resolvePrimaryUserId(user) : userId;
  const childIndex = buildChildIndex(nodes);
  const globallyActive = isBinaryGloballyActive(primaryId, childIndex, usersMap, startUsers);

  const [rows, profitCap] = await Promise.all([
    db.query.binaryLegPoints.findMany({ where: eq(binaryLegPoints.userId, primaryId) }),
    getProfitCapStatus(primaryId),
  ]);

  const byLevel = new Map<number, BinaryLevelPoints>();
  byLevel.set(1, {
    level: 1,
    left: { total: 0, matched: 0, available: 0 },
    right: { total: 0, matched: 0, available: 0 },
    qualified: globallyActive,
    canMatch: false,
    potentialPayout: 0,
  });

  for (const row of rows) {
    if (row.level !== 1) continue;
    const entry = byLevel.get(1)!;
    const side = row.side as Side;
    const bucket = side === "left" ? entry.left : entry.right;
    bucket.total = row.totalPoints;
    bucket.matched = row.matchedPoints;
    bucket.available = row.totalPoints - row.matchedPoints;
  }

  const level1 = byLevel.get(1)!;
  const matchable = Math.min(level1.left.available, level1.right.available);
  level1.canMatch = globallyActive && matchable > 0;
  level1.potentialPayout = roundMoney((matchable * BINARY_MATCH_PAYOUT_PERCENT) / 100);

  const pendingLeft = globallyActive ? 0 : level1.left.available;
  const pendingRight = globallyActive ? 0 : level1.right.available;
  const availableLeft = globallyActive ? level1.left.available : 0;
  const availableRight = globallyActive ? level1.right.available : 0;

  return {
    globallyActive,
    payoutPercent: BINARY_MATCH_PAYOUT_PERCENT,
    pointsPerReal: POINTS_PER_REAL,
    availableLeft,
    availableRight,
    pendingLeft,
    pendingRight,
    potentialPayout: level1.potentialPayout,
    levels: [level1],
    profitCap,
  };
}
