# Deploy na VPS — Singlestake / stake37.com.br

**Produção actual:** [docs/deploy-stake37.md](deploy-stake37.md) (`stake37.com.br`).

Stack: **Node 22** + **PM2** + **Nginx** (ou Apache) + **SQLite** (ou PostgreSQL).

## 1. Preparar o VPS (uma vez)

```bash
sudo bash deploy/vps-setup.sh
```

Instala: `git`, `nginx`, `certbot`, Node 22, PM2.

## 2. Clonar o projeto

```bash
sudo mkdir -p /var/www/singlestake
sudo chown $USER:$USER /var/www/singlestake
cd /var/www/singlestake
git clone https://github.com/isaacgomes3/singlestake.git .
```

## 3. Variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Mínimo em produção:

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

# Roleta ao vivo (Pragmatic DGA)
ROULETTE_WS_URL=wss://dga.pragmaticplaylive.net/ws
ROULETTE_CASINO_ID=ppcdk00000005148
ROULETTE_TABLE_IDS=234,227,203,230,201,206,237,213
ROULETTE_CURRENCY=BRL

# Base de dados (caminho absoluto na VPS)
DATABASE_URL=/var/www/singlestake/data/singlestake.db
SESSION_SECRET=gerar-string-longa-aleatoria-aqui

# URLs do operador (iframe mesas) — JSON
# VITE_CASINO_TABLE_EMBED_URLS={"227":"https://br4.bet.br/play/pragmatic/roulette-1",...}
```

> As variáveis `VITE_*` são lidas no **build**. Depois de alterar `.env`, corra `npm run build` de novo.

## 4. Primeiro deploy

```bash
npm ci
FIRST_DEPLOY=1 ./deploy/deploy.sh
pm2 startup    # copiar e executar o comando que o PM2 imprimir
pm2 save
```

## 5. Nginx + SSL

```bash
sudo cp deploy/nginx-singlestake.conf.example /etc/nginx/sites-available/singlestake
sudo nano /etc/nginx/sites-available/singlestake   # trocar SEU_DOMINIO
sudo ln -sf /etc/nginx/sites-available/singlestake /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d singlestake.bet.br -d www.singlestake.bet.br
```

DNS: registo **A** do domínio → IP da VPS.

## 6. Atualizações (cada release)

No PC:

```powershell
git push origin main
```

Na VPS:

```bash
cd /var/www/singlestake
./deploy/deploy.sh
```

## 7. Verificar

```bash
curl -sI http://127.0.0.1:3000/
curl -sI https://SEU_DOMINIO/
pm2 logs singlestake --lines 50
```

## Ficheiros

| Ficheiro | Função |
|----------|--------|
| `deploy/vps-setup.sh` | Setup inicial do servidor |
| `deploy/deploy.sh` | Pull + build + DB + PM2 reload |
| `deploy/ecosystem.config.cjs` | Config PM2 (`singlestake`) |
| `deploy/nginx-singlestake.conf.example` | Reverse proxy + SSE |
| `deploy/apache-roleta.conf.example` | Alternativa Apache |

## Extensão Chrome

A extensão corre no browser do utilizador — não vai para a VPS. Os utilizadores instalam a pasta `extension/` (ou cópia do Desktop) e abrem o site em **HTTPS**.

## Apache (alternativa)

Ver `deploy/apache-roleta.conf.example` — adaptar `ServerName` e porta `3000`.
