import { existsSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";
import { config } from "dotenv";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");

if (existsSync(envPath)) {
  config({ path: envPath });
}

function resolveDatabasePath(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return resolve(root, "data/singlestake.db");
  if (raw.startsWith("file:")) return resolve(raw.slice("file:".length));
  return resolve(root, raw);
}

const dbPath = resolveDatabasePath();
console.log("→ BD:", dbPath);

if (!existsSync(dbPath)) {
  console.error("✗ Base de dados não encontrada:", dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
const names = new Set(cols.map((c) => c.name));

const statements: string[] = [];
if (!names.has("account_status")) {
  statements.push("ALTER TABLE users ADD COLUMN account_status text DEFAULT 'active' NOT NULL");
}
if (!names.has("pix_key")) {
  statements.push("ALTER TABLE users ADD COLUMN pix_key text");
}
if (!names.has("pix_key_set_at")) {
  statements.push("ALTER TABLE users ADD COLUMN pix_key_set_at integer");
}
if (!names.has("allow_pix_key_edit")) {
  statements.push("ALTER TABLE users ADD COLUMN allow_pix_key_edit integer DEFAULT 0 NOT NULL");
}

for (const sql of statements) {
  db.exec(sql);
  console.log("OK:", sql);
}

if (statements.length === 0) {
  console.log("Colunas admin/PIX já existem.");
}

const after = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
const afterNames = new Set(after.map((c) => c.name));
const required = ["account_status", "pix_key", "pix_key_set_at", "allow_pix_key_edit"];
const missing = required.filter((name) => !afterNames.has(name));

db.close();

if (missing.length > 0) {
  console.error("✗ Colunas em falta após migração:", missing.join(", "));
  process.exit(1);
}

console.log("✓ Colunas admin/PIX verificadas.");
