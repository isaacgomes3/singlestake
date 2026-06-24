/**
 * Sonda o payload DGA da mesa Super Trunfo Futebol Latino (tableKey 4022).
 * Uso: npx tsx scripts/probe-dga-football-blitz.ts
 */
import "dotenv/config";
import WebSocket from "ws";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const TABLE_KEY = Number(process.env.DGA_FOOTBALL_BLITZ_TABLE_KEY ?? 4022);
const RUN_MS = Math.max(5_000, Number(process.env.DGA_PROBE_MS ?? 18_000) || 18_000);

const ws = new WebSocket(WS_URL);
let subscribed = false;
let printed = 0;

ws.on("open", () => {
  console.log("Ligado | key:", TABLE_KEY);
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
      console.log("subscribe enviado (fallback)");
    }
  }, 500);
});

ws.on("message", (data) => {
  try {
    const raw = data.toString();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (!subscribed) {
      const tk = parsed.tableKey;
      if (tk != null && tk !== "") {
        ws.send(
          JSON.stringify({
            type: "subscribe",
            casinoId: CASINO_ID,
            key: TABLE_KEY,
            currency: CURRENCY,
          }),
        );
        subscribed = true;
        console.log("subscribe enviado (tableKey root)");
      }
    }

    if (!subscribed) return;

    const interesting =
      parsed.last20Results != null ||
      parsed.resultEvent != null ||
      parsed.tableName != null ||
      parsed.gameResult != null ||
      parsed.lastGameResult != null;

    if (interesting && printed < 3) {
      printed += 1;
      const max = 12_000;
      console.log("\n--- payload", printed, "---\n");
      console.log(raw.length > max ? `${raw.slice(0, max)}…` : raw);
    }
  } catch (e) {
    console.error("parse:", e);
  }
});

ws.on("error", (e) => console.error("ws error:", e));

setTimeout(() => {
  ws.close();
  console.log("\nFim.");
  process.exit(printed > 0 ? 0 : 1);
}, RUN_MS);
