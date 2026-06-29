import { getDb } from "@/lib/server/db/client";
import { binaryTreeNodes } from "@/lib/server/db/schema";

type ChildMap = Map<string, { left?: string; right?: string }>;
type LegSide = "left" | "right";
type NodeRow = typeof binaryTreeNodes.$inferSelect;

function buildChildMap(nodes: NodeRow[]): ChildMap {
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

function isNodeExcluded(userId: string, exclude: ReadonlySet<string> | undefined): boolean {
  return exclude?.has(userId) ?? false;
}

function legChildOccupied(
  parentId: string,
  side: LegSide,
  children: ChildMap,
  exclude: ReadonlySet<string> | undefined,
): string | undefined {
  const occupant = children.get(parentId)?.[side];
  if (!occupant || isNodeExcluded(occupant, exclude)) return undefined;
  return occupant;
}

/**
 * Spillover na extremidade da perna:
 * - esquerda: desce sempre pelo filho esquerdo (L1 → L2 esq → L3 esq …)
 * - direita: desce sempre pelo filho direito
 * Indicados directos não ocupam posições internas (filho oposto no meio da perna).
 */
export function findLegSpilloverPlacement(
  rootUserId: string,
  legSide: LegSide,
  nodes: NodeRow[],
  excludeUserIds?: ReadonlySet<string>,
): { parentId: string; side: LegSide } | null {
  const children = buildChildMap(nodes);

  if (!legChildOccupied(rootUserId, legSide, children, excludeUserIds)) {
    return { parentId: rootUserId, side: legSide };
  }

  let current = legChildOccupied(rootUserId, legSide, children, excludeUserIds)!;
  const visited = new Set<string>([rootUserId]);
  while (true) {
    if (visited.has(current)) return null;
    visited.add(current);
    if (!legChildOccupied(current, legSide, children, excludeUserIds)) {
      return { parentId: current, side: legSide };
    }
    current = legChildOccupied(current, legSide, children, excludeUserIds)!;
  }
}

export function legSpilloverSlotAvailable(
  rootUserId: string,
  legSide: LegSide,
  nodes: NodeRow[],
): boolean {
  return findLegSpilloverPlacement(rootUserId, legSide, nodes) != null;
}

/** Indicado está na extremidade da perna (não em posição interna). */
export function isOnLegExtremity(
  sponsorId: string,
  userId: string,
  nodes: NodeRow[],
): boolean {
  const byUser = new Map(nodes.map((n) => [n.userId, n]));
  const node = byUser.get(userId);
  if (!node?.side || !node.parentId) return true;

  const pos = getBinaryPositionRelativeTo(sponsorId, userId, nodes);
  if (!pos) return false;
  const { legSide } = pos;

  if (node.side !== legSide) return false;
  if (node.parentId === sponsorId) return true;

  const children = buildChildMap(nodes);
  let current: string | undefined = userId;
  const visited = new Set<string>();

  while (current && current !== sponsorId) {
    if (visited.has(current)) return false;
    visited.add(current);

    const currentNode = byUser.get(current);
    if (!currentNode?.side || currentNode.side !== legSide) return false;

    const parentId = currentNode.parentId;
    if (!parentId) return false;
    if (parentId === sponsorId) return true;
    if (children.get(parentId)?.[legSide] !== current) return false;

    current = parentId;
  }

  return false;
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
 * Posição na perna ao nível N (1 = filho directo do root nessa perna).
 * Níveis 2+ empilham na extremidade da perna (não preenchem filho interno oposto).
 * Se o nível nominal estiver ocupado, desce pelo spillover na mesma perna.
 */
export function findLegPlacementAtLevel(
  rootUserId: string,
  legSide: LegSide,
  targetLevel: number,
  nodes: NodeRow[],
  excludeUserIds?: ReadonlySet<string>,
): { parentId: string; side: LegSide } | null {
  if (targetLevel < 1) return null;

  const children = buildChildMap(nodes);

  if (targetLevel === 1) {
    if (!legChildOccupied(rootUserId, legSide, children, excludeUserIds)) {
      return { parentId: rootUserId, side: legSide };
    }
    return null;
  }

  let current = legChildOccupied(rootUserId, legSide, children, excludeUserIds);
  if (!current) return null;

  for (let depth = 1; depth < targetLevel - 1; depth++) {
    const next = legChildOccupied(current, legSide, children, excludeUserIds);
    if (!next) {
      if (!legChildOccupied(current, legSide, children, excludeUserIds)) {
        return { parentId: current, side: legSide };
      }
      return findLegSpilloverPlacement(rootUserId, legSide, nodes, excludeUserIds);
    }
    current = next;
  }

  if (!legChildOccupied(current, legSide, children, excludeUserIds)) {
    return { parentId: current, side: legSide };
  }

  return findLegSpilloverPlacement(rootUserId, legSide, nodes, excludeUserIds);
}

/** Nível e perna de um nó relativamente ao root da árvore binária. */
export function getBinaryPositionRelativeTo(
  rootUserId: string,
  nodeUserId: string,
  nodes: NodeRow[],
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

/** IDs do utilizador e de toda a sub-árvore abaixo. */
export function collectSubtreeUserIds(
  rootUserId: string,
  nodes: NodeRow[],
): Set<string> {
  const children = buildChildMap(nodes);
  const ids = new Set<string>();
  const queue = [rootUserId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ids.add(current);
    const slot = children.get(current);
    if (slot?.left) queue.push(slot.left);
    if (slot?.right) queue.push(slot.right);
  }
  return ids;
}
