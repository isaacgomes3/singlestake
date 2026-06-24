# Proxy Local — Painel Exchange

A API `mexchange-api.fulltbet.bet.br` bloqueia IPs fora do Brasil **e** não envia headers CORS. Este proxy roda na **sua máquina** (IP BR + sem CORS) e o painel consulta ele.

## Como rodar

Requer Node 18+ (já vem com `fetch` e `http` nativos).

```bash
node proxy/local-proxy.mjs
```

Saída esperada:

```
  Proxy local rodando em  http://localhost:8787
  Teste:                   http://localhost:8787/events
```

Deixe o terminal aberto. No painel (preview), o campo **"URL do proxy"** já vem com `http://localhost:8787` — basta clicar em **Atualizar**.

## Endpoints

- `GET /events` → lista de eventos de futebol (`sportsid=15`)
- `GET /raw?url=<URL_ENCODED>` → repassa qualquer URL da exchange (use para `/statistics`, charts, etc.)
- `GET /health` → ping

## Porta diferente

```bash
PORT=9000 node proxy/local-proxy.mjs
```
