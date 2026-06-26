#!/usr/bin/env bash
# Apache — stake37.com.br → singlestake (PM2 :3000)
# VPS partilhada: NÃO para outros sites; só adiciona VirtualHost stake37.
set -euo pipefail

DOMAIN="stake37.com.br"
WWW="www.stake37.com.br"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF_SRC="$ROOT/deploy/apache-stake37.conf.example"

if [[ ! -f "$CONF_SRC" ]]; then
  echo "Erro: $CONF_SRC não encontrado. Corra a partir de /var/www/stake37 após git pull."
  exit 1
fi

# Detectar Apache (CentOS=httpd, Debian=apache2)
if systemctl list-unit-files httpd.service &>/dev/null && [[ -d /etc/httpd ]]; then
  APACHE_FLAVOR="httpd"
  CONF_DEST="/etc/httpd/conf.d/stake37.conf"
  LOG_DIR="/var/log/httpd"
  TEST_CMD="httpd -t"
  SVC="httpd"
elif systemctl list-unit-files apache2.service &>/dev/null && [[ -d /etc/apache2 ]]; then
  APACHE_FLAVOR="apache2"
  CONF_DEST="/etc/apache2/sites-available/stake37.conf"
  LOG_DIR="/var/log/apache2"
  TEST_CMD="apache2ctl configtest"
  SVC="apache2"
else
  echo "Erro: Apache (httpd/apache2) não encontrado."
  exit 1
fi

echo "→ Apache detectado: $APACHE_FLAVOR ($SVC)"

if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "→ A parar Nginx (Apache já usa 80/443; outros sites ficam no httpd)"
  systemctl stop nginx || true
  systemctl disable nginx || true
fi

echo "→ Copiar VirtualHost stake37"
cp "$CONF_SRC" "$CONF_DEST"
sed -i "s|\${APACHE_LOG_DIR}|${LOG_DIR}|g" "$CONF_DEST"

if [[ "$APACHE_FLAVOR" == "apache2" ]]; then
  a2enmod proxy proxy_http headers ssl rewrite 2>/dev/null || true
  a2ensite stake37.conf 2>/dev/null || ln -sf "$CONF_DEST" /etc/apache2/sites-enabled/stake37.conf
fi

echo "→ Testar configuração"
$TEST_CMD

echo "→ Reiniciar $SVC (reload não disponível em httpd CentOS)"
if systemctl try-reload-or-restart "$SVC" 2>/dev/null; then
  :
else
  systemctl restart "$SVC"
fi

echo "→ Teste local (Host: stake37.com.br)"
if curl -sf -H "Host: $DOMAIN" "http://127.0.0.1/entrar" | grep -qi singlestake; then
  echo "✓ Proxy HTTP OK"
else
  echo "⚠ Proxy ainda não responde singlestake — confirme: pm2 status && curl -s http://127.0.0.1:3000/entrar | head"
fi

echo "→ SSL (Let's Encrypt)"
if certbot plugins 2>/dev/null | grep -q apache; then
  certbot --apache -d "$DOMAIN" -d "$WWW" --non-interactive --agree-tos -m "admin@${DOMAIN}" || \
    certbot --apache -d "$DOMAIN" -d "$WWW"
elif [[ "$APACHE_FLAVOR" == "httpd" ]]; then
  echo "Plugin certbot-apache em falta. Instale e volte a correr certbot:"
  echo "  dnf install -y certbot python3-certbot-apache   # ou: yum install ..."
  echo "  certbot --apache -d $DOMAIN -d $WWW"
else
  echo "  apt install -y certbot python3-certbot-apache"
  echo "  certbot --apache -d $DOMAIN -d $WWW"
fi

echo "✓ VirtualHost stake37 instalado. Outros domínios no $SVC não foram alterados."
