# Singlestake — extensão ice.bet

Extensão **separada** da pasta `extension/` (br4.bet). Use para testar o operador [ice.bet.br](https://ice.bet.br) sem alterar a extensão em produção.

## Funcionalidades específicas

- **Auto-clique «Jogar»** — ao navegar para `/games/...`, a extensão detecta o botão do lobby e clica antes de apostar.
- **Espera inteligente** — polling até iframe Pragmatic ou canvas do jogo (em vez de sleep fixo de 5,5 s).
- **URL por defeito** — Roulette 1 (mesa 227)

## Mesas configuradas (DGA → ice.bet)

| Mesa | ID | URL |
|------|-----|-----|
| Roulette 1 | 227 | `.../rouletteazure-pragmaticexternal` |
| Speed Roulette 1 | 203 | `.../speedroulette-pragmaticexternal` |
| Roulette 3 | 230 | `.../roulette10ruby-pragmaticexternal` |
| Roulette 2 Extra Time | 201 | `.../liveroulettea-pragmaticexternal` |
| Roulette Macao | 206 | `.../roulettemacao-pragmaticexternal` |
| Roulette Brazilian | 237 | `.../brazilianroulette-pragmaticexternal` |
| Korean Roulette | 213 | `.../koreanroulette-pragmaticexternal` |

Na app: `VITE_CASINO_OPERATOR=ice` em `.env.development` (ver `casinoEmbedIceDefaults.ts`).

## Instalação

1. `chrome://extensions` → Modo programador
2. Carregar sem compactação → pasta `extension-icebet`
3. **Desactivar** a extensão `extension/` (br4) para evitar conflito

## Ficheiros novos

| Ficheiro | Função |
|----------|--------|
| `operator-config.js` | Host ice.bet, textos «Jogar», timeouts |
| `operator-lobby.js` | Detecção e clique no lobby (content + inject) |

## Integração com a app

Configure `VITE_CASINO_TABLE_EMBED_URLS` (ou catálogo admin) com URLs `ice.bet.br/games/...` quando migrar mesas para este operador.

## Desenvolvimento

Cópia do motor Um Fator: `npm run extension:build` gera `extension/um-fator-engine.js` — copie para `extension-icebet/` se actualizar a lógica de sinais.
