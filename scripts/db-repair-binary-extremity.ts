/**
 * Repõe indicados directos que estão em posição interna para a extremidade da perna.
 * Uso: npx tsx scripts/db-repair-binary-extremity.ts [--dry-run]
 */
import "./load-local-env";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/lib/server/db/client";
import { binaryTreeNodes, users } from "../src/lib/server/db/schema";
import { onPackagePurchaseBinary } from "../src/lib/server/network/binary-engine";
import {
  collectSubtreeUserIds,
  findLegSpilloverPlacement,
  getBinaryPositionRelativeTo,
  isOnLegExtremity,
} from "../src/lib/server/network/placement";

const dryRun = process.argv.includes("--dry-run");

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

async function main() {
  const db = getDb();
  const [nodes, allUsers] = await Promise.all([
    db.query.binaryTreeNodes.findMany(),
    db.query.users.findMany(),
  ]);

  const directsBySponsor = new Map<string, typeof allUsers>();
  for (const user of allUsers) {
    if (!user.sponsorId || user.masterUserId) continue;
    const list = directsBySponsor.get(user.sponsorId) ?? [];
    list.push(user);
    directsBySponsor.set(user.sponsorId, list);
  }

  type Repair = { userId: string; name: string; sponsorId: string; legSide: "left" | "right" };
  const repairs: Repair[] = [];

  for (const [sponsorId, directs] of directsBySponsor) {
    for (const direct of directs) {
      const node = nodes.find((n) => n.userId === direct.id);
      if (!node?.side || !node.parentId) continue;

      if (isOnLegExtremity(sponsorId, direct.id, nodes)) continue;

      const pos = getBinaryPositionRelativeTo(sponsorId, direct.id, nodes);
      if (!pos) continue;

      repairs.push({
        userId: direct.id,
        name: direct.name,
        sponsorId,
        legSide: pos.legSide,
      });
    }
  }

  repairs.sort((a, b) => {
    const depthA = getBinaryPositionRelativeTo(a.sponsorId, a.userId, nodes)?.level ?? 0;
    const depthB = getBinaryPositionRelativeTo(b.sponsorId, b.userId, nodes)?.level ?? 0;
    return depthB - depthA;
  });

  if (repairs.length === 0) {
    console.log("Nenhum indicado directo em posição interna.");
    return;
  }

  console.log(`${dryRun ? "[DRY-RUN] " : ""}${repairs.length} indicado(s) a corrigir:`);

  let moved = 0;
  for (const repair of repairs) {
    const freshNodes = await db.query.binaryTreeNodes.findMany();
    const exclude = collectSubtreeUserIds(repair.userId, freshNodes);
    const target = findLegSpilloverPlacement(repair.sponsorId, repair.legSide, freshNodes, exclude);

    if (!target) {
      console.warn(`  SKIP ${repair.name} — sem vaga na extremidade ${repair.legSide}`);
      continue;
    }

    const sponsor = allUsers.find((u) => u.id === repair.sponsorId);
    console.log(
      `  ${repair.name} → perna ${repair.legSide}, parent ${target.parentId.slice(0, 8)}… side ${target.side}`,
    );

    if (!dryRun) {
      await db
        .update(binaryTreeNodes)
        .set({
          parentId: target.parentId,
          side: target.side,
          placedAt: new Date(),
        })
        .where(eq(binaryTreeNodes.userId, repair.userId));

      await replayPointsForUser(repair.userId);
      moved++;
    }
  }

  console.log(dryRun ? "Dry-run concluído." : `OK — ${moved} indicado(s) movido(s) para a extremidade.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
