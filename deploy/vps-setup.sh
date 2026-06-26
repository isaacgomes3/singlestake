#!/usr/bin/env bash
# Configuração inicial do VPS (Ubuntu/Debian) — executar UMA vez como root ou com sudo.
# Uso: sudo bash deploy/vps-setup.sh
set -euo pipefail

echo "→ Pacotes base"
apt-get update
apt-get install -y curl git nginx certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1; then
  echo "→ Node.js 22 (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "→ PM2"
  npm install -g pm2
fi

APP_DIR="${APP_DIR:-/var/www/stake37}"
mkdir -p "$APP_DIR"
chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$APP_DIR" 2>/dev/null || true

echo ""
echo "Próximos passos (como utilizador da app, não root):"
echo "  cd $APP_DIR"
echo "  git clone https://github.com/isaacgomes3/singlestake.git ."
echo "  cp deploy/env.production.example .env   # editar SESSION_SECRET, senha admin"
echo "  npm ci && npm run build"
echo "  FIRST_DEPLOY=1 ./deploy/deploy.sh"
echo "  pm2 startup   # seguir instrução do PM2"
echo ""
echo "Nginx: sudo bash deploy/setup-nginx-stake37.sh"
echo "  (ou copiar deploy/nginx-stake37.conf → /etc/nginx/sites-available/stake37)"
