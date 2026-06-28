#!/usr/bin/env bash
# Reparação rápida — site sem CSS. Executar na VPS como root.
# curl -fsSL https://raw.githubusercontent.com/isaacgomes3/singlestake/main/deploy/quick-fix-site.sh | bash
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/stake37}"
cd "$APP_DIR" || { echo "✗ Pasta $APP_DIR não existe"; exit 1; }
# shellcheck source=deploy-common.sh
source "$APP_DIR/deploy/deploy-common.sh"
setup_deploy_path
ensure_pm2

echo "=== stake37 — quick fix site ==="
echo "→ pasta: $(pwd) | commit: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

git fetch origin main
git reset --hard origin/main

if [[ ! -f package.json ]]; then
  echo "✗ package.json não encontrado — confirme a pasta: cd /var/www/stake37"
  exit 1
fi

echo "→ npm ci / build (pode demorar 2–5 min)"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"
npm ci 2>/dev/null || npm install
rebuild_native_modules
pm2 delete singlestake 2>/dev/null || true
sleep 2
rm -rf .output
npm run build

if [[ ! -d .output/public/assets ]]; then
  echo "✗ Build sem .output/public/assets"
  exit 1
fi

if [[ -f .env ]] && grep -q '^DATABASE_URL=' .env; then
  npm run db:push || echo "⚠ db:push ignorado"
  npx tsx scripts/apply-user-admin-columns.ts || echo "⚠ apply-user-admin-columns ignorado"
fi

pm2 delete singlestake 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

sleep 4
CSS="$(curl -sf http://127.0.0.1:3000/entrar | grep -oE '/assets/styles-[A-Za-z0-9_-]+\.css' | head -1 || true)"
if [[ -n "$CSS" ]]; then
  CODE="$(curl -sf -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000${CSS}" || echo "000")"
  echo "Node ${CSS} → HTTP ${CODE}"
fi

bash deploy/patch-apache-static.sh || true

echo "=== Concluído — teste https://stake37.com.br/entrar (Ctrl+F5) ==="
