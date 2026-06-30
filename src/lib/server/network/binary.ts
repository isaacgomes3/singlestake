import { and, eq } from "drizzle-orm";

import { BINARY_MAX_LEVELS, BINARY_START_PACKAGE_ID } from "@/lib/back-office/binary-constants";
import type {
  BinaryNetworkData,
  BinaryTreeNodeDetails,
  BinaryTreeNodeView,
} from "@/lib/back-office/network-types";
import { getDb } from "@/lib/server/db/client";
import { binaryTreeNodes, userPackages, users } from "@/lib/server/db/schema";
import { isBinaryGloballyActive, resolvePrimaryUserId } from "@/lib/server/network/binary-engine";
import {
  isBinaryPlacementPending,
  listPendingDirectPlacements,
  listMyDirectPlacements,
  resolveNextDirectSide,
  autoPlacePendingDirectsWithPreferredSide,
} from "@/lib/server/network/direct-placement";
import type { BinarySide } from "@/lib/server/network/direct-placement";
import { ensureBinaryLegExtremity } from "@/lib/server/network/binary-extremity-repair";
import { legSpilloverSlotAvailable } from "@/lib/server/network/placement";

type NodeRow = typeof binaryTreeNodes.$inferSelect;

/** Níveis iniciais na genealogia; clique expande mais níveis abaixo. */
export const BINARY_TREE_INITIAL_DEPTH = 3;
export const BINARY_TREE_EXPAND_DEPTH = 3;

type UserRow = { id: string; name: string; email: string; createdAt: Date };

function normalizeBinarySide(value: string | null | undefined): BinarySide | null {
  if (value === "left" || value === "right") return value;
  return null;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildChildIndex(nodes: NodeRow[]): Map<string, { left?: string; right?: string }> {
  const index = new Map<string, { left?: string; right?: string }>();
  for (const node of nodes) {
    if (!node.parentId || !node.side) continue;
    const entry = index.get(node.parentId) ?? {};
    if (node.side === "left") entry.left = node.userId;
    else entry.right = node.userId;
    index.set(node.parentId, entry);
  }
  return index;
}

function hasDescendantsInDb(
  userId: string,
  childIndex: Map<string, { left?: string; right?: string }>,
): boolean {
  const children = childIndex.get(userId);
  return Boolean(children?.left || children?.right);
}

function collectLegUserIds(
  startUserId: string | undefined,
  childIndex: Map<string, { left?: string; right?: string }>,
): string[] {
  if (!startUserId) return [];
  const ids: string[] = [];
  const queue = [startUserId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ids.push(current);
    const children = childIndex.get(current);
    if (children?.left) queue.push(children.left);
    if (children?.right) queue.push(children.right);
  }
  return ids;
}

function buildNodeDetails(
  userId: string,
  usersById: Map<string, UserRow>,
  packageByUser: Map<string, number>,
  startUsers: Set<string>,
): BinaryTreeNodeDetails | undefined {
  const user = usersById.get(userId);
  if (!user) return undefined;
  return {
    email: user.email,
    joinedAt: formatDate(user.createdAt),
    hasActiveStart: startUsers.has(userId),
    packageAmount: packageByUser.get(userId) ?? 0,
  };
}

function buildTreeNode(
  userId: string | null,
  side: BinarySide | null,
  names: Map<string, string>,
  usersById: Map<string, UserRow>,
  packageByUser: Map<string, number>,
  startUsers: Set<string>,
  childIndex: Map<string, { left?: string; right?: string }>,
  depth: number,
  maxDepth: number,
): BinaryTreeNodeView {
  const isEmpty = !userId;
  const childrenInDb = userId ? (childIndex.get(userId) ?? {}) : {};
  const atMaxDepth = depth >= maxDepth;
  const canExpand = Boolean(userId && atMaxDepth && hasDescendantsInDb(userId, childIndex));

  const node: BinaryTreeNodeView = {
    userId,
    name: userId ? (names.get(userId) ?? "—") : "",
    side,
    level: depth,
    isEmpty,
    canExpand,
    children: [],
    details: userId ? buildNodeDetails(userId, usersById, packageByUser, startUsers) : undefined,
  };

  if (isEmpty || atMaxDepth) return node;

  for (const childSide of ["left", "right"] as const) {
    const childId = childrenInDb[childSide];
    node.children.push(
      buildTreeNode(
        childId ?? null,
        childSide,
        names,
        usersById,
        packageByUser,
        startUsers,
        childIndex,
        depth + 1,
        maxDepth,
      ),
    );
  }

  return node;
}

export function isBinaryTreeDescendant(
  ancestorId: string,
  targetId: string,
  nodes: NodeRow[],
): boolean {
  if (ancestorId === targetId) return true;
  const parentByUser = new Map(nodes.map((n) => [n.userId, n.parentId]));
  let current: string | null | undefined = targetId;
  while (current) {
    if (current === ancestorId) return true;
    current = parentByUser.get(current) ?? null;
  }
  return false;
}

export async function buildBinarySubtree(input: {
  viewerId: string;
  rootUserId: string;
  maxDepth?: number;
}): Promise<BinaryTreeNodeView | null> {
  const db = getDb();
  const maxDepth = Math.min(input.maxDepth ?? BINARY_TREE_EXPAND_DEPTH, BINARY_MAX_LEVELS);

  const [nodes, allUsers, activePackages, startRows] = await Promise.all([
    db.query.binaryTreeNodes.findMany(),
    db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt }).from(users),
    db
      .select({ userId: userPackages.userId, amount: userPackages.amount })
      .from(userPackages)
      .where(eq(userPackages.status, "active")),
    db
      .select({ userId: userPackages.userId })
      .from(userPackages)
      .where(
        and(eq(userPackages.packageId, BINARY_START_PACKAGE_ID), eq(userPackages.status, "active")),
      ),
  ]);

  if (!isBinaryTreeDescendant(input.viewerId, input.rootUserId, nodes)) {
    return null;
  }

  const names = new Map(allUsers.map((u) => [u.id, u.name]));
  const usersById = new Map(allUsers.map((u) => [u.id, u]));
  const packageByUser = new Map<string, number>();
  for (const row of activePackages) {
    packageByUser.set(row.userId, (packageByUser.get(row.userId) ?? 0) + row.amount);
  }
  const startUsers = new Set(startRows.map((r) => r.userId));
  const childIndex = buildChildIndex(nodes);

  return buildTreeNode(
    input.rootUserId,
    null,
    names,
    usersById,
    packageByUser,
    startUsers,
    childIndex,
    0,
    maxDepth,
  );
}

