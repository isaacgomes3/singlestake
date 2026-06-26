/** Autopilot — capta giros na DGA, corre Um Fator e dispara apostas (sem localhost). */
const STORAGE_AUTOPLAY = "gogAutopilotEnabled";
const STORAGE_DGA_CONFIG = "gogDgaConfig";
const STORAGE_AUTO_STATUS = "gogAutopilotStatus";
const STORAGE_AUTO_STATS = "gogAutopilotSessionStats";
const STORAGE_AUTOMATION_BALANCE = "gogAutomationBalance";

const DEFAULT_PRE_BET_WAIT_SEC = 11;
const DEFAULT_MAX_GALES = 5;
const BET_RETRY_MS = 1500;

function clampMaxGales(value) {
  if (globalThis.SinglestakeUmFator?.clampExtensionMaxRecovery) {
    return SinglestakeUmFator.clampExtensionMaxRecovery(value, DEFAULT_MAX_GALES);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_GALES;
  return Math.min(6, Math.max(0, Math.floor(n)));
}

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeUmFator['createUmFatorEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingBetTimers = new Map();

function preBetWaitSec() {
  return SinglestakeUmFator?.EXTENSION_PRE_BET_WAIT_SEC ?? DEFAULT_PRE_BET_WAIT_SEC;
}

function clearPendingBetTimers() {
  for (const timer of pendingBetTimers.values()) {
    clearTimeout(timer);
  }
  pendingBetTimers.clear();
}

async function readAutopilotEnabled() {
  const data = await chrome.storage.local.get([STORAGE_AUTOPLAY]);
  return data[STORAGE_AUTOPLAY] === true;
}

async function readDgaConfig() {
  const data = await chrome.storage.local.get([STORAGE_DGA_CONFIG]);
  const stored = data[STORAGE_DGA_CONFIG];
  const defaults = {
    tableIds: SinglestakeUmFator?.ROTATING_ROOM_TABLE_IDS ?? [227, 203, 230, 201, 206, 237, 213],
    mesaEmbedUrl: null,
    wsUrl: SinglestakeDgaHub?.DGA_DEFAULTS?.wsUrl ?? "wss://dga.pragmaticplaylive.net/ws",
    casinoId: SinglestakeDgaHub?.DGA_DEFAULTS?.casinoId ?? "ppcdk00000005148",
    currency: SinglestakeDgaHub?.DGA_DEFAULTS?.currency ?? "BRL",
    preBetWaitSec: DEFAULT_PRE_BET_WAIT_SEC,
    maxRecovery: DEFAULT_MAX_GALES,
  };
  if (!stored || typeof stored !== "object") return defaults;
  const tableIds = Array.isArray(stored.tableIds)
    ? stored.tableIds.filter((n) => typeof n === "number" && n > 0)
    : defaults.tableIds;
  return {
    tableIds: tableIds.length > 0 ? tableIds : defaults.tableIds,
    mesaEmbedUrl:
      typeof stored.mesaEmbedUrl === "string" && stored.mesaEmbedUrl.trim()
        ? stored.mesaEmbedUrl.trim()
        : null,
    wsUrl:
      typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : defaults.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : defaults.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : defaults.currency,
    preBetWaitSec:
      typeof stored.preBetWaitSec === "number" && stored.preBetWaitSec >= 0
        ? stored.preBetWaitSec
        : defaults.preBetWaitSec,
    maxRecovery: clampMaxGales(stored.maxRecovery ?? defaults.maxRecovery),
  };
}

async function readAutopilotStats(maxRecovery) {
  const data = await chrome.storage.local.get([STORAGE_AUTO_STATS]);
  const raw = data[STORAGE_AUTO_STATS];
  if (!raw?.stats || typeof raw.stats !== "object") return null;
  const mr = clampMaxGales(raw.maxRecovery ?? maxRecovery);
  return { stats: raw.stats, maxRecovery: mr };
}

async function persistAutopilotStats(stats, maxRecovery) {
  const mr = clampMaxGales(maxRecovery);
  await chrome.storage.local.set({
    [STORAGE_AUTO_STATS]: { stats, maxRecovery: mr, updatedAt: new Date().toISOString() },
  });
  await writeAutopilotStatus({ wins: stats.wins ?? 0, losses: stats.losses ?? 0, maxRecovery: mr });
}

async function resetAutopilotStats() {
  const cfg = await readDgaConfig();
  const mr = cfg.maxRecovery;
  const empty = { wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] };
  await persistAutopilotStats(empty, mr);
  if (engine?.resetStats) engine.resetStats();
  return { ok: true, wins: 0, losses: 0, maxRecovery: mr };
}

async function getDgaConfigForPopup() {
  return readDgaConfig();
}

async function setDgaConfigFromPopup(config) {
  await chrome.storage.local.set({ [STORAGE_DGA_CONFIG]: config });
}

async function writeAutopilotStatus(patch) {
  const data = await chrome.storage.local.get([STORAGE_AUTO_STATUS]);
  const prev = data[STORAGE_AUTO_STATUS] ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_AUTO_STATUS]: next });
  return next;
}

