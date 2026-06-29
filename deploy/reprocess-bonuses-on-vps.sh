#!/usr/bin/env bash
# Reprocessa bónus na BD de produção (backup + PM2 parado durante SQLite).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=deploy-common.sh
source "$ROOT/deploy/deploy-common.sh"
setup_deploy_path

DB_PATH="${DATABASE_URL:-./data/singlestake.db}"
if [[ "$DB_PATH" == file:* ]]; then
  DB_PATH="${DB_PATH#file:}"
fi
if [[ "$DB_PATH" != /* ]]; then
  DB_PATH="$ROOT/$DB_PATH"
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "✗ Base de dados não encontrada: $DB_PATH"
  exit 1
fi

BACKUP="${DB_PATH}.bak-$(date +%Y%m%d-%H%M%S)"
echo "→ backup: $BACKUP"
cp "$DB_PATH" "$BACKUP"

ensure_pm2
echo "→ pm2 stop singlestake"
pm2 stop singlestake 2>/dev/null || true
sleep 2

echo "→ colunas binárias (idempotente)"
bash deploy/apply-binary-tree-columns.sh || true

echo "→ reprocessar bónus"
npx tsx scripts/reprocess-all-bonuses.ts

echo "→ pm2 start"
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "✓ Reprocessamento concluído — backup em $BACKUP"
