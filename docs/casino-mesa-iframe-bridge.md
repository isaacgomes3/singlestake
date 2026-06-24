# Bridge `/casino-mesa` → página pai (iframe)

Quando embutes **`/casino-mesa`** num `<iframe>` na tua shell, podes receber o estado **Ruas 9%** (incluindo ruas excluídas e alvos de aposta estruturados) via **`postMessage`**, sem aceder ao DOM interno da app.

## Configurar a origem do pai

O filho só envia mensagens com `postMessage(..., targetOrigin)` para uma origem explícita (não usa `*`).

**Ordem de prioridade:** parâmetro URL `parentOrigin` → valor guardado em **URL** na página `/casino-mesa` (campo «Shell que embute esta página», `localStorage`) → variável de ambiente `VITE_CASINO_MESA_PARENT_ORIGIN` no build.

1. **Na própria página Casino mesa** (recomendado no dia a dia): abre **«URL»** no cabeçalho, preenche «Shell que embute esta página» com `https://…` (o site onde tens o `<iframe>`), **Guardar origem da shell**. Isto **não** altera o iframe do Pragmatic — só define para onde o `postMessage` é enviado quando `/casino-mesa` está embutido nessa shell.

2. **Query string** (útil para partilhar links ou sobrepor o guardado):

   `https://<a-tua-app>/casino-mesa?mesa=225&parentOrigin=https://<a-tua-shell>`

   - `parentOrigin` pode ser uma URL completa; só a **origem** (`protocolo + host + porta`) é usada.

3. **Build** (opcional, mesma origem fixa para todos os embeds):

   `.env`:

   ```bash
   VITE_CASINO_MESA_PARENT_ORIGIN=https://minha-shell.com
   ```

## Formato da mensagem

- `type`: `game-odds-glow/casino-mesa/ruas9`
- `version`: `1`
- `tableId`: id da mesa (ex. `225`)
- `lastSpin`: último número no histórico local ou `null`
- `active`: objeto com `zone`, `excludedStreetIds`, `gatilhoTriple`, `streetIdsForBet`, `outsideZone`, etc., ou `null` se não houver indicação

Na shell, valida sempre **`event.origin`** (deve ser a origem onde está alojada a app game-odds-glow) e o campo **`type`**.

## Exemplo mínimo (página pai)

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Shell</title></head>
  <body>
    <iframe
      id="tools"
      style="width:100%;height:420px;border:1px solid #333"
      src="https://APP_ORIGIN/casino-mesa?mesa=225&parentOrigin=https://SHELL_ORIGIN"
    ></iframe>
    <pre id="log"></pre>
    <script>
      const APP_ORIGIN = "https://APP_ORIGIN"; // substituir
      window.addEventListener("message", (ev) => {
        if (ev.origin !== APP_ORIGIN) return;
        const d = ev.data;
        if (!d || d.type !== "game-odds-glow/casino-mesa/ruas9" || d.version !== 1) return;
        document.getElementById("log").textContent = JSON.stringify(d, null, 2);
        // Aqui podes ligar lógica própria (ex.: overlay, atalhos, automação permitida pelo teu produto).
      });
    </script>
  </body>
</html>
```

## Tipos TypeScript

Importa `CasinoMesaRuas9BridgePayload` e `isCasinoMesaRuas9BridgePayload` de `@/lib/roulette/casinoMesaIframeBridge` no monorepo, ou copia os tipos alinhados ao contrato acima.

## Nota

Automatizar cliques ou apostas no cliente do operador pode violar termos de uso. Este bridge expõe apenas **dados de apoio** da ferramenta; a shell é responsável pelo que fizer com eles.
