# stake37 — Reals Football Blitz Obs

Observação da mesa **4001 · Football Blitz Top Card** na Reals (`reals.bet.br`).

## Indicação (perfeição)

1. **Gatilho** = última rodada (chip exacto, ex.: `3/J` azul)
2. **Direita do último** = as **duas** rodadas seguintes (h[1] e h[2])
3. Usa **apenas a coincidência exacta mais recente** (se a direita falhar, não alerta)
4. As duas à direita da coincidência: **mesma cor** posição a posição
5. **Indica** a cor à esquerda dessa coincidência

Ex.: gatilho `3/J` · dir azul+amarelo → acha `3/J` com dir azul+amarelo → alerta a cor à esquerda.

Na mudança de baralho (`shuffle: true` na DGA), o histórico de cartas é **zerado**; o **placar** (W/L e gráfico) **mantém-se**. O botão «Limpar histórico» zera os dois.

## Shoe (8 baralhos)

Conta altas (10–K) e médias (6–9) já saídas por lado e estima P(casa / visitante / empate) da próxima mão com as cartas restantes (sem reposição). O shoe reinicia com o histórico no shuffle.

## Instalar

Chrome → Extensões → Carregar sem compactação → `extension-reals-football-blitz-obs/`
