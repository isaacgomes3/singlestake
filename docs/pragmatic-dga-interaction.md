# Pragmatic — leitura DGA + link directo + extensão

Pipeline **sem lobby** (não precisa de scanner Playtech nem `.prime`):

```
┌─────────────────┐     SSE / WS DGA      ┌──────────────────────┐
│  API Pragmatic  │ ───────────────────►  │  Motor Um Fator      │
│  (giros ao vivo)│                       │  (sala rotativa)     │
└─────────────────┘                       └──────────┬───────────┘
                                                     │ sinal
                                                     ▼
┌─────────────────┐     mesaEmbedUrl        ┌──────────────────────┐
│  Link directo   │ ◄────────────────────── │  Sala rotativa       │
│  /play/pragmatic│   (iframe ou nova aba)  │  Modo sinal / iframe │
└────────┬────────┘                       └──────────┬───────────┘
         │                                            │ postMessage
         ▼                                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Extensão Chrome — Demo (destaca) ou Real (clica)           │
└─────────────────────────────────────────────────────────────┘
```

## O que cada camada faz

| Camada | Já existe | Função |
|--------|-----------|--------|
| **DGA** | `LiveRouletteSseBridge`, `useRotatingRoomHistories` | Números **sem** varrer lobby |
| **Estratégia** | `useRotatingRoomUmFatorSession` | Gatilho, gale, rodízio |
| **Mesa directa** | `getCasinoEmbedUrlForTable`, iframe / `window.open` | Entra na roleta pelo **link guardado** |
| **Interacção** | Extensão v1.0 + `RotatingRoomExtensionStrip` | Só cliques Demo/Real |

## Uso prático

1. `.env` com `ROULETTE_WS_URL` + mesas DGA
2. `npm run dev` → `/sala-rotativa-um-fator`
3. Configurar URL Pragmatic por mesa (`/casino-mesa` ou `VITE_CASINO_TABLE_EMBED_URLS`)
4. **Modo sinal** ou **Iframe activo** — painel de indicação
5. Abrir mesa: iframe embutido **ou** link directo numa aba (`/play/pragmatic/...`)
6. Extensão instalada → barra **Extensão · Activo** → Demo primeiro, depois Real

## vs Playtech

| | Pragmatic (nosso) | Playtech (bot original) |
|---|-------------------|-------------------------|
| Números | API DGA | Scanner lobby |
| Entrada na mesa | Link directo / iframe | Painel + `.prime` |
| Interacção | Extensão | Extensão / painel |

Não misturar feeds: Playtech continua em `playtech-test/`; Pragmatic usa a app + extensão.
