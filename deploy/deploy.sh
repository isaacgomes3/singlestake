#!/usr/bin/env bash
# Deploy no servidor (VPS) — sem Lovable.
# Uso: ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ git pull"
git pull --ff-only origin main

echo "→ npm ci"
npm ci

echo "→ npm run build"
npm run build

echo "→ pm2 reload"
if pm2 describe roleta-poupexplay >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi

pm2 save
echo "✓ Deploy concluído — verifique https://roleta.poupexplay.com/"