export async function buildBinaryNetworkData(
  userId: string,
  rootName: string,
): Promise<BinaryNetworkData> {
  await autoPlacePendingDirectsWithPreferredSide(userId);
  await ensureBinaryLegExtremity(userId);

  const db = getDb();

  const [nodes, allUsers, activePackages, myNode, startRows] = await Promise.all([
    db.query.binaryTreeNodes.findMany(),
    db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt }).from(users),
    db
      .select({ userId: userPackages.userId, amount: userPackages.amount })
      .from(userPackages)
      .where(eq(userPackages.status, "active")),
    db.query.binaryTreeNodes.findFirst({ where: eq(binaryTreeNodes.userId, userId) }),
    db
      .select({ userId: userPackages.userId })
      .from(userPackages)
      .where(
        and(eq(userPackages.packageId, BINARY_START_PACKAGE_ID), eq(userPackages.status, "active")),
      ),
  ]);

  const names = new Map(allUsers.map((u) => [u.id, u.name]));
  names.set(userId, rootName);
  const usersById = new Map(allUsers.map((u) => [u.id, u]));

  const packageByUser = new Map<string, number>();
  for (const row of activePackages) {
    packageByUser.set(row.userId, (packageByUser.get(row.userId) ?? 0) + row.amount);
  }
  const startUsers = new Set(startRows.map((r) => r.userId));

  const childIndex = buildChildIndex(nodes);
  const myChildren = childIndex.get(userId) ?? {};

  const leftIds = collectLegUserIds(myChildren.left, childIndex);
  const rightIds = collectLegUserIds(myChildren.right, childIndex);

  const sumVolume = (ids: string[]) =>
    ids.reduce((sum, id) => sum + (packageByUser.get(id) ?? 0), 0);

  const leftVolume = sumVolume(leftIds);
  const rightVolume = sumVolume(rightIds);
  const weakerVolume = Math.min(leftVolume, rightVolume);

  let parentName: string | null = null;
  if (myNode?.parentId) {
    parentName = names.get(myNode.parentId) ?? null;
  }

  const userRow = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const primaryId = userRow ? resolvePrimaryUserId(userRow) : userId;
  const allUsersRows = await db.query.users.findMany();
  const usersMap = new Map(allUsersRows.map((u) => [u.id, u]));
  const binaryQualified = isBinaryGloballyActive(primaryId, childIndex, usersMap, startUsers);

  const pendingDirects = await listPendingDirectPlacements(userId);
  const myDirects = await listMyDirectPlacements(userId);
  const leftAvailable = legSpilloverSlotAvailable(userId, "left", nodes);
  const rightAvailable = legSpilloverSlotAvailable(userId, "right", nodes);
  const selectedNextSide = resolveNextDirectSide({
    stored: myNode?.nextDirectSide ?? null,
    leftVolume,
    rightVolume,
  });

  return {
    root: buildTreeNode(
      userId,
      null,
      names,
      usersById,
      packageByUser,
      startUsers,
      childIndex,
      0,
      BINARY_TREE_INITIAL_DEPTH,
    ),
    legs: {
      left: { count: leftIds.length, volume: leftVolume },
      right: { count: rightIds.length, volume: rightVolume },
      weakerVolume,
    },
    placement: {
      parentName,
      side: normalizeBinarySide(myNode?.side),
      placedAt: myNode ? formatDate(myNode.placedAt) : null,
      pending: isBinaryPlacementPending(myNode),
    },
    nextDirectSide: {
      stored: normalizeBinarySide(myNode?.nextDirectSide),
      selected: selectedNextSide,
      leftAvailable,
      rightAvailable,
    },
    pendingDirects,
    myDirects,
    binaryQualified,
  };
}
