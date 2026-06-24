/**
 * Liga ao WebSocket DGA da Pragmatic, envia `available` e lê o payload com `tableKey`
 * (lista de IDs de mesas disponíveis para o `casinoId`).
 *
 * Uso: npm run dga:list-tables
 * Opcional (.env): ROULETTE_WS_URL, ROULETTE_CASINO_ID
 * Primeira mensagem JSON completa: DGA_DISCOVER_DEBUG=1
 */
import "dotenv/config";
import WebSocket from "ws";

import { LOBBY_FIXED_TABLE_IDS } from "../src/lib/roulette/lobbyTables.ts";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const RUN_MS = Math.max(3_000, Number(process.env.DGA_DISCOVER_MS ?? 12_000) || 12_000);
const DEBUG = process.env.DGA_DISCOVER_DEBUG === "1";

const tableKeys = new Set<string>();

function ingestTableKeyPayload(parsed: unknown) {
  if (typeof parsed !== "object" || parsed === null) return;
  const tk = (parsed as Record<string, unknown>).tableKey;
  if (!Array.isArray(tk)) return;
  for (const x of tk) {
    if (x === null || x === undefined) continue;
    tableKeys.add(String(x).trim());
  }
}

const socket = new WebSocket(WS_URL);

socket.on("open", () => {
  console.log("Ligado:", WS_URL);
  console.log("casinoId:", CASINO_ID);
  console.log("À escuta até", RUN_MS / 1000, "s (a 1.ª mensagem costuma trazer `tableKey`).\n");
  socket.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
});

socket.on("message", (data) => {
  try {
    const raw = data.toString();
    const parsed = JSON.parse(raw) as unknown;
    if (DEBUG) {
      const max = 8_000;
      console.log("--- JSON (truncado) ---\n", raw.length > max ? `${raw.slice(0, max)}…` : raw, "\n");
    }
    ingestTableKeyPayload(parsed);
  } catch {
    /* ignore */
  }
});

socket.on("error", (e) => {
  console.error("Erro WS:", e);
});

function sortKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    const aNum = /^\d+$/.test(a) && Number.isFinite(na);
    const bNum = /^\d+$/.test(b) && Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

setTimeout(() => {
  socket.close();
  const keys = sortKeys([...tableKeys]);

  if (keys.length === 0) {
    console.log(
      "Não foi recebido nenhum `tableKey`. Verifique ROULETTE_CASINO_ID ou aumente DGA_DISCOVER_MS.\n",
    );
    process.exit(1);
    return;
  }

  console.log("--- IDs em `tableKey` para este casino (", keys.length, "entradas) ---\n");
  console.log(keys.join(", "));
  console.log();

  const numericOnly = keys.filter((k) => /^\d+$/.test(k));
  const asInts = numericOnly.map((k) => parseInt(k, 10)).filter((n) => n > 0);
  console.log("--- Só numéricos (usar em ROULETTE_TABLE_IDS / subscribe `key`) ---\n");
  console.log(numericOnly.join(", "));
  console.log();
  const preferredBlock = [...LOBBY_FIXED_TABLE_IDS].filter((n) => asInts.includes(n));
  const pick = preferredBlock.length > 0 ? preferredBlock : asInts.slice(0, 7);
  console.log(
    "Exemplo .env (lobby 225–227; acrescente IDs após `npm run dga:probe-spins` se precisar de mais mesas):\n  ROULETTE_TABLE_IDS=" +
      pick.join(",") +
      "\n",
  );
  process.exit(0);
}, RUN_MS);
