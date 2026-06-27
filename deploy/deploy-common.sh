#!/usr/bin/env bash
# PATH do npm global (pm2) + rebuild de módulos nativos após mudança de versão Node.
setup_deploy_path() {
  export PATH="$(npm prefix -g 2>/dev/null)/bin:${PATH:-}"
  # aaPanel / NVM comuns
  for dir in \
    /usr/local/bin \
    /usr/bin \
    "$HOME/.nvm/current/bin" \
    /www/server/nvm/versions/node/*/bin; do
    if [[ -d "$dir" ]]; then
      export PATH="${dir}:${PATH}"
    fi
  done
}

ensure_node() {
  setup_deploy_path
  if command -v node >/dev/null 2>&1; then
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
