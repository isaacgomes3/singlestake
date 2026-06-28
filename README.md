# singlestake

## Desenvolvimento local (sandbox de teste)

Guia completo: **[docs/ambiente-local.md](docs/ambiente-local.md)**

### Arranque rápido

```powershell
cd caminho\para\singlestake
npm install
npm run dev:local
```

**Windows — erro "execução de scripts desabilitada"?** Use `npm.cmd install` e `npm.cmd run dev:local`, ou execute `scripts\dev-local.cmd` no CMD. Ver [docs/ambiente-local.md](docs/ambiente-local.md).

Ou no PowerShell:

```powershell
.\scripts\dev-local.ps1
```

Isto cria o **sandbox isolado** em `data/local/` (BD + automação), aplica migrations, seed e abre **http://localhost:5173/**.

**Credenciais demo** (após `setup:local`):

| Campo | Valor |
|-------|--------|
| E-mail | `admin@singlestake.local` |
| Senha | `123456` |
| Back-office | http://localhost:5173/back-office |
| Automação global | http://localhost:5173/back-office/financeiro/automacao-global |

### Comandos do sandbox

```powershell
npm run setup:local          # preparar sandbox (sem servidor)
npm run dev                  # só servidor (sandbox já preparado)
npm run reset:local          # apagar e recriar sandbox do zero
npm run check:local          # verificar se está pronto
npm run seed:local-automation # repor automação R$ 50.000
npm run test:local           # build + preview (teste pré-deploy)
npm run db:studio            # explorar SQLite
```

**Fluxo:** desenvolver local → `test:local` → um merge em `main` → deploy automático na VPS.

### Variáveis de ambiente

| Ficheiro | Uso |
|----------|-----|
| `.env.development.local.example` | Modelo do sandbox (versionado) |
| `.env.development.local` | Sandbox activo (criado pelo setup, não versionado) |
| `.env.development` | Defaults de dev (versionado) |
| `.env.example` | Referência completa (WebSocket roleta, embeds casino, etc.) |

1. Instalar dependências: `npm install`
2. (Opcional) Copiar variáveis de ambiente: copie `.env.example` para `.env` e ajuste se precisar do WebSocket da roleta ao vivo.
3. Subir o servidor: `npm run dev` ou `npm run dev:local`
4. Abrir no navegador a URL que o Vite imprimir no terminal (por padrão **http://localhost:5173/**).

### Imagem de fundo (roleta)

Coloca o teu ficheiro em **`public/images/roulette-bg.png`**. Todas as rotas usam um fundo escuro com essa imagem (`cover`, fixo ao scroll) e uma vinheta para o texto continuar legível. Sem o ficheiro, vês só o degradê.

No **Windows**, o Vite está com **polling** de ficheiros para o recarregamento ao editar código funcionar de forma fiável. Se mudares `vite.config.ts`, volta a correr `npm run dev`.

### Deploy na VPS — stake37.com.br

Ver **[docs/deploy-stake37.md](docs/deploy-stake37.md)** — domínio **https://stake37.com.br**, Node 22, PM2, Nginx, SSL e SQLite.

Resumo na VPS: clonar em `/var/www/stake37`, `cp deploy/env.production.example .env`, depois `FIRST_DEPLOY=1 ./deploy/deploy.sh`.

Guia genérico: **[docs/deploy-vps.md](docs/deploy-vps.md)**.

Deploy legado (roleta.poupexplay.com): **[docs/deploy-roleta-poupexplay.md](docs/deploy-roleta-poupexplay.md)**.

No **PowerShell** antigo, encadeie com ponto e vírgula, não com `&&`:

```powershell
Set-Location caminho\para\game-odds-glow; npm run dev
```

### Streamlit (calculadora em Python)

Na raiz do repositório:

```powershell
streamlit run streamlit_app.py
```

Em geral fica em **http://localhost:8501/**.

### Documentação das estratégias (implementação noutro sistema)

Ver **[docs/estrategias-roleta.md](docs/estrategias-roleta.md)** — espelho, Ruas 9%/20%, Números 2,8%, placares e constantes.

Alterações recentes só ao nível de regras/documentação: **[docs/atualizacao-estrategias.md](docs/atualizacao-estrategias.md)**.

### Roulette Macao (DGA / lobby)

Ver **[docs/roulette-macao-dga.md](docs/roulette-macao-dga.md)** — chave da mesa, `npm run dga:verify-macao`, `npm run dga:inspect-table-names`.
