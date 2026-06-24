/**
 * WebSocket DGA — **Super Trunfo Futebol Latino** (Pragmatic, mesa 4022).
 * Histórico em `gameResult[]` (não `last20Results`).
 */

import { DGA_FOOTBALL_BLITZ_DEFAULT_TABLE_KEY } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import type { FootballBlitzWinner } from "@/lib/pragmatic/dgaFootballBlitzHistory";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";

const RECONNECT_MS = 5000;
const PING_MS = 30_000;
const SUBSCRIBE_FALLBACK_MS = Math.max(
  0,
  Number(process.env.ROULETTE_SUBSCRIBE_DELAY_MS ?? 400) || 400,
);

export type DgaFootballBlitzRound = {
  gameId: string;
  winner: FootballBlitzWinner;
  winningNumber: number;
  scoreDiff: number;
  time?: string;
};

export type DgaFootballBlitzSocketOptions = {
  onDisconnect?: (message: string) => void;
  debug?: boolean;
  tableKey?: number;
  onTableHistorySnapshot?: (rounds: DgaFootballBlitzRound[]) => void;
};

type WsGameResultRow = {
  scoreDiff?: number;
  winningNumber?: number;
  gameId?: string;
  time?: string;
  gameResult?: string;
};

const isDebug = (options?: DgaFootballBlitzSocketOptions): boolean =>
  options?.debug === true || process.env.DEBUG_DGA_FOOTBALL_BLITZ_WS === "1";

function parseWinner(raw: unknown): FootballBlitzWinner | null {
  if (typeof raw !== "string") return null;
  const w = raw.trim().toLowerCase();
  if (w === "home" || w === "away" || w === "draw") return w;
  return null;
}

function parseOneRoundRow(row: WsGameResultRow | undefined): DgaFootballBlitzRound | null {
  if (row == null || row.gameId === undefined || row.gameId === "") return null;
  const winner = parseWinner(row.gameResult);
  if (!winner) return null;
  const winningNumber = Number(row.winningNumber);
  if (!Number.isFinite(winningNumber)) return null;
  return {
    gameId: String(row.gameId),
    winner,
    winningNumber,
    scoreDiff: Number(row.scoreDiff) || 0,
    time: typeof row.time === "string" ? row.time : undefined,
  };
}

