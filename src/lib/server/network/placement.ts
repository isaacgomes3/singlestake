import { getDb } from "@/lib/server/db/client";
import { binaryTreeNodes } from "@/lib/server/db/schema";

type ChildMap = Map<string, { left?: string; right?: string }>;
type LegSide = "left" | "right";

function buildChildMap(nodes: (typeof binaryTreeNodes.$inferSelect)[]): ChildMap {
  const children: ChildMap = new Map();
  for (const node of nodes) {
    if (!node.parentId || !node.side) continue;
    const entry = children.get(node.parentId) ?? {};
    if (node.side === "left") entry.left = node.userId;
    else entry.right = node.userId;
    children.set(node.parentId, entry);
  }
  return children;
}

/**
 * Primeira posição livre na perna escolhida (nível 1 directo ou spillover abaixo).
 * Usado para indicados directos quando L1 já tem qualificador.
 */
export function findLegSpilloverPlacement(
  rootUserId: string,
  legSide: LegSide,
  nodes: (typeof binaryTreeNodes.$inferSelect)[],
): { parentId: string; side: LegSide } | null {
  const children = buildChildMap(nodes);
  const rootSlot = children.get(rootUserId) ?? {};

  if (!rootSlot[legSide]) {
    return { parentId: rootUserId, side: legSide };
  }

  const queue = [rootSlot[legSide]!];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const slot = children.get(current) ?? {};
    if (!slot.left) return { parentId: current, side: "left" };
    if (!slot.right) return { parentId: current, side: "right" };
    queue.push(slot.left, slot.right);
  }

  return null;
}

export function legSpilloverSlotAvailable(
  rootUserId: string,
  legSide: LegSide,
  nodes: (typeof binaryTreeNodes.$inferSelect)[],
): boolean {
  return findLegSpilloverPlacement(rootUserId, legSide, nodes) != null;
}

/** Primeira posição livre (esquerda, depois direita) em BFS a partir do patrocinador. */
export async function findBinaryPlacement(
  sponsorUserId: string,
): Promise<{ parentId: string; side: "left" | "right" }> {
  const db = getDb();
  const nodes = await db.query.binaryTreeNodes.findMany();
  const children = buildChildMap(nodes);

  const queue = [sponsorUserId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const slot = children.get(current) ?? {};
    if (!slot.left) return { parentId: current, side: "left" };
    if (!slot.right) return { parentId: current, side: "right" };
    queue.push(slot.left, slot.right);
  }

  return { parentId: sponsorUserId, side: "left" };
}

/**
 * Posição livre na perna indicada ao nível N (1 = filho directo do root nessa perna).
 * Usado para sub-contas de qualificação binária.
 */
export function findLegPlacementAtLevel(
  rootUserId: string,
  legSide: LegSide,
  targetLevel: number,
  nodes: (typeof binaryTreeNodes.$inferSelect)[],
): { parentId: string; side: LegSide } | null {
  if (targetLevel < 1) return null;

  const children = buildChildMap(nodes);

  if (targetLevel === 1) {
    const slot = children.get(rootUserId) ?? {};
    if (legSide === "left" && !slot.left) return { parentId: rootUserId, side: "left" };
    if (legSide === "right" && !slot.right) return { parentId: rootUserId, side: "right" };
    return null;
  }

  const direct = children.get(rootUserId)?.[legSide];
  if (!direct) return null;

  const queue: { userId: string; depth: number }[] = [{ userId: direct, depth: 1 }];
  while (queue.length > 0) {
    const { userId, depth } = queue.shift()!;
    if (depth === targetLevel - 1) {
      const slot = children.get(userId) ?? {};
      if (!slot.left) return { parentId: userId, side: "left" };
      if (!slot.right) return { parentId: userId, side: "right" };
    }
    if (depth < targetLevel - 1) {
      const slot = children.get(userId) ?? {};
      if (slot.left) queue.push({ userId: slot.left, depth: depth + 1 });
      if (slot.right) queue.push({ userId: slot.right, depth: depth + 1 });
    }
  }

  return null;
}

/** Nível e perna de um nó relativamente ao root da árvore binária. */
export function getBinaryPositionRelativeTo(
  rootUserId: string,
  nodeUserId: string,
  nodes: (typeof binaryTreeNodes.$inferSelect)[],
): { level: number; legSide: LegSide } | null {
  const byUser = new Map(nodes.map((n) => [n.userId, n]));
  let current = byUser.get(nodeUserId);
  if (!current) return null;

  const path: { userId: string; side: LegSide | null }[] = [];
  while (current) {
    path.unshift({ userId: current.userId, side: current.side as LegSide | null });
    if (!current.parentId) break;
    current = byUser.get(current.parentId);
  }

  const rootIdx = path.findIndex((p) => p.userId === rootUserId);
  if (rootIdx < 0) return null;

  const tail = path.slice(rootIdx + 1);
  if (tail.length === 0) return null;

  const legSide = tail[0]?.side;
  if (!legSide) return null;

  return { level: tail.length, legSide };
}
