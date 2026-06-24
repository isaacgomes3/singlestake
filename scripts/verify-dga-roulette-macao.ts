/**
 * Verifica na API DGA (WebSocket) se a mesa configurada como Roulette Macao
 * devolve `last20Results` / `resultEvent` com números 0–36.
 *
 * Uso: npm run dga:verify-macao
 * .env: ROULETTE_WS_URL, ROULETTE_CASINO_ID, ROULETTE_CURRENCY (opcional),
 *       ROULETTE_MACAO_TABLE_ID (opcional; default 206 — Pragmatic «Roulette Macao» no casino por defeito do repo)
 */
import "dotenv/config";
import WebSocket from "ws";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const TABLE_ID = Math.max(1, parseInt(process.env.ROULETTE_MACAO_TABLE_ID ?? "206", 10) || 206);
const SUBSCRIBE_FALLBACK_MS = Math.max(
  0,
  Number(process.env.ROULETTE_SUBSCRIBE_DELAY_MS ?? 400) || 400,
);
const WAIT_MS = Math.max(8_000, Number(process.env.DGA_VERIFY_MACAO_MS ?? 25_000) || 25_000);

type WsResultRow = { result?: string | number; gameId?: string };

function parseLast20Len(parsed: Record<string, unknown>): number {
  const last20 = parsed.last20Results as WsResultRow[] | undefined;
  if (!Array.isArray(last20)) return 0;
  let n = 0;
  for (const row of last20) {
    if (row == null || typeof row !== "object") continue;
    const r = row as WsResultRow;
    if (r.gameId === undefined || r.gameId === "") continue;
    if (r.result === undefined || r.result === null) continue;
    const num = typeof r.result === "number" ? r.result : parseInt(String(r.result), 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 36) n++;
  }
  return n;
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

function main() {
  let ws!: WebSocket;
  let subscribed = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let sawLast20 = 0;
  let sawName: string | null = null;

  const sendSubscribe = () => {
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
    console.log("→ subscribe key:", TABLE_ID, "| casino:", CASINO_ID);
  };

  ws = new WebSocket(WS_URL);
  ws.on("open", () => {
    console.log("Ligado:", WS_URL);
    ws.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      sendSubscribe();
    }, SUBSCRIBE_FALLBACK_MS);
  });

  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString()) as Record<string, unknown>;
      const rootTk = parsed.tableKey;
      if (!subscribed && rootTk != null && rootTk !== "") {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        sendSubscribe();
      }
      const name = extractTableName(parsed);
      if (name) sawName = name;
      sawLast20 = Math.max(sawLast20, parseLast20Len(parsed));
    } catch {
      /* ignore */
    }
  });

  ws.on("error", (e) => {
    console.error("Erro WS:", e);
  });

  setTimeout(() => {
    try {
      ws.close();
    } catch {
      /* */
    }
    console.log("\n--- Resultado ---");
    if (sawName) console.log("Nome visto na API:", sawName);
    console.log("Giros válidos em last20Results (máx. contados):", sawLast20);
    if (sawLast20 > 0) {
      console.log(
        "\nOK: a mesa",
        TABLE_ID,
        "fornece histórico recente. Use o mesmo id em ROULETTE_MACAO_TABLE_ID / VITE_ROULETTE_MACAO_TABLE_ID se diferir de 206.",
      );
      process.exit(0);
    } else {
      console.warn(
        "\nFALHOU: sem last20Results com números 0–36 no tempo limite.",
        "Aumente DGA_VERIFY_MACAO_MS ou experimente outro ROULETTE_MACAO_TABLE_ID (lista: npm run dga:list-tables).",
      );
      process.exit(1);
    }
  }, WAIT_MS);
}

main();
