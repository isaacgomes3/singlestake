# stake37 — ICE Cruzamento 2 Fatores

Extensão Chrome para **ICE** (mesa **201** · Roulette 2 Extra Time).

## Estratégia

Gatilho único:

| Par |
|-----|
| **3×6** |

- Cada match indica de imediato (sem falhas prévias)
- **Indicação única** — não reaposta os mesmos factores
- **Empate:** fecha a indicação; gale mantido
- **Vitória / derrota:** fecha o ciclo
- Gale até **5**; zero = derrota

## Instalação

```bash
npm run extension:ice2f:build
```

Chrome → `chrome://extensions` → Carregar `extension-ice-cruzamento-2f/`
