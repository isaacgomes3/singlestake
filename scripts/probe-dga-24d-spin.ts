/**
 * Liga ao DGA, subscribe na mesa 24D Spin (tableKey **3426**) e imprime JSON recebido (truncado).
 * Uso: npx tsx scripts/probe-dga-24d-spin.ts
 */
import "dotenv/config";
import WebSocket from "ws";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const TABLE_KEY = Number(process.env.DGA_24D_TABLE_KEY ?? 3426);
const RUN_MS = Math.max(5_000, Number(process.env.DGA_24D_PROBE_MS ?? 18_000) || 18_000);

const socket = new WebSocket(WS_URL);
let subscribed = false;

socket.on("open", () => {
  console.log("WS open | subscribe key:", TABLE_KEY);
  socket.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
  setTimeout(() => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "subscribe",
        casinoId: CASINO_ID,
        key: TABLE_KEY,
        currency: process.env.ROULETTE_CURRENCY ?? "BRL",
      }),
    );
    subscribed = true;
    console.log("sent subscribe\n");
  }, 450);
});

socket.on("message", (data) => {
  const raw = data.toString();
  const max = 20_000;
  console.log(raw.length > max ? `${raw.slice(0, max)}\n… (${raw.length} chars)` : raw);
  console.log("\n---\n");
});

socket.on("error", (e) => console.error("WS error:", e));

setTimeout(() => {
  try {
    socket.close();
  } catch {
    /* ignore */
  }
  console.log("done | subscribed:", subscribed);
  process.exit(0);
}, RUN_MS);
