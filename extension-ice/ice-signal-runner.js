/** Autopilot ICE — Roulette 2 Extra Time (201) · gatilho 2F · dúzia em falta · Fibonacci. */
const STORAGE_ICE_AUTOPLAY = "gogIceAutopilotEnabled";
const STORAGE_ICE_CONFIG = "gogIceConfig";
const STORAGE_ICE_STATUS = "gogIceAutopilotStatus";
const STORAGE_ICE_STATS = "gogIceAutopilotSessionStats";
const STORAGE_ICE_MACHINE = "gogIceMachineState";

const BET_RETRY_MS = 1500;
const ICE_FIB_UNITS = [1, 1, 2, 3, 5, 8, 13, 21, 34];
const ICE_MAX_RECOVERY = ICE_FIB_UNITS.length - 1;

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeIceCruzamento['createIceCruzamentoEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingBetTimers = new Map();

const ICE_DEFAULTS = {
  tableId: SinglestakeIceCruzamento?.ICE_TABLE_ID ?? 201,
  mesaUrl:
    SinglestakeIceCruzamento?.ICE_MESA_URL ??
    "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal",
  wsUrl: SinglestakeDgaHub?.DGA_DEFAULTS?.wsUrl ?? "wss://dga.pragmaticplaylive.net/ws",
  casinoId: SinglestakeDgaHub?.DGA_DEFAULTS?.casinoId ?? "ppcdk00000005148",
  currency: SinglestakeDgaHub?.DGA_DEFAULTS?.currency ?? "BRL",
};

function clampUnits(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function clampRecovery(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(ICE_MAX_RECOVERY, Math.max(0, Math.floor(n)));
}

function unitsForRecovery(recovery) {
  return ICE_FIB_UNITS[clampRecovery(recovery)] ?? 1;
}

function recoveryFromUnits(units) {
  const u = clampUnits(units);
  // 1 aparece duas vezes na sequência (níveis 0 e 1) — sem recovery explícito
  // não dá para distinguir; assume entrada (0).
  if (u === 1) return 0;
  const idx = ICE_FIB_UNITS.indexOf(u);
  if (idx >= 0) return idx;
  for (let i = ICE_FIB_UNITS.length - 1; i >= 0; i--) {
    if (ICE_FIB_UNITS[i] <= u) return i;
  }
  return 0;
}

function clearPendingBetTimers() {
  for (const timer of pendingBetTimers.values()) {
    clearTimeout(timer);
  }
  pendingBetTimers.clear();
}

async function readIceAutopilotEnabled() {
  const data = await chrome.storage.local.get([STORAGE_ICE_AUTOPLAY]);
  return data[STORAGE_ICE_AUTOPLAY] === true;
}

async function readIceConfig() {
  const data = await chrome.storage.local.get([STORAGE_ICE_CONFIG]);
  const stored = data[STORAGE_ICE_CONFIG];
  if (!stored || typeof stored !== "object") return { ...ICE_DEFAULTS };
  const legacyWrong =
    stored.tableId === 230 ||
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" &&
      (stored.mesaUrl.includes("kto.bet") || stored.mesaUrl.includes("roulette-3-ppl")));
  return {
    tableId:
      legacyWrong
        ? ICE_DEFAULTS.tableId
        : typeof stored.tableId === "number" && stored.tableId > 0
          ? stored.tableId
          : ICE_DEFAULTS.tableId,
    mesaUrl: legacyWrong
      ? ICE_DEFAULTS.mesaUrl
      : typeof stored.mesaUrl === "string" && stored.mesaUrl.trim()
        ? stored.mesaUrl.trim()
        : ICE_DEFAULTS.mesaUrl,
    wsUrl:
      typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : ICE_DEFAULTS.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : ICE_DEFAULTS.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : ICE_DEFAULTS.currency,
  };
}

async function readIceMachineState() {
  const data = await chrome.storage.local.get([STORAGE_ICE_MACHINE]);
  const raw = data[STORAGE_ICE_MACHINE];
  if (!raw || typeof raw !== "object") return null;
  const recovery =
    typeof raw.recovery === "number" && Number.isFinite(raw.recovery)
      ? clampRecovery(raw.recovery)
      : recoveryFromUnits(raw.units ?? 1);
  const lastBetUnits =
    typeof raw.lastBetUnits === "number" && Number.isFinite(raw.lastBetUnits)
      ? clampUnits(raw.lastBetUnits)
      : null;
  const lastSpinHead =
    typeof raw.lastSpinHead === "string" && raw.lastSpinHead.trim()
      ? raw.lastSpinHead.trim()
      : null;
  return { recovery, units: unitsForRecovery(recovery), lastBetUnits, lastSpinHead };
}

async function persistIceMachineState(machine) {
  if (!machine || typeof machine !== "object") return;
  const recovery = clampRecovery(
    machine.cycle?.recovery ?? machine.recovery ?? 0,
  );
  await chrome.storage.local.set({
    [STORAGE_ICE_MACHINE]: {
      recovery,
      units: unitsForRecovery(recovery),
      lastBetUnits:
        typeof machine.lastBetUnits === "number" && Number.isFinite(machine.lastBetUnits)
          ? clampUnits(machine.lastBetUnits)
          : typeof machine.cycle?.betUnits === "number"
            ? clampUnits(machine.cycle.betUnits)
            : null,
      lastSpinHead:
        typeof machine.lastSpinHead === "string" ? machine.lastSpinHead : null,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function clearIceMachineState() {
  await chrome.storage.local.remove([STORAGE_ICE_MACHINE]);
}

async function readIceStats() {
  const data = await chrome.storage.local.get([STORAGE_ICE_STATS]);
  const raw = data[STORAGE_ICE_STATS];
  if (!raw?.stats || typeof raw.stats !== "object") return null;
  return { stats: raw.stats };
}

async function persistIceStats(stats) {
  await chrome.storage.local.set({
    [STORAGE_ICE_STATS]: { stats, updatedAt: new Date().toISOString() },
  });
  await writeIceStatus({ wins: stats.wins ?? 0, losses: stats.losses ?? 0 });
}

async function resetIceStats() {
  const empty = { wins: 0, losses: 0 };
  await persistIceStats(empty);
  await clearIceMachineState();
  if (engine?.resetStats) engine.resetStats();
  if (engine?.reset) engine.reset();
  return { ok: true, wins: 0, losses: 0 };
}

async function getIceConfigForPopup() {
  return readIceConfig();
}

async function setIceConfigFromPopup(config) {
  await chrome.storage.local.set({ [STORAGE_ICE_CONFIG]: config });
}

async function writeIceStatus(patch) {
  const data = await chrome.storage.local.get([STORAGE_ICE_STATUS]);
  const prev = data[STORAGE_ICE_STATUS] ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_ICE_STATUS]: next });
  return next;
}

function summarizeBridgeBetResults(results) {
  const clicks = (results ?? []).filter(
    (r) =>
      r?.target === "factor-1" ||
      r?.target === "factor-2" ||
      r?.target === "dozen-1" ||
      r?.target === "dozen-2" ||
      (typeof r?.target === "string" && r.target.startsWith("num-")),
  );
  const ok = (r) => r?.ok === true && r?.skipped !== true;
  const required = clicks.filter((r) => r?.skipped !== true);
  const placed =
    required.length > 0 && required.every(ok) && clicks.some((r) => ok(r));
  const detail = clicks
    .map((r) => `${r.target}: ${r.ok ? "ok" : "falhou"}${r.skipped ? " (ignorado)" : ""} — ${r.detail ?? ""}`)
    .join(" | ");
  return { placed, detail, clicks };
}

function formatActiveLabel(active, units, recovery) {
  if (!active) return null;
  const u = units ?? 1;
  const d1 = active.dozen1 != null ? `${active.dozen1}ª` : null;
  const d2 = active.dozen2 != null ? `${active.dozen2}ª` : null;
  const nums = Array.isArray(active.coveredNumbers)
    ? active.coveredNumbers.length
    : null;
  const core =
    d1 && d2
      ? `${d1}+${d2} dz${nums != null ? ` · ${nums} núms` : ""}`
      : active.dozen != null
        ? `${active.dozen}ª dúzia`
        : null;
  if (!core) return null;
  const fib = recovery > 0 ? ` · fib ${u} un./dz` : ` · ${u} un./dz`;
  return `${core}${fib}`;
}

function idleUnitsFromResult(result, engine) {
  if (result?.flash?.nextUnits != null) return result.flash.nextUnits;
  const recovery =
    result?.recovery ??
    result?.flash?.nextRecovery ??
    engine?.getState?.()?.machine?.recovery ??
    0;
  return unitsForRecovery(recovery);
}

async function executeBridgePayload(payload, mesaUrl) {
  if (!bridgeHandler || !payload?.context?.signalId) return;
  if (payload.context.signalId === lastEmittedSignalId) return;

  lastEmittedSignalId = payload.context.signalId;
  const active = engine?.getState?.()?.machine?.cycle?.active;
  const units = payload.context.units ?? 1;
  const recovery = payload.context.currentRecovery ?? 0;
  const label =
    payload.context.factor1Label
      ? `${payload.context.factor1Label}${
          payload.context.factor2Label ? ` · ${payload.context.factor2Label}` : ""
        }${recovery > 0 ? ` · fib ${units} un./dz` : ` · ${units} un./dz`}`
      : formatActiveLabel(active, units, recovery);

  // Marcar commit ANTES de qualquer await — senão o giro DGA cancela awaiting_bet
  // e a derrota/vitória não actualiza o Fibonacci.
  engine?.beginBetCommit?.();

  await writeIceStatus({
    active: true,
    tableId: payload.context.currentTableId,
    label,
    signalId: payload.context.signalId,
    units,
    recovery,
    waitingBet: false,
    lastError: null,
    lastBetDetail: null,
  });

  try {
    const bridgeResult = await bridgeHandler(payload, null);
    const { placed, detail } = summarizeBridgeBetResults(bridgeResult?.results);
    if (placed && engine?.markBetPlaced) {
      engine.markBetPlaced();
      const live = engine.getState?.();
      if (live?.machine) await persistIceMachineState(live.machine);
      await writeIceStatus({
        lastBetDetail: detail || "Aposta enviada (2 dúzias + números)",
        lastError: null,
      });
    } else {
      engine?.abortBetCommit?.();
      lastEmittedSignalId = null;
      const errDetail =
        detail ||
        "Cliques não confirmados — calibre dúzias e números 0–36 na mesa";
      await writeIceStatus({
        lastError: errDetail,
        lastBetDetail: detail || null,
      });
      const cfg = await readIceConfig();
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
    await writeIceStatus({
      lastError: msg,
    });
    const cfg = await readIceConfig();
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
      ? SinglestakeIceCruzamento?.ROTATING_ROOM_CROSSING_BET_DELAY_MS ?? 5000
      : SinglestakeIceCruzamento?.ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS ?? 5000;
  const elapsed = Date.now() - at;
  return Math.max(BET_RETRY_MS, settleMs - elapsed);
}

function scheduleBetAttempt(result, mesaUrl, cfg) {
  if (!engine || !result?.active) {
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    void writeIceStatus({
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
    const label = formatActiveLabel(active, result.units ?? 1, result.recovery ?? 0);

    void writeIceStatus({
      active: true,
      tableId,
      label,
      waitingBet: true,
      waitRemainingSec: Math.ceil(remaining / 1000),
      units: result.units,
      recovery: result.recovery ?? 0,
    });

    const signalKey = `ice:${active?.triggerNumbers?.join("-") ?? "?"}:${result.recovery ?? 0}:${result.units}`;
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
    await persistIceMachineState(result.machine);
  }
  if (result.stats) {
    await persistIceStats(result.stats);
  }

  if (result.flash) {
    const ended = result.flash.kind === "win" || result.flash.kind === "loss";
    if (ended && !result.active) {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
    }
    const idleUnits = idleUnitsFromResult(result, engine);
    const idleRecovery =
      result.flash?.nextRecovery ??
      result.recovery ??
      engine?.getState?.()?.machine?.recovery ??
      0;
    const flashKind = result.flash.kind;
    const idleReason =
      flashKind === "loss"
        ? `Derrota — próxima entrada fib ${idleUnits} un. · aguarda novo gatilho`
        : flashKind === "win"
          ? "Vitória — Fibonacci reiniciado (1 un.)"
          : `Aguarda novo gatilho · fib ${idleUnits} un.`;
    await writeIceStatus({
      lastFlash: flashKind,
      lastResult: result.flash.resultNumber,
      units: idleUnits,
      recovery: idleRecovery,
      lastBetUnits: result.flash.betUnits ?? null,
      ...(ended && !result.active
        ? {
            active: false,
            label: null,
            lastTrigger: null,
            signalId: null,
            waitingBet: false,
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
    const label = formatActiveLabel(result.active, result.units ?? 1, result.recovery ?? 0);
    await writeIceStatus({
      active: true,
      label,
      units: result.units ?? 1,
      recovery: result.recovery ?? 0,
      lastTrigger: result.active.triggerNumbers ?? null,
      tableId: cfg.tableId,
      reason: null,
      waitingBet: false,
    });
  }

  if (!bridgeHandler) return;

  scheduleBetAttempt(result, mesaUrl, cfg);
}

async function startIceAutopilot(handleBridgePayload) {
  if (typeof handleBridgePayload === "function") {
    bridgeHandler = handleBridgePayload;
    globalThis.__singlestakeIceBridgeHandler = handleBridgePayload;
  }
  const enabled = await readIceAutopilotEnabled();
  if (!enabled) {
    await writeIceStatus({ running: false, reason: "autopilot ICE desligado" });
    return;
  }

  if (!globalThis.SinglestakeIceCruzamento?.createIceCruzamentoEngine) {
    await writeIceStatus({
      running: false,
      reason: "ice-cruzamento-engine.js em falta — corra npm run extension:ice:build",
    });
    return;
  }

  stopIceAutopilot();

  const cfg = await readIceConfig();
  const saved = await readIceStats();
  const savedMachine = await readIceMachineState();
  engine = SinglestakeIceCruzamento.createIceCruzamentoEngine({
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
    onLog: (msg) => void writeIceStatus({ log: msg }),
    onStatus: (status) => void writeIceStatus({ dga: status }),
    onHistorySnapshot: async (_tableId, spins) => {
      if (!engine) return;
      const result = engine.ingestHistorySnapshot(spins);
      const cfgNow = await readIceConfig();
      void processEngineResult(result, cfgNow.mesaUrl, cfgNow);
    },
    onSpin: (_tableId, spin) => {
      if (!engine) return;
      const result = engine.ingestSpin(spin.number, spin.gameId);
      if (!result) return;
      void readIceConfig().then((cfgNow) =>
        processEngineResult(result, cfgNow.mesaUrl, cfgNow),
      );
    },
  });

  dgaHub.start();
  await writeIceStatus({
    running: true,
    reason: null,
    tableId: cfg.tableId,
    mesaUrl: cfg.mesaUrl,
    wins: saved?.stats?.wins ?? 0,
    losses: saved?.stats?.losses ?? 0,
    units: savedMachine?.units ?? 1,
    recovery: savedMachine?.recovery ?? 0,
  });
}

function stopIceAutopilot() {
  clearPendingBetTimers();
  dgaHub?.stop();
  dgaHub = null;
  engine = null;
  lastEmittedSignalId = null;
  void writeIceStatus({ running: false, active: false, waitingBet: false });
}

async function setIceAutopilotEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_ICE_AUTOPLAY]: enabled === true });
  if (enabled) {
    await startIceAutopilot(bridgeHandler ?? globalThis.__singlestakeIceBridgeHandler ?? null);
    if (!bridgeHandler && !globalThis.__singlestakeIceBridgeHandler) {
      await writeIceStatus({
        running: false,
        reason: "Extensão a iniciar — clique Parado/Activo outra vez",
      });
    }
  } else {
    stopIceAutopilot();
    await writeIceStatus({ running: false, reason: "autopilot ICE desligado" });
  }
  return getIceAutopilotStatus();
}

async function getIceAutopilotStatus() {
  const data = await chrome.storage.local.get([STORAGE_ICE_STATUS, STORAGE_ICE_AUTOPLAY, STORAGE_ICE_STATS]);
  const statsPack = data[STORAGE_ICE_STATS];
  const live = engine?.getState?.();
  const wins = live?.stats?.wins ?? statsPack?.stats?.wins ?? data[STORAGE_ICE_STATUS]?.wins ?? 0;
  const losses = live?.stats?.losses ?? statsPack?.stats?.losses ?? data[STORAGE_ICE_STATUS]?.losses ?? 0;
  const pendingRecovery =
    live?.machine?.recovery ??
    live?.machine?.cycle?.recovery ??
    (await readIceMachineState())?.recovery ??
    0;
  const pendingUnits =
    live?.machine?.cycle?.betUnits ??
    unitsForRecovery(pendingRecovery);
  const lastBetUnits =
    live?.machine?.lastBetUnits ?? (await readIceMachineState())?.lastBetUnits ?? null;
  return {
    enabled: data[STORAGE_ICE_AUTOPLAY] === true,
    status: {
      ...(data[STORAGE_ICE_STATUS] ?? { running: false }),
      wins,
      losses,
      units: pendingUnits,
      recovery: pendingRecovery,
      lastBetUnits,
      maxRecovery: ICE_MAX_RECOVERY,
      extensionVersion: chrome.runtime.getManifest().version,
    },
  };
}

function initIceSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  globalThis.__singlestakeIceBridgeHandler = handleBridgePayload;
  void readIceAutopilotEnabled().then((on) => {
    if (on) void startIceAutopilot(handleBridgePayload);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_ICE_AUTOPLAY] && bridgeHandler) {
      if (changes[STORAGE_ICE_AUTOPLAY].newValue === true) {
        void startIceAutopilot(bridgeHandler);
      } else {
        stopIceAutopilot();
      }
    }
    if (changes[STORAGE_ICE_CONFIG] && bridgeHandler) {
      void readIceAutopilotEnabled().then((on) => {
        if (on) void startIceAutopilot(bridgeHandler);
      });
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeIceSignalRunner = {
    initIceSignalRunner,
    startIceAutopilot,
    stopIceAutopilot,
    setIceAutopilotEnabled,
    getIceAutopilotStatus,
    getIceConfigForPopup,
    setIceConfigFromPopup,
    resetIceStats,
    STORAGE_ICE_AUTOPLAY,
    STORAGE_ICE_CONFIG,
  };
}
