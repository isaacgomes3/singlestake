#!/usr/bin/env bash
# Primeiro deploy em stake37.com.br — executar na VPS como root.
# Uso: bash -c "$(curl -fsSL https://raw.githubusercontent.com/isaacgomes3/singlestake/main/deploy/first-deploy-stake37.sh)"
# Ou após git clone: sudo bash deploy/first-deploy-stake37.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/stake37}"
REPO="${REPO:-https://github.com/isaacgomes3/singlestake.git}"
BRANCH="${BRANCH:-main}"

echo "=== Singlestake — primeiro deploy stake37.com.br ==="

if ! command -v node >/dev/null 2>&1; then
  echo "→ Instalar dependências do sistema"
  apt-get update
  apt-get install -y curl git nginx certbot python3-certbot-nginx build-essential python3
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

mkdir -p "$APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

if [[ ! -f .env ]]; then
  cp deploy/env.production.example .env
  SECRET="$(openssl rand -hex 32)"
  sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
  sed -i "s|SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=$(openssl rand -hex 8)|" .env
  echo ""
  echo "⚠️  .env criado. Anote a senha admin:"
  grep '^SEED_ADMIN_PASSWORD=' .env
  echo ""
fi

mkdir -p data
export FIRST_DEPLOY=1
bash deploy/deploy.sh

pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup
pm2 save

if [[ -f deploy/nginx-stake37.conf ]]; then
  cp deploy/nginx-stake37.conf /etc/nginx/sites-available/stake37
  ln -sf /etc/nginx/sites-available/stake37 /etc/nginx/sites-enabled/stake37
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t
  systemctl reload nginx
fi

echo ""
echo "✓ App: http://127.0.0.1:3000"
echo "✓ Próximo: DNS A @ e www → $(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "✓ Depois do DNS: certbot --nginx -d stake37.com.br -d www.stake37.com.br"
echo "✓ Admin: $(grep '^SEED_ADMIN_EMAIL=' .env | cut -d= -f2-)"
