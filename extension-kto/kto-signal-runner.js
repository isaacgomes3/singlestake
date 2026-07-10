/** Autopilot KTO — Roulette 3 (230) · cruzamento sequencial 2 fatores. */
const STORAGE_KTO_AUTOPLAY = "gogKtoAutopilotEnabled";
const STORAGE_KTO_CONFIG = "gogKtoConfig";
const STORAGE_KTO_STATUS = "gogKtoAutopilotStatus";
const STORAGE_KTO_STATS = "gogKtoAutopilotSessionStats";
const STORAGE_KTO_MACHINE = "gogKtoMachineState";

const DEFAULT_MAX_GALES = 6;
const BET_RETRY_MS = 1500;

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeKtoCruzamento['createKtoCruzamentoEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingBetTimers = new Map();

const KTO_DEFAULTS = {
  tableId: SinglestakeKtoCruzamento?.KTO_TABLE_ID ?? 230,
  mesaUrl:
    SinglestakeKtoCruzamento?.KTO_MESA_URL ??
    "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/",
  wsUrl: SinglestakeDgaHub?.DGA_DEFAULTS?.wsUrl ?? "wss://dga.pragmaticplaylive.net/ws",
  casinoId: SinglestakeDgaHub?.DGA_DEFAULTS?.casinoId ?? "ppcdk00000005148",
  currency: SinglestakeDgaHub?.DGA_DEFAULTS?.currency ?? "BRL",
  maxRecovery: DEFAULT_MAX_GALES,
};

function clampMaxGales(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_GALES;
  return Math.min(6, Math.max(0, Math.floor(n)));
}

function clearPendingBetTimers() {
  for (const timer of pendingBetTimers.values()) {
    clearTimeout(timer);
  }
  pendingBetTimers.clear();
}

async function readKtoAutopilotEnabled() {
  const data = await chrome.storage.local.get([STORAGE_KTO_AUTOPLAY]);
  return data[STORAGE_KTO_AUTOPLAY] === true;
}

async function readKtoConfig() {
  const data = await chrome.storage.local.get([STORAGE_KTO_CONFIG]);
  const stored = data[STORAGE_KTO_CONFIG];
  if (!stored || typeof stored !== "object") return { ...KTO_DEFAULTS };
  const legacy237 =
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" && stored.mesaUrl.includes("roleta-ao-vivo"));
  return {
    tableId:
      legacy237
        ? KTO_DEFAULTS.tableId
        : typeof stored.tableId === "number" && stored.tableId > 0
          ? stored.tableId
          : KTO_DEFAULTS.tableId,
    mesaUrl: legacy237
      ? KTO_DEFAULTS.mesaUrl
      : typeof stored.mesaUrl === "string" && stored.mesaUrl.trim()
        ? stored.mesaUrl.trim()
        : KTO_DEFAULTS.mesaUrl,
    wsUrl:
      typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : KTO_DEFAULTS.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : KTO_DEFAULTS.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : KTO_DEFAULTS.currency,
    maxRecovery: clampMaxGales(stored.maxRecovery ?? KTO_DEFAULTS.maxRecovery),
  };
}

async function readKtoMachineState() {
  const data = await chrome.storage.local.get([STORAGE_KTO_MACHINE]);
  const raw = data[STORAGE_KTO_MACHINE];
  if (!raw || typeof raw !== "object") return null;
  const recovery =
    typeof raw.recovery === "number" && Number.isFinite(raw.recovery)
      ? Math.max(0, Math.floor(raw.recovery))
      : 0;
  const lastSpinHead =
    typeof raw.lastSpinHead === "string" && raw.lastSpinHead.trim()
      ? raw.lastSpinHead.trim()
      : null;
  return { recovery, lastSpinHead };
}

async function persistKtoMachineState(machine) {
  if (!machine || typeof machine !== "object") return;
  await chrome.storage.local.set({
    [STORAGE_KTO_MACHINE]: {
      recovery:
        typeof machine.recovery === "number" && Number.isFinite(machine.recovery)
          ? Math.max(0, Math.floor(machine.recovery))
          : 0,
      lastSpinHead:
        typeof machine.lastSpinHead === "string" ? machine.lastSpinHead : null,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function clearKtoMachineState() {
  await chrome.storage.local.remove([STORAGE_KTO_MACHINE]);
}

async function readKtoStats(maxRecovery) {
  const data = await chrome.storage.local.get([STORAGE_KTO_STATS]);
  const raw = data[STORAGE_KTO_STATS];
  if (!raw?.stats || typeof raw.stats !== "object") return null;
  return { stats: raw.stats, maxRecovery: clampMaxGales(raw.maxRecovery ?? maxRecovery) };
}

async function persistKtoStats(stats, maxRecovery) {
  const mr = clampMaxGales(maxRecovery);
  await chrome.storage.local.set({
    [STORAGE_KTO_STATS]: { stats, maxRecovery: mr, updatedAt: new Date().toISOString() },
  });
  await writeKtoStatus({ wins: stats.wins ?? 0, losses: stats.losses ?? 0, maxRecovery: mr });
}

async function resetKtoStats() {
  const cfg = await readKtoConfig();
  const empty = { wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] };
  await persistKtoStats(empty, cfg.maxRecovery);
  await clearKtoMachineState();
  if (engine?.resetStats) engine.resetStats();
  if (engine?.reset) engine.reset();
  return { ok: true, wins: 0, losses: 0, maxRecovery: cfg.maxRecovery };
}

async function getKtoConfigForPopup() {
  return readKtoConfig();
}

async function setKtoConfigFromPopup(config) {
  await chrome.storage.local.set({ [STORAGE_KTO_CONFIG]: config });
}

async function writeKtoStatus(patch) {
  const data = await chrome.storage.local.get([STORAGE_KTO_STATUS]);
  const prev = data[STORAGE_KTO_STATUS] ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_KTO_STATUS]: next });
  return next;
}

function summarizeBridgeBetResults(results) {
  const clicks = (results ?? []).filter(
    (r) => r?.target === "factor-1" || r?.target === "factor-2",
  );
  const f1 = clicks.find((r) => r?.target === "factor-1");
  const f2 = clicks.find((r) => r?.target === "factor-2");
  const ok = (r) => r?.ok === true && r?.skipped !== true;
  const placed = ok(f1) && ok(f2);
  const detail = clicks
    .map((r) => `${r.target}: ${r.ok ? "ok" : "falhou"}${r.skipped ? " (ignorado)" : ""} — ${r.detail ?? ""}`)
    .join(" | ");
  return { placed, detail, f1, f2 };
}

function formatActiveLabel(active, recovery) {
  if (!active) return null;
  const betFn = globalThis.SinglestakeKtoCruzamento?.ktoCruzamentoBetFactors;
  if (typeof betFn === "function") {
    const bet = betFn(active, recovery ?? 0);
    const l1 = bet.factor1?.value ?? "";
    const l2 = bet.factor2?.value ?? "";
    const suffix = bet.oppositeMode ? " · oposto" : "";
    return `${l1} · ${l2}${suffix}`.trim();
  }
  const f1 = active.factor1;
  const f2 = active.factor2;
  return f1 && f2 ? `${f1.value ?? ""} · ${f2.value ?? ""}`.trim() : null;
}

function idleRecoveryFromResult(result, engine) {
  if (result.flash?.kind === "win") return 0;
  return result.recovery ?? engine?.getState?.()?.machine?.recovery ?? 0;
}

async function executeBridgePayload(payload, mesaUrl) {
  if (!bridgeHandler || !payload?.context?.signalId) return;
  if (payload.context.signalId === lastEmittedSignalId) return;

  lastEmittedSignalId = payload.context.signalId;
  const active = engine?.getState?.()?.machine?.cycle?.active;
  const recovery = payload.context.currentRecovery ?? 0;
  const label =
    payload.context.factor1Label && payload.context.factor2Label
      ? `${payload.context.factor1Label} · ${payload.context.factor2Label}${
          String(payload.context.signalId || "").includes(":opp") ? " · oposto" : ""
        }`
      : formatActiveLabel(active, recovery);

  await writeKtoStatus({
    active: true,
    tableId: payload.context.currentTableId,
    label,
    signalId: payload.context.signalId,
    recovery: payload.context.currentRecovery,
    waitingBet: false,
    lastError: null,
    lastBetDetail: null,
  });

  engine?.beginBetCommit?.();

  try {
    const bridgeResult = await bridgeHandler(payload, null);
    const { placed, detail } = summarizeBridgeBetResults(bridgeResult?.results);
    if (placed && engine?.markBetPlaced) {
      engine.markBetPlaced();
      const live = engine.getState?.();
      if (live?.machine) await persistKtoMachineState(live.machine);
      await writeKtoStatus({
        lastBetDetail: detail || "Aposta enviada (factor-1 + factor-2)",
        lastError: null,
      });
    } else {
      engine?.abortBetCommit?.();
      lastEmittedSignalId = null;
      const errDetail = detail || "Cliques não confirmados — calibre Preto/Vermelho/Par/Ímpar na mesa";
      await writeKtoStatus({
        lastError: errDetail,
        lastBetDetail: detail || null,
      });
      const cfg = await readKtoConfig();
      const retry = engine.runTick();
      const waitMs = Math.max(BET_RETRY_MS, betDelayRemainingMs(retry));
      const signalKey = `retry:${payload.context.signalId}`;
      if (!pendingBetTimers.has(signalKey)) {
        const timer = setTimeout(() => {
          pendingBetTimers.delete(signalKey);
          if (!engine) return;
          scheduleBetAttempt(engine.runTick(), mesaUrl, cfg);
        }, waitMs);
        pendingBetTimers.set(signalKey, timer);
      }
    }
  } catch (e) {
    engine?.abortBetCommit?.();
    lastEmittedSignalId = null;
    const msg = e instanceof Error ? e.message : String(e);
    await writeKtoStatus({
      lastError: msg,
    });
    const cfg = await readKtoConfig();
    scheduleBetAttempt(engine.runTick(), mesaUrl, cfg);
  }
}

function betDelayRemainingMs(result) {
  const state = engine?.getState?.();
  const recovery =
    result?.recovery ??
    state?.machine?.cycle?.recovery ??
    state?.machine?.recovery ??
    0;
  const at = state?.lastLiveSpinAt;
  if (at == null) return BET_RETRY_MS;

  const settleMs =
    recovery > 0
      ? SinglestakeKtoCruzamento?.ROTATING_ROOM_CROSSING_BET_DELAY_MS ?? 6000
      : SinglestakeKtoCruzamento?.ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS ?? 6000;
  const elapsed = Date.now() - at;
  return Math.max(BET_RETRY_MS, settleMs - elapsed);
}

function scheduleBetAttempt(result, mesaUrl, cfg) {
  if (!engine || !result?.active) {
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    void writeKtoStatus({
      active: false,
      tableId: null,
      label: null,
      signalId: null,
      waitingBet: false,
    });
    return;
  }

  const payload = engine.buildBridgePayload(mesaUrl);
  if (!payload?.context?.signalId) {
    const remaining = betDelayRemainingMs(result);
    const tableId = cfg.tableId;
    const active = result.active;
    const label = formatActiveLabel(active, result.recovery ?? 0);

    void writeKtoStatus({
      active: true,
      tableId,
      label,
      waitingBet: true,
      waitRemainingSec: Math.ceil(remaining / 1000),
      recovery: result.recovery,
    });

    const signalKey = `kto:${active?.triggerNumbers?.join("-") ?? "?"}:${result.recovery}`;
    if (pendingBetTimers.has(signalKey)) return;

    const timer = setTimeout(() => {
      pendingBetTimers.delete(signalKey);
      if (!engine) return;
      scheduleBetAttempt(engine.runTick(), mesaUrl, cfg);
    }, remaining);
    pendingBetTimers.set(signalKey, timer);
    return;
  }

  clearPendingBetTimers();
  void executeBridgePayload(payload, mesaUrl);
}

async function processEngineResult(result, mesaUrl, cfg) {
  if (!result || !engine) return;
  if (result.machine) {
    await persistKtoMachineState(result.machine);
  }
  if (result.stats) {
    await persistKtoStats(result.stats, cfg.maxRecovery);
  }

  if (result.flash) {
    const ended = result.flash.kind === "win" || result.flash.kind === "tie" || result.flash.kind === "loss";
    if (ended && !result.active) {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
    }
    const idleRecovery = idleRecoveryFromResult(result, engine);
    const flashKind = result.flash.kind;
    const idleReason =
      flashKind === "tie"
        ? idleRecovery > 0
          ? `Empate — gale ${idleRecovery} mantido · aguarda novo gatilho`
          : "Empate — aguarda novo gatilho (2 factores em comum)"
        : flashKind === "loss"
          ? idleRecovery > 0
            ? `Aguarda novo gatilho · próxima entrada gale ${idleRecovery}`
            : idleRecovery === 0 && (result.stats?.losses ?? 0) > 0
              ? "Derrota final — aguarda novo gatilho"
              : "Aguarda novo gatilho (2 factores em comum)"
          : flashKind === "win"
            ? "Vitória — aguarda novo gatilho"
            : idleRecovery > 0
              ? `Aguarda novo gatilho · próxima entrada gale ${idleRecovery}`
              : "Aguarda novo gatilho (2 factores em comum)";
    await writeKtoStatus({
      lastFlash: flashKind,
      lastResult: result.flash.resultNumber,
      ...(ended && !result.active
        ? {
            active: false,
            label: null,
            lastTrigger: null,
            signalId: null,
            waitingBet: false,
            recovery: idleRecovery,
            reason: idleReason,
          }
        : {}),
    });
  }

  if (result.active) {
    if (result.flash) {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
    }
    const label = formatActiveLabel(result.active, result.recovery ?? 0);
    const displayRecovery =
      result.flash?.kind === "win" ? 0 : (result.recovery ?? 0);
    await writeKtoStatus({
      active: true,
      label,
      recovery: displayRecovery,
      lastTrigger: result.active.triggerNumbers ?? null,
      tableId: cfg.tableId,
      reason: null,
      waitingBet: false,
    });
  }

  if (!bridgeHandler) return;

  scheduleBetAttempt(result, mesaUrl, cfg);
}

async function startKtoAutopilot(handleBridgePayload) {
  if (typeof handleBridgePayload === "function") {
    bridgeHandler = handleBridgePayload;
    globalThis.__singlestakeKtoBridgeHandler = handleBridgePayload;
  }
  const enabled = await readKtoAutopilotEnabled();
  if (!enabled) {
    await writeKtoStatus({ running: false, reason: "autopilot KTO desligado" });
    return;
  }

  if (!globalThis.SinglestakeKtoCruzamento?.createKtoCruzamentoEngine) {
    await writeKtoStatus({
      running: false,
      reason: "kto-cruzamento-engine.js em falta — corra npm run extension:build",
    });
    return;
  }

  stopKtoAutopilot();

  const cfg = await readKtoConfig();
  const saved = await readKtoStats(cfg.maxRecovery);
  const savedMachine = await readKtoMachineState();
  engine = SinglestakeKtoCruzamento.createKtoCruzamentoEngine({
    maxRecovery: cfg.maxRecovery,
    initialStats: saved?.stats ?? null,
    initialMachine: savedMachine,
  });
  lastEmittedSignalId = null;
  clearPendingBetTimers();

  dgaHub = SinglestakeDgaHub.createDgaHub({
    tableIds: [cfg.tableId],
    config: {
      wsUrl: cfg.wsUrl,
      casinoId: cfg.casinoId,
      currency: cfg.currency,
    },
    onLog: (msg) => void writeKtoStatus({ log: msg }),
    onStatus: (status) => void writeKtoStatus({ dga: status }),
    onHistorySnapshot: async (_tableId, spins) => {
      if (!engine) return;
      const result = engine.ingestHistorySnapshot(spins);
      const cfgNow = await readKtoConfig();
      void processEngineResult(result, cfgNow.mesaUrl, cfgNow);
    },
    onSpin: (_tableId, spin) => {
      if (!engine) return;
      const result = engine.ingestSpin(spin.number, spin.gameId);
      if (!result) return;
      void readKtoConfig().then((cfgNow) =>
        processEngineResult(result, cfgNow.mesaUrl, cfgNow),
      );
    },
  });

  dgaHub.start();
  await writeKtoStatus({
    running: true,
    reason: null,
    tableId: cfg.tableId,
    mesaUrl: cfg.mesaUrl,
    maxRecovery: cfg.maxRecovery,
    wins: saved?.stats?.wins ?? 0,
    losses: saved?.stats?.losses ?? 0,
  });
}

function stopKtoAutopilot() {
  clearPendingBetTimers();
  dgaHub?.stop();
  dgaHub = null;
  engine = null;
  lastEmittedSignalId = null;
  void writeKtoStatus({ running: false, active: false, waitingBet: false });
}

async function setKtoAutopilotEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_KTO_AUTOPLAY]: enabled === true });
  if (enabled) {
    await startKtoAutopilot(bridgeHandler ?? globalThis.__singlestakeKtoBridgeHandler ?? null);
    if (!bridgeHandler && !globalThis.__singlestakeKtoBridgeHandler) {
      await writeKtoStatus({
        running: false,
        reason: "Extensão a iniciar — clique Parado/Activo outra vez",
      });
    }
  } else {
    stopKtoAutopilot();
    await writeKtoStatus({ running: false, reason: "autopilot KTO desligado" });
  }
  return getKtoAutopilotStatus();
}

