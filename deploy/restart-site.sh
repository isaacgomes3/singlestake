#!/usr/bin/env bash
# Repõe o site em ~30s quando Apache devolve 503 (PM2 parado).
# Na VPS: cd /var/www/stake37 && bash deploy/restart-site.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/stake37}"
cd "$APP_DIR"
# shellcheck source=deploy-common.sh
source "$APP_DIR/deploy/deploy-common.sh"
setup_deploy_path
ensure_pm2

if [[ ! -f .output/server/index.mjs ]]; then
  echo "✗ Build em falta (.output/server/index.mjs) — execute: bash deploy/quick-fix-site.sh"
  exit 1
fi

echo "=== stake37 — restart site ==="
pm2 describe singlestake >/dev/null 2>&1 && pm2 restart singlestake || pm2 start deploy/ecosystem.config.cjs
pm2 save

for i in 1 2 3 4 5 6; do
  if curl -sf --max-time 8 http://127.0.0.1:3000/entrar >/dev/null 2>&1; then
    echo "✓ Node OK — http://127.0.0.1:3000/entrar"
    bash "$APP_DIR/deploy/verify-site.sh" || true
    exit 0
  fi
  sleep 4
done

echo "✗ Node ainda não responde:"
pm2 status 2>/dev/null || true
pm2 logs singlestake --lines 30 --nostream 2>/dev/null || true
echo "→ Reparação completa: bash deploy/fix-vps-all.sh"
exit 1
