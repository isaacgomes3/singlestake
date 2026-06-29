/**
 * Reorganiza qualificadores e indicados directos na extremidade de cada perna.
 * Uso: npx tsx scripts/db-repair-binary-extremity.ts [--dry-run]
 */
import "./load-local-env";

import { closeDb, getDb } from "../src/lib/server/db/client";
import { users } from "../src/lib/server/db/schema";
import { ensureBinaryLegExtremity } from "../src/lib/server/network/binary-extremity-repair";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();
  const allUsers = await db.query.users.findMany();

  const sponsorIds = new Set<string>();
  for (const user of allUsers) {
    if (user.sponsorId) sponsorIds.add(user.sponsorId);
    if (user.masterUserId) sponsorIds.add(user.masterUserId);
  }

  if (dryRun) {
    console.log(
      `[DRY-RUN] Correcção automática ao abrir a genealogia — ou execute sem --dry-run para forçar agora.`,
    );
    console.log(`Patrocinadores a verificar: ${sponsorIds.size}`);
    return;
  }

  let total = 0;
  for (const sponsorId of sponsorIds) {
    const moved = await ensureBinaryLegExtremity(sponsorId);
    total += moved;
    if (moved > 0) {
      const name = allUsers.find((u) => u.id === sponsorId)?.name ?? sponsorId.slice(0, 8);
      console.log(`  ${name}: ${moved} nó(s) movido(s)`);
    }
  }

  console.log(total === 0 ? "Todas as pernas já estão correctas." : `OK — ${total} nó(s) reorganizado(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