async function getKtoAutopilotStatus() {
  const data = await chrome.storage.local.get([STORAGE_KTO_STATUS, STORAGE_KTO_AUTOPLAY, STORAGE_KTO_STATS]);
  const statsPack = data[STORAGE_KTO_STATS];
  const live = engine?.getState?.();
  const wins = live?.stats?.wins ?? statsPack?.stats?.wins ?? data[STORAGE_KTO_STATUS]?.wins ?? 0;
  const losses = live?.stats?.losses ?? statsPack?.stats?.losses ?? data[STORAGE_KTO_STATUS]?.losses ?? 0;
  const pendingRecovery =
    live?.machine?.recovery ??
    live?.machine?.cycle?.recovery ??
    (await readKtoMachineState())?.recovery ??
    0;
  const maxRecovery =
    live?.maxRecovery ?? statsPack?.maxRecovery ?? data[STORAGE_KTO_STATUS]?.maxRecovery ?? DEFAULT_MAX_GALES;
  return {
    enabled: data[STORAGE_KTO_AUTOPLAY] === true,
    status: {
      ...(data[STORAGE_KTO_STATUS] ?? { running: false }),
      wins,
      losses,
      maxRecovery,
      recovery: pendingRecovery,
      extensionVersion: chrome.runtime.getManifest().version,
    },
  };
}

function initKtoSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  globalThis.__singlestakeKtoBridgeHandler = handleBridgePayload;
  void readKtoAutopilotEnabled().then((on) => {
    if (on) void startKtoAutopilot(handleBridgePayload);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_KTO_AUTOPLAY] && bridgeHandler) {
      if (changes[STORAGE_KTO_AUTOPLAY].newValue === true) {
        void startKtoAutopilot(bridgeHandler);
      } else {
        stopKtoAutopilot();
      }
    }
    if (changes[STORAGE_KTO_CONFIG] && bridgeHandler) {
      void readKtoAutopilotEnabled().then((on) => {
        if (on) void startKtoAutopilot(bridgeHandler);
      });
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeKtoSignalRunner = {
    initKtoSignalRunner,
    startKtoAutopilot,
    stopKtoAutopilot,
    setKtoAutopilotEnabled,
    getKtoAutopilotStatus,
    getKtoConfigForPopup,
    setKtoConfigFromPopup,
    resetKtoStats,
    STORAGE_KTO_AUTOPLAY,
    STORAGE_KTO_CONFIG,
  };
}
