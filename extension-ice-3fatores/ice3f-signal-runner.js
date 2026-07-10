/** Autopilot ICE — 3 Fatores (201) · cruzamento sequencial 2 fatores. */
const STORAGE_ICE3F_AUTOPLAY = "gogIce3fAutopilotEnabled";
const STORAGE_ICE3F_CONFIG = "gogIce3fConfig";
const STORAGE_ICE3F_STATUS = "gogIce3fAutopilotStatus";
const STORAGE_ICE3F_STATS = "gogIce3fAutopilotSessionStats";
const STORAGE_ICE3F_MACHINE = "gogIce3fMachineState";

const DEFAULT_MAX_GALES = 6;
const BET_RETRY_MS = 1500;

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeIce3f['createIce3fEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingBetTimers = new Map();

const ICE3F_DEFAULTS = {
  tableId: SinglestakeIce3f?.ICE3F_TABLE_ID ?? 201,
  mesaUrl:
    SinglestakeIce3f?.ICE3F_MESA_URL ??
    "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal",
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

async function readIce3fAutopilotEnabled() {
  const data = await chrome.storage.local.get([STORAGE_ICE3F_AUTOPLAY]);
  return data[STORAGE_ICE3F_AUTOPLAY] === true;
}

async function readIce3fConfig() {
  const data = await chrome.storage.local.get([STORAGE_ICE3F_CONFIG]);
  const stored = data[STORAGE_ICE3F_CONFIG];
  if (!stored || typeof stored !== "object") return { ...ICE3F_DEFAULTS };
  const legacyWrong =
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" && stored.mesaUrl.includes("roleta-ao-vivo"));
  return {
    tableId:
      legacyWrong
        ? ICE3F_DEFAULTS.tableId
        : typeof stored.tableId === "number" && stored.tableId > 0
          ? stored.tableId
          : ICE3F_DEFAULTS.tableId,
    mesaUrl: legacyWrong
      ? ICE3F_DEFAULTS.mesaUrl
      : typeof stored.mesaUrl === "string" && stored.mesaUrl.trim()
        ? stored.mesaUrl.trim()
        : ICE3F_DEFAULTS.mesaUrl,
    wsUrl:
      typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : ICE3F_DEFAULTS.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : ICE3F_DEFAULTS.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : ICE3F_DEFAULTS.currency,
    maxRecovery: clampMaxGales(stored.maxRecovery ?? ICE3F_DEFAULTS.maxRecovery),
  };
}

async function readIce3fMachineState() {
  const data = await chrome.storage.local.get([STORAGE_ICE3F_MACHINE]);
  const raw = data[STORAGE_ICE3F_MACHINE];
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

async function persistIce3fMachineState(machine) {
  if (!machine || typeof machine !== "object") return;
  await chrome.storage.local.set({
    [STORAGE_ICE3F_MACHINE]: {
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

async function clearIce3fMachineState() {
  await chrome.storage.local.remove([STORAGE_ICE3F_MACHINE]);
}

async function readIce3fStats(maxRecovery) {
  const data = await chrome.storage.local.get([STORAGE_ICE3F_STATS]);
  const raw = data[STORAGE_ICE3F_STATS];
  if (!raw?.stats || typeof raw.stats !== "object") return null;
  return { stats: raw.stats, maxRecovery: clampMaxGales(raw.maxRecovery ?? maxRecovery) };
}

async function persistIce3fStats(stats, maxRecovery) {
  const mr = clampMaxGales(maxRecovery);
  await chrome.storage.local.set({
    [STORAGE_ICE3F_STATS]: { stats, maxRecovery: mr, updatedAt: new Date().toISOString() },
  });
  await writeIce3fStatus({ wins: stats.wins ?? 0, losses: stats.losses ?? 0, maxRecovery: mr });
}

async function resetIce3fStats() {
  const cfg = await readIce3fConfig();
  const empty = { wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] };
  await persistIce3fStats(empty, cfg.maxRecovery);
  await clearIce3fMachineState();
  if (engine?.resetStats) engine.resetStats();
  if (engine?.reset) engine.reset();
  return { ok: true, wins: 0, losses: 0, maxRecovery: cfg.maxRecovery };
}

async function getIce3fConfigForPopup() {
  return readIce3fConfig();
}

async function setIce3fConfigFromPopup(config) {
  await chrome.storage.local.set({ [STORAGE_ICE3F_CONFIG]: config });
}

async function writeIce3fStatus(patch) {
  const data = await chrome.storage.local.get([STORAGE_ICE3F_STATUS]);
  const prev = data[STORAGE_ICE3F_STATUS] ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_ICE3F_STATUS]: next });
  return next;
}

function summarizeBridgeBetResults(results) {
  const clicks = (results ?? []).filter(
    (r) => r?.target === "factor-1" || r?.target === "factor-2" || r?.target === "factor-3",
  );
  const f1 = clicks.find((r) => r?.target === "factor-1");
  const f2 = clicks.find((r) => r?.target === "factor-2");
  const f3 = clicks.find((r) => r?.target === "factor-3");
  const ok = (r) => r?.ok === true && r?.skipped !== true;
  const placed = ok(f1) && ok(f2) && ok(f3);
  const detail = clicks
    .map((r) => `${r.target}: ${r.ok ? "ok" : "falhou"}${r.skipped ? " (ignorado)" : ""} — ${r.detail ?? ""}`)
    .join(" | ");
  return { placed, detail, f1, f2 };
}

function formatActiveLabel(active, unitScale) {
  if (!active) return null;
  if (Array.isArray(active.factors) && active.factors.length === 3) {
    const labels = active.factors.map((f) => f?.value ?? "").filter(Boolean);
    const scale = unitScale > 1 ? ` · ${unitScale}×` : "";
    return `${labels.join(" · ")}${scale} · pos${active.criticalPosition ?? "?"}`;
  }
  const f1 = active.factor1;
  const f2 = active.factor2;
  return f1 && f2 ? `${f1.value ?? ""} · ${f2.value ?? ""}`.trim() : null;
}

function normalizeWatchSlot(raw) {
  if (typeof raw === "number") return { total: Math.max(0, raw), partial: 0 };
  return {
    total: Math.max(0, raw?.total ?? 0),
    partial: Math.max(0, raw?.partial ?? 0),
  };
}

function formatWatchCounters(watch) {
  if (!watch || typeof watch !== "object") return null;
  const positions = SinglestakeIce3f?.ICE_3F_CRITICAL_POSITIONS ?? [5, 6, 7, 9, 10, 11];
  return positions
    .map((pos) => {
      const s = normalizeWatchSlot(watch[pos]);
      return `${pos}:${s.total}T+${s.partial}P`;
    })
    .join(" · ");
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
  const unitScale = payload.context.units ?? payload.context.currentRecovery ?? 1;
  const label =
    payload.context.factor1Label &&
    payload.context.factor2Label &&
    payload.context.factor3Label
      ? `${payload.context.factor1Label} · ${payload.context.factor2Label} · ${payload.context.factor3Label}${
          unitScale > 1 ? ` · ${unitScale}×` : ""
        }`
      : formatActiveLabel(active, unitScale);

  await writeIce3fStatus({
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
      if (live?.machine) await persistIce3fMachineState(live.machine);
      await writeIce3fStatus({
        lastBetDetail: detail || "Aposta enviada (factor-1 + factor-2 + factor-3)",
        lastError: null,
      });
    } else {
      engine?.abortBetCommit?.();
      lastEmittedSignalId = null;
      const errDetail = detail || "Cliques não confirmados — calibre Preto/Vermelho/Par/Ímpar na mesa";
      await writeIce3fStatus({
        lastError: errDetail,
        lastBetDetail: detail || null,
      });
      const cfg = await readIce3fConfig();
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
    await writeIce3fStatus({
      lastError: msg,
    });
    const cfg = await readIce3fConfig();
    scheduleBetAttempt(engine.runTick(), mesaUrl, cfg);
  }
}

function betDelayRemainingMs(result) {
  const state = engine?.getState?.();
  const at = state?.lastLiveSpinAt;
  if (at == null) return BET_RETRY_MS;

  const settleMs = SinglestakeIce3f?.ICE_3F_BET_DELAY_MS ?? 5000;
  const elapsed = Date.now() - at;
  return Math.max(BET_RETRY_MS, settleMs - elapsed);
}

function scheduleBetAttempt(result, mesaUrl, cfg) {
  if (!engine || !result?.active) {
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    void writeIce3fStatus({
      active: false,
      tableId: null,
      label: null,
      signalId: null,
      waitingBet: false,
      watch: engine?.getState?.()?.machine?.watch ?? null,
    });
    return;
  }

  const payload = engine.buildBridgePayload(mesaUrl);
  if (!payload?.context?.signalId) {
    const remaining = betDelayRemainingMs(result);
    const tableId = cfg.tableId;
    const active = result.active;
    const unitScale = result.unitScale ?? result.recovery ?? 1;
    const label = formatActiveLabel(active, unitScale);

    void writeIce3fStatus({
      active: true,
      tableId,
      label,
      waitingBet: true,
      waitRemainingSec: Math.ceil(remaining / 1000),
      unitScale,
      watch: engine?.getState?.()?.machine?.watch ?? null,
    });

    const signalKey = `ice3f:pos${active?.criticalPosition ?? "?"}:ref${active?.referenceNumber ?? "?"}:s${unitScale}`;
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
    await persistIce3fMachineState(result.machine);
  }
  if (result.stats) {
    await persistIce3fStats(result.stats, cfg.maxRecovery);
  }

  if (result.flash) {
    const ended =
      result.flash.kind === "win" ||
      result.flash.kind === "cycle_fail" ||
      (result.flash.kind === "loss" && !result.active);
    if (ended && !result.active) {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
    }
    const idleRecovery = idleRecoveryFromResult(result, engine);
    const flashKind = result.flash.kind;
    const unitScale = result.unitScale ?? result.recovery ?? 0;
    const idleReason =
      flashKind === "loss" && result.active
        ? `Derrota parcial/total — reentrada ${unitScale > 1 ? unitScale + "×" : "base"}`
        : flashKind === "cycle_fail"
          ? "Ciclo falhou — aguarda gatilho (2T ou 1T+3P)"
          : flashKind === "loss"
            ? "Derrota — aguarda novo gatilho"
            : flashKind === "win"
              ? "Vitória — aguarda novo gatilho"
              : unitScale > 0
                ? `Aguarda gatilho · escala ${unitScale}×`
                : "Aguarda gatilho (2T ou 1T+3P · pos 5/6/7/9/10/11)";
    await writeIce3fStatus({
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

  const watch = result.machine?.watch ?? engine?.getState?.()?.machine?.watch ?? null;
  const watchLabel = formatWatchCounters(watch);

  if (result.active) {
    if (result.flash?.kind === "win" || result.flash?.kind === "cycle_fail") {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
    }
    const label = formatActiveLabel(result.active, result.unitScale ?? result.recovery ?? 1);
    await writeIce3fStatus({
      active: true,
      label,
      unitScale: result.unitScale ?? result.recovery ?? 1,
      watch,
      watchLabel,
      tableId: cfg.tableId,
      reason: null,
      waitingBet: false,
    });
  } else if (watchLabel) {
    await writeIce3fStatus({
      watch,
      watchLabel,
      reason: watchLabel,
    });
  }

  if (!bridgeHandler) return;

  scheduleBetAttempt(result, mesaUrl, cfg);
}

async function startIce3fAutopilot(handleBridgePayload) {
  if (typeof handleBridgePayload === "function") {
    bridgeHandler = handleBridgePayload;
    globalThis.__singlestakeIce3fBridgeHandler = handleBridgePayload;
  }
  const enabled = await readIce3fAutopilotEnabled();
  if (!enabled) {
    await writeIce3fStatus({ running: false, reason: "autopilot ICE 3F desligado" });
    return;
  }

  if (!globalThis.SinglestakeIce3f?.createIce3fEngine) {
    await writeIce3fStatus({
      running: false,
      reason: "ice3f-engine.js em falta — corra npm run extension:ice3f:build",
    });
    return;
  }

  stopIce3fAutopilot();

  const cfg = await readIce3fConfig();
  const saved = await readIce3fStats(cfg.maxRecovery);
  const savedMachine = await readIce3fMachineState();
  engine = SinglestakeIce3f.createIce3fEngine({
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
    onLog: (msg) => void writeIce3fStatus({ log: msg }),
    onStatus: (status) => void writeIce3fStatus({ dga: status }),
    onHistorySnapshot: async (_tableId, spins) => {
      if (!engine) return;
      const result = engine.ingestHistorySnapshot(spins);
      const cfgNow = await readIce3fConfig();
      void processEngineResult(result, cfgNow.mesaUrl, cfgNow);
    },
    onSpin: (_tableId, spin) => {
      if (!engine) return;
      const result = engine.ingestSpin(spin.number, spin.gameId);
      if (!result) return;
      void readIce3fConfig().then((cfgNow) =>
        processEngineResult(result, cfgNow.mesaUrl, cfgNow),
      );
    },
  });

  dgaHub.start();
  await writeIce3fStatus({
    running: true,
    reason: null,
    tableId: cfg.tableId,
    mesaUrl: cfg.mesaUrl,
    maxRecovery: cfg.maxRecovery,
    wins: saved?.stats?.wins ?? 0,
    losses: saved?.stats?.losses ?? 0,
    watch: engine?.getState?.()?.machine?.watch ?? null,
    watchLabel: formatWatchCounters(engine?.getState?.()?.machine?.watch),
  });
}

function stopIce3fAutopilot() {
  clearPendingBetTimers();
  dgaHub?.stop();
  dgaHub = null;
  engine = null;
  lastEmittedSignalId = null;
  void writeIce3fStatus({ running: false, active: false, waitingBet: false });
}

async function setIce3fAutopilotEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_ICE3F_AUTOPLAY]: enabled === true });
  if (enabled) {
    await startIce3fAutopilot(bridgeHandler ?? globalThis.__singlestakeIce3fBridgeHandler ?? null);
    if (!bridgeHandler && !globalThis.__singlestakeIce3fBridgeHandler) {
      await writeIce3fStatus({
        running: false,
        reason: "Extensão a iniciar — clique Parado/Activo outra vez",
      });
    }
  } else {
    stopIce3fAutopilot();
    await writeIce3fStatus({ running: false, reason: "autopilot ICE 3F desligado" });
  }
  return getIce3fAutopilotStatus();
}

async function getIce3fAutopilotStatus() {
  const data = await chrome.storage.local.get([STORAGE_ICE3F_STATUS, STORAGE_ICE3F_AUTOPLAY, STORAGE_ICE3F_STATS]);
  const statsPack = data[STORAGE_ICE3F_STATS];
  const live = engine?.getState?.();
  const wins = live?.stats?.wins ?? statsPack?.stats?.wins ?? data[STORAGE_ICE3F_STATUS]?.wins ?? 0;
  const losses = live?.stats?.losses ?? statsPack?.stats?.losses ?? data[STORAGE_ICE3F_STATUS]?.losses ?? 0;
  const watch = live?.machine?.watch ?? data[STORAGE_ICE3F_STATUS]?.watch ?? null;
  const watchLabel = formatWatchCounters(watch);
  const pendingRecovery =
    live?.machine?.cycle?.unitScale ??
    live?.unitScale ??
    (await readIce3fMachineState())?.recovery ??
    0;
  const maxRecovery =
    live?.maxRecovery ?? statsPack?.maxRecovery ?? data[STORAGE_ICE3F_STATUS]?.maxRecovery ?? DEFAULT_MAX_GALES;
  return {
    enabled: data[STORAGE_ICE3F_AUTOPLAY] === true,
    status: {
      ...(data[STORAGE_ICE3F_STATUS] ?? { running: false }),
      wins,
      losses,
      maxRecovery,
      recovery: pendingRecovery,
      watch,
      watchLabel,
      extensionVersion: chrome.runtime.getManifest().version,
    },
  };
}

function initIce3fSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  globalThis.__singlestakeIce3fBridgeHandler = handleBridgePayload;
  void readIce3fAutopilotEnabled().then((on) => {
    if (on) void startIce3fAutopilot(handleBridgePayload);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_ICE3F_AUTOPLAY] && bridgeHandler) {
      if (changes[STORAGE_ICE3F_AUTOPLAY].newValue === true) {
        void startIce3fAutopilot(bridgeHandler);
      } else {
        stopIce3fAutopilot();
      }
    }
    if (changes[STORAGE_ICE3F_CONFIG] && bridgeHandler) {
      void readIce3fAutopilotEnabled().then((on) => {
        if (on) void startIce3fAutopilot(bridgeHandler);
      });
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeIce3fSignalRunner = {
    initIce3fSignalRunner,
    startIce3fAutopilot,
    stopIce3fAutopilot,
    setIce3fAutopilotEnabled,
    getIce3fAutopilotStatus,
    getIce3fConfigForPopup,
    setIce3fConfigFromPopup,
    resetIce3fStats,
    STORAGE_ICE3F_AUTOPLAY,
    STORAGE_ICE3F_CONFIG,
  };
}
