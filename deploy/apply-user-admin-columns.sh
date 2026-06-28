#!/usr/bin/env bash
# Aplica colunas admin/PIX na BD de produção (idempotente).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "⚠ .env não encontrado — ignorar colunas admin/PIX"
  exit 0
fi

DB_RAW="$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
if [[ -z "$DB_RAW" ]]; then
  echo "⚠ DATABASE_URL vazio — ignorar colunas admin/PIX"
  exit 0
fi

DB_PATH="$DB_RAW"
if [[ "$DB_PATH" == file:* ]]; then
  DB_PATH="${DB_PATH#file:}"
fi
if [[ "$DB_PATH" != /* ]]; then
  DB_PATH="$ROOT/$DB_PATH"
fi

echo "→ colunas admin/PIX em $DB_PATH"

if [[ ! -f "$DB_PATH" ]]; then
  echo "✗ Base de dados não encontrada: $DB_PATH"
  exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
  has_col() {
    sqlite3 "$DB_PATH" "PRAGMA table_info(users);" | grep -Fq "|$1|"
  }
  add_col() {
    local name="$1"
    local ddl="$2"
    if has_col "$name"; then
      echo "  ✓ $name já existe"
    else
      sqlite3 "$DB_PATH" "$ddl"
      echo "  + $name adicionada"
    fi
  }

  add_col account_status "ALTER TABLE users ADD COLUMN account_status text DEFAULT 'active' NOT NULL;"
  add_col pix_key "ALTER TABLE users ADD COLUMN pix_key text;"
  add_col pix_key_set_at "ALTER TABLE users ADD COLUMN pix_key_set_at integer;"
  add_col allow_pix_key_edit "ALTER TABLE users ADD COLUMN allow_pix_key_edit integer DEFAULT 0 NOT NULL;"

  for col in account_status pix_key pix_key_set_at allow_pix_key_edit; do
    if ! has_col "$col"; then
      echo "✗ Coluna $col ainda em falta após sqlite3"
      exit 1
    fi
  done
  echo "✓ colunas admin/PIX OK (sqlite3)"
  exit 0
fi

echo "→ sqlite3 indisponível — fallback tsx"
npx tsx scripts/apply-user-admin-columns.ts
