# Deploy na VPS — stake37.com.br

Stack: **Node 22** + **PM2** + **Nginx** + **SQLite**.

## DNS (antes de tudo)

No painel do domínio **stake37.com.br**:

| Tipo | Nome | Valor |
|------|------|--------|
| A | `@` | IP da VPS |
| A | `www` | IP da VPS |

Aguarde a propagação (minutos a algumas horas).

## 1. Preparar o VPS (uma vez)

```bash
sudo bash deploy/vps-setup.sh
```

## 2. Clonar o projeto

```bash
sudo mkdir -p /var/www/stake37
sudo chown $USER:$USER /var/www/stake37
cd /var/www/stake37
git clone https://github.com/isaacgomes3/singlestake.git .
```

## 3. Variáveis de ambiente

```bash
cp deploy/env.production.example .env
nano .env
```

Obrigatório alterar:

- `SESSION_SECRET` — `openssl rand -hex 32`
- `SEED_ADMIN_PASSWORD` — senha forte do admin
- `DATABASE_URL` — manter `/var/www/stake37/data/singlestake.db`

## 4. Primeiro deploy

```bash
mkdir -p data
npm ci
FIRST_DEPLOY=1 ./deploy/deploy.sh
pm2 startup    # copiar e executar o comando que o PM2 imprimir
pm2 save
```

## 5. Nginx + HTTPS

```bash
sudo bash deploy/setup-nginx-stake37.sh
```

Ou manualmente:

```bash
sudo cp deploy/nginx-stake37.conf /etc/nginx/sites-available/stake37
sudo ln -sf /etc/nginx/sites-available/stake37 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d stake37.com.br -d www.stake37.com.br
```

## 6. Verificar

```bash
curl -sI http://127.0.0.1:3000/
curl -sI https://stake37.com.br/
pm2 logs singlestake --lines 50
```

Abrir no browser:

- https://stake37.com.br/back-office
- Login admin: email definido em `SEED_ADMIN_EMAIL` (por defeito `admin@stake37.com.br`)

## 7. Atualizações (cada release)

No PC (após push para `main`):

```powershell
git push origin main
```

Na VPS:

```bash
cd /var/www/stake37
./deploy/deploy.sh
```

## Extensão Chrome

A extensão em `extension/` já aceita **stake37.com.br**. Reinstale ou recarregue a extensão após actualizar.

## Ficheiros

| Ficheiro | Função |
|----------|--------|
| `deploy/vps-setup.sh` | Node, PM2, Nginx, Certbot |
| `deploy/deploy.sh` | Pull + build + DB + PM2 |
| `deploy/nginx-stake37.conf` | Reverse proxy stake37.com.br |
| `deploy/setup-nginx-stake37.sh` | Nginx + SSL automático |
| `deploy/env.production.example` | `.env` de produção |
