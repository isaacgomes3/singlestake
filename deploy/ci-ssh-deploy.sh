#!/usr/bin/env bash
# Executado no GitHub Actions — SSH à VPS, deploy e diagnóstico em caso de falha.
set -euo pipefail

LOG="${GITHUB_WORKSPACE:-$(pwd)}/vps-deploy.log"
: >"$LOG"

log() {
  echo "$@" | tee -a "$LOG"
}

annotate_error() {
  echo "::error::$1"
  log "ERRO: $1"
}

if [ -z "${VPS_HOST:-}" ] || [ -z "${VPS_USER:-}" ]; then
  annotate_error "Defina VPS_HOST e VPS_USER nos secrets do repositório."
  exit 1
fi

install -m 700 -d ~/.ssh
if [ -n "${SSH_KEY_B64:-}" ]; then
  echo "$SSH_KEY_B64" | base64 -d > ~/.ssh/vps_deploy_key
elif [ -n "${SSH_KEY:-}" ]; then
  printf '%s' "$SSH_KEY" > ~/.ssh/vps_deploy_key
  printf '\n' >> ~/.ssh/vps_deploy_key
else
  annotate_error "Defina VPS_SSH_KEY_B64 (recomendado) ou VPS_SSH_KEY."
  exit 1
fi
chmod 600 ~/.ssh/vps_deploy_key

if ! ssh-keygen -y -f ~/.ssh/vps_deploy_key >/dev/null 2>&1; then
  annotate_error "Chave SSH inválida. Na VPS: base64 -w0 /root/.ssh/github-deploy-stake37"
  exit 1
fi

SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=30
  -o ConnectTimeout=120
  -i ~/.ssh/vps_deploy_key
)

ssh_run() {
  ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" "$@" 2>&1 | tee -a "$LOG"
}

REMOTE_PREP='APP_DIR=/var/www/stake37; [ -d "$APP_DIR" ] || APP_DIR=/var/www/singlestake; cd "$APP_DIR"'

log "=== Chave SSH válida — alvo ${VPS_USER}@${VPS_HOST} ==="
log "=== Pré-voo SSH ==="
if ! ssh_run "${REMOTE_PREP} && echo OK && hostname && uptime && df -h / | tail -1 && free -m | head -2"; then
  annotate_error "Falha na ligação SSH ou pré-voo na VPS."
  exit 1
fi

log ""
log "=== Deploy remoto (commit ${GITHUB_SHA:-?}) ==="
REMOTE_DEPLOY="${REMOTE_PREP} && \
  git fetch origin main && \
  git reset --hard origin/main && \
  echo \"=== HEAD: \$(git rev-parse --short HEAD) \$(git log -1 --pretty=%s) ===\" && \
  GITHUB_ACTIONS=true DEPLOY_TRACE=1 PUBLIC_APP_URL=https://stake37.com.br bash deploy/github-actions-remote.sh"

DEPLOY_OK=0
if ssh_run "$REMOTE_DEPLOY"; then
  log "=== Deploy concluído com sucesso ==="
  exit 0
fi
DEPLOY_OK=1

annotate_error "Deploy na VPS falhou — a recolher diagnóstico remoto (ver log e artefacto vps-deploy.log)."
log ""
log "=== Diagnóstico remoto ==="
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
  "${REMOTE_PREP} && PUBLIC_APP_URL=https://stake37.com.br bash deploy/github-actions-failure-diagnostics.sh" \
  2>&1 | tee -a "$LOG" || true

exit "${DEPLOY_OK}"
