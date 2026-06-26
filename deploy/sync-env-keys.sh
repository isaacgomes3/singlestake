#!/usr/bin/env bash
# Adiciona ao .env chaves em falta a partir de deploy/env.production.example
# (não sobrescreve valores existentes — só preenche o que falta).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="$ROOT/deploy/env.production.example"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$EXAMPLE" ]]; then
  echo "sync-env: exemplo não encontrado"
  exit 0
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "sync-env: a criar .env a partir do exemplo"
  cp "$EXAMPLE" "$ENV_FILE"
  echo "⚠ Edite SESSION_SECRET e SEED_ADMIN_PASSWORD em .env"
  exit 0
fi

added=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  [[ "$line" != *"="* ]] && continue

  key="${line%%=*}"
  key="${key// /}"

  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "$line" >> "$ENV_FILE"
    echo "sync-env: + $key"
    added=$((added + 1))
  fi
done < "$EXAMPLE"

if [[ "$added" -eq 0 ]]; then
  echo "sync-env: .env já tem todas as chaves do exemplo"
else
  echo "sync-env: $added chave(s) adicionada(s)"
fi
