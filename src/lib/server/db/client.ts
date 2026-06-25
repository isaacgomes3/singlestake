import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const DEFAULT_DB_PATH = "./data/singlestake.db";

function resolveDatabasePath(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return resolve(DEFAULT_DB_PATH);
  if (raw.startsWith("file:")) return resolve(raw.slice("file:".length));
  return resolve(raw);
}

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Cliente SQLite singleton (servidor Node / Nitro). */
export function getDb() {
  if (db) return db;

  const path = resolveDatabasePath();
  mkdirSync(dirname(path), { recursive: true });

  sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  db = drizzle(sqlite, { schema });
  return db;
}

export function closeDb() {
  sqlite?.close();
  sqlite = null;
  db = null;
}

export { schema };
