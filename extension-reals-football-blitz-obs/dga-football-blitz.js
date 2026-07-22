const FOOTBALL_BLITZ_DGA_DEFAULTS = Object.freeze({
  wsUrl: "wss://dga.pragmaticplaylive.net/ws",
  casinoId: "ppcdk00000005148",
  currency: "BRL",
  tableKey: 4001,
  reconnectMs: 5000,
  pingMs: 20_000,
  subscribeDelayMs: 400,
});

function parseFootballBlitzRound(row) {
  if (!row || row.gameId == null || row.gameId === "") return null;
  const winner = String(row.gameResult ?? "").toLowerCase();
  if (winner !== "home" && winner !== "away" && winner !== "draw") return null;
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

function parseFootballBlitzSnapshot(message) {
  if (!Array.isArray(message?.gameResult)) return [];
  return message.gameResult.map(parseFootballBlitzRound).filter(Boolean);
}

function messageContainsFootballBlitzTable(value, tableKey) {
  if (value == null) return false;
  if (Array.isArray(value)) {
    return value.some((item) => messageContainsFootballBlitzTable(item, tableKey));
  }
  if (typeof value !== "object") return false;
  if (Number(value.tableKey) === tableKey) return true;
  if (
    Number(value.key) === tableKey &&
    ("gameResult" in value || "tableName" in value || "pragmaticTable" in value)
  ) {
    return true;
  }
  return Object.values(value).some((item) => messageContainsFootballBlitzTable(item, tableKey));
}

function createFootballBlitzDga(options = {}) {
  const config = { ...FOOTBALL_BLITZ_DGA_DEFAULTS, ...(options.config ?? {}) };
  let socket = null;
  let stopped = false;
  let subscribed = false;
  let lastGameId = null;
  let snapshotSent = false;
  let shuffleActive = false;
  let reconnectTimer = null;
  let subscribeTimer = null;
  let pingTimer = null;

  function clearTimers() {
    if (subscribeTimer) clearTimeout(subscribeTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearInterval(pingTimer);
    subscribeTimer = null;
    reconnectTimer = null;
    pingTimer = null;
  }

  function subscribe(reason) {
    if (subscribed || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "subscribe",
        casinoId: config.casinoId,
        key: config.tableKey,
        currency: config.currency,
      }),
    );
    subscribed = true;
    options.onLog?.(`Mesa ${config.tableKey} inscrita (${reason})`);
  }

  function connect() {
    if (stopped) return;
    clearTimers();
    subscribed = false;
    snapshotSent = false;
    shuffleActive = false;
    socket = new WebSocket(config.wsUrl);
    options.onStatus?.("connecting");

    socket.addEventListener("open", () => {
      if (stopped) return;
      options.onStatus?.("open");
      socket.send(JSON.stringify({ type: "available", casinoId: config.casinoId }));
      subscribeTimer = setTimeout(() => subscribe("fallback"), config.subscribeDelayMs);
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping", pingTime: String(Date.now()) }));
        }
      }, config.pingMs);
    });

    socket.addEventListener("message", (event) => {
      if (stopped) return;
      try {
        const parsed = JSON.parse(String(event.data));
        if (!subscribed) {
          if (
            parsed.tableKey != null ||
            messageContainsFootballBlitzTable(parsed, config.tableKey)
          ) {
            subscribe("table-key");
          }
        }
        if (!subscribed) return;

        const snapshot = parseFootballBlitzSnapshot(parsed);

        // Mudança de baralho (DGA: shuffle false → true)
        if (typeof parsed?.shuffle === "boolean") {
          const shuffleNow = parsed.shuffle === true;
          if (shuffleNow && !shuffleActive) {
            options.onShuffle?.({
              detectedAt: new Date().toISOString(),
              tableKey: config.tableKey,
              suppressGameIds: snapshot.map((r) => r.gameId).filter(Boolean),
            });
          }
          shuffleActive = shuffleNow;
        }

        if (snapshot.length === 0) return;
        if (!snapshotSent) {
          snapshotSent = true;
          lastGameId = snapshot[0]?.gameId ?? null;
          options.onSnapshot?.(snapshot);
          return;
        }
        const latest = snapshot[0];
        if (!latest || latest.gameId === lastGameId) return;
        lastGameId = latest.gameId;
        options.onRound?.(latest, snapshot);
      } catch (error) {
        options.onLog?.(`Mensagem DGA inválida: ${String(error)}`);
      }
    });

    socket.addEventListener("close", () => {
      clearTimers();
      if (stopped) return;
      options.onStatus?.("reconnecting");
      reconnectTimer = setTimeout(connect, config.reconnectMs);
    });

    socket.addEventListener("error", () => options.onStatus?.("error"));
  }

  return {
    start() {
      stopped = false;
      connect();
    },
    stop() {
      stopped = true;
      clearTimers();
      try {
        socket?.close();
      } catch {
        // A ligação já estava fechada.
      }
      socket = null;
      options.onStatus?.("stopped");
    },
  };
}

globalThis.SinglestakeFootballBlitzDga = {
  createFootballBlitzDga,
  parseFootballBlitzRound,
  parseFootballBlitzSnapshot,
  FOOTBALL_BLITZ_DGA_DEFAULTS,
};
