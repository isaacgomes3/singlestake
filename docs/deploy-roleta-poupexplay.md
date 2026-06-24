# Deploy em roleta.poupexplay.com (sem Lovable)

O projeto deixou de depender da **Lovable** para build e publicação. O deploy é feito no **seu servidor** com Node.js + PM2, com Apache (ou Nginx) como reverse proxy.

## Resumo

| Antes (Lovable) | Agora (self-host) |
|-----------------|-------------------|
| Push GitHub + Publish na Lovable | Push GitHub + `deploy/deploy.sh` no servidor |
| Build Cloudflare (Lovable) | `npm run build` → `.output/server/index.mjs` |
| Domínio aponta para Lovable | Apache proxy → `127.0.0.1:3000` |

## 1. Desligar a Lovable do domínio

1. No painel Lovable: desactivar / remover o domínio personalizado `roleta.poupexplay.com` (para o tráfego deixar de ir para a Lovable).
2. No DNS / Apache do servidor **poupexplay**: o virtual host de `roleta.poupexplay.com` deve fazer proxy para o Node local (ver `deploy/apache-roleta.conf.example`).

## 2. Preparar o servidor (uma vez)

Requisitos: **Node 20+**, **git**, **PM2** (`npm i -g pm2`).

```bash
cd /var/www/game-odds-glow   # ou outro caminho
git clone https://github.com/isaacgomes3/game-odds-glow.git .
cp .env.example .env
# Editar .env: ROULETTE_WS_URL, ROULETTE_CASINO_ID, ROULETTE_TABLE_IDS, etc.
npm ci
npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # seguir instruções para arranque automático
```

Apache: copiar `deploy/apache-roleta.conf.example`, activar o site, `apachectl configtest`, reiniciar Apache.

## 3. Publicar alterações (cada atualização)

No servidor:

```bash
./deploy/deploy.sh
```

Ou manualmente:

```bash
git pull origin main
npm ci
npm run build
pm2 reload deploy/ecosystem.config.cjs
```

No PC (só enviar código):

```powershell
git push origin main
```

Depois correr `deploy.sh` no servidor.

## 4. Variáveis de ambiente

Ficheiro `.env` na raiz do projeto (não commitar). Ver `.env.example`:

- `ROULETTE_WS_URL`, `ROULETTE_CASINO_ID`, `ROULETTE_TABLE_IDS` — stream ao vivo
- `PORT` — porta do Node (por defeito `3000` no PM2)
- `ROULETTE_STRATEGY_GLOBAL_PATH` — histórico global no disco (opcional)

## 5. Verificar

```bash
curl -sI http://127.0.0.1:3000/mobile
curl -sI https://roleta.poupexplay.com/mobile
```

Sucesso: HTTP 200 (não 404). O lobby **não** deve mostrar «Ganhos nas entradas» nos cartões das mesas.

## 6. Desenvolvimento local

Inalterado:

```powershell
npm run dev
```

Build de produção local:

```powershell
npm run build
$env:PORT="3456"; npm start
```

## Ficheiros de deploy

- `vite.config.ts` — TanStack Start + Nitro (`node-server`), sem `@lovable.dev/vite-tanstack-config`
- `deploy/ecosystem.config.cjs` — PM2
- `deploy/apache-roleta.conf.example` — reverse proxy + SSE
- `deploy/deploy.sh` — script de actualização no servidor
