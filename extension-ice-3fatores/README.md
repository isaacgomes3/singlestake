# stake37 — ICE 3 Fatores

Extensão Chrome para **ICE** (mesa **201** · Roulette 2 Extra Time).

## Estratégia

- Posições críticas **5, 6, 7, 9, 10 e 11** — gatilho: **2 derrotas totais** ou **1 total + 3 parciais**
- Vitória parcial/total reinicia contadores; derrota parcial (1 factor) e total (0) contam na observação
- Entrada: **3 factores** do número na **mesma posição crítica** que armou (independentes entre si)
- Gale parcial (+1 gale, ×2) · derrota total (+2 gales, ×4: 1→4, gale1·2→8)
- Zero com aposta activa = derrota total · zero na observação = neutro
- Tempo de digitação igual ao gale 3 (8×) em todos os estágios
- Falha: 5 gales, 2 triplas, ou 1 tripla + 2 gales

## Instalação

```bash
npm run extension:ice3f:build
```

Chrome → `chrome://extensions` → Carregar `extension-ice-3fatores/`
