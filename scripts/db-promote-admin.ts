/**
 * Promove um utilizador a administrador.
 * Uso: npx tsx scripts/db-promote-admin.ts niano191@gmail.com
 */
import "./load-local-env";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/lib/server/db/client";
import { users } from "../src/lib/server/db/schema";

const email = (process.argv[2] ?? process.env.PROMOTE_ADMIN_EMAIL ?? "").trim().toLowerCase();

async function main() {
  if (!email || !email.includes("@")) {
    console.error("Uso: npx tsx scripts/db-promote-admin.ts <email>");
    process.exit(1);
  }

  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!row) {
    console.error("Utilizador não encontrado:", email);
    process.exit(1);
  }

  if (row.role === "admin") {
    console.log("Já é administrador:", email);
    return;
  }

  await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.id, row.id));

  console.log(`OK — ${row.name} (${email}) promovido a administrador.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
