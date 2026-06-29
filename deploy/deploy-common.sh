#!/usr/bin/env bash
# PATH do npm global (pm2) + rebuild de módulos nativos após mudança de versão Node.
setup_deploy_path() {
  local npm_global
  npm_global="$(npm prefix -g 2>/dev/null)/bin"
  # NodeSource (/usr/bin) antes do aaPanel — evita Node 20.11 antigo no build (Vite 7).
  if [[ -x /usr/bin/node ]]; then
    export PATH="/usr/local/bin:/usr/bin:${npm_global}:${PATH:-}"
  else
    export PATH="${npm_global}:${PATH:-}"
    for dir in \
      /usr/local/bin \
      /usr/bin \
      "$HOME/.nvm/current/bin" \
      /www/server/nvm/versions/node/*/bin; do
      if [[ -d "$dir" ]]; then
        export PATH="${dir}:${PATH}"
      fi
    done
  fi
}

warn_if_node_too_old() {
  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi
  local ver major minor
  ver="$(node -v 2>/dev/null | sed 's/^v//')"
  major="${ver%%.*}"
  minor="${ver#*.}"
  minor="${minor%%.*}"
  if [[ "$major" -lt 20 ]] || { [[ "$major" -eq 20 ]] && [[ "$minor" -lt 18 ]]; }; then
    echo "✗ Node $(node -v) é antigo demais — Vite 7 exige >= 20.18 ou >= 22.12"
    echo "  which node: $(command -v node)"
    echo "  export PATH=\"/usr/bin:/usr/local/bin:\$(npm prefix -g)/bin:\$PATH\""
    return 1
  fi
  echo "→ Node $(node -v) ($(command -v node))"
  return 0
}

# HTML local sem gzip — evita "grep: binary file matches" no curl.
fetch_local_page_html() {
  local path="${1:-/entrar}"
  curl -sf --max-time 30 -H "Accept-Encoding: identity" "http://127.0.0.1:3000${path}" 2>/dev/null || true
}

extract_asset_href() {
  local html="$1"
  local pattern="$2"
  printf '%s' "$html" | grep -aoE "$pattern" 2>/dev/null | head -1 || true
}

ensure_node() {
  setup_deploy_path
  if command -v node >/dev/null 2>&1; then
    warn_if_node_too_old || exit 1
    return 0
  fi
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$HOME/.nvm/nvm.sh"
  fi
  if command -v node >/dev/null 2>&1; then
    return 0
  fi
  echo "✗ Node.js não encontrado — instale Node 22 (bash deploy/vps-setup.sh)"
  exit 1
}

ensure_pm2() {
  ensure_node
  setup_deploy_path
  if command -v pm2 >/dev/null 2>&1; then
    return 0
  fi
  echo "→ instalar PM2 global"
  npm install -g pm2
  setup_deploy_path
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "✗ pm2 não encontrado após npm install -g — tente: export PATH=\"\$(npm prefix -g)/bin:\$PATH\""
    exit 1
  fi
}

rebuild_native_modules() {
  echo "→ rebuild módulos nativos (Node $(node -v 2>/dev/null || echo '?'))"
  if ! npm rebuild better-sqlite3; then
    echo "→ npm rebuild completo"
    npm rebuild
  fi
}
