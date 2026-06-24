/**
 * Para cada candidato: liga ao WS DGA, `subscribe` na mesa e espera pelo menos um
 * payload com `resultEvent` ou `last20Results[0]` com resultado 0–36 (igual ao servidor).
 *
 * Uso: npm run dga:probe-spins
 * .env: ROULETTE_WS_URL, ROULETTE_CASINO_ID, ROULETTE_CURRENCY (opcional)
 *
 * Opcional:
 *   DGA_PROBE_DISCOVER_MS — ms a escutar `tableKey` antes de sondar (default 8000)
 *   DGA_PROBE_PER_TABLE_MS — timeout por mesa (default 22000)
 *   DGA_PROBE_MAX_TABLES — máximo de mesas a testar (default 30)
 *   DGA_PROBE_IDS — lista explícita "201,202,203" (ignora descoberta de candidatos)
 *   DGA_PROBE_SKIP_IDS — IDs a não testar (default = todas as mesas do lobby fixo, incl. Macao)
 */
import "dotenv/config";
import WebSocket from "ws";

import { LOBBY_FIXED_TABLE_IDS } from "../src/lib/roulette/lobbyTables.ts";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const SUBSCRIBE_FALLBACK_MS = Math.max(
  0,
  Number(process.env.ROULETTE_SUBSCRIBE_DELAY_MS ?? 400) || 400,
);

const DISCOVER_MS = Math.max(2_000, Number(process.env.DGA_PROBE_DISCOVER_MS ?? 8_000) || 8_000);
const PER_TABLE_MS = Math.max(5_000, Number(process.env.DGA_PROBE_PER_TABLE_MS ?? 22_000) || 22_000);
const MAX_TABLES = Math.max(1, Number(process.env.DGA_PROBE_MAX_TABLES ?? 30) || 30);

const DEFAULT_SKIP = new Set<number>([...LOBBY_FIXED_TABLE_IDS]);

function parseIdList(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

const SKIP_IDS = new Set(
  (process.env.DGA_PROBE_SKIP_IDS?.trim()
    ? parseIdList(process.env.DGA_PROBE_SKIP_IDS)
    : [...DEFAULT_SKIP]) as number[],
);
const EXPLICIT_IDS = parseIdList(process.env.DGA_PROBE_IDS);

type WsResultRow = { result?: string | number; gameId?: string };

function parseSpin(parsed: Record<string, unknown>): { number: number; gameId: string } | null {
  const fromRow = (row: WsResultRow | undefined) => {
    if (row == null || row.gameId === undefined || row.gameId === "") return null;
    if (row.result === undefined || row.result === null) return null;
    const number =
      typeof row.result === "number" ? row.result : parseInt(String(row.result), 10);
    if (Number.isNaN(number) || number < 0 || number > 36) return null;
    return { number, gameId: String(row.gameId) };
  };
  const resultEvent = parsed.resultEvent as WsResultRow | undefined;
  const fromEvent = fromRow(resultEvent);
  if (fromEvent) return fromEvent;
  const last20 = parsed.last20Results as WsResultRow[] | undefined;
  return fromRow(last20?.[0]);
}

const isTableLikeObject = (o: Record<string, unknown>): boolean =>
  "last20Results" in o ||
  "resultEvent" in o ||
  "tableName" in o ||
  "tableOpen" in o ||
  "pragmaticTable" in o;

function messageContainsOurTableKey(value: unknown, tableId: number): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.some((item) => messageContainsOurTableKey(item, tableId));
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    if ("tableKey" in o) {
      const tk = o.tableKey;
      if (Number(tk) === tableId || String(tk) === String(tableId)) return true;
    }
    if (isTableLikeObject(o) && "key" in o) {
      const k = o.key;
      if (Number(k) === tableId || String(k) === String(tableId)) return true;
    }
    return Object.values(o).some((v) => messageContainsOurTableKey(v, tableId));
  }
  return false;
}