async function executeBridgePayload(payload, mesaEmbedUrl, view) {
  if (!bridgeHandler || !payload?.context?.signalId) return;
  if (payload.context.signalId === lastEmittedSignalId) return;

  const stored = await chrome.storage.local.get([STORAGE_AUTOMATION_BALANCE]);
  if (
    payload.context &&
    (payload.context.automationBalance == null || !Number.isFinite(payload.context.automationBalance)) &&
    typeof stored[STORAGE_AUTOMATION_BALANCE] === "number"
  ) {
    payload.context.automationBalance = stored[STORAGE_AUTOMATION_BALANCE];
  }

  lastEmittedSignalId = payload.context.signalId;
  await writeAutopilotStatus({
    active: true,
    tableId: view.globalTableId,
    label: payload.context.factor1Label,
    signalId: payload.context.signalId,
    recovery: payload.context.currentRecovery,
    waitingBet: false,
  });

  try {
    await bridgeHandler(payload, null);
  } catch (e) {
    await writeAutopilotStatus({
      lastError: e instanceof Error ? e.message : String(e),
    });
  }
}

async function scheduleBetAttempt(result, mesaEmbedUrl, cfg) {
  if (!engine || !result?.view?.globalActive || result.view.globalTableId == null) {
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    void writeAutopilotStatus({
      active: false,
      tableId: null,
      label: null,
      signalId: null,
      waitingBet: false,
    });
    return;
  }

  const stored = await chrome.storage.local.get([STORAGE_AUTOMATION_BALANCE]);
  const automationBalance =
    typeof stored[STORAGE_AUTOMATION_BALANCE] === "number" ? stored[STORAGE_AUTOMATION_BALANCE] : null;
  const payload = engine.buildBridgePayload(result, mesaEmbedUrl, automationBalance);
  if (!payload?.context?.signalId) {
    const waitSec = cfg.preBetWaitSec ?? preBetWaitSec();
    const tableId = result.view.globalTableId;
    const state = engine.getState();
    const at = state.lastLiveSpinAtByTable?.[tableId];
    const elapsed = at ? (Date.now() - at) / 1000 : 0;
    const remaining = Math.max(0, waitSec - elapsed);
    void writeAutopilotStatus({
      active: true,
      tableId,
      label: result.view.globalActive
        ? SinglestakeUmFator.doisFatoresFactorLabel(result.view.globalActive.alertFactor)
        : null,
      waitingBet: true,
      waitRemainingSec: Math.ceil(remaining),
    });

    const signalKey = `${tableId}:${result.view.globalActive.resultNumber}:${result.machine.recovery}`;
    if (pendingBetTimers.has(signalKey)) return;

    const delayMs = Math.max(BET_RETRY_MS, remaining * 1000);
    const timer = setTimeout(() => {
      pendingBetTimers.delete(signalKey);
      if (!engine) return;
      void scheduleBetAttempt(engine.runTick(), mesaEmbedUrl, cfg);
    }, delayMs);
    pendingBetTimers.set(signalKey, timer);
    return;
  }

  clearPendingBetTimers();
  void executeBridgePayload(payload, mesaEmbedUrl, result.view);
}

async function processEngineResult(result, mesaEmbedUrl, cfg) {
  if (!result || !engine) return;
  if (result.stats) {
    await persistAutopilotStats(result.stats, cfg.maxRecovery);
  }
  if (!bridgeHandler || !result.view?.globalActive) return;

  void scheduleBetAttempt(result, mesaEmbedUrl, cfg);
}

