# Football Studio hub (24h)

Backend independente da UI:

1. **Bridge** (poll ~2s) → cores Casa/Visitante/Empate sempre
2. **Ingest POST** → cartas + naipes (alimentador Playwright ou extensão Obs)

## APIs

| Método | Rota | Uso |
|--------|------|-----|
| GET | `/api/evolution/football-studio` | Snapshot JSON |
| GET | `/api/evolution/football-studio/stream` | SSE |
| POST | `/api/evolution/football-studio-cards` | Cartas/naipes (feeder ou Obs) |

## Env

```
BRBET_API_KEY=…
BRBET_FS_CHANNEL=evolution.football-studio
FOOTBALL_STUDIO_INGEST_TOKEN=…   # opcional
```

## Cartas 24h — alimentador independente (recomendado)

Não precisa de Chrome com extensão. Um Chromium Playwright abre a mesa, captura o WS Evolution e faz POST no hub.

```bash
# uma vez
npm run feeder:football-studio:install

# hub a correr (npm run dev) + feeder
npm run feeder:football-studio
```

Na 1ª execução a janela abre — faz login na casa e entra na mesa. O perfil fica em `data/football-studio/feeder-profile/` (sessão reutilizada).

| Env / flag | Default |
|------------|---------|
| `FS_FEEDER_URL` / `--url` | Ice Top Card |
| `FS_FEEDER_HUB` / `--hub` | `http://127.0.0.1:5173` |
| `FS_FEEDER_TOKEN` / `--token` | `FOOTBALL_STUDIO_INGEST_TOKEN` |
| `FS_FEEDER_PROFILE` / `--profile` | `./data/football-studio/feeder-profile` |
| `FS_FEEDER_HEADLESS=1` / `--headless 1` | off (login manual) |

Exemplos:

```bash
npm run feeder:football-studio -- --url https://ice.bet.br/games/tag/slots/topcard-evolution
npm run feeder:football-studio -- --url https://kto.bet.br/…   # se tiveres URL Top Card KTO
```

### Alternativa: DinhuTech (sem login na casa)

O DinhuTech já mantém worker Evolution 24h e publica o estado (cartas + letras C/V/E):

```bash
# hub a correr + feeder DinhuTech (mesa 48694)
npm run feeder:football-studio:dinhutech
npm run feeder:football-studio:dinhutech -- --id 48694
```

| Env / flag | Default |
|------------|---------|
| `DINHUTECH_FS_ID` / `--id` | `48694` |
| `DINHUTECH_FS_API` / `--api` | `https://api.dinhutech.com.br` |
| `FS_FEEDER_HUB` / `--hub` | `http://127.0.0.1:5173` |
| `DINHUTECH_POLL_MS` / `--poll` | `1500` |
| `DINHUTECH_AUTH` / `--auth` | opcional (Cookie/Bearer) |

Letras gravadas em `data/football-studio/dinhutech-letters.txt` (`C`=Casa, `V`=Visitante, `E`=Empate).

Alternativa: extensão Obs com a mesa aberta (POST automático para o mesmo endpoint).

A Bridge **não** envia naipe — só cores. Cartas/naipes vêm só do feeder ou da Obs.

### Fonte única (anti-oscilação)

Por defeito o hub **não** liga a Bridge e **só aceita** ingest `source: "dinhutech"`:

```
FOOTBALL_STUDIO_BRIDGE=0          # default — Bridge desligada
FOOTBALL_STUDIO_CARDS_SOURCE=dinhutech   # default — rejeita Obs/WS
```

Para voltar a misturar: `FOOTBALL_STUDIO_BRIDGE=1` e `FOOTBALL_STUDIO_CARDS_SOURCE=any`.

Estado persistido em `data/football-studio/hub-state.json`.

## Painel web

Com o app a correr (`npm run dev`) e sessão iniciada:

**http://127.0.0.1:5173/football-studio**

Também há um cartão no lobby do back-office (`/back-office`).
