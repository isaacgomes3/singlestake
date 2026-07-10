# stake37 — KTO Cruzamento 2 Fatores

Extensão Chrome para **KTO** (mesa **230** · Roulette 3).

## Estratégia

- Posições críticas **5, 6, 7, 9, 10, 11**
- Monitoriza falha de cruzamento **cor/altura** e **paridade/altura**
- Após **4 derrotas** (empate não conta; zero neutro na observação) → entrada nos 2 factores do número na posição
- Gales até **5** (unidades 1·2·4·8·16·32)
- Zero com indicação activa = derrota na aposta

## Instalação

```bash
npm run extension:kto2f:setup
npm run extension:kto2f:build
```

Chrome → `chrome://extensions` → Carregar `extension-kto-cruzamento-2f/`

Popup fixo (ícone da extensão) — não fecha ao clicar na mesa.
