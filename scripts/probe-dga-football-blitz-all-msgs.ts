/**
 * Captura TODOS os payloads DGA mesa 4022 durante ~60s (inclui eventos de ronda).
 * Uso: npx tsx scripts/probe-dga-football-blitz-all-msgs.ts
 */
import "dotenv/config";
import WebSocket from "ws";
import { writeFileSync } from "fs";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const TABLE_KEY = Number(process.env.DGA_FOOTBALL_BLITZ_TABLE_KEY ?? 4022);
const RUN_MS = Math.max(10_000, Number(process.env.DGA_PROBE_MS ?? 60_000) || 60_000);

const MULTI_RE = /multi|lucky|boost|betspot|spread|odds|payout|bonus|power|enhance/i;

type Msg = { t: number; len: number; keys: string[]; raw: string };

const msgs: Msg[] = [];
let subscribed = false;

const ws = new WebSocket(WS_URL);

ws.on("open", () => {
  console.log("Ligado mesa", TABLE_KEY, "| aguardando", RUN_MS / 1000, "s");
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

    msgs.push({
      t: Date.now(),
      len: raw.length,
      keys: Object.keys(parsed),
      raw,
    });
    console.log(
      `[${msgs.length}] keys=${Object.keys(parsed).join(",")} len=${raw.length}` +
        (MULTI_RE.test(raw) ? " *** MATCH multi/lucky ***" : ""),
    );
  } catch {
    /* */
  }
});

ws.on("error", (e) => console.error("ws error:", e));

setTimeout(() => {
  ws.close();
  const out = "scripts/.probe-football-blitz-msgs.json";
  writeFileSync(out, JSON.stringify(msgs, null, 2));
  console.log("\n=== RESUMO ===");
  console.log("Mensagens:", msgs.length);
  const allKeys = new Set<string>();
  msgs.forEach((m) => m.keys.forEach((k) => allKeys.add(k)));
  console.log("Chaves top-level únicas:", [...allKeys].sort().join(", "));
  const multiHits = msgs.filter((m) => MULTI_RE.test(m.raw));
  console.log("Mensagens com multi/lucky/boost/betspot:", multiHits.length);
  if (multiHits.length > 0) {
    multiHits.forEach((m, i) => console.log(`\n--- hit ${i + 1} ---\n`, m.raw.slice(0, 4000)));
  }
  // gameResult row keys
  const rowKeys = new Set<string>();
  for (const m of msgs) {
    try {
      const p = JSON.parse(m.raw) as Record<string, unknown>;
      const gr = p.gameResult as Record<string, unknown>[] | undefined;
      if (Array.isArray(gr)) {
        for (const row of gr.slice(0, 3)) {
          if (row && typeof row === "object") Object.keys(row).forEach((k) => rowKeys.add(k));
        }
      }
      for (const k of Object.keys(p)) {
        if (MULTI_RE.test(k)) rowKeys.add(`top:${k}`);
      }
    } catch {
      /* */
    }
  }
  console.log("\nChaves em gameResult[]:", [...rowKeys].sort().join(", "));
  console.log("Dump salvo em", out);
  process.exit(msgs.length > 0 ? 0 : 1);
}, RUN_MS);
