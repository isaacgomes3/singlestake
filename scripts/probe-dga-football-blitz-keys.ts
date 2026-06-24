/**
 * Sonda chaves do payload DGA mesa 4022 — procura campos de multiplicadores.
 * Uso: npx tsx scripts/probe-dga-football-blitz-keys.ts
 */
import "dotenv/config";
import WebSocket from "ws";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const TABLE_KEY = Number(process.env.DGA_FOOTBALL_BLITZ_TABLE_KEY ?? 4022);
const RUN_MS = Math.max(5_000, Number(process.env.DGA_PROBE_MS ?? 25_000) || 25_000);

const MULTI_RE = /multi|lucky|boost|betspot|spread|odds|payout|bonus|power|enhance/i;

function collectPaths(obj: unknown, prefix = "", out = new Set<string>()): Set<string> {
  if (obj == null || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    obj.slice(0, 5).forEach((v, i) => collectPaths(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.add(p);
    if (typeof v === "object" && v !== null) collectPaths(v, p, out);
  }
  return out;
}

const allPaths = new Set<string>();
const interestingPaths = new Set<string>();
const samples: Record<string, unknown> = {};
let subscribed = false;
let payloads = 0;
let fullPayloadSaved = false;

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("Ligado mesa", TABLE_KEY);
  ws.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
  setTimeout(() => {
    if (!subscribed && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "subscribe",
          casinoId: CASINO_ID,
          key: TABLE_KEY,
          currency: CURRENCY,
        }),
      );
      subscribed = true;
    }
  }, 500);
});

ws.on("message", (data) => {
  try {
    const raw = data.toString();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (!subscribed) {
      if (parsed.tableKey != null && parsed.tableKey !== "") {
        ws.send(
          JSON.stringify({
            type: "subscribe",
            casinoId: CASINO_ID,
            key: TABLE_KEY,
            currency: CURRENCY,
          }),
        );
        subscribed = true;
      } else return;
    }

    payloads += 1;
    for (const p of collectPaths(parsed)) {
      allPaths.add(p);
      if (MULTI_RE.test(p)) interestingPaths.add(p);
    }

    if (parsed.gameResult && !samples.gameResult0) {
      const gr = parsed.gameResult as unknown[];
      if (Array.isArray(gr) && gr[0]) {
        samples.gameResult0 = gr[0];
        if (gr.length > 1) samples.gameResult1 = gr[1];
      }
    }

    for (const [k, v] of Object.entries(parsed)) {
      if (MULTI_RE.test(k) && samples[`top.${k}`] === undefined) samples[`top.${k}`] = v;
    }

    if (!fullPayloadSaved && parsed.gameResult != null) {
      fullPayloadSaved = true;
      samples.fullPayloadKeys = Object.keys(parsed);
      const max = 20_000;
      samples.fullPayloadSnippet =
        raw.length > max ? `${raw.slice(0, max)}…` : raw;
    }
  } catch {
    /* */
  }
});

ws.on("error", (e) => console.error("ws error:", e));

setTimeout(() => {
  ws.close();
  console.log("\n=== RESUMO ===");
  console.log("Payloads recebidos:", payloads);
  console.log("\nCaminhos com multi/lucky/boost/betspot/spread/odds/payout/bonus:");
  [...interestingPaths].sort().forEach((p) => console.log(" ", p));
  console.log("\nTodas as chaves únicas:");
  [...allPaths].sort().forEach((p) => console.log(" ", p));
  console.log("\nAmostras:");
  console.log(JSON.stringify(samples, null, 2));
  process.exit(payloads > 0 ? 0 : 1);
}, RUN_MS);
