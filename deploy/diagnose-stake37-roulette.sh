#!/usr/bin/env bash
# Diagnóstico giros ao vivo — executar na VPS: bash deploy/diagnose-stake37-roulette.sh
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/stake37}"
CONF="${CONF:-/www/server/panel/vhost/apache/stake37.com.br.conf}"

echo "========== stake37 — diagnóstico roleta =========="
echo ""

fail=0
ok() { echo "  OK: $1"; }
bad() { echo "  FALHA: $1"; fail=1; }
warn() { echo "  AVISO: $1"; }

echo "1. PM2"
if command -v pm2 >/dev/null 2>&1 || [[ -x "$(npm prefix -g 2>/dev/null)/bin/pm2" ]]; then
  export PATH="$(npm prefix -g 2>/dev/null)/bin:$PATH"
  if pm2 describe singlestake >/dev/null 2>&1; then
    ok "singlestake online (pm2)"
    pm2 describe singlestake 2>/dev/null | grep -E 'status|restarts|uptime' | sed 's/^/    /'
  else
    bad "singlestake não está no PM2"
  fi
else
  bad "pm2 não encontrado"
fi
echo ""

echo "2. App responde na :3000"
if curl -sf --max-time 5 http://127.0.0.1:3000/entrar >/dev/null; then
  ok "http://127.0.0.1:3000/entrar"
else
  bad "app não responde em :3000"
fi
echo ""

echo "3. Variáveis ROULETTE no .env"
if [[ -f "$APP_DIR/.env" ]]; then
  for key in ROULETTE_WS_URL ROULETTE_CASINO_ID ROULETTE_TABLE_IDS; do
    if grep -q "^${key}=" "$APP_DIR/.env"; then
      ok "$key definido"
    else
      warn "$key em falta — a usar valor por defeito do código"
    fi
  done
else
  bad ".env não encontrado em $APP_DIR"
fi
echo ""

echo "4. API /api/roulette/histories (hub Pragmatic)"
HIST=$(curl -sf --max-time 15 http://127.0.0.1:3000/api/roulette/histories 2>/dev/null || true)
if [[ -z "$HIST" ]]; then
  bad "sem resposta de /api/roulette/histories"
else
  echo "$HIST" | head -c 500
  echo ""
  if echo "$HIST" | grep -q '"hasData":true'; then
    ok "servidor tem giros da Pragmatic"
  elif echo "$HIST" | grep -q '"upstreamActive":true'; then
    warn "WebSocket activo mas ainda sem giros — aguarde ~30s ou verifique ROULETTE_CASINO_ID"
  elif pm2 logs singlestake --lines 30 --nostream 2>/dev/null | grep -q "WebSocket is not defined"; then
    bad "WebSocket não definido no Node — corra git pull && npm run build && pm2 restart"
  else
    bad "hub não ligou à Pragmatic — ver pm2 logs"
  fi
fi
echo ""

echo "5. SSE /api/roulette/spins"
SSE=$(timeout 8 curl -sN http://127.0.0.1:3000/api/roulette/spins 2>/dev/null | head -1 || true)
if echo "$SSE" | grep -q '"type":"ready"'; then
  ok "SSE Node responde"
else
  bad "SSE não responde no Node"
fi
echo ""

echo "6. Apache vhost (aaPanel)"
if [[ -f "$CONF" ]]; then
  if grep -q 'api/roulette/spins' "$CONF"; then
    ok "proxy SSE configurado em $CONF"
  else
    bad "FALTA proxy SSE em $CONF"
    echo ""
    echo "  CORRECÇÃO: copie deploy/aapanel-stake37.conf.example"
    echo "  cp $APP_DIR/deploy/aapanel-stake37.conf.example $CONF"
    echo "  /www/server/apache/bin/httpd -t && /etc/init.d/httpd reload"
  fi
else
  warn "vhost não encontrado em $CONF — confirme o caminho no aaPanel"
fi
echo ""

echo "7. Últimos logs [Roleta]"
if command -v pm2 >/dev/null 2>&1; then
  pm2 logs singlestake --lines 25 --nostream 2>/dev/null | grep -i roleta | tail -10 || echo "  (sem linhas Roleta)"
fi
echo ""

if [[ "$fail" -eq 0 ]]; then
  echo "========== Resumo: servidor parece OK =========="
  echo "Se o browser ainda mostra Sem giros: git pull, npm run build, pm2 restart"
else
  echo "========== Resumo: corrija os itens FALHA acima =========="
fi
exit "$fail"
