/** Sincroniza o motor Um Fator da extensão com o servidor (visor + extrato + automação). */
const SYNC_VERSION = 1;
const SYNC_DEBOUNCE_MS = 350;
const SYNC_TIMEOUT_MS = 8_000;

const DEFAULT_SYNC_URLS = [
  "https://stake37.com.br/api/roulette/extension-sync",
  "https://auto.stake37.com.br/api/roulette/extension-sync",
  "http://127.0.0.1:3000/api/roulette/extension-sync",
  "http://127.0.0.1:3001/api/roulette/extension-sync",
];

/** @type {number} */
let syncSeq = 0;
/** @type {ReturnType<typeof setTimeout>|null} */
let debounceTimer = null;
/** @type {unknown|null} */
let pendingPayload = null;
/** @type {Set<string>} */
const syncedSettlementKeys = new Set();

function readSyncUrls(cfg) {
  const fromCfg = Array.isArray(cfg?.syncUrls)
    ? cfg.syncUrls.filter((u) => typeof u === "string" && u.trim())
    : [];
  if (fromCfg.length > 0) return fromCfg.map((u) => u.trim());
  return DEFAULT_SYNC_URLS;
}

function readSyncSecret(cfg) {
  if (typeof cfg?.syncSecret === "string" && cfg.syncSecret.trim()) {
    return cfg.syncSecret.trim();
  }
  return null;
}

function settlementDedupeKey(flash, recoveryBefore) {
  return `${flash.tableId}:${flash.resultNumber}:${flash.kind}:${recoveryBefore}`;
}

function rememberSyncedSettlement(key) {
  if (syncedSettlementKeys.has(key)) return false;
  syncedSettlementKeys.add(key);
  if (syncedSettlementKeys.size > 4000) {
    const drop = syncedSettlementKeys.size - 3000;
    let i = 0;
    for (const k of syncedSettlementKeys) {
      syncedSettlementKeys.delete(k);
      if (++i >= drop) break;
    }
  }
  return true;
}

function buildPayload(engine, cfg, autopilotRunning, settlements) {
  const state = engine.getState();
  const histories = {};
  for (const [id, list] of Object.entries(state.histories ?? {})) {
    histories[String(id)] = Array.isArray(list) ? [...list] : [];
  }

  const settlementList = [];
  for (const item of settlements ?? []) {
    const flash = item?.flash;
    const recoveryBefore = item?.recoveryBefore;
    if (!flash || typeof recoveryBefore !== "number") continue;
    if (flash.kind !== "win" && flash.kind !== "loss" && flash.kind !== "recovery") continue;
    const dedupeKey = settlementDedupeKey(flash, recoveryBefore);
    if (!rememberSyncedSettlement(dedupeKey)) continue;
    settlementList.push({ recoveryBefore, flash, dedupeKey });
  }

  syncSeq += 1;
  const secret = readSyncSecret(cfg);
  if (!secret) return null;

  return {
    version: SYNC_VERSION,
    secret,
    seq: syncSeq,
    updatedAt: Date.now(),
    autopilotRunning: autopilotRunning === true,
    tableIds: [...(state.tableIds ?? engine.tableIds ?? [])],
    histories,
    machine: state.machine,
    stats: state.stats,
    maxRecovery: state.maxRecovery,
    settlements: settlementList,
  };
}

async function postSyncUrl(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: "omit",
    });
    return { url, ok: res.ok, status: res.status };
  } catch (err) {
    return {
      url,
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function flushPending() {
  debounceTimer = null;
  const payload = pendingPayload;
  pendingPayload = null;
  if (!payload) return;

  const cfg = payload.cfg;
  const urls = readSyncUrls(cfg);
  const body = buildPayload(payload.engine, cfg, payload.autopilotRunning, payload.settlements);
  if (!body) return;

  await Promise.all(urls.map((url) => postSyncUrl(url, body)));
}

/**
 * @param {ReturnType<SinglestakeUmFator['createUmFatorEngine']>} engine
 * @param {Awaited<ReturnType<typeof readDgaConfig>>} cfg
 * @param {{ autopilotRunning?: boolean, settlements?: Array<{ recoveryBefore: number, flash: unknown }> }} [options]
 */
function scheduleExtensionServerSync(engine, cfg, options = {}) {
  if (!engine) return;
  if (!readSyncSecret(cfg)) return;

  if (!pendingPayload) {
    pendingPayload = {
      engine,
      cfg,
      autopilotRunning: options.autopilotRunning === true,
      settlements: [],
    };
  } else {
    pendingPayload.engine = engine;
    pendingPayload.cfg = cfg;
    if (options.autopilotRunning === true) pendingPayload.autopilotRunning = true;
  }

  if (Array.isArray(options.settlements) && options.settlements.length > 0) {
    pendingPayload.settlements.push(...options.settlements);
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void flushPending();
  }, SYNC_DEBOUNCE_MS);
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeServerSync = {
    scheduleExtensionServerSync,
    settlementDedupeKey,
    DEFAULT_SYNC_URLS,
  };
}
