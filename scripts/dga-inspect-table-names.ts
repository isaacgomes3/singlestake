/**
 * Para cada ID em DGA_INSPECT_IDS (vírgulas), subscreve na DGA e imprime o primeiro `tableName` visto.
 * Útil para encontrar a chave da «Roulette Macao» no teu casino.
 *
 * Uso:
 *   DGA_INSPECT_IDS=198,199,200,201,202,203,204,205 npm run dga:inspect-table-names
 *
 * .env: ROULETTE_WS_URL, ROULETTE_CASINO_ID, ROULETTE_CURRENCY (opcional)
 */
import "dotenv/config";
import WebSocket from "ws";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const PER_MS = Math.max(3_000, Number(process.env.DGA_INSPECT_PER_MS ?? 7_000) || 7_000);
const SUBSCRIBE_FALLBACK_MS = Math.max(
  0,
  Number(process.env.ROULETTE_SUBSCRIBE_DELAY_MS ?? 400) || 400,
);

const RAW_IDS =
  process.env.DGA_INSPECT_IDS?.trim() ||
  "195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212";

function parseIds(s: string): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const p of s.split(/[\s,]+/)) {
    const n = parseInt(p.trim(), 10);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
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

function inspectOne(tableId: number): Promise<string | null> {
  return new Promise((resolve) => {
    let name: string | null = null;
    let subscribed = false;
    let fb: ReturnType<typeof setTimeout> | null = null;
    const ws = new WebSocket(WS_URL);

    const sendSubscribe = () => {
      if (subscribed || ws.readyState !== WebSocket.OPEN) return;
      subscribed = true;
      ws.send(
        JSON.stringify({
          type: "subscribe",
          casinoId: CASINO_ID,
          key: tableId,
          currency: CURRENCY,
        }),
      );
    };

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
      fb = setTimeout(() => {
        fb = null;
        sendSubscribe();
      }, SUBSCRIBE_FALLBACK_MS);
    });

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as Record<string, unknown>;
        const rootTk = parsed.tableKey;
        if (!subscribed && rootTk != null && rootTk !== "") {
          if (fb) {
            clearTimeout(fb);
            fb = null;
          }
          sendSubscribe();
        }
        const n = extractTableName(parsed);
        if (n && !name) name = n;
      } catch {
        /* */
      }
    });

    ws.on("error", () => {});

    setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* */
      }
      resolve(name);
    }, PER_MS);
  });
}

async function main() {
  const ids = parseIds(RAW_IDS);
  console.log("DGA inspect | casino:", CASINO_ID, "|", ids.length, "mesas |", PER_MS / 1000, "s cada\n");
  for (const id of ids) {
    const n = await inspectOne(id);
    const line = n ?? "(sem tableName no tempo)";
    console.log(id, "\t", line);
    if (n && /maca/i.test(n)) {
      console.log("\n>>> Possível Roulette Macao / Macau — usar ROULETTE_MACAO_TABLE_ID=" + id);
    }
  }
  console.log("\nFeito. Se não apareceu «Macao», alargue DGA_INSPECT_IDS ou use `npm run dga:list-tables`.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
