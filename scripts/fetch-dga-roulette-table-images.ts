/**
 * Busca `tableImage` na DGA Pragmatic para todas as roletas do lobby/sala rotativa
 * e grava posters em `public/lobby/dga/`.
 *
 * Uso: npm run dga:fetch-roulette-images
 * Opcional: DGA_FETCH_IDS=227,203 DGA_FETCH_PER_MS=8000
 */
import "dotenv/config";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import WebSocket from "ws";

import {
  LOBBY_FIXED_TABLE_IDS,
  ROTATING_ROOM_PREMIUM_TABLE_IDS,
  lobbyTableDisplayName,
} from "../src/lib/roulette/lobbyTables.ts";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";
const PER_MS = Math.max(4_000, Number(process.env.DGA_FETCH_PER_MS ?? 9_000) || 9_000);
const SUBSCRIBE_FALLBACK_MS = Math.max(
  0,
  Number(process.env.ROULETTE_SUBSCRIBE_DELAY_MS ?? 400) || 400,
);
const OUT_DIR = path.resolve(process.cwd(), "public/lobby/dga");
const MANIFEST_PATH = path.resolve(process.cwd(), "scripts/.dga-roulette-table-images.json");

function parseIds(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const p of raw.split(/[\s,]+/)) {
    const n = parseInt(p.trim(), 10);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function defaultTableIds(): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of [...LOBBY_FIXED_TABLE_IDS, ...ROTATING_ROOM_PREMIUM_TABLE_IDS]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.sort((a, b) => a - b);
}

type TableMeta = {
  tableId: number;
  label: string;
  tableName: string | null;
  tableImage: string | null;
  localFile: string | null;
  downloadError: string | null;
};

function extractTableMeta(parsed: Record<string, unknown>): {
  tableName: string | null;
  tableImage: string | null;
} {
  const directName = parsed.tableName;
  const directImage = parsed.tableImage;
  let tableName =
    typeof directName === "string" && directName.trim() ? directName.trim() : null;
  let tableImage =
    typeof directImage === "string" && directImage.trim() ? directImage.trim() : null;

  const nested = parsed.pragmaticTable;
  if (nested != null && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    if (!tableName && typeof n.tableName === "string" && n.tableName.trim()) {
      tableName = n.tableName.trim();
    }
    if (!tableImage && typeof n.tableImage === "string" && n.tableImage.trim()) {
      tableImage = n.tableImage.trim();
    }
  }

  return { tableName, tableImage };
}

function fetchOneTable(tableId: number): Promise<{ tableName: string | null; tableImage: string | null }> {
  return new Promise((resolve) => {
    let tableName: string | null = null;
    let tableImage: string | null = null;
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
        if (!subscribed && parsed.tableKey != null) {
          if (fb) {
            clearTimeout(fb);
            fb = null;
          }
          sendSubscribe();
        }
        const meta = extractTableMeta(parsed);
        if (meta.tableName && !tableName) tableName = meta.tableName;
        if (meta.tableImage && !tableImage) tableImage = meta.tableImage;
        if (tableName && tableImage) {
          try {
            ws.close();
          } catch {
            /* */
          }
        }
      } catch {
        /* ignore */
      }
    });

    ws.on("error", () => {});

    setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* */
      }
      resolve({ tableName, tableImage });
    }, PER_MS);
  });
}

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return ".png";
    if (pathname.endsWith(".webp")) return ".webp";
    if (pathname.endsWith(".jpeg")) return ".jpeg";
    if (pathname.endsWith(".jpg")) return ".jpg";
  } catch {
    /* */
  }
  return ".jpg";
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "singlestake-dga-fetch/1.0",
      Accept: "image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error("Sem corpo na resposta");
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(destPath));
}

async function main() {
  const ids = parseIds(process.env.DGA_FETCH_IDS) ;
  const tableIds = ids.length > 0 ? ids : defaultTableIds();

  await mkdir(OUT_DIR, { recursive: true });

  console.log("DGA fetch posters | casino:", CASINO_ID);
  console.log("Mesas:", tableIds.join(", "));
  console.log("Timeout por mesa:", PER_MS / 1000, "s\n");

  const results: TableMeta[] = [];

  for (const tableId of tableIds) {
    const label = lobbyTableDisplayName(tableId);
    process.stdout.write(`[${tableId}] ${label} … `);

    const { tableName, tableImage } = await fetchOneTable(tableId);

    let localFile: string | null = null;
    let downloadError: string | null = null;

    if (tableImage) {
      const ext = extFromUrl(tableImage);
      const filename = `${tableId}${ext}`;
      const dest = path.join(OUT_DIR, filename);
      try {
        await downloadImage(tableImage, dest);
        localFile = `lobby/dga/${filename}`;
        console.log("OK", tableName ?? "", "\n ", tableImage, "\n →", localFile);
      } catch (e) {
        downloadError = e instanceof Error ? e.message : String(e);
        console.log("URL OK, download falhou:", downloadError, "\n ", tableImage);
      }
    } else {
      console.log("sem tableImage", tableName ? `(${tableName})` : "");
    }

    results.push({
      tableId,
      label,
      tableName,
      tableImage,
      localFile,
      downloadError,
    });
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const withImage = results.filter((r) => r.tableImage);
  const downloaded = results.filter((r) => r.localFile);
  const missing = results.filter((r) => !r.tableImage);

  console.log("\n--- Resumo ---");
  console.log("Com tableImage DGA:", withImage.length, "/", results.length);
  console.log("Descarregadas:", downloaded.length);
  if (missing.length) {
    console.log("Sem imagem:", missing.map((r) => r.tableId).join(", "));
  }
  console.log("Manifesto:", MANIFEST_PATH);

  console.log("\n--- URLs DGA ---");
  for (const r of withImage) {
    console.log(`${r.tableId}\t${r.label}\t${r.tableImage}`);
  }

  process.exit(missing.length > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
