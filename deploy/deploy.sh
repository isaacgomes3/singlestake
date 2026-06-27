#!/usr/bin/env bash
# Deploy no VPS — Singlestake (Node + PM2).
# Uso na VPS:
#   ./deploy/deploy.sh
#   bash deploy/deploy.sh   # se Permission denied após git pull no Windows
# Com push em main + GitHub Actions configurado, corre sozinho após cada merge.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=deploy-common.sh
source "$ROOT/deploy/deploy-common.sh"
setup_deploy_path

BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"

echo "→ git actualizar (${BRANCH})"
git fetch origin "${BRANCH}"
# VPS: npm run build/dev pode alterar routeTree.gen.ts — reset alinha com o remoto (.env fica: está no .gitignore).
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  echo "  (alterações locais descartadas — só código do GitHub)"
fi
git reset --hard "origin/${BRANCH}"
echo "→ commit: $(git rev-parse --short HEAD)"

echo "→ sincronizar chaves .env em falta"
bash deploy/sync-env-keys.sh

echo "→ npm ci"
if ! npm ci 2>/dev/null; then
  echo "→ lock desactualizado — npm install"
  npm install
fi

rebuild_native_modules
ensure_pm2

echo "→ pm2 stop (libertar .output antes do build)"
pm2 delete singlestake 2>/dev/null || true
sleep 2

echo "→ build limpo (.output)"
rm -rf .output
npm run build

if [[ ! -d .output/public/assets ]]; then
  echo "✗ Build incompleto — falta .output/public/assets"
  exit 1
fi

AAPANEL_CONF="${AAPANEL_CONF:-/www/server/panel/vhost/apache/stake37.com.br.conf}"
mkdir -p data

echo "→ pm2 (arranque imediato — antes de migrações DB)"
pm2 start deploy/ecosystem.config.cjs
pm2 save

if [[ -f .env ]] && grep -q '^DATABASE_URL=' .env; then
  echo "→ pm2 stop (migrações DB — evita crash SQLite)"
  pm2 stop singlestake 2>/dev/null || true
  sleep 1
  echo "→ npm run db:push"
  npm run db:push || echo "⚠ db:push ignorado"
  if [[ "${FIRST_DEPLOY:-0}" == "1" ]]; then
    echo "→ npm run db:seed (FIRST_DEPLOY=1)"
    npm run db:seed || echo "⚠ db:seed ignorado"
  fi
  echo "→ npm run db:seed-isaac (rede qualificadora Isaac — idempotente)"
  npm run db:seed-isaac || echo "⚠ db:seed-isaac ignorado"
  echo "→ pm2 start (após migrações DB)"
  pm2 start deploy/ecosystem.config.cjs 2>/dev/null || pm2 restart singlestake
  pm2 save
fi

if [[ -f "$AAPANEL_CONF" ]]; then
  bash "$ROOT/deploy/patch-apache-static.sh" || echo "⚠ patch Apache ignorado — Node serve estáticos"
else
  echo "⚠ vhost Apache não encontrado ($AAPANEL_CONF)"
fi

echo "→ verificar assets estáticos"
sleep 3
HTML="$(curl -sf --max-time 30 http://127.0.0.1:3000/entrar || true)"
CSS="$(echo "$HTML" | grep -oE '/assets/styles-[A-Za-z0-9_-]+\.css' | head -1 || true)"
if [[ -z "$CSS" ]]; then
  echo "⚠ HTML sem link CSS — ver pm2 logs singlestake"
elif [[ ! -f ".output/public${CSS}" ]]; then
  echo "✗ Ficheiro CSS em falta no disco: .output/public${CSS}"
  exit 1
else
  CODE="$(curl -sf -o /dev/null -w '%{http_code}' "http://127.0.0.1:3000${CSS}" 2>/dev/null || echo "000")"
  if [[ "$CODE" == "200" ]]; then
    echo "✓ Assets OK via Node (${CSS})"
  elif grep -q 'ProxyPass /assets !' "$AAPANEL_CONF" 2>/dev/null; then
    echo "✓ Asset no disco (${CSS}); Apache serve /assets (Node devolve ${CODE})"
  else
    echo "⚠ Asset via Node HTTP ${CODE} — ficheiro existe; ver pm2 logs se o site público falhar"
  fi
fi

PUBLIC_URL="${PUBLIC_APP_URL:-https://stake37.com.br}"
if [[ -n "$CSS" && -f ".output/public${CSS}" ]]; then
  PUB_CODE="$(curl -sf -o /dev/null -w '%{http_code}' "${PUBLIC_URL}${CSS}" 2>/dev/null || echo "000")"
  if [[ "$PUB_CODE" == "200" ]]; then
    echo "✓ Site público OK (${PUBLIC_URL}${CSS})"
  else
    echo "⚠ Site público ainda HTTP ${PUB_CODE} — bash deploy/patch-apache-static.sh ou aguarde DNS/cache"
  fi
fi

REV="$(git rev-parse --short HEAD)"
if [[ -f .env ]]; then
  if grep -q '^DEPLOY_GIT_REV=' .env; then
    sed -i "s/^DEPLOY_GIT_REV=.*/DEPLOY_GIT_REV=${REV}/" .env
  else
    echo "DEPLOY_GIT_REV=${REV}" >> .env
  fi
  pm2 restart singlestake 2>/dev/null || pm2 start deploy/ecosystem.config.cjs
  pm2 save
fi

echo "→ verificar PM2 online"
for i in 1 2 3 4 5 6; do
  if curl -sf --max-time 10 http://127.0.0.1:3000/entrar >/dev/null 2>&1; then
    echo "✓ Node responde em :3000"
    break
  fi
  if [[ "$i" -eq 6 ]]; then
    echo "✗ Node não responde — pm2 logs singlestake --lines 40"
    pm2 logs singlestake --lines 40 --nostream 2>/dev/null || true
    pm2 status 2>/dev/null || true
    exit 1
  fi
  echo "  aguardar arranque (${i}/6)…"
  sleep 5
done

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

HIST_CHECK="$(curl -sf --max-time 30 http://127.0.0.1:3000/api/roulette/histories 2>/dev/null || echo '{}')"
if echo "$HIST_CHECK" | grep -q '"webSocketAvailable":false'; then
  echo "✗ WebSocket polyfill inactivo — confirme node-preload no PM2 (deploy/ecosystem.config.cjs)"
fi

PUBLIC_URL="${PUBLIC_APP_URL:-https://stake37.com.br}"
echo "✓ Deploy concluído — app em http://127.0.0.1:3000 (público: ${PUBLIC_URL})"
