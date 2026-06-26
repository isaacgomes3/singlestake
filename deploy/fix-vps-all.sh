#!/usr/bin/env bash
# Reparação completa stake37 na VPS — uma única execução.
# Uso: cd /var/www/stake37 && bash deploy/fix-vps-all.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/stake37}"
AAPANEL_CONF="${AAPANEL_CONF:-/www/server/panel/vhost/apache/stake37.com.br.conf}"
HTTPD="${HTTPD:-/www/server/apache/bin/httpd}"

cd "$APP_DIR"

echo "========== stake37 — reparação completa =========="
echo ""

echo "1/7 — Código do GitHub (descarta alterações locais)"
git fetch origin main
git reset --hard origin/main
echo "   commit: $(git rev-parse --short HEAD)"
echo ""

echo "2/7 — .env (chaves em falta)"
bash deploy/sync-env-keys.sh
# Garantir variáveis críticas da roleta
for line in \
  'ROULETTE_HUB_IDLE_SHUTDOWN_MS=-1' \
  'WS_NO_BUFFER_UTIL=1' \
  'WS_NO_UTF_8_VALIDATE=1'; do
  key="${line%%=*}"
  if ! grep -q "^${key}=" .env 2>/dev/null; then
    echo "$line" >> .env
    echo "   + $key"
  fi
done
echo ""

echo "3/7 — Dependências e build"
if ! npm ci 2>/dev/null; then npm install; fi
npm run build
if [[ -f .output/server/_libs/ws.mjs ]]; then
  echo "   AVISO: ws ainda empacotado — rebuild pode precisar de npm install recente"
fi
echo ""

echo "4/7 — Base de dados"
mkdir -p data
if grep -q '^DATABASE_URL=' .env; then
  npm run db:push
fi
echo ""

echo "5/7 — PM2"
export PATH="$(npm prefix -g 2>/dev/null)/bin:$PATH"
if pm2 describe singlestake >/dev/null 2>&1; then
  pm2 delete singlestake 2>/dev/null || true
fi
pm2 start deploy/ecosystem.config.cjs
pm2 save
echo ""

echo "6/7 — Apache SSE (aaPanel)"
if [[ -f "$AAPANEL_CONF" ]] && ! grep -q 'api/roulette/spins' "$AAPANEL_CONF"; then
  cp deploy/aapanel-stake37.conf.example "$AAPANEL_CONF"
  if [[ -x "$HTTPD" ]]; then
    "$HTTPD" -t && /etc/init.d/httpd reload
    echo "   Apache actualizado"
  else
    echo "   AVISO: copiou vhost — reinicie Apache manualmente"
  fi
else
  echo "   Apache OK ou vhost não encontrado"
fi
echo ""

echo "7/7 — Teste Pragmatic directo (mesa 234)"
node -e "
process.env.WS_NO_BUFFER_UTIL='1';
process.env.WS_NO_UTF_8_VALIDATE='1';
const WS=require('ws');
const url=process.env.ROULETTE_WS_URL||'wss://dga.pragmaticplaylive.net/ws';
const casino=process.env.ROULETTE_CASINO_ID||'ppcdk00000005148';
const table=234;
const s=new WS(url);
let ok=false;
const t=setTimeout(()=>{ if(!ok){ console.log('   FALHA: sem dados em 15s'); process.exit(1);} },15000);
s.on('open',()=>{
  s.send(JSON.stringify({type:'available',casinoId:casino}));
  setTimeout(()=>s.send(JSON.stringify({type:'subscribe',casinoId:casino,key:table,currency:'BRL'})),500);
});
s.on('message',(d)=>{
  try{
    const j=JSON.parse(String(d));
    const r=j.last20Results?.[0]?.result ?? j.resultEvent?.result;
    if(r!=null){ ok=true; clearTimeout(t); console.log('   OK: mesa',table,'último giro',r); s.close(); process.exit(0); }
  }catch(e){}
});
s.on('error',e=>{ console.log('   ERRO WS:',e.message); process.exit(1); });
" || echo "   (teste WS falhou — ver firewall / ROULETTE_CASINO_ID)"
echo ""

echo "→ Aguardar hub (60s)..."
sleep 60
HIST=$(curl -sf --max-time 90 http://127.0.0.1:3000/api/roulette/histories || echo '{}')
echo "$HIST" | head -c 400
echo ""
if echo "$HIST" | grep -q '"hasData":true'; then
  echo ""
  echo "========== ✓ SUCESSO — giros activos =========="
elif echo "$HIST" | grep -q '"upstreamActive":true'; then
  echo ""
  echo "========== ⚠ Upstream activo mas sem giros — ver logs =========="
  pm2 logs singlestake --lines 40 --nostream 2>/dev/null | grep -i roleta | tail -15
else
  echo ""
  echo "========== ✗ Hub sem ligação — pm2 logs singlestake =========="
  pm2 logs singlestake --lines 30 --nostream 2>/dev/null | tail -20
fi

echo ""
echo "Diagnóstico completo: bash deploy/diagnose-stake37-roulette.sh"
