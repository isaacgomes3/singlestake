/**
 * WebSocket DGA — jogo **24D Spin** (Pragmatic). Mesmo endpoint que a roleta;
 * `subscribe.key` = tableKey numérico (por defeito **3426**).
 */

import { DGA_24D_SPIN_DEFAULT_TABLE_KEY } from "@/lib/pragmatic/dga24dSpinConstants";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";

const RECONNECT_MS = 5000;
const PING_MS = 30_000;
const SUBSCRIBE_FALLBACK_MS = Math.max(
  0,
  Number(process.env.ROULETTE_SUBSCRIBE_DELAY_MS ?? 400) || 400,
);

export type Dga24dBallColor = "red" | "black";

export type Dga24dSpin = {
  number: number;
  color: Dga24dBallColor | null;
  gameId: string;
};

export type Dga24dSpinSocketOptions = {
  onDisconnect?: (message: string) => void;
  debug?: boolean;
  tableKey?: number;
  onTableHistorySnapshot?: (spins: Dga24dSpin[]) => void;
};

type WsResultRow = {
  result?: string | number;
  gameId?: string;
  color?: string;
};

const isDebug = (options?: Dga24dSpinSocketOptions): boolean =>
  options?.debug === true || process.env.DEBUG_DGA_24D_WS === "1";

function parseBallColor(raw: unknown): Dga24dBallColor | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toLowerCase();
  if (c === "red") return "red";
  if (c === "black") return "black";
  return null;
}

function parseOneSpinRow(row: WsResultRow | undefined): Dga24dSpin | null {
  if (row == null || row.gameId === undefined || row.gameId === "") return null;
  if (row.result === undefined || row.result === null) return null;
  const number =
    typeof row.result === "number" ? row.result : parseInt(String(row.result), 10);
  if (Number.isNaN(number) || number < 1 || number > 24) return null;
  return { number, color: parseBallColor(row.color), gameId: String(row.gameId) };
}

const parseSpin = (parsed: Record<string, unknown>): Dga24dSpin | null => {
  const resultEvent = parsed.resultEvent as WsResultRow | undefined;
  const fromEvent = parseOneSpinRow(resultEvent);
  if (fromEvent) return fromEvent;
  const last20 = parsed.last20Results as WsResultRow[] | undefined;
  return parseOneSpinRow(last20?.[0]);
};

function parseLast20SnapshotFromParsed(parsed: Record<string, unknown>): Dga24dSpin[] {
  const last20 = parsed.last20Results as WsResultRow[] | undefined;
  if (!Array.isArray(last20) || last20.length === 0) return [];
  const out: Dga24dSpin[] = [];
  for (const row of last20) {
    if (row == null || typeof row !== "object") continue;
    const s = parseOneSpinRow(row as WsResultRow);
    if (s) out.push(s);
  }
  return out;
}

const parseApiError = (parsed: Record<string, unknown>): string | null => {
  if (parsed.error != null) return String(parsed.error);
  if (parsed.type === "error" && typeof parsed.message === "string") return parsed.message;
  return null;
};

const isTableLikeObject = (o: Record<string, unknown>): boolean =>
  "last20Results" in o ||
  "resultEvent" in o ||
  "tableName" in o ||
  "tableOpen" in o ||
  "pragmaticTable" in o;

export function parseDga24dSpinTableKeyFromEnv(): number {
  const raw = process.env.DGA_24D_SPIN_TABLE_KEY?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DGA_24D_SPIN_DEFAULT_TABLE_KEY;
}

/**
 * Liga ao feed DGA da mesa 24D Spin (ou outra com o mesmo formato de `last20Results`).
 */
export const startDga24dSpinSocket = (
  onSpin: (spin: Dga24dSpin) => void,
  options?: Dga24dSpinSocketOptions,
): (() => void) => {
  const tableKey = options?.tableKey ?? parseDga24dSpinTableKeyFromEnv();

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
    console.log("[24D Spin] WS →", WS_URL, "| casino:", CASINO_ID, "| key:", tableKey);
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
      console.log("[24D Spin] subscribe", tableKey, "|", reason);
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
        if (process.env.DEBUG_DGA_24D_WS_MSG === "1" || isDebug(options)) {
          const max = 8000;
          console.log("[24D Spin] ←", raw.length > max ? `${raw.slice(0, max)}…` : raw);
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        const apiError = parseApiError(parsed);
        if (apiError) {
          console.error("[24D Spin] API error:", apiError);
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
          const snapshot = parseLast20SnapshotFromParsed(parsed);
          if (snapshot.length > 0 && options?.onTableHistorySnapshot) {
            options.onTableHistorySnapshot(snapshot);
          }
        }

        const spin = parseSpin(parsed);
        if (!spin || !subscribedThisConnection) return;

        if (!spinBaselined) {
          lastGameId = spin.gameId;
          spinBaselined = true;
          return;
        }
        if (spin.gameId === lastGameId) return;
        lastGameId = spin.gameId;
        onSpin(spin);
      } catch (e) {
        console.error("[24D Spin] parse error:", e);
      }
    });

    socket.addEventListener("error", (ev) => {
      if (ws === socket) console.error("[24D Spin] WS error:", ev);
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
      console.warn("[24D Spin] WS closed", event.code, event.reason);
      if (!stopped) {
        if (!disconnectNotified) {
          options?.onDisconnect?.("A ligar ao 24D Spin…");
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
