import { LOBBY_FIXED_TABLE_IDS, ROTATING_ROOM_FIXED_TABLE_IDS } from "@/lib/roulette/lobbyTables";

const WS_URL = process.env.ROULETTE_WS_URL ?? "wss://dga.pragmaticplaylive.net/ws";
const CASINO_ID = process.env.ROULETTE_CASINO_ID ?? "ppcdk00000005148";
const DEFAULT_TABLE_ID = Number(process.env.ROULETTE_TABLE_ID ?? 234);
const CURRENCY = process.env.ROULETTE_CURRENCY ?? "BRL";

const RECONNECT_MS = 5000;
const PING_MS = 30_000;
const SUBSCRIBE_FALLBACK_MS = Math.max(
  0,
  Number(process.env.ROULETTE_SUBSCRIBE_DELAY_MS ?? 400) || 400,
);

export type RouletteSpin = {
  number: number;
  gameId: string;
};

export type DgaTableMetaPayload = {
  tableName?: string;
  tableImage?: string;
};

export type RouletteSocketOptions = {
  onDisconnect?: (message: string) => void;
  debug?: boolean;
  tableId?: number;
  /** Últimos resultados da mesa (payload `last20Results`) — alimenta replay SSE e localStorage no cliente. */
  onTableHistorySnapshot?: (spins: RouletteSpin[]) => void;
  /** Metadados da mesa (`tableName`, `tableImage`) vindos da DGA após subscribe. */
  onTableMeta?: (meta: DgaTableMetaPayload) => void;
};

type WsResultRow = {
  result?: string | number;
  gameId?: string;
};

const isDebug = (options?: RouletteSocketOptions): boolean =>
  options?.debug === true || process.env.DEBUG_ROULETTE_WS === "1";

const shouldLogWsPayload = (options?: RouletteSocketOptions): boolean =>
  process.env.DEBUG_ROULETTE_WS_MSG === "1" || isDebug(options);

const logWsIncoming = (raw: string, options?: RouletteSocketOptions) => {
  if (!shouldLogWsPayload(options)) return;
  const max = 12_000;
  const out = raw.length > max ? `${raw.slice(0, max)}\n… (${raw.length} chars total)` : raw;
  console.log("[Roleta] API ←\n", out);
};

const isTableLikeObject = (o: Record<string, unknown>): boolean =>
  "last20Results" in o ||
  "resultEvent" in o ||
  "tableName" in o ||
  "tableImage" in o ||
  "tableOpen" in o ||
  "pragmaticTable" in o;

function parseTableMeta(parsed: Record<string, unknown>): DgaTableMetaPayload | null {
  const directName = parsed.tableName;
  const directImage = parsed.tableImage;
  const tableName = typeof directName === "string" && directName.trim() ? directName.trim() : undefined;
  const tableImage =
    typeof directImage === "string" && directImage.trim() ? directImage.trim() : undefined;
  if (tableName || tableImage) return { tableName, tableImage };

  const nested = parsed.pragmaticTable;
  if (nested != null && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    const nestedName = n.tableName;
    const nestedImage = n.tableImage;
    const nn = typeof nestedName === "string" && nestedName.trim() ? nestedName.trim() : undefined;
    const ni = typeof nestedImage === "string" && nestedImage.trim() ? nestedImage.trim() : undefined;
    if (nn || ni) return { tableName: nn, tableImage: ni };
  }
  return null;
}

const parseSpin = (parsed: Record<string, unknown>): RouletteSpin | null => {
  const fromRow = (row: WsResultRow | undefined): RouletteSpin | null => {
    if (row == null || row.gameId === undefined || row.gameId === "") return null;
    if (row.result === undefined || row.result === null) return null;
    const number =
      typeof row.result === "number" ? row.result : parseInt(String(row.result), 10);
    if (Number.isNaN(number) || number < 0 || number > 36) return null;
    return { number, gameId: row.gameId };
  };

  const resultEvent = parsed.resultEvent as WsResultRow | undefined;
  const fromEvent = fromRow(resultEvent);
  if (fromEvent) return fromEvent;

  const last20 = parsed.last20Results as WsResultRow[] | undefined;
  return fromRow(last20?.[0]);
};

/** Lista de giros em `last20Results` (índice 0 = mais recente, como em `parseSpin`). */
function parseLast20SnapshotFromParsed(parsed: Record<string, unknown>): RouletteSpin[] {
  const last20 = parsed.last20Results as WsResultRow[] | undefined;
  if (!Array.isArray(last20) || last20.length === 0) return [];
  const out: RouletteSpin[] = [];
  for (const row of last20) {
    if (row == null || typeof row !== "object") continue;
    const r = row as WsResultRow;
    if (r.gameId === undefined || r.gameId === "") continue;
    if (r.result === undefined || r.result === null) continue;
    const number =
      typeof r.result === "number" ? r.result : parseInt(String(r.result), 10);
    if (Number.isNaN(number) || number < 0 || number > 36) continue;
    out.push({ number, gameId: String(r.gameId) });
  }
  return out;
}

