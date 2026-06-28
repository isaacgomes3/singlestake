import { and, eq } from "drizzle-orm";

import { BINARY_START_PACKAGE_ID } from "@/lib/back-office/binary-constants";
import type { PendingDirectPlacement } from "@/lib/back-office/network-types";
import { getDb } from "@/lib/server/db/client";
import { binaryTreeNodes, userPackages, users } from "@/lib/server/db/schema";
import { onPackagePurchaseBinary } from "@/lib/server/network/binary-engine";

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

export function sponsorDirectSlotTaken(
  sponsorId: string,
  side: BinarySide,
  nodes: (typeof binaryTreeNodes.$inferSelect)[],
): boolean {
  return nodes.some((n) => n.parentId === sponsorId && n.side === side);
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
  const leftTaken = sponsorDirectSlotTaken(sponsorId, "left", nodes);
  const rightTaken = sponsorDirectSlotTaken(sponsorId, "right", nodes);

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
        leftSlotAvailable: !leftTaken,
        rightSlotAvailable: !rightTaken,
      };
    })
    .filter((row) => row.pending)
    .sort((a, b) => {
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
  if (sponsorDirectSlotTaken(input.sponsorId, input.side, nodes)) {
    return {
      ok: false,
      error: `A perna ${input.side === "left" ? "esquerda" : "direita"} já está ocupada.`,
    };
  }

  const now = new Date();
  await db
    .update(binaryTreeNodes)
    .set({ side: input.side, placedAt: now })
    .where(eq(binaryTreeNodes.userId, input.directUserId));

  await replayBinaryPointsForUser(input.directUserId);

  const otherSide: BinarySide = input.side === "left" ? "right" : "left";
  const otherWasFree = !sponsorDirectSlotTaken(input.sponsorId, otherSide, nodes);
  await db
    .update(binaryTreeNodes)
    .set({ nextDirectSide: otherWasFree ? otherSide : null })
    .where(eq(binaryTreeNodes.userId, input.sponsorId));

  return { ok: true };
}

export function resolveNextDirectSide(input: {
  stored: BinarySide | null | undefined;
  leftAvailable: boolean;
  rightAvailable: boolean;
  leftVolume: number;
  rightVolume: number;
}): BinarySide | null {
  if (input.stored === "left" && input.leftAvailable) return "left";
  if (input.stored === "right" && input.rightAvailable) return "right";
  if (input.leftAvailable && !input.rightAvailable) return "left";
  if (input.rightAvailable && !input.leftAvailable) return "right";
  if (input.leftAvailable && input.rightAvailable) {
    return input.leftVolume <= input.rightVolume ? "left" : "right";
  }
  return null;
}

export async function setNextDirectBinarySide(input: {
  userId: string;
  side: BinarySide;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const nodes = await db.query.binaryTreeNodes.findMany();
  const leftAvailable = !sponsorDirectSlotTaken(input.userId, "left", nodes);
  const rightAvailable = !sponsorDirectSlotTaken(input.userId, "right", nodes);

  if (input.side === "left" && !leftAvailable) {
    return { ok: false, error: "A perna esquerda já está ocupada." };
  }
  if (input.side === "right" && !rightAvailable) {
    return { ok: false, error: "A perna direita já está ocupada." };
  }

  await db
    .update(binaryTreeNodes)
    .set({ nextDirectSide: input.side })
    .where(eq(binaryTreeNodes.userId, input.userId));

  return { ok: true };
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
