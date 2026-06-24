# Extensão Chrome — Sala Rotativa (aprendizagem)

Protótipo que mostra como uma **extensão do browser** contorna a limitação do iframe cross-origin: recebe o plano de cliques da app **game-odds-glow** e actua no separador / frames da mesa do casino.

## Instalar (modo desenvolvedor)

1. Abra `chrome://extensions`
2. Active **Modo de programador**
3. **Carregar sem compactação** → escolha esta pasta `extension/`
4. Na app (`npm run dev`), abra **Sala Rotativa**
5. No painel **Bot de clique**, escolha modo **Extensão** e **Activo**

## Fluxo

```
App (postMessage) → content-app.js → background.js → separador da mesa
                                                    → content-casino.js (todos os frames)
```

| Fase app        | O que a extensão faz                                      |
|-----------------|-----------------------------------------------------------|
| POSICIONAR      | Abre nova aba com a URL da mesa (`mesaEmbedUrl`)          |
| JOGANDO (F1/F2) | Overlay no iframe + destaque heurístico de botões         |

## Produção (app não em localhost)

Edite `manifest.json` e acrescente o origin da app em `content_scripts[0].matches`, por exemplo:

```json
"matches": [
  "http://localhost:5173/*",
  "https://a-sua-app.example/*"
]
```

E em `exclude_matches` do script casino, exclua o mesmo origin para não correr duas vezes na app.

## Limitações (intencionais neste protótipo)

- **Não mapeia** ainda os selectores reais do Pragmatic para apostar cor/paridade/altura — só demonstra recepção do sinal e acesso aos frames.
- Automatizar apostas pode violar termos do operador; use só para aprendizagem.
- O modo **iframe embutido** na app continua a ser só visual; a extensão prefere o **separador** com a mesma origem que `mesaEmbedUrl`.

## Ficheiros

| Ficheiro           | Função                          |
|--------------------|---------------------------------|
| `content-app.js`   | Escuta `postMessage` da app     |
| `background.js`    | Orquestra abas e cliques        |
| `content-casino.js`| Overlay em cada frame da mesa   |
| `popup.html`       | Último evento recebido          |

Contrato TypeScript na app: `src/lib/roulette/rotatingRoomExtensionBridge.ts`.
