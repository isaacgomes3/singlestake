# stake37 — Bet365 24D Spin Cruzamento 2F

Extensão Chrome para **bet365** · jogo Pragmatic **24D Spin** (mesa DGA **3426**).

URL: https://casino.bet365.bet.br/play/24DSpin

## Estratégia

Mesmo conceito da Cruzamento 2F (roleta), adaptado a **1–24**:

| Item | 24D Spin |
|------|----------|
| Gatilho | **2×4** (posições newest-first) |
| Vermelho | 1–4, 9–12, 17–20 |
| Preto | 5–8, 13–16, 21–24 |
| Baixo | **1–12** |
| Alto | **13–24** |
| Espera clique | **6s** (entrada / gale / pós-empate) |
| Gales | até **8** |

## Build

```bash
npm run extension:bet36524d2f:setup
npm run extension:bet36524d2f:build
```

Chrome → `chrome://extensions` → Carregar `extension-bet365-24d-cruzamento-2f/`
