/**
 * Procura mesas na DGA cujo `tableName` contenha um texto (case-insensitive).
 *
 * Uso:
 *   npm run dga:find-table -- immersive
 *   DGA_FIND_QUERY="roulette deluxe" npm run dga:find-table
 */
import "dotenv/config";
import WebSocket from "ws";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const QUERY = (process.argv[2] ?? process.env.DGA_FIND_QUERY ?? "immersive").toLowerCase();
const PER_MS = Math.max(1_500, Number(process.env.DGA_FIND_PER_MS ?? 2_500) || 2_500);
const SUBSCRIBE_FALLBACK_MS = Math.max(
  0,
  Number(process.env.ROULETTE_SUBSCRIBE_DELAY_MS ?? 400) || 400,
);

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

function ingestTableKeys(parsed: unknown, out: Set<string>) {
  if (typeof parsed !== "object" || parsed === null) return;
  const tk = (parsed as Record<string, unknown>).tableKey;
  if (!Array.isArray(tk)) return;
  for (const x of tk) {
    if (x === null || x === undefined) continue;
    out.add(String(x).trim());
  }
}

function listTableKeys(): Promise<string[]> {
  return new Promise((resolve) => {
    const keys = new Set<string>();
    const ws = new WebSocket(WS_URL);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
    });
    ws.on("message", (data) => {
      try {
        ingestTableKeys(JSON.parse(data.toString()) as unknown, keys);
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
      resolve(
        [...keys].sort((a, b) => {
          const na = parseInt(a, 10);
          const nb = parseInt(b, 10);
          const aNum = /^\d+$/.test(a) && Number.isFinite(na);
          const bNum = /^\d+$/.test(b) && Number.isFinite(nb);
          if (aNum && bNum) return na - nb;
          return a.localeCompare(b, undefined, { numeric: true });
        }),
      );
    }, 12_000);
  });
}

function inspectKey(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    let name: string | null = null;
    let subscribed = false;
    let fb: ReturnType<typeof setTimeout> | null = null;
    const ws = new WebSocket(WS_URL);

    const sendSubscribe = () => {
      if (subscribed || ws.readyState !== WebSocket.OPEN) return;
      subscribed = true;
      const parsedKey = /^\d+$/.test(key) ? parseInt(key, 10) : key;
      ws.send(
        JSON.stringify({
          type: "subscribe",
          casinoId: CASINO_ID,
          key: parsedKey,
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
  console.log("DGA find | casino:", CASINO_ID, "| query:", JSON.stringify(QUERY));
  const keys = await listTableKeys();
  if (keys.length === 0) {
    console.error("Nenhum tableKey recebido.");
    process.exit(1);
  }
  console.log("A inspecionar", keys.length, "chaves (~", PER_MS / 1000, "s cada)…\n");

  const hits: { key: string; name: string }[] = [];
  for (const key of keys) {
    const name = await inspectKey(key);
    if (!name) continue;
    if (name.toLowerCase().includes(QUERY)) {
      hits.push({ key, name });
      console.log(">>>", key, "\t", name);
    }
  }

  console.log("\n--- Resultados ---");
  if (hits.length === 0) {
    console.log("Nenhuma mesa com", JSON.stringify(QUERY), "no nome.");
    process.exit(1);
  }
  for (const h of hits) console.log(h.key, "\t", h.name);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
