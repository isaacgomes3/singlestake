import { eq } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { binaryTreeNodes, systemSettings, users } from "@/lib/server/db/schema";
import { onPackagePurchaseBinary } from "@/lib/server/network/binary-engine";
import {
  findLegSpilloverPlacement,
  getBinaryPositionRelativeTo,
  isOnLegExtremity,
} from "@/lib/server/network/placement";

type NodeRow = typeof binaryTreeNodes.$inferSelect;
type UserRow = typeof users.$inferSelect;
type LegSide = "left" | "right";

const ISAAC_SLOTS_KEY = "isaac_network_slots";

function inferQualificatorLegFromEmail(email: string): LegSide | null {
  const e = email.toLowerCase();
  if (/\.l\d+\.left\.|qual\.l\d+\.left/.test(e)) return "left";
  if (/\.l\d+\.right\.|qual\.l\d+\.right/.test(e)) return "right";
  return null;
}

async function loadQualificatorLegByUserId(): Promise<Map<string, LegSide>> {
  const map = new Map<string, LegSide>();
  const db = getDb();
  const row = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, ISAAC_SLOTS_KEY),
  });
  if (!row) return map;

  try {
    const parsed = JSON.parse(row.valueJson) as {
      slots?: Record<string, { userId?: string; leg?: LegSide }>;
    };
    for (const slot of Object.values(parsed.slots ?? {})) {
      if (slot.userId && (slot.leg === "left" || slot.leg === "right")) {
        map.set(slot.userId, slot.leg);
      }
    }
  } catch {
    /* ignorar */
  }
  return map;
}

function applyVirtualPlacement(
  nodes: NodeRow[],
  userId: string,
  parentId: string,
  side: LegSide,
  placedAt: Date,
): NodeRow[] {
  const idx = nodes.findIndex((n) => n.userId === userId);
  if (idx >= 0) {
    const next = [...nodes];
    next[idx] = { ...next[idx]!, parentId, side, placedAt };
    return next;
  }
  return [
    ...nodes,
    {
      userId,
      parentId,
      side,
      placedAt,
      nextDirectSide: null,
    },
  ];
}

function resolveIntendedLeg(
  user: UserRow,
  sponsorId: string,
  nodes: NodeRow[],
  qualLegByUserId: Map<string, LegSide>,
): LegSide | null {
  const isQual = user.masterUserId === sponsorId;
  const isDirect = user.sponsorId === sponsorId && !user.masterUserId;
  if (!isQual && !isDirect) return null;

  if (isQual) {
    const fromSettings = qualLegByUserId.get(user.id);
    if (fromSettings) return fromSettings;
    const fromEmail = inferQualificatorLegFromEmail(user.email);
    if (fromEmail) return fromEmail;
  }

  const pos = getBinaryPositionRelativeTo(sponsorId, user.id, nodes);
  return pos?.legSide ?? null;
}

function collectSponsorLegMembers(
  sponsorId: string,
  legSide: LegSide,
  nodes: NodeRow[],
  allUsers: UserRow[],
  qualLegByUserId: Map<string, LegSide>,
): Array<{
  userId: string;
  isQual: boolean;
  level: number;
  placedAt: Date;
}> {
  const members: Array<{
    userId: string;
    isQual: boolean;
    level: number;
    placedAt: Date;
  }> = [];

  for (const user of allUsers) {
    if (user.id === sponsorId) continue;
    const node = nodes.find((n) => n.userId === user.id);
    if (!node?.side) continue;

    const intendedLeg = resolveIntendedLeg(user, sponsorId, nodes, qualLegByUserId);
    if (intendedLeg !== legSide) continue;

    const isQual = user.masterUserId === sponsorId;
    const pos = getBinaryPositionRelativeTo(sponsorId, user.id, nodes);

    members.push({
      userId: user.id,
      isQual,
      level: pos?.level ?? 99,
      placedAt: node.placedAt,
    });
  }

  members.sort((a, b) => {
    if (a.isQual !== b.isQual) return a.isQual ? -1 : 1;
    if (a.level !== b.level) return a.level - b.level;
    return a.placedAt.getTime() - b.placedAt.getTime();
  });

  return members;
}

