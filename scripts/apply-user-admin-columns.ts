import Database from "better-sqlite3";

import "./load-local-env";

const path = process.env.DATABASE_URL ?? "./data/singlestake.db";
const db = new Database(path);

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

db.close();
