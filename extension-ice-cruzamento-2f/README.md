# stake37 — ICE Cruzamento 2 Fatores

Extensão Chrome para **ICE** (mesa **201** · Roulette 2 Extra Time).

## Estratégia

Gatilho único:

| Par |
|-----|
| **2×4** |

- Match indica de imediato (sem falhas prévias)
- **Indicação única** — não reaposta os mesmos factores
- **Empate:** fecha a indicação; gale mantido
- **Vitória / derrota:** fecha o ciclo
- Gale até **8**; zero = derrota
- Opcional: **sem gale** e **sem clique** (só observação)

## Instalação

```bash
npm run extension:ice2f:build
```

Chrome → `chrome://extensions` → Carregar `extension-ice-cruzamento-2f/`
