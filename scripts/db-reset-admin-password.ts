/**
 * Redefine a senha do admin (ou cria se não existir).
 * Uso: ADMIN_PASSWORD=nova123 npm run db:reset-admin
 */
import "dotenv/config";

import { eq } from "drizzle-orm";

import { hashPassword } from "../src/lib/server/auth/password";
import { closeDb, getDb } from "../src/lib/server/db/client";
import { users } from "../src/lib/server/db/schema";

const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@stake37.com.br").toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

async function main() {
  if (!password || password.length < 6) {
    console.error("Defina ADMIN_PASSWORD (mín. 6 caracteres).");
    process.exit(1);
  }

  const db = getDb();
  const row = await db.query.users.findFirst({ where: eq(users.email, email) });
  const hash = hashPassword(password);

  if (row) {
    await db
      .update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.id, row.id));
    console.log("Senha actualizada para:", email);
  } else {
    console.error("Utilizador não encontrado:", email);
    console.error("Corra: FIRST_DEPLOY=1 npm run db:seed");
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
