#!/usr/bin/env bash
# Colunas da árvore binária (next_direct_side, side nullable) — idempotente.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "⚠ .env não encontrado — ignorar colunas binárias"
  exit 0
fi

DB_RAW="$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
if [[ -z "$DB_RAW" ]]; then
  echo "⚠ DATABASE_URL vazio — ignorar colunas binárias"
  exit 0
fi

DB_PATH="$DB_RAW"
if [[ "$DB_PATH" == file:* ]]; then
  DB_PATH="${DB_PATH#file:}"
fi
if [[ "$DB_PATH" != /* ]]; then
  DB_PATH="$ROOT/$DB_PATH"
fi

echo "→ colunas binary_tree_nodes em $DB_PATH"

if [[ ! -f "$DB_PATH" ]]; then
  echo "✗ Base de dados não encontrada: $DB_PATH"
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "⚠ sqlite3 indisponível — confiar em npm run db:push"
  exit 0
fi

if ! sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='binary_tree_nodes';" | grep -q binary_tree_nodes; then
  echo "⚠ tabela binary_tree_nodes não existe — confiar em db:push/seed"
  exit 0
fi

has_col() {
  sqlite3 "$DB_PATH" "PRAGMA table_info(binary_tree_nodes);" | grep -Fq "|$1|"
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

add_col next_direct_side "ALTER TABLE binary_tree_nodes ADD COLUMN next_direct_side text;"

if ! has_col next_direct_side; then
  echo "✗ Coluna next_direct_side ainda em falta após sqlite3"
  exit 1
fi

echo "✓ colunas binary_tree_nodes OK (sqlite3)"
