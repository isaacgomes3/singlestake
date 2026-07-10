# stake37 — ICE Cruzamento 2 Fatores

Extensão Chrome para **ICE** (mesa **201** · Roulette 2 Extra Time).

## Estratégia

- Posições críticas **5, 6, 7, 9, 10, 11**
- Monitoriza falha de cruzamento **cor/altura** e **paridade/altura**
- Após **4 derrotas** (empate não conta; zero neutro na observação) → entrada nos 2 factores do número na posição
- Gales até **5** (unidades 1·2·4·8·16·32)
- Zero com indicação activa = derrota na aposta

## Instalação

```bash
npm run extension:ice2f:setup
npm run extension:ice2f:build
```

Chrome → `chrome://extensions` → Carregar `extension-ice-cruzamento-2f/`

Popup fixo (ícone da extensão) — não fecha ao clicar na mesa.
