#!/usr/bin/env bash
# Diagnóstico na VPS quando o deploy GitHub Actions falha.
set +e

APP_DIR="${APP_DIR:-/var/www/stake37}"
if [ ! -d "$APP_DIR" ]; then APP_DIR=/var/www/singlestake; fi
cd "$APP_DIR" 2>/dev/null || {
  echo "=== ERRO: diretório da app não encontrado ($APP_DIR) ==="
  exit 1
}

echo "=== DIAGNÓSTICO VPS — $(date -Is 2>/dev/null || date) ==="
echo "=== Host: $(hostname) | User: $(whoami) ==="

echo ""
echo "=== Git ==="
git rev-parse --short HEAD 2>/dev/null || echo "(sem git)"
git log -1 --oneline 2>/dev/null || true
git status --porcelain 2>/dev/null | head -20 || true

echo ""
echo "=== Disco / memória ==="
df -h / 2>/dev/null || df -h 2>/dev/null || true
free -m 2>/dev/null || true

echo ""
echo "=== Node / npm ==="
command -v node >/dev/null && node -v || echo "node: não encontrado"
command -v npm >/dev/null && npm -v || echo "npm: não encontrado"

echo ""
echo "=== PM2 ==="
if command -v pm2 >/dev/null 2>&1; then
  pm2 status 2>/dev/null || true
  pm2 describe singlestake 2>/dev/null | tail -25 || true
  echo "--- pm2 logs (últimas 50 linhas) ---"
  pm2 logs singlestake --lines 50 --nostream 2>/dev/null || true
else
  echo "pm2: não encontrado no PATH"
fi

echo ""
echo "=== Build .output ==="
if [ -d .output ]; then
  ls -la .output/server/index.mjs 2>/dev/null || echo "Falta .output/server/index.mjs"
  ls -la .output/public/assets 2>/dev/null | head -5 || echo "Falta .output/public/assets"
else
  echo "Diretório .output não existe"
fi

echo ""
echo "=== HTTP local / público ==="
LOCAL_CODE="$(curl -sfL -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3000/entrar 2>/dev/null || echo 000)"
PUB="${PUBLIC_APP_URL:-https://stake37.com.br}"
PUB_CODE="$(curl -sfL -o /dev/null -w '%{http_code}' --max-time 25 "${PUB}/entrar" 2>/dev/null || echo 000)"
echo "127.0.0.1:3000/entrar → HTTP ${LOCAL_CODE}"
echo "${PUB}/entrar → HTTP ${PUB_CODE}"

echo ""
echo "=== Porta 3000 ==="
(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || true) | grep -E ':3000\b' || echo "Nada a escutar na porta 3000"

echo ""
echo "=== Fim diagnóstico ==="
