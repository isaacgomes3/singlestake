/**
 * Aplica migrations SQL em drizzle/migrations.
 * Uso: npm run db:migrate
 */
import "dotenv/config";

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const path = resolve(process.env.DATABASE_URL ?? "./data/singlestake.db");
mkdirSync(dirname(path), { recursive: true });

const sqlite = new Database(path);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: resolve("./drizzle/migrations") });

sqlite.close();
console.log("Migrations aplicadas em:", path);
