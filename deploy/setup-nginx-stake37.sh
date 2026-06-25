#!/usr/bin/env bash
# Configura Nginx + SSL para stake37.com.br (executar na VPS com sudo).
# Pré-requisito: DNS A de stake37.com.br e www → IP desta VPS.
set -euo pipefail

DOMAIN="stake37.com.br"
WWW="www.stake37.com.br"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Copiar config Nginx"
cp "$ROOT/deploy/nginx-stake37.conf" "/etc/nginx/sites-available/stake37"
ln -sf "/etc/nginx/sites-available/stake37" "/etc/nginx/sites-enabled/stake37"

echo "→ Testar Nginx"
nginx -t
systemctl reload nginx

echo "→ Certificado SSL (Let's Encrypt)"
if command -v certbot >/dev/null 2>&1; then
  certbot --nginx -d "$DOMAIN" -d "$WWW" --non-interactive --agree-tos -m "admin@${DOMAIN}" || \
    certbot --nginx -d "$DOMAIN" -d "$WWW"
else
  echo "certbot não instalado — corra: apt install certbot python3-certbot-nginx"
  exit 1
fi

echo "✓ Nginx + SSL configurados para https://${DOMAIN}"
