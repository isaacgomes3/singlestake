#!/usr/bin/env bash
# Deploy no VPS — Singlestake (Node + PM2).
# Uso na VPS: ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"

echo "→ git pull (${BRANCH})"
git fetch origin "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

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

PUBLIC_URL="${PUBLIC_APP_URL:-https://stake37.com.br}"
echo "✓ Deploy concluído — app em http://127.0.0.1:3000 (público: ${PUBLIC_URL})"