function parseGameResultSnapshot(parsed: Record<string, unknown>): DgaFootballBlitzRound[] {
  const arr = parsed.gameResult as WsGameResultRow[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const out: DgaFootballBlitzRound[] = [];
  for (const row of arr) {
    if (row == null || typeof row !== "object") continue;
    const r = parseOneRoundRow(row as WsGameResultRow);
    if (r) out.push(r);
  }
  return out;
}

const parseLatestRound = (parsed: Record<string, unknown>): DgaFootballBlitzRound | null => {
  const arr = parsed.gameResult as WsGameResultRow[] | undefined;
  return parseOneRoundRow(arr?.[0]);
};

const parseApiError = (parsed: Record<string, unknown>): string | null => {
  if (parsed.error != null) return String(parsed.error);
  if (parsed.type === "error" && typeof parsed.message === "string") return parsed.message;
  return null;
};

const isTableLikeObject = (o: Record<string, unknown>): boolean =>
  "gameResult" in o ||
  "tableName" in o ||
  "tableOpen" in o ||
  "pragmaticTable" in o;

export function parseDgaFootballBlitzTableKeyFromEnv(): number {
  const raw = process.env.DGA_FOOTBALL_BLITZ_TABLE_KEY?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DGA_FOOTBALL_BLITZ_DEFAULT_TABLE_KEY;
}

export const startDgaFootballBlitzSocket = (
  onRound: (round: DgaFootballBlitzRound) => void,
  options?: DgaFootballBlitzSocketOptions,
): (() => void) => {
  const tableKey = options?.tableKey ?? parseDgaFootballBlitzTableKeyFromEnv();

  const messageContainsOurTableKey = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) {
      return value.some((item) => messageContainsOurTableKey(item));
    }
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      if ("tableKey" in o) {
        const tk = o.tableKey;
        if (Number(tk) === tableKey || String(tk) === String(tableKey)) return true;
      }
      if (isTableLikeObject(o) && "key" in o) {
        const k = o.key;
        if (Number(k) === tableKey || String(k) === String(tableKey)) return true;
      }
      return Object.values(o).some((v) => messageContainsOurTableKey(v));
    }
    return false;
  };

  let ws: WebSocket | null = null;
  let stopped = false;
  let lastGameId: string | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let subscribeFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let disconnectNotified = false;
  let spinBaselined = false;
  let subscribedThisConnection = false;

  const connect = () => {
    console.log("[Football Blitz] WS →", WS_URL, "| casino:", CASINO_ID, "| key:", tableKey);
    const socket = new WebSocket(WS_URL);
    ws = socket;

    const sendAvailable = () => {
      socket.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
    };

    const sendSubscribe = (reason: string) => {
      if (subscribeFallbackTimer) {
        clearTimeout(subscribeFallbackTimer);
        subscribeFallbackTimer = null;
      }
      if (subscribedThisConnection) return;
      if (socket.readyState !== 1) return;
      socket.send(
        JSON.stringify({
          type: "subscribe",
          casinoId: CASINO_ID,
          key: tableKey,
          currency: CURRENCY,
        }),
      );
      subscribedThisConnection = true;
      console.log("[Football Blitz] subscribe", tableKey, "|", reason);
    };

    socket.addEventListener("open", () => {
      if (ws !== socket) return;
      disconnectNotified = false;
      spinBaselined = false;
      subscribedThisConnection = false;
      sendAvailable();
      if (subscribeFallbackTimer) clearTimeout(subscribeFallbackTimer);
      subscribeFallbackTimer = setTimeout(() => {
        subscribeFallbackTimer = null;
        if (!stopped && ws === socket) sendSubscribe("fallback");
      }, SUBSCRIBE_FALLBACK_MS);
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws === socket && socket.readyState === 1) {
          socket.send(JSON.stringify({ type: "ping", pingTime: Date.now().toString() }));
        }
      }, PING_MS);
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      if (ws !== socket) return;
      try {
        const raw = typeof event.data === "string" ? event.data : String(event.data);
        if (process.env.DEBUG_DGA_FOOTBALL_BLITZ_WS_MSG === "1" || isDebug(options)) {
          const max = 8000;
          console.log("[Football Blitz] ←", raw.length > max ? `${raw.slice(0, max)}…` : raw);
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        const apiError = parseApiError(parsed);
        if (apiError) {
          console.error("[Football Blitz] API error:", apiError);
          return;
        }

        if (!subscribedThisConnection) {
          const rootTk = parsed.tableKey;
          if (rootTk != null && rootTk !== "") {
            sendSubscribe("root-tableKey");
            return;
          }
          if (messageContainsOurTableKey(parsed)) {
            sendSubscribe("nested-tableKey");
          }
        }

        if (subscribedThisConnection) {
          const snapshot = parseGameResultSnapshot(parsed);
          if (snapshot.length > 0 && options?.onTableHistorySnapshot) {
            options.onTableHistorySnapshot(snapshot);
          }
        }

        const round = parseLatestRound(parsed);
        if (!round || !subscribedThisConnection) return;

        if (!spinBaselined) {
          lastGameId = round.gameId;
          spinBaselined = true;
          return;
        }
        if (round.gameId === lastGameId) return;
        lastGameId = round.gameId;
        onRound(round);
      } catch (e) {
        console.error("[Football Blitz] parse error:", e);
      }
    });

    socket.addEventListener("error", (ev) => {
      if (ws === socket) console.error("[Football Blitz] WS error:", ev);
    });

    socket.addEventListener("close", (event: CloseEvent) => {
      if (ws !== socket) return;
      if (subscribeFallbackTimer) {
        clearTimeout(subscribeFallbackTimer);
        subscribeFallbackTimer = null;
      }
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      console.warn("[Football Blitz] WS closed", event.code, event.reason);
      if (!stopped) {
        if (!disconnectNotified) {
          options?.onDisconnect?.("A ligar ao Super Trunfo…");
          disconnectNotified = true;
        }
        setTimeout(connect, RECONNECT_MS);
      }
    });
  };

  connect();

  return () => {
    stopped = true;
    if (subscribeFallbackTimer) {
      clearTimeout(subscribeFallbackTimer);
      subscribeFallbackTimer = null;
    }
    if (pingInterval) clearInterval(pingInterval);
    try {
      ws?.close();
    } catch {
      /* */
    }
  };
};
