/**
 * Repõe indicado directo para «aguardando perna» (side = null).
 * Uso: npx tsx scripts/db-reset-direct-binary-pending.ts email@exemplo.com
 */
import "./load-local-env";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/lib/server/db/client";
import { binaryTreeNodes, users } from "../src/lib/server/db/schema";

const email = (process.argv[2] ?? "").trim().toLowerCase();

async function main() {
  if (!email || !email.includes("@")) {
    console.error("Uso: npx tsx scripts/db-reset-direct-binary-pending.ts <email-do-indicado>");
    process.exit(1);
  }

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    console.error("Utilizador não encontrado:", email);
    process.exit(1);
  }
  if (user.masterUserId) {
    console.error("Sub-contas mantêm posição automática — use só em indicados directos.");
    process.exit(1);
  }

  const node = await db.query.binaryTreeNodes.findFirst({
    where: eq(binaryTreeNodes.userId, user.id),
  });
  if (!node) {
    console.error("Nó binário não encontrado.");
    process.exit(1);
  }
  if (node.side == null) {
    console.log("Já está pendente (sem perna):", email);
    return;
  }
  if (node.parentId !== user.sponsorId) {
    console.error(
      "Este indicado não está pendente de escolha directa do patrocinador (parentId ≠ sponsor).",
    );
    process.exit(1);
  }

  await db
    .update(binaryTreeNodes)
    .set({ side: null, placedAt: new Date() })
    .where(eq(binaryTreeNodes.userId, user.id));

  console.log(`OK — ${user.name} (${email}) reposto como pendente. O patrocinador deve escolher a perna.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
