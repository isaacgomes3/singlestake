/** Ligação directa à DGA Pragmatic — uma WebSocket por mesa (sem localhost). */
const DGA_DEFAULTS = {
  wsUrl: "wss://dga.pragmaticplaylive.net/ws",
  casinoId: "ppcdk00000005148",
  currency: "BRL",
  subscribeDelayMs: 400,
  reconnectMs: 5000,
  pingMs: 30_000,
};

function parseSpin(parsed) {
  const fromRow = (row) => {
    if (!row || row.gameId === undefined || row.gameId === "") return null;
    if (row.result === undefined || row.result === null) return null;
    const number = typeof row.result === "number" ? row.result : parseInt(String(row.result), 10);
    if (Number.isNaN(number) || number < 1 || number > 24) return null;
    return { number, gameId: String(row.gameId) };
  };

  const fromEvent = fromRow(parsed.resultEvent);
  if (fromEvent) return fromEvent;

  const last20 = parsed.last20Results;
  return Array.isArray(last20) ? fromRow(last20[0]) : null;
}

function parseLast20(parsed) {
  const last20 = parsed.last20Results;
  if (!Array.isArray(last20)) return [];
  const out = [];
  for (const row of last20) {
    if (!row || typeof row !== "object") continue;
    if (row.gameId === undefined || row.gameId === "") continue;
    if (row.result === undefined || row.result === null) continue;
    const number = typeof row.result === "number" ? row.result : parseInt(String(row.result), 10);
    if (Number.isNaN(number) || number < 1 || number > 24) continue;
    out.push({ number, gameId: String(row.gameId) });
  }
  return out;
}

function messageContainsTableKey(value, tableId) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => messageContainsTableKey(item, tableId));
  if (typeof value === "object") {
    const o = value;
    if ("tableKey" in o) {
      const tk = o.tableKey;
      if (Number(tk) === tableId || String(tk) === String(tableId)) return true;
    }
    if (
      ("last20Results" in o ||
        "resultEvent" in o ||
        "tableName" in o ||
        "tableImage" in o ||
        "tableOpen" in o ||
        "pragmaticTable" in o) &&
      "key" in o
    ) {
      const k = o.key;
      if (Number(k) === tableId || String(k) === String(tableId)) return true;
    }
    return Object.values(o).some((v) => messageContainsTableKey(v, tableId));
  }
  return false;
}

function createTableSocket(tableId, config, callbacks) {
  const { wsUrl, casinoId, currency, subscribeDelayMs, reconnectMs, pingMs } = config;
  let ws = null;
  let stopped = false;
  let subscribed = false;
  let spinBaselined = false;
  let historySnapshotSent = false;
  let lastGameId = null;
  let pingInterval = null;
  let subscribeTimer = null;
  let reconnectTimer = null;

  const sendSubscribe = (reason) => {
    if (subscribeTimer) {
      clearTimeout(subscribeTimer);
      subscribeTimer = null;
    }
    if (subscribed || !ws || ws.readyState !== 1) return;
    ws.send(
      JSON.stringify({
        type: "subscribe",
        casinoId,
        key: tableId,
        currency,
      }),
    );
    subscribed = true;
    callbacks.onLog?.(`mesa ${tableId} inscrita (${reason})`);
  };

  const connect = () => {
    if (stopped) return;
    ws = new WebSocket(wsUrl);
    subscribed = false;
    spinBaselined = false;
    historySnapshotSent = false;

    ws.addEventListener("open", () => {
      if (stopped) return;
      callbacks.onStatus?.({ state: "open", tableId });
      ws.send(JSON.stringify({ type: "available", casinoId }));
      subscribeTimer = setTimeout(() => sendSubscribe("fallback"), subscribeDelayMs);
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws?.readyState === 1) {
          ws.send(JSON.stringify({ type: "ping", pingTime: Date.now().toString() }));
        }
      }, pingMs);
    });

    ws.addEventListener("message", (event) => {
      if (stopped) return;
      try {
        const parsed = JSON.parse(String(event.data));

        if (!subscribed) {
          if (parsed.tableKey != null && parsed.tableKey !== "") {
            sendSubscribe("root-tableKey");
          } else if (messageContainsTableKey(parsed, tableId)) {
            sendSubscribe("nested-tableKey");
          }
        }

        if (subscribed) {
          const snapshot = parseLast20(parsed);
          if (snapshot.length > 0 && !historySnapshotSent) {
            historySnapshotSent = true;
            lastGameId = snapshot[0].gameId;
            spinBaselined = true;
            callbacks.onHistorySnapshot?.(tableId, snapshot);
          }
        }

        const spin = parseSpin(parsed);
        if (!spin || !subscribed) return;

        if (spin.gameId === lastGameId) return;
        lastGameId = spin.gameId;
        callbacks.onSpin?.(tableId, spin);
      } catch {
        /* ignore */
      }
    });

    ws.addEventListener("close", () => {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (stopped) return;
      callbacks.onStatus?.({ state: "reconnecting", tableId });
      reconnectTimer = setTimeout(connect, reconnectMs);
    });

    ws.addEventListener("error", () => {
      callbacks.onStatus?.({ state: "error", tableId });
    });
  };

  connect();

  return () => {
    stopped = true;
    if (pingInterval) clearInterval(pingInterval);
    if (subscribeTimer) clearTimeout(subscribeTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
  };
}

/**
 * @param {object} options
 * @param {number[]} options.tableIds
 * @param {(tableId: number, spin: {number: number, gameId: string}) => void} [options.onSpin]
 * @param {(tableId: number, spins: {number: number, gameId: string}[]) => void} [options.onHistorySnapshot]
 * @param {(status: {state: string, tableId?: number}) => void} [options.onStatus]
 * @param {(msg: string) => void} [options.onLog]
 * @param {Partial<typeof DGA_DEFAULTS>} [options.config]
 */
function createDgaHub(options) {
  const config = { ...DGA_DEFAULTS, ...(options.config ?? {}) };
  const disposers = [];
  let running = false;

  return {
    start() {
      if (running) return;
      running = true;
      for (const tableId of options.tableIds) {
        disposers.push(
          createTableSocket(tableId, config, {
            onSpin: options.onSpin,
            onHistorySnapshot: options.onHistorySnapshot,
            onStatus: options.onStatus,
            onLog: options.onLog,
          }),
        );
      }
      options.onLog?.(`DGA ligada · ${options.tableIds.length} mesas`);
    },
    stop() {
      running = false;
      while (disposers.length) {
        const dispose = disposers.pop();
        dispose?.();
      }
      options.onLog?.("DGA desligada");
    },
    isRunning() {
      return running;
    },
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeDgaHub = { createDgaHub, DGA_DEFAULTS };
}
