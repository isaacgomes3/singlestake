#!/usr/bin/env bash
# Verifica Node local + site público. Uso: bash deploy/verify-site.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/stake37}"
PUBLIC_URL="${PUBLIC_APP_URL:-https://stake37.com.br}"
cd "$APP_DIR"
# shellcheck source=deploy-common.sh
source "$APP_DIR/deploy/deploy-common.sh"
setup_deploy_path

LOCAL_CODE="$(curl -sf -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/entrar 2>/dev/null || echo "000")"
PUB_CODE="$(curl -sf -o /dev/null -w '%{http_code}' --max-time 20 "${PUBLIC_URL}/entrar" 2>/dev/null || echo "000")"
LOGIN_CODE="$(curl -sf -o /dev/null -w '%{http_code}' --max-time 15 -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"healthcheck@invalid.local","password":"x"}' 2>/dev/null || echo "000")"

echo "Node :3000/entrar → HTTP ${LOCAL_CODE}"
echo "Node POST /api/auth/login → HTTP ${LOGIN_CODE} (401 esperado; 500 = schema BD)"
echo "${PUBLIC_URL}/entrar → HTTP ${PUB_CODE}"

if command -v pm2 >/dev/null 2>&1; then
  pm2 status singlestake 2>/dev/null || pm2 status 2>/dev/null || true
else
  echo "⚠ pm2 não no PATH — export PATH=\"\$(npm prefix -g)/bin:\$PATH\""
fi

if [[ "$LOCAL_CODE" == "200" && "$PUB_CODE" == "503" ]]; then
  echo ""
  echo "⚠ Node OK mas Apache 503 — proxy ou PM2 só em localhost:"
  echo "   bash deploy/patch-apache-static.sh"
  echo "   systemctl reload httpd 2>/dev/null || /www/server/apache/bin/httpd -k graceful"
  exit 2
fi

if [[ "$LOCAL_CODE" != "200" ]]; then
  echo ""
  echo "✗ Node não responde — bash deploy/restart-site.sh"
  exit 1
fi

if [[ "$LOGIN_CODE" == "500" ]]; then
  echo ""
  echo "✗ API de login com erro 500 — aplicar colunas admin/PIX:"
  echo "   bash deploy/apply-user-admin-columns.sh && pm2 restart singlestake"
  exit 1
fi

if [[ "$PUB_CODE" != "200" && "$PUB_CODE" != "302" ]]; then
  echo "⚠ Público HTTP ${PUB_CODE} — verificar Apache/SSL"
  exit 2
fi

echo "✓ Site OK (local + público)"
exit 0