function legNeedsRebuild(
  sponsorId: string,
  legSide: LegSide,
  nodes: NodeRow[],
  allUsers: UserRow[],
  qualLegByUserId: Map<string, LegSide>,
): boolean {
  for (const user of allUsers) {
    if (user.id === sponsorId) continue;
    const node = nodes.find((n) => n.userId === user.id);
    if (!node?.side) continue;
    const intendedLeg = resolveIntendedLeg(user, sponsorId, nodes, qualLegByUserId);
    if (intendedLeg !== legSide) continue;
    if (!isOnLegExtremity(sponsorId, user.id, nodes)) return true;
  }
  return false;
}

function planLegRebuild(
  sponsorId: string,
  legSide: LegSide,
  nodes: NodeRow[],
  allUsers: UserRow[],
  qualLegByUserId: Map<string, LegSide>,
): Array<{ userId: string; parentId: string; side: LegSide }> {
  const members = collectSponsorLegMembers(sponsorId, legSide, nodes, allUsers, qualLegByUserId);
  if (members.length === 0) return [];

  const memberIds = new Set(members.map((m) => m.userId));
  const userById = new Map(allUsers.map((u) => [u.id, u]));
  // Remove membros desta perna e nós «estrangeiros» que bloqueiam a extremidade.
  let virtualNodes = nodes.filter((n) => {
    if (memberIds.has(n.userId)) return false;
    const user = userById.get(n.userId);
    if (!user || user.id === sponsorId) return true;
    const intended = resolveIntendedLeg(user, sponsorId, nodes, qualLegByUserId);
    return intended == null || intended === legSide;
  });
  const moves: Array<{ userId: string; parentId: string; side: LegSide }> = [];

  for (const member of members) {
    const target = findLegSpilloverPlacement(sponsorId, legSide, virtualNodes);
    if (!target) break;

    const existing = nodes.find((n) => n.userId === member.userId);
    virtualNodes = applyVirtualPlacement(
      virtualNodes,
      member.userId,
      target.parentId,
      target.side,
      existing?.placedAt ?? new Date(),
    );

    if (existing?.parentId !== target.parentId || existing?.side !== target.side) {
      moves.push({
        userId: member.userId,
        parentId: target.parentId,
        side: target.side,
      });
    }
  }

  return moves;
}

async function replayPointsForUser(userId: string): Promise<void> {
  const db = getDb();
  const purchases = await db.query.userPackages.findMany({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.status, "active")),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
  for (const purchase of purchases) {
    await onPackagePurchaseBinary({ buyerUserId: userId, amount: purchase.amount });
  }
}

/** Reorganiza qualificadores e directs na extremidade de cada perna do patrocinador. */
export async function ensureBinaryLegExtremity(sponsorId: string): Promise<number> {
  const db = getDb();
  const qualLegByUserId = await loadQualificatorLegByUserId();
  const allUsers = await db.query.users.findMany();

  let moved = 0;

  // Esquerda antes da direita — liberta slots bloqueados por quals na perna oposta.
  for (const legSide of ["left", "right"] as const) {
    const currentNodes = await db.query.binaryTreeNodes.findMany();
    if (!legNeedsRebuild(sponsorId, legSide, currentNodes, allUsers, qualLegByUserId)) continue;

    const moves = planLegRebuild(sponsorId, legSide, currentNodes, allUsers, qualLegByUserId);
    for (const move of moves) {
      await db
        .update(binaryTreeNodes)
        .set({
          parentId: move.parentId,
          side: move.side,
          placedAt: new Date(),
        })
        .where(eq(binaryTreeNodes.userId, move.userId));
      await replayPointsForUser(move.userId);
      moved++;
    }
  }

  if (moved === 0) return 0;

  if (moved > 0) {
    console.info(`[binary-extremity] ${moved} nó(s) reorganizado(s) para patrocinador ${sponsorId.slice(0, 8)}`);
  }

  return moved;
}
