# stake37 — Sportingbet 3 Fatores

Extensão Chrome para **Sportingbet** (mesa **201** · Roulette 2 Extra Time).

Mesma estratégia da ICE 3F: eco → **3 factores** · parcial **×2** / total **×4** · máx. **5 gales**.

## Abertura manual

O Sportingbet **não disponibiliza link directo** estável para a mesa. Antes de ligar o autopilot:

1. Abra [sportingbet.bet.br](https://www.sportingbet.bet.br/) e entre na conta
2. Navegue até **Roulette 2 Extra Time** (Pragmatic, mesa 201) e deixe o jogo carregar
3. Ligue o autopilot no popup — os cliques usam o separador activo

A DGA segue a mesa **201** independentemente do URL.

## Estratégia

- Eco da última ocorrência → **cor + altura + paridade** do nº à esquerda (**3 un.**)
- Sem eco em número consecutivo (`22, 22` → espera próximo)
- Vitória se ≥2 factores; parcial (1) → **+1 gale ×2**; total (0 / zero) → **+2 gales ×4**
- Entrada em **unidades** (auto a cada 63 vitórias / manual no popup)
- Máx. **5 gales**; em auto, gale 5 com ≥2u → volta a 1u

## Instalação

```bash
npm run extension:sportingbet3f:setup
npm run extension:sportingbet3f:build
```

Chrome → `chrome://extensions` → Carregar `extension-sportingbet-3fatores/`

- **Table ID DGA:** 201
- **Site:** https://www.sportingbet.bet.br/
