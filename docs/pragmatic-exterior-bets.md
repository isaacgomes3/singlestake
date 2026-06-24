# Mapeamento Pragmatic — apostas exteriores (Fatores 3,2%)

Liga cada **factor** da estratégia a uma aposta exterior na mesa Pragmatic Live (European).

## Chaves (app ↔ extensão)

| Factor na app | Chave | Aposta Pragmatic |
|---------------|-------|------------------|
| Ímpar | `odd` | Paridade ímpar |
| Par | `even` | Paridade par |
| Vermelho | `red` | Vermelho |
| Preto | `black` | Preto |
| Baixo 1–18 | `low` | 1–18 |
| Alto 19–36 | `high` | 19–36 |

Código partilhado: `src/lib/roulette/pragmaticExteriorBetMap.ts`  
Lógica de clique (extensão): `extension/pragmatic-roulette-bets.js`

## Fluxo automático (modo Extensão)

1. App envia `factor1BetKey: "odd"` quando o factor 1 é **Ímpar**
2. Extensão injecta script em **todos os frames** da aba da mesa
3. Escolhe o frame com **maior score** de correspondência DOM
4. Destaca e clica (ou só destaca se «dry run» activo)

## Calibrar na tua mesa

1. Abra a **mesa Pragmatic** numa aba (login feito)
2. Popup da extensão → **Testar Ímpar** (com «Só destacar» marcado)
3. Deve aparecer contorno ciano na área **Ímpar** do tapete
4. Se falhar: **Varredura 6 apostas** — vê quais chaves têm score no popup
5. Quando correcto, desmarque «Só destacar» para enviar clique real (aprendizagem)

## Heurísticas DOM (ordem)

- `data-bet-spot`, `data-bet-code`, `data-spot`, `data-type`
- `class` com `odd`, `impar`, etc.
- Texto / `aria-label`: «Ímpar», «Odd», …

Operadores customizam markup — se o teu operador usar outros atributos, edita `PROFILES` em `pragmatic-roulette-bets.js`.

## Aviso

Automatizar apostas pode violar termos do operador. Use só para aprendizagem; «Só destacar» vem activo por defeito no popup.
