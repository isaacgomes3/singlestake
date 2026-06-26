#!/usr/bin/env bash
# Deploy no VPS — Singlestake (Node + PM2).
# Uso na VPS:
#   ./deploy/deploy.sh
#   bash deploy/deploy.sh   # se Permission denied após git pull no Windows
# Com push em main + GitHub Actions configurado, corre sozinho após cada merge.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"

echo "→ git pull (${BRANCH})"
git fetch origin "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "→ sincronizar chaves .env em falta"
bash deploy/sync-env-keys.sh

echo "→ npm ci"
if ! npm ci 2>/dev/null; then
  echo "→ lock desactualizado — npm install"
  npm install
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "→ instalar PM2"
  npm install -g pm2
fi

echo "→ npm run build"
npm run build

mkdir -p data

if [[ -f .env ]] && grep -q '^DATABASE_URL=' .env; then
  echo "→ npm run db:push"
  npm run db:push
  if [[ "${FIRST_DEPLOY:-0}" == "1" ]]; then
    echo "→ npm run db:seed (FIRST_DEPLOY=1)"
    npm run db:seed
  fi
fi

echo "→ pm2"
if pm2 describe singlestake >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi

pm2 save

echo "→ verificação pós-deploy (45s — hub Pragmatic)"
sleep 45
HIST="$(curl -sf --max-time 60 http://127.0.0.1:3000/api/roulette/histories || echo '{}')"
if echo "$HIST" | grep -q '"hasData":true'; then
  echo "✓ Roleta: dados Pragmatic OK"
elif echo "$HIST" | grep -q '"upstreamActive":true'; then
  echo "⚠ Roleta: upstream activo mas ainda sem giros — pm2 logs singlestake | grep Roleta"
else
  echo "⚠ Roleta: hub sem dados — bash deploy/diagnose-stake37-roulette.sh"
fi

if pm2 logs singlestake --lines 20 --nostream 2>/dev/null | grep -q "bufferUtil.*mask is not a function"; then
  echo "✗ ERRO bufferutil — confirme WS_NO_BUFFER_UTIL=1 no .env e npm run build recente"
fi

AAPANEL_CONF="${AAPANEL_CONF:-/www/server/panel/vhost/apache/stake37.com.br.conf}"
if [[ -f "$AAPANEL_CONF" ]] && ! grep -q "api/roulette/spins" "$AAPANEL_CONF" 2>/dev/null; then
  echo "⚠ Apache sem proxy SSE — copie deploy/aapanel-stake37.conf.example para $AAPANEL_CONF"
fi

PUBLIC_URL="${PUBLIC_APP_URL:-https://stake37.com.br}"
echo "✓ Deploy concluído — app em http://127.0.0.1:3000 (público: ${PUBLIC_URL})"
