import { eq } from "drizzle-orm";

import type { BinaryNetworkData, BinaryTreeNodeView } from "@/lib/back-office/network-types";
import { getDb } from "@/lib/server/db/client";
import { binaryTreeNodes, userPackages, users } from "@/lib/server/db/schema";

type NodeRow = typeof binaryTreeNodes.$inferSelect;

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

function buildTreeNode(
  userId: string,
  names: Map<string, string>,
  childIndex: Map<string, { left?: string; right?: string }>,
  depth: number,
  maxDepth: number,
): BinaryTreeNodeView {
  const children = childIndex.get(userId) ?? {};
  const node: BinaryTreeNodeView = {
    userId,
    name: names.get(userId) ?? "—",
    side: null,
    children: [],
  };

  if (depth >= maxDepth) return node;

  for (const side of ["left", "right"] as const) {
    const childId = children[side];
    if (!childId) continue;
    const child = buildTreeNode(childId, names, childIndex, depth + 1, maxDepth);
    child.side = side;
    node.children.push(child);
  }

  return node;
}

export async function buildBinaryNetworkData(
  userId: string,
  rootName: string,
): Promise<BinaryNetworkData> {
  const db = getDb();

  const [nodes, allUsers, activePackages, myNode] = await Promise.all([
    db.query.binaryTreeNodes.findMany(),
    db.select({ id: users.id, name: users.name }).from(users),
    db
      .select({ userId: userPackages.userId, amount: userPackages.amount })
      .from(userPackages)
      .where(eq(userPackages.status, "active")),
    db.query.binaryTreeNodes.findFirst({ where: eq(binaryTreeNodes.userId, userId) }),
  ]);

  const names = new Map(allUsers.map((u) => [u.id, u.name]));
  names.set(userId, rootName);

  const packageByUser = new Map<string, number>();
  for (const row of activePackages) {
    packageByUser.set(row.userId, (packageByUser.get(row.userId) ?? 0) + row.amount);
  }

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

  return {
    root: buildTreeNode(userId, names, childIndex, 0, 3),
    legs: {
      left: { count: leftIds.length, volume: leftVolume },
      right: { count: rightIds.length, volume: rightVolume },
      weakerVolume,
    },
    placement: {
      parentName,
      side: myNode?.side ?? null,
      placedAt: myNode ? formatDate(myNode.placedAt) : null,
    },
  };
}