function discoverNumericTableKeys(): Promise<number[]> {
  return new Promise((resolve) => {
    const keys = new Set<string>();
    const ws = new WebSocket(WS_URL);

    const ingest = (parsed: unknown) => {
      if (typeof parsed !== "object" || parsed === null) return;
      const tk = (parsed as Record<string, unknown>).tableKey;
      if (!Array.isArray(tk)) return;
      for (const x of tk) {
        if (x === null || x === undefined) continue;
        const s = String(x).trim();
        if (/^\d+$/.test(s)) keys.add(s);
      }
    };

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
    });
    ws.on("message", (data) => {
      try {
        ingest(JSON.parse(data.toString()) as unknown);
      } catch {
        /* ignore */
      }
    });
    ws.on("error", () => {});

    setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      const nums = [...keys]
        .map((k) => parseInt(k, 10))
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      resolve(nums);
    }, DISCOVER_MS);
  });
}

/** Espera um payload de roleta (0–36 + gameId) após `subscribe`. */
function probeTable(tableId: number): Promise<boolean> {
  return new Promise((resolve) => {
    let ws!: WebSocket;
    let subscribed = false;
    let finished = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let overall: ReturnType<typeof setTimeout>;

    const done = (ok: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(overall);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };

    overall = setTimeout(() => done(false), PER_TABLE_MS);

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

    ws = new WebSocket(WS_URL);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null;
        sendSubscribe();
      }, SUBSCRIBE_FALLBACK_MS);
    });

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as Record<string, unknown>;
        if (!subscribed) {
          const rootTk = parsed.tableKey;
          if (rootTk != null && rootTk !== "") {
            sendSubscribe();
          } else if (messageContainsOurTableKey(parsed, tableId)) {
            sendSubscribe();
          }
        }
        if (!subscribed) return;
        if (parseSpin(parsed)) {
          done(true);
        }
      } catch {
        /* ignore */
      }
    });

    ws.on("error", () => done(false));
    ws.on("close", () => {
      if (!finished) done(false);
    });
  });
}

async function main() {
  console.log("DGA probe | casino:", CASINO_ID, "| WS:", WS_URL);
  let candidates: number[];
  if (EXPLICIT_IDS.length > 0) {
    candidates = [...new Set(EXPLICIT_IDS)].sort((a, b) => a - b);
    console.log("Candidatos (DGA_PROBE_IDS):", candidates.join(", "));
    if (process.env.DGA_PROBE_IDS?.trim()) {
      console.warn(
        "→ Modo lista fixa. Para varrer o casino e escolher as primeiras 3 mesas com dados, remova DGA_PROBE_IDS do ambiente e do .env.\n",
      );
    }
  } else {
    console.log("Descoberta de tableKeys numéricos (" + DISCOVER_MS / 1000 + "s)…");
    candidates = await discoverNumericTableKeys();
    console.log("Encontrados", candidates.length, "IDs numéricos.");
    if (candidates.length === 0) {
      console.error("Sem candidatos. Aumente DGA_PROBE_DISCOVER_MS ou defina DGA_PROBE_IDS.");
      process.exit(1);
      return;
    }
  }

  const toTry = candidates.filter((id) => !SKIP_IDS.has(id)).slice(0, MAX_TABLES);
  console.log(
    "A sondar",
    toTry.length,
    "mesas (timeout",
    PER_TABLE_MS / 1000,
    "s cada). Skip:",
    [...SKIP_IDS].sort((a, b) => a - b).join(", "),
    "\n",
  );

  const working: number[] = [];
  for (const tid of toTry) {
    process.stdout.write(`  mesa ${tid} … `);
    const ok = await probeTable(tid);
    console.log(ok ? "OK (payload roleta)" : "sem dados");
    if (ok) working.push(tid);
    if (working.length >= 3) break;
  }

  console.log("\n--- Resultado ---");
  if (working.length === 0) {
    console.log("Nenhuma mesa extra passou no teste neste run.");
    process.exit(2);
    return;
  }
  console.log("IDs com giros/dados de roleta:", working.join(", "));
  const core = [...DEFAULT_SKIP].sort((a, b) => a - b);
  const envLine = "ROULETTE_TABLE_IDS=" + [...core, ...working].join(",");
  console.log("\nSugestão .env (núcleo + extras validados):\n  " + envLine);
  console.log(
    "\nLOBBY_FIXED_TABLE_IDS (ordem lobby): [" +
      [...core, ...working.slice(0, 3)].join(", ") +
      "]",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