async function startAutopilot(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  const enabled = await readAutopilotEnabled();
  if (!enabled) {
    await writeAutopilotStatus({ running: false, reason: "autopilot desligado" });
    return;
  }

  if (!globalThis.SinglestakeUmFator?.createUmFatorEngine) {
    await writeAutopilotStatus({
      running: false,
      reason: "um-fator-engine.js em falta — corra npm run extension:build",
    });
    return;
  }

  stopAutopilot();

  const cfg = await readDgaConfig();
  const saved = await readAutopilotStats(cfg.maxRecovery);
  engine = SinglestakeUmFator.createUmFatorEngine({
    tableIds: cfg.tableIds,
    maxRecovery: cfg.maxRecovery,
    initialStats: saved?.stats ?? null,
  });
  lastEmittedSignalId = null;
  clearPendingBetTimers();

  dgaHub = SinglestakeDgaHub.createDgaHub({
    tableIds: cfg.tableIds,
    config: {
      wsUrl: cfg.wsUrl,
      casinoId: cfg.casinoId,
      currency: cfg.currency,
    },
    onLog: (msg) => void writeAutopilotStatus({ log: msg }),
    onStatus: (status) => void writeAutopilotStatus({ dga: status }),
    onHistorySnapshot: async (tableId, spins) => {
      if (!engine) return;
      const result = engine.ingestHistorySnapshot(tableId, spins);
      const cfgNow = await readDgaConfig();
      void processEngineResult(result, cfgNow.mesaEmbedUrl, cfgNow);
    },
    onSpin: (tableId, spin) => {
      if (!engine) return;
      const result = engine.ingestSpin(tableId, spin.number, spin.gameId);
      void readDgaConfig().then((cfgNow) =>
        processEngineResult(result, cfgNow.mesaEmbedUrl, cfgNow),
      );
    },
  });

  dgaHub.start();
  await writeAutopilotStatus({
    running: true,
    reason: null,
    tableIds: cfg.tableIds,
    mesaEmbedUrl: cfg.mesaEmbedUrl,
    preBetWaitSec: cfg.preBetWaitSec ?? preBetWaitSec(),
    maxRecovery: cfg.maxRecovery,
    wins: saved?.stats?.wins ?? 0,
    losses: saved?.stats?.losses ?? 0,
  });
}

function stopAutopilot() {
  clearPendingBetTimers();
  dgaHub?.stop();
  dgaHub = null;
  engine = null;
  lastEmittedSignalId = null;
  void writeAutopilotStatus({ running: false, active: false, waitingBet: false });
}

async function setAutopilotEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_AUTOPLAY]: enabled === true });
  if (enabled) {
    if (bridgeHandler) await startAutopilot(bridgeHandler);
  } else {
    stopAutopilot();
    await writeAutopilotStatus({ running: false, reason: "autopilot desligado" });
  }
}

async function getAutopilotStatus() {
  const data = await chrome.storage.local.get([STORAGE_AUTO_STATUS, STORAGE_AUTOPLAY, STORAGE_AUTO_STATS]);
  const statsPack = data[STORAGE_AUTO_STATS];
  const live = engine?.getState?.();
  const wins = live?.stats?.wins ?? statsPack?.stats?.wins ?? data[STORAGE_AUTO_STATUS]?.wins ?? 0;
  const losses = live?.stats?.losses ?? statsPack?.stats?.losses ?? data[STORAGE_AUTO_STATUS]?.losses ?? 0;
  const maxRecovery =
    live?.maxRecovery ?? statsPack?.maxRecovery ?? data[STORAGE_AUTO_STATUS]?.maxRecovery ?? DEFAULT_MAX_GALES;
  return {
    enabled: data[STORAGE_AUTOPLAY] === true,
    status: {
      ...(data[STORAGE_AUTO_STATUS] ?? { running: false }),
      wins,
      losses,
      maxRecovery,
    },
  };
}

function initSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  void readAutopilotEnabled().then((on) => {
    if (on) void startAutopilot(handleBridgePayload);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_AUTOPLAY] && bridgeHandler) {
      if (changes[STORAGE_AUTOPLAY].newValue === true) {
        void startAutopilot(bridgeHandler);
      } else {
        stopAutopilot();
      }
    }
    if (changes[STORAGE_DGA_CONFIG] && bridgeHandler) {
      void readAutopilotEnabled().then((on) => {
        if (on) void startAutopilot(bridgeHandler);
      });
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeSignalRunner = {
    initSignalRunner,
    startAutopilot,
    stopAutopilot,
    setAutopilotEnabled,
    getAutopilotStatus,
    getDgaConfigForPopup,
    setDgaConfigFromPopup,
    resetAutopilotStats,
    STORAGE_AUTOPLAY,
    STORAGE_DGA_CONFIG,
  };
}
