#!/usr/bin/env bash
# Insere snippet de estáticos no vhost Apache existente (preserva SSL e resto).
# Uso: bash deploy/patch-apache-static.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTTPD="${HTTPD:-/www/server/apache/bin/httpd}"
SNIPPET="$ROOT/deploy/apache-static-snippet.conf"

find_vhost() {
  if [[ -n "${AAPANEL_CONF:-}" && -f "${AAPANEL_CONF}" ]]; then
    echo "${AAPANEL_CONF}"
    return 0
  fi
  local candidates=(
    "/www/server/panel/vhost/apache/stake37.com.br.conf"
    "/www/server/panel/vhost/apache/www.stake37.com.br.conf"
    "/etc/apache2/sites-available/stake37.com.br.conf"
    "/etc/httpd/conf.d/stake37.com.br.conf"
  )
  local p
  for p in "${candidates[@]}"; do
    if [[ -f "$p" ]]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

CONF="$(find_vhost || true)"
if [[ -z "$CONF" ]]; then
  echo "⚠ vhost Apache não encontrado — Node serve estáticos via server.ts"
  exit 0
fi

if grep -q 'ProxyPass /assets !' "$CONF" 2>/dev/null; then
  echo "→ Apache: estáticos já configurados ($CONF)"
  exit 0
fi

if [[ ! -f "$SNIPPET" ]]; then
  echo "✗ Snippet em falta: $SNIPPET"
  exit 1
fi

cp "$CONF" "${CONF}.bak.$(date +%Y%m%d%H%M%S)"
echo "→ Apache: a inserir estáticos em $CONF"

awk -v snippet="$SNIPPET" '
  /^[[:space:]]*ProxyPass[[:space:]]+\/[[:space:]]+http:\/\/127\.0\.0\.1:3000/ {
    while ((getline line < snippet) > 0) print line
    close(snippet)
  }
  { print }
' "$CONF" > "${CONF}.new"
mv "${CONF}.new" "$CONF"

if [[ -x "$HTTPD" ]]; then
  if "$HTTPD" -t 2>&1; then
    /etc/init.d/httpd reload 2>/dev/null || systemctl reload httpd 2>/dev/null || systemctl reload apache2 2>/dev/null || true
    echo "✓ Apache reload OK (estáticos activos)"
  else
    echo "✗ httpd -t falhou — restaure o backup em ${CONF}.bak.*"
    exit 1
  fi
else
  echo "⚠ Reinicie Apache manualmente"
fi
