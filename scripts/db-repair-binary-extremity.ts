/**
 * Reorganiza qualificadores e indicados directos na extremidade de cada perna.
 * Uso: npx tsx scripts/db-repair-binary-extremity.ts [--dry-run]
 */
import "./load-local-env";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/lib/server/db/client";
import { binaryTreeNodes, users } from "../src/lib/server/db/schema";
import { onPackagePurchaseBinary } from "../src/lib/server/network/binary-engine";
import {
  findLegSpilloverPlacement,
  getBinaryPositionRelativeTo,
  isOnLegExtremity,
} from "../src/lib/server/network/placement";

const dryRun = process.argv.includes("--dry-run");

type NodeRow = typeof binaryTreeNodes.$inferSelect;
type LegSide = "left" | "right";

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

function collectSponsorLegMembers(
  sponsorId: string,
  legSide: LegSide,
  nodes: NodeRow[],
  allUsers: (typeof users.$inferSelect)[],
): Array<{
  userId: string;
  name: string;
  isQual: boolean;
  level: number;
  placedAt: Date;
}> {
  const members: Array<{
    userId: string;
    name: string;
    isQual: boolean;
    level: number;
    placedAt: Date;
  }> = [];

  for (const user of allUsers) {
    if (user.id === sponsorId) continue;
    const node = nodes.find((n) => n.userId === user.id);
    if (!node?.side) continue;

    const isQual = user.masterUserId === sponsorId;
    const isDirect = user.sponsorId === sponsorId && !user.masterUserId;
    if (!isQual && !isDirect) continue;

    const pos = getBinaryPositionRelativeTo(sponsorId, user.id, nodes);
    if (!pos || pos.legSide !== legSide) continue;

    members.push({
      userId: user.id,
      name: user.name,
      isQual,
      level: pos.level,
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

function needsLegRebuild(
  sponsorId: string,
  legSide: LegSide,
  nodes: NodeRow[],
  allUsers: (typeof users.$inferSelect)[],
): boolean {
  const members = collectSponsorLegMembers(sponsorId, legSide, nodes, allUsers);
  return members.some((m) => !isOnLegExtremity(sponsorId, m.userId, nodes));
}

async function rebuildLegExtremity(
  sponsorId: string,
  legSide: LegSide,
  nodes: NodeRow[],
  allUsers: (typeof users.$inferSelect)[],
): Promise<Array<{ userId: string; name: string; parentId: string; side: LegSide }>> {
  const members = collectSponsorLegMembers(sponsorId, legSide, nodes, allUsers);
  if (members.length === 0) return [];

  const memberIds = new Set(members.map((m) => m.userId));
  let virtualNodes = nodes.filter((n) => !memberIds.has(n.userId));
  const moves: Array<{ userId: string; name: string; parentId: string; side: LegSide }> = [];

  for (const member of members) {
    const target = findLegSpilloverPlacement(sponsorId, legSide, virtualNodes);
    if (!target) break;

    const node = nodes.find((n) => n.userId === member.userId);
    virtualNodes = applyVirtualPlacement(
      virtualNodes,
      member.userId,
      target.parentId,
      target.side,
      node?.placedAt ?? new Date(),
    );

    const existing = nodes.find((n) => n.userId === member.userId);
    if (
      existing?.parentId !== target.parentId ||
      existing?.side !== target.side
    ) {
      moves.push({
        userId: member.userId,
        name: member.name,
        parentId: target.parentId,
        side: target.side,
      });
    }
  }

  return moves;
}

async function main() {
  const db = getDb();
  const [nodes, allUsers] = await Promise.all([
    db.query.binaryTreeNodes.findMany(),
    db.query.users.findMany(),
  ]);

  const sponsorIds = new Set<string>();
  for (const user of allUsers) {
    if (user.sponsorId) sponsorIds.add(user.sponsorId);
    if (user.masterUserId) sponsorIds.add(user.masterUserId);
  }

  const allMoves: Array<{
    sponsorId: string;
    legSide: LegSide;
    userId: string;
    name: string;
    parentId: string;
    side: LegSide;
  }> = [];

  for (const sponsorId of sponsorIds) {
    for (const legSide of ["left", "right"] as const) {
      if (!needsLegRebuild(sponsorId, legSide, nodes, allUsers)) continue;
      const sponsor = allUsers.find((u) => u.id === sponsorId);
      const moves = await rebuildLegExtremity(sponsorId, legSide, nodes, allUsers);
      for (const move of moves) {
        allMoves.push({ sponsorId, legSide, ...move });
      }
      if (moves.length > 0) {
        console.log(
          `\n${sponsor?.name ?? sponsorId.slice(0, 8)} — perna ${legSide}: ${moves.length} movimento(s)`,
        );
        for (const move of moves) {
          console.log(`  ${move.name} → parent ${move.parentId.slice(0, 8)}… (${move.side})`);
        }
      }
    }
  }

  if (allMoves.length === 0) {
    console.log("Todas as pernas já estão na extremidade correcta.");
    return;
  }

  if (dryRun) {
    console.log(`\n[DRY-RUN] ${allMoves.length} movimento(s) planeados.`);
    return;
  }

  let moved = 0;
  for (const move of allMoves) {
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

  console.log(`\nOK — ${moved} conta(s) reorganizada(s) na extremidade.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
