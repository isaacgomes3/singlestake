#!/usr/bin/env bash
# Repõe automação global na VPS — saldo R$ 50.000 e histórico limpo.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/stake37}"
cd "$APP_DIR"
# shellcheck source=deploy-common.sh
source "$APP_DIR/deploy/deploy-common.sh"
setup_deploy_path

echo "=== Reiniciar ciclo da automação global ==="
npx tsx scripts/reset-global-automation.ts
pm2 restart singlestake singlestake-automation
pm2 save
echo "=== Concluído — verifique o painel de automação ==="
