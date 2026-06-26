#!/usr/bin/env bash
# Insere snippet de estáticos no vhost Apache existente (preserva SSL e resto).
# Uso: bash deploy/patch-apache-static.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF="${AAPANEL_CONF:-/www/server/panel/vhost/apache/stake37.com.br.conf}"
HTTPD="${HTTPD:-/www/server/apache/bin/httpd}"
SNIPPET="$ROOT/deploy/apache-static-snippet.conf"

if [[ ! -f "$CONF" ]]; then
  echo "⚠ vhost não encontrado: $CONF"
  exit 0
fi

if grep -q 'ProxyPass /assets !' "$CONF" 2>/dev/null; then
  echo "→ Apache: estáticos já configurados"
  exit 0
fi

if [[ ! -f "$SNIPPET" ]]; then
  echo "✗ Snippet em falta: $SNIPPET"
  exit 1
fi

cp "$CONF" "${CONF}.bak.$(date +%Y%m%d%H%M%S)"
echo "→ Apache: a inserir estáticos em $CONF"

awk -v snippet="$SNIPPET" '
  /^[[:space:]]*ProxyPass \/ http:\/\/127\.0\.0\.1:3000/ {
    while ((getline line < snippet) > 0) print line
    close(snippet)
  }
  { print }
' "$CONF" > "${CONF}.new"
mv "${CONF}.new" "$CONF"

if [[ -x "$HTTPD" ]]; then
  if "$HTTPD" -t 2>&1; then
    /etc/init.d/httpd reload
    echo "✓ Apache reload OK (estáticos activos)"
  else
    echo "✗ httpd -t falhou — restaure o backup em ${CONF}.bak.*"
    exit 1
  fi
else
  echo "⚠ Reinicie Apache manualmente"
fi
