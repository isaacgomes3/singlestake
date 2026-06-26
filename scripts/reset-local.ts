/**
 * Apaga a SQLite local e recria do zero (migrations + seed).
 * Uso: npm run reset:local
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

import "dotenv/config";

const root = resolve(import.meta.dirname, "..");
const dbPath = resolve(root, process.env.DATABASE_URL ?? "./data/singlestake.db");

for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (existsSync(file)) rmSync(file);
}

mkdirSync(dirname(dbPath), { recursive: true });

console.log("BD local removida. A recriar…\n");
execSync("npm run db:migrate", { cwd: root, stdio: "inherit" });
execSync("npm run db:seed", { cwd: root, stdio: "inherit" });
console.log("\nBD local recriada com sucesso.");
