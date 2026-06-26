# Deploy na VPS — stake37.com.br

Stack: **Node 22** + **PM2** + **Apache ou Nginx** + **SQLite**.

> **VPS com vários sistemas:** se `httpd` (Apache) já serve POUPEX/outros sites, **não desactive o Apache**. Use a secção [VPS partilhada (Apache)](#vps-partilhada-apache--outros-sistemas) abaixo.

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

**Só use Nginx se a VPS NÃO tiver Apache na porta 80/443.**

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

## 5b. VPS partilhada (Apache + outros sistemas)

Quando `ss -tlnp | grep ':80'` mostra **`httpd`**, o Apache já serve os outros sites. **Não pare nem desactive o Apache.**

1. **Desactive só o Nginx** (opcional, evita confusão):

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

2. **VirtualHost novo só para stake37** (os outros domínios ficam intactos):

```bash
cd /var/www/stake37
git pull   # traz deploy/apache-stake37.conf.example e setup-apache-stake37.sh
sudo bash deploy/setup-apache-stake37.sh
```

CentOS (`httpd`): o script usa `httpd -t` e `systemctl restart httpd` (não `apachectl` / `reload`).

3. **SSL só para stake37** (se o script avisar que falta o plugin):

```bash
sudo dnf install -y certbot python3-certbot-apache   # ou: yum install ...
sudo certbot --apache -d stake37.com.br -d www.stake37.com.br
```

4. **App Node na porta 3000**:

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

5. **Teste** (deve mostrar singlestake, não POUPEX):

```bash
curl -s -H "Host: stake37.com.br" http://127.0.0.1/entrar | grep -i singlestake | head -1
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
| `deploy/apache-stake37.conf.example` | VirtualHost Apache (VPS partilhada) |
| `deploy/env.production.example` | `.env` de produção |
