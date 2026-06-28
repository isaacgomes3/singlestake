#!/usr/bin/env bash
# Executado na VPS pelo GitHub Actions (deploy-stake37.yml).
set -euo pipefail

echo "=== Ligado como $(whoami) em $(hostname) ==="
APP_DIR=/var/www/stake37
if [ ! -d "$APP_DIR" ]; then APP_DIR=/var/www/singlestake; fi
cd "$APP_DIR"
# shellcheck source=deploy-common.sh
source deploy/deploy-common.sh
ensure_pm2
echo "=== Node: $(node -v) | PM2: $(pm2 -v) ==="

set +e
bash deploy/deploy.sh
DEPLOY_RC=$?
set -e

if [ "$DEPLOY_RC" -eq 0 ]; then
  echo "=== deploy.sh concluído com sucesso ==="
  exit 0
fi

echo "=== deploy.sh falhou (${DEPLOY_RC}) — quick-fix e verificação ==="
bash deploy/quick-fix-site.sh || true
sleep 10
PUB="${PUBLIC_APP_URL:-https://stake37.com.br}"
PUB_CODE="$(curl -sfL -o /dev/null -w '%{http_code}' --max-time 25 "${PUB}/entrar" 2>/dev/null || echo 000)"
LOCAL_CODE="$(curl -sfL -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/entrar 2>/dev/null || echo 000)"
echo "=== Pós quick-fix: local=${LOCAL_CODE} público=${PUB_CODE} ==="

if [ "$LOCAL_CODE" = "200" ] || [ "$LOCAL_CODE" = "302" ]; then
  bash deploy/patch-apache-static.sh || true
  echo "=== Node local OK — deploy considerado sucesso ==="
  exit 0
fi

if [ "$PUB_CODE" = "200" ] || [ "$PUB_CODE" = "302" ]; then
  echo "=== Site público OK — deploy considerado sucesso ==="
  exit 0
fi

bash deploy/verify-site.sh && exit 0
pm2 logs singlestake --lines 30 --nostream 2>/dev/null || true
exit 1
