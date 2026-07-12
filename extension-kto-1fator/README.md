# stake37 — KTO 1 Fator

Extensão Chrome para **KTO** (mesa **230** · Roulette 3).

## Estratégia

- Compara as posições **1** e **13** do histórico (newest-first)
- 3 contadores (Paridade / Cor / Altura): coincidência → +1 vitória (streak); falha → +1 derrota
- O parâmetro com **melhor score** é destacado
- Alerta o valor desse parâmetro na **posição 12** (indicação normal, não oposta)
- Clique em **1 factor** apenas
- Gales até **5** via **Dobrar**

## Popup

- Cards Paridade / Cor / Altura (vitórias, derrotas, último) — melhor score com ⚡
- Estatísticas Gerais: rodadas, vitórias, gale actual, máximo gale

## Instalação

```bash
npm run extension:kto1f:build
```

Chrome → Extensões → Carregar sem compactação → pasta `extension-kto-1fator/`.
