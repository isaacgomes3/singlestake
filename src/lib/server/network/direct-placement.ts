import { and, eq } from "drizzle-orm";

import { BINARY_START_PACKAGE_ID } from "@/lib/back-office/binary-constants";
import type { PendingDirectPlacement, BinaryDirectPlacement } from "@/lib/back-office/network-types";
import { getDb } from "@/lib/server/db/client";
import { binaryTreeNodes, userPackages, users } from "@/lib/server/db/schema";
import { onPackagePurchaseBinary } from "@/lib/server/network/binary-engine";
import {
  findLegSpilloverPlacement,
  legSpilloverSlotAvailable,
} from "@/lib/server/network/placement";

export type BinarySide = "left" | "right";

function formatDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Indicado directo aguarda escolha de perna — não entra na árvore até o patrocinador decidir. */
export function isBinaryPlacementPending(
  node: Pick<typeof binaryTreeNodes.$inferSelect, "parentId" | "side"> | null | undefined,
): boolean {
  return node != null && node.parentId != null && node.side == null;
}

export async function listPendingDirectPlacements(
  sponsorId: string,
): Promise<PendingDirectPlacement[]> {
  const db = getDb();
  const [directs, nodes, startRows] = await Promise.all([
    db.query.users.findMany({ where: eq(users.sponsorId, sponsorId) }),
    db.query.binaryTreeNodes.findMany(),
    db
      .select({ userId: userPackages.userId })
      .from(userPackages)
      .where(
        and(
          eq(userPackages.packageId, BINARY_START_PACKAGE_ID),
          eq(userPackages.status, "active"),
        ),
      ),
  ]);

  const startUsers = new Set(startRows.map((r) => r.userId));
  const nodeByUser = new Map(nodes.map((n) => [n.userId, n]));

  return directs
    .filter((u) => !u.masterUserId)
    .map((u) => {
      const node = nodeByUser.get(u.id);
      const pending = isBinaryPlacementPending(node);
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        joinedAt: formatDate(u.createdAt),
        hasActiveStart: startUsers.has(u.id),
        pending,
        leftSlotAvailable: legSpilloverSlotAvailable(sponsorId, "left", nodes),
        rightSlotAvailable: legSpilloverSlotAvailable(sponsorId, "right", nodes),
      };
    })
    .filter((row) => row.pending)
    .sort((a, b) => {
      if (a.hasActiveStart !== b.hasActiveStart) return a.hasActiveStart ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

export async function listMyDirectPlacements(sponsorId: string): Promise<BinaryDirectPlacement[]> {
  const db = getDb();
  const [directs, nodes, startRows] = await Promise.all([
    db.query.users.findMany({ where: eq(users.sponsorId, sponsorId) }),
    db.query.binaryTreeNodes.findMany(),
    db
      .select({ userId: userPackages.userId })
      .from(userPackages)
      .where(
        and(
          eq(userPackages.packageId, BINARY_START_PACKAGE_ID),
          eq(userPackages.status, "active"),
        ),
      ),
  ]);

  const startUsers = new Set(startRows.map((r) => r.userId));
  const nodeByUser = new Map(nodes.map((n) => [n.userId, n]));

  return directs
    .filter((u) => !u.masterUserId)
    .map((u) => {
      const node = nodeByUser.get(u.id);
      const placementPending = isBinaryPlacementPending(node);
      const side =
        node?.side === "left" || node?.side === "right" ? node.side : null;
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        joinedAt: formatDate(u.createdAt),
        hasActiveStart: startUsers.has(u.id),
        placementPending,
        side,
        placedAt: node?.side && node.placedAt ? formatDate(node.placedAt) : null,
      };
    })
    .sort((a, b) => {
      if (a.placementPending !== b.placementPending) return a.placementPending ? -1 : 1;
      if (a.hasActiveStart !== b.hasActiveStart) return a.hasActiveStart ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

export async function confirmDirectBinaryPlacement(input: {
  sponsorId: string;
  directUserId: string;
  side: BinarySide;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();

  const direct = await db.query.users.findFirst({ where: eq(users.id, input.directUserId) });
  if (!direct || direct.sponsorId !== input.sponsorId) {
    return { ok: false, error: "Indicado directo não encontrado." };
  }
  if (direct.masterUserId) {
    return { ok: false, error: "Sub-contas são posicionadas automaticamente." };
  }

  const node = await db.query.binaryTreeNodes.findFirst({
    where: eq(binaryTreeNodes.userId, input.directUserId),
  });
  if (!node || node.parentId !== input.sponsorId) {
    return { ok: false, error: "Posicionamento binário inválido." };
  }
  if (node.side != null) {
    return { ok: false, error: "Este indicado já foi posicionado na árvore." };
  }

  const hasStart = await db.query.userPackages.findFirst({
    where: and(
      eq(userPackages.userId, input.directUserId),
      eq(userPackages.packageId, BINARY_START_PACKAGE_ID),
      eq(userPackages.status, "active"),
    ),
  });
  if (!hasStart) {
    return {
      ok: false,
      error: "O indicado precisa do Pacote Start activo antes de escolher a perna.",
    };
  }

  const nodes = await db.query.binaryTreeNodes.findMany();
  const target = findLegSpilloverPlacement(input.sponsorId, input.side, nodes);
  if (!target) {
    return {
      ok: false,
      error: `Sem posição livre na perna ${input.side === "left" ? "esquerda" : "direita"}.`,
    };
  }

  const slotTaken = nodes.some(
    (n) => n.parentId === target.parentId && n.side === target.side && n.userId !== input.directUserId,
  );
  if (slotTaken) {
    return { ok: false, error: "Posição já ocupada. Actualize e tente novamente." };
  }

  const now = new Date();
  await db
    .update(binaryTreeNodes)
    .set({
      parentId: target.parentId,
      side: target.side,
      placedAt: now,
    })
    .where(eq(binaryTreeNodes.userId, input.directUserId));

  await replayBinaryPointsForUser(input.directUserId);

  await db
    .update(binaryTreeNodes)
    .set({ nextDirectSide: input.side })
    .where(eq(binaryTreeNodes.userId, input.sponsorId));

  return { ok: true };
}

export function resolveNextDirectSide(input: {
  stored: BinarySide | null | undefined;
  leftVolume: number;
  rightVolume: number;
}): BinarySide {
  if (input.stored === "left" || input.stored === "right") return input.stored;
  return input.leftVolume <= input.rightVolume ? "left" : "right";
}

export async function setNextDirectBinarySide(input: {
  userId: string;
  side: BinarySide;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();

  await db
    .update(binaryTreeNodes)
    .set({ nextDirectSide: input.side })
    .where(eq(binaryTreeNodes.userId, input.userId));

  return { ok: true };
}

/** Posiciona indicado pendente na perna preferida do patrocinador (spillover). */
export async function tryAutoPlaceDirectAfterStartActivation(
  directUserId: string,
): Promise<{ placed: boolean; side?: BinarySide; error?: string }> {
  const db = getDb();
  const direct = await db.query.users.findFirst({ where: eq(users.id, directUserId) });
  if (!direct?.sponsorId || direct.masterUserId) return { placed: false };

  const node = await db.query.binaryTreeNodes.findFirst({
    where: eq(binaryTreeNodes.userId, directUserId),
  });
  if (!isBinaryPlacementPending(node) || node!.parentId !== direct.sponsorId) {
    return { placed: false };
  }

  const hasStart = await db.query.userPackages.findFirst({
    where: and(
      eq(userPackages.userId, directUserId),
      eq(userPackages.packageId, BINARY_START_PACKAGE_ID),
      eq(userPackages.status, "active"),
    ),
  });
  if (!hasStart) return { placed: false };

  const side = await resolveSponsorPreferredPlacementSide(direct.sponsorId);
  const result = await confirmDirectBinaryPlacement({
    sponsorId: direct.sponsorId,
    directUserId,
    side,
  });
  if (!result.ok) return { placed: false, error: result.error };
  return { placed: true, side };
}

async function resolveSponsorPreferredPlacementSide(sponsorId: string): Promise<BinarySide> {
  const db = getDb();
  const [sponsorNode, nodes, activePackages] = await Promise.all([
    db.query.binaryTreeNodes.findFirst({ where: eq(binaryTreeNodes.userId, sponsorId) }),
    db.query.binaryTreeNodes.findMany(),
    db
      .select({ userId: userPackages.userId, amount: userPackages.amount })
      .from(userPackages)
      .where(eq(userPackages.status, "active")),
  ]);

  if (sponsorNode?.nextDirectSide === "left" || sponsorNode?.nextDirectSide === "right") {
    return sponsorNode.nextDirectSide;
  }

  const childIndex = new Map<string, { left?: string; right?: string }>();
  for (const node of nodes) {
    if (!node.parentId || !node.side) continue;
    const entry = childIndex.get(node.parentId) ?? {};
    if (node.side === "left") entry.left = node.userId;
    else entry.right = node.userId;
    childIndex.set(node.parentId, entry);
  }

  const packageByUser = new Map<string, number>();
  for (const row of activePackages) {
    packageByUser.set(row.userId, (packageByUser.get(row.userId) ?? 0) + row.amount);
  }

  const sumLeg = (startUserId: string | undefined): number => {
    if (!startUserId) return 0;
    const queue = [startUserId];
    const ids: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      ids.push(current);
      const children = childIndex.get(current);
      if (children?.left) queue.push(children.left);
      if (children?.right) queue.push(children.right);
    }
    return ids.reduce((sum, id) => sum + (packageByUser.get(id) ?? 0), 0);
  };

  const myChildren = childIndex.get(sponsorId) ?? {};
  return resolveNextDirectSide({
    stored: null,
    leftVolume: sumLeg(myChildren.left),
    rightVolume: sumLeg(myChildren.right),
  });
}

/**
 * Posiciona na árvore todos os indicados pendentes com Start activo,
 * usando a perna guardada em «Próxima indicação».
 */
export async function autoPlacePendingDirectsWithPreferredSide(
  sponsorId: string,
): Promise<number> {
  const db = getDb();
  const sponsorNode = await db.query.binaryTreeNodes.findFirst({
    where: eq(binaryTreeNodes.userId, sponsorId),
  });
  if (!sponsorNode?.nextDirectSide) return 0;

  const side = sponsorNode.nextDirectSide as BinarySide;
  const pending = await listPendingDirectPlacements(sponsorId);
  const ready = pending.filter((row) => row.hasActiveStart);
  let placed = 0;

  for (const row of ready) {
    const result = await confirmDirectBinaryPlacement({
      sponsorId,
      directUserId: row.userId,
      side,
    });
    if (result.ok) placed++;
    else break;
  }

  return placed;
}

/** Compras efectuadas enquanto aguardava perna — pontua após confirmação. */
async function replayBinaryPointsForUser(userId: string): Promise<void> {
  const db = getDb();
  const purchases = await db.query.userPackages.findMany({
    where: and(eq(userPackages.userId, userId), eq(userPackages.status, "active")),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  for (const purchase of purchases) {
    await onPackagePurchaseBinary({ buyerUserId: userId, amount: purchase.amount });
  }
}
