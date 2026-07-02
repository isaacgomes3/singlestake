# Extensão Chrome — Singlestake Playtech v1.5.0

Executa entradas **Um Fator** na mesa do operador (Playtech / Pragmatic). Pensada para teste prático com o **teu painel Playtech** — independente da app DGA Pragmatic.

## Modos

| Modo | Badge | Comportamento |
|------|-------|---------------|
| **Demo** | `D` azul | Destaca o botão na mesa — **não aposta** |
| **Real** | `R` verde | Envia **clique real** na aposta exterior |

Modo por defeito: **Demo** (seguro).

## Instalar

```text
chrome://extensions → Modo programador → Carregar sem compactação → pasta extension/
```

Ou copiar para o Ambiente de Trabalho:

```bash
npm run extension:copy-desktop
```

## Autopilot (sem localhost)

A extensão **v1.3+** liga-se directamente à **DGA Pragmatic** (`wss://dga.pragmaticplaylive.net/ws`), corre a estratégia **Sala Rotativa · Um Fator** e aposta na mesa aberta — **não precisa** de `localhost:5173`.

1. Popup → **Ligar autopilot**
2. **Configuração DGA / operador** — casino ID, mesas, URL do operador (sem editar código)
3. Modo **REAL** + calibração OK
4. Mesa `br4.bet.br` aberta num separador

Rebuild do motor após alterar estratégia na app:

```bash
npm run extension:build
```

## Teste imediato (sem app)

1. Abrir mesa Playtech num separador (`/play/playtech/...`)
2. Clicar no ícone da extensão
3. Modo **Demo** → **Par** ou **Ímpar**
4. Confirmar destaque no botão correcto
5. Só então activar **Real**

## Sinais do painel Playtech

O content script corre em `*.bet.br` e expõe:

```javascript
window.__singlestakeExtension.sendSignal({
  betKey: "even",
  label: "Par",
  mesaUrl: "https://br4.bet.br/play/playtech/roleta-brasileira",
  signalId: "1:19:Par:0",
  mode: "demo", // opcional
});
```

Também aceita `postMessage` com:

- `game-odds-glow/rotating-room-extension` (contrato completo)
- `singlestake/playtech-signal` (formato simplificado)

## Arquitectura

```text
Painel Playtech / App
        │ postMessage
        ▼
 content-bridge.js  (bet.br, localhost, singlestake)
        │
        ▼
 background.js  →  resolve Demo/Real  →  separador da mesa
        │
        ▼
 exterior-bets.js  (todos os frames)  →  clique ou destaque
```

## Ficheiros

| Ficheiro | Função |
|----------|--------|
| `shared.js` | Constantes e modo Demo/Real |
| `background.js` | Service worker, abas, dedup sinal |
| `content-bridge.js` | Bridge na página do operador / painel |
| `exterior-bets.js` | Heurísticas DOM (Playtech + Pragmatic) |
| `content-casino.js` | Overlay nos frames da mesa |
| `popup.html/js` | Modo Demo/Real + testes |

## Contrato TypeScript (referência)

`src/lib/roulette/rotatingRoomExtensionBridge.ts`