const parseApiError = (parsed: Record<string, unknown>): string | null => {
  if (parsed.error != null) return String(parsed.error);
  if (parsed.type === "error" && typeof parsed.message === "string") return parsed.message;
  return null;
};

/**
 * Usa a WebSocket global (browser/edge-runtime). Compatível com Cloudflare Workers (workerd).
 */
export const startRouletteSocket = (
  onSpin: (spin: RouletteSpin) => void,
  options?: RouletteSocketOptions,
): (() => void) => {
  const tableId = options?.tableId ?? DEFAULT_TABLE_ID;

  const messageContainsOurTableKey = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) {
      return value.some((item) => messageContainsOurTableKey(item));
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
    console.log(
      "[Roleta] WS a ligar →",
      WS_URL,
      "| casino:",
      CASINO_ID,
      "| mesa (subscribe key):",
      tableId,
    );
    const socket = new WebSocket(WS_URL);
    ws = socket;

    const sendAvailable = () => {
      socket.send(JSON.stringify({ type: "available", casinoId: CASINO_ID }));
    };

    const sendSubscribe = (reason: "root-tableKey" | "nested-tableKey" | "fallback") => {
      if (subscribeFallbackTimer) {
        clearTimeout(subscribeFallbackTimer);
        subscribeFallbackTimer = null;
      }
      if (subscribedThisConnection) return;
      if (socket.readyState !== 1 /* OPEN */) return;
      socket.send(
        JSON.stringify({
          type: "subscribe",
          casinoId: CASINO_ID,
          key: tableId,
          currency: CURRENCY,
        }),
      );
      subscribedThisConnection = true;
      console.log("[Roleta] inscrito na mesa", tableId, "|", reason);
    };

    socket.addEventListener("open", () => {
      if (ws !== socket) return;
      disconnectNotified = false;
      spinBaselined = false;
      subscribedThisConnection = false;
      console.log("[Roleta] conectado | mesa destino (subscribe):", tableId);
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
        logWsIncoming(raw, options);
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        const apiError = parseApiError(parsed);
        if (apiError) {
          console.error("[Roleta] erro API:", apiError);
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
          const meta = parseTableMeta(parsed);
          if (meta) options?.onTableMeta?.(meta);

          const snapshot = parseLast20SnapshotFromParsed(parsed);
          if (snapshot.length > 0 && options?.onTableHistorySnapshot) {
            options.onTableHistorySnapshot(snapshot);
          }
        }

        const spin = parseSpin(parsed);
        if (!spin) return;
        if (!subscribedThisConnection) return;

        if (!spinBaselined) {
          lastGameId = spin.gameId;
          spinBaselined = true;
          if (isDebug(options)) {
            console.log("[Roleta] baseline gameId (sem emitir):", spin.gameId);
          }
          return;
        }

        if (spin.gameId === lastGameId) {
          if (isDebug(options)) {
            console.log("[Roleta] ignorado (mesmo gameId):", spin.gameId);
          }
          return;
        }

        lastGameId = spin.gameId;
        if (isDebug(options)) {
          console.log("[Roleta]", spin.number, "| gameId:", spin.gameId);
        }
        onSpin(spin);
      } catch (err) {
        console.error("[Roleta] erro ao processar mensagem:", err);
      }
    });

    socket.addEventListener("error", (event) => {
      if (ws === socket) console.error("[Roleta] erro WS:", event);
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

      console.warn("[Roleta] WS fechou", { code: event.code, reason: event.reason });

      if (!stopped) {
        const msg = "Conexão com a roleta instável. Reconectando...";
        if (!disconnectNotified) {
          options?.onDisconnect?.(msg);
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

/**
 * Garante que todas as mesas do lobby e da sala rotativa têm WebSocket — evita cartões no UI sem giros
 * quando `ROULETTE_TABLE_IDS` no servidor fica desactualizado.
 * Ordem: primeiro os IDs vindos do env (define mesa principal = 1.º), depois faltam lobby + sala rotativa.
 */
function mergeEnvTableIdsWithLobby(envIds: readonly number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of envIds) {
    if (Number.isFinite(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  for (const n of LOBBY_FIXED_TABLE_IDS) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  for (const n of ROTATING_ROOM_FIXED_TABLE_IDS) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * Mesas: `ROULETTE_TABLE_IDS` (vírgula/espaço) → `ROULETTE_TABLE_ID` → todas do lobby.
 */
export function parseRouletteTableIdsFromEnv(): number[] {
  const raw = process.env.ROULETTE_TABLE_IDS?.trim();
  if (raw) {
    const ids = raw
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const seen = new Set<number>();
    const out: number[] = [];
    for (const n of ids) {
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
    if (out.length > 0) return mergeEnvTableIdsWithLobby(out);
  }
  const rawSingle = process.env.ROULETTE_TABLE_ID?.trim();
  if (rawSingle) {
    const single = Number(rawSingle);
    if (Number.isFinite(single) && single > 0) return mergeEnvTableIdsWithLobby([single]);
  }
  return [...LOBBY_FIXED_TABLE_IDS];
}
