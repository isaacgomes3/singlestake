# stake37 — ICE 24D Spin Cruzamento 2F

Extensão Chrome para **ICE** · Pragmatic **24D Spin** (mesa DGA **3426**).

URL sugerida: https://ice.bet.br/games/tag/game-shows/24dspin-pragmaticexternal

> A detecção aceita qualquer path com `24d-spin` / `24DSpin` / `3426` no host ice.bet.br.
> Se a URL exacta do lobby for diferente, actualiza `mesaUrl` no popup/config ou no sync.

## Estratégia

Idêntica à Bet365 24D:

| Item | Valor |
|------|-------|
| Gatilho | **2×4** |
| Números | **1–24** |
| Espera clique | **9,5s** |
| Gales | até **8** |
| Liquidar | não rearma no mesmo giro (anti indicação fantasma) |

## Build

```bash
npm run extension:24d2f:sync
npm run extension:ice24d2f:build
```

Chrome → `chrome://extensions` → Carregar `extension-ice-24d-cruzamento-2f/`
