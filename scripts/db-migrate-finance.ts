/**
 * Migração manual SQLite — financeiro v2.
 * Uso: npx tsx scripts/db-migrate-finance.ts
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { join } from "node:path";

const dbPath = process.env.DATABASE_URL?.replace("file:", "") ?? join(process.cwd(), "data", "singlestake.db");

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function run() {
  const db = new Database(dbPath);

  const alters: [string, string, string][] = [
    ["investment_packages", "package_kind", "TEXT NOT NULL DEFAULT 'automation'"],
    ["user_packages", "affiliate_amount", "REAL NOT NULL DEFAULT 0"],
    ["user_packages", "automation_base", "REAL NOT NULL DEFAULT 0"],
    ["user_packages", "company_amount", "REAL NOT NULL DEFAULT 0"],
    ["user_packages", "total_earned", "REAL NOT NULL DEFAULT 0"],
    ["user_packages", "max_profit", "REAL NOT NULL DEFAULT 0"],
    ["user_packages", "adhesion_ends_at", "INTEGER"],
    ["subscriptions", "grace_ends_at", "INTEGER"],
    ["users", "master_user_id", "TEXT"],
  ];

  for (const [table, column, def] of alters) {
    if (!columnExists(db, table, column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
      console.log(`+ ${table}.${column}`);
    }
  }

  if (!columnExists(db, "missed_credits", "id")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS missed_credits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS missed_credits_user_id_idx ON missed_credits(user_id);
    `);
    console.log("+ missed_credits table");
  }

  const binaryLegPointsExists = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='binary_leg_points'`)
    .get();
  if (!binaryLegPointsExists) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS binary_leg_points (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level INTEGER NOT NULL,
        side TEXT NOT NULL CHECK(side IN ('left', 'right')),
        total_points REAL NOT NULL DEFAULT 0,
        matched_points REAL NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        UNIQUE(user_id, level, side)
      );
      CREATE INDEX IF NOT EXISTS binary_leg_points_user_id_idx ON binary_leg_points(user_id);
    `);
    console.log("+ binary_leg_points table");
  }

  db.prepare(
    `UPDATE user_packages SET adhesion_ends_at = term_ends_at WHERE adhesion_ends_at IS NULL`,
  ).run();
  db.prepare(
    `UPDATE user_packages SET max_profit = amount * 2 WHERE max_profit = 0 AND amount > 0`,
  ).run();
  db.prepare(
    `UPDATE user_packages SET affiliate_amount = amount * 0.3, automation_base = amount * 0.2, company_amount = amount * 0.5 WHERE amount > 0 AND affiliate_amount = 0`,
  ).run();

  const wallets = db.prepare(`SELECT id FROM users`).all() as { id: string }[];

  for (const row of wallets) {
    for (const bucket of ["automacao", "empresa"]) {
      const exists = db
        .prepare(`SELECT 1 FROM wallet_accounts WHERE user_id = ? AND bucket = ?`)
        .get(row.id, bucket);
      if (!exists) {
        db.prepare(
          `INSERT INTO wallet_accounts (id, user_id, bucket, available_balance, blocked_balance, updated_at) VALUES (?, ?, ?, 0, 0, ?)`,
        ).run(randomUUID(), row.id, bucket, Date.now());
      }
    }
  }

  db.close();
  console.log("Migração financeira concluída.");
}

run();
