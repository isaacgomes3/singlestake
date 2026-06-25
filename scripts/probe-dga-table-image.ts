/**
 * Subscreve uma mesa DGA e imprime campos de imagem (tableImage, etc.).
 * Uso: DGA_PROBE_TABLE_ID=213 npx tsx scripts/probe-dga-table-image.ts
 */
import "dotenv/config";
import WebSocket from "ws";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const TABLE_ID = Math.max(1, Number(process.env.DGA_PROBE_TABLE_ID ?? 213) || 213);
const RUN_MS = Math.max(5_000, Number(process.env.DGA_PROBE_MS ?? 20_000) || 20_000);

function collectImageFields(obj: unknown, out: Map<string, string>, depth = 0): void {
  if (depth > 8 || obj == null || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (/image|photo|thumb|banner|logo/i.test(k) && typeof v === "string" && v.trim()) {
      out.set(k, v.trim());
    }
  }
  for (const v of Object.values(o)) {
    if (typeof v === "object") collectImageFields(v, out, depth + 1);
  }
}

function extractTableName(parsed: Record<string, unknown>): string | null {
  const direct = parsed.tableName;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = parsed.pragmaticTable;
  if (nested != null && typeof nested === "object" && "tableName" in nested) {
    const t = (nested as Record<string, unknown>).tableName;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}

const ws = new WebSocket(WS_URL);
let subscribed = false;
const images = new Map<string, string>();
let tableName: string | null = null;

const timer = setTimeout(() => {
  console.log("Timeout após", RUN_MS / 1000, "s");
  finish();
}, RUN_MS);

function finish() {
  clearTimeout(timer);
  ws.close();
  console.log("\nMesa:", TABLE_ID);
  console.log("tableName:", tableName ?? "(não recebido)");
  if (images.size === 0) {
    console.log("Nenhum campo de imagem encontrado.");
    process.exit(1);
    return;
  }
  console.log("\nCampos de imagem:");
  for (const [k, v] of images) console.log(`  ${k}: ${v}`);
  process.exit(0);
}

ws.on("open", () => {
  console.log("Ligado:", WS_URL, "| casino:", CASINO_ID, "| mesa:", TABLE_ID);
  ws.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
  setTimeout(() => {
    if (!subscribed) subscribe();
  }, 400);
});

function subscribe() {
  if (subscribed || ws.readyState !== WebSocket.OPEN) return;
  subscribed = true;
  ws.send(
    JSON.stringify({
      type: "subscribe",
      casinoId: CASINO_ID,
      key: TABLE_ID,
      currency: CURRENCY,
    }),
  );
  console.log("Subscrito na mesa", TABLE_ID);
}

ws.on("message", (data) => {
  try {
    const parsed = JSON.parse(data.toString()) as Record<string, unknown>;
    if (!subscribed && parsed.tableKey != null) subscribe();

    const name = extractTableName(parsed);
    if (name) tableName = name;

    collectImageFields(parsed, images);

    if (images.size > 0 && tableName) {
      finish();
    }
  } catch {
    /* ignore */
  }
});

ws.on("error", (e) => console.error("Erro WS:", e));
