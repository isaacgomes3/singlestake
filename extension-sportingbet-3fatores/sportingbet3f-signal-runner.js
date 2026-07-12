/** Autopilot ICE — 3 Fatores (201) · cruzamento sequencial 2 fatores. */
const STORAGE_SPORTINGBET3F_AUTOPLAY = "gogSportingbet3fAutopilotEnabled";
const STORAGE_SPORTINGBET3F_CONFIG = "gogSportingbet3fConfig";
const STORAGE_SPORTINGBET3F_STATUS = "gogSportingbet3fAutopilotStatus";
const STORAGE_SPORTINGBET3F_STATS = "gogSportingbet3fAutopilotSessionStats";
const STORAGE_SPORTINGBET3F_MACHINE = "gogSportingbet3fMachineState";

const DEFAULT_MAX_GALES = 5;
const BET_RETRY_MS = 1500;
const ENTRY_UNIT_OPTIONS = [1, 2, 4, 8, 16, 32];

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeSportingbet3f['createSportingbet3fEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingBetTimers = new Map();

const SPORTINGBET3F_DEFAULTS = {
  tableId: SinglestakeSportingbet3f?.SPORTINGBET3F_TABLE_ID ?? 201,
  mesaUrl: SinglestakeSportingbet3f?.SPORTINGBET3F_MESA_URL ?? "",
  wsUrl: SinglestakeDgaHub?.DGA_DEFAULTS?.wsUrl ?? "wss://dga.pragmaticplaylive.net/ws",
  casinoId: SinglestakeDgaHub?.DGA_DEFAULTS?.casinoId ?? "ppcdk00000005148",
  currency: SinglestakeDgaHub?.DGA_DEFAULTS?.currency ?? "BRL",
  maxRecovery: DEFAULT_MAX_GALES,
  stakeMode: "auto",
  entryUnits: 1,
};

function clampMaxGales(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_GALES;
  return Math.min(6, Math.max(0, Math.floor(n)));
}

function normalizeEntryUnits(value) {
  if (typeof SinglestakeSportingbet3f?.ice3fNormalizeEntryUnits === "function") {
    return SinglestakeSportingbet3f.ice3fNormalizeEntryUnits(value);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  const floored = Math.max(1, Math.floor(n));
  const pow = 2 ** Math.round(Math.log2(floored));
  return Math.min(32, Math.max(1, pow));
}

function normalizeStakeMode(value) {
  return value === "manual" ? "manual" : "auto";
}

function clearPendingBetTimers() {
  for (const timer of pendingBetTimers.values()) {
    clearTimeout(timer);
  }
  pendingBetTimers.clear();
}

async function readSportingbet3fAutopilotEnabled() {
  const data = await chrome.storage.local.get([STORAGE_SPORTINGBET3F_AUTOPLAY]);
  return data[STORAGE_SPORTINGBET3F_AUTOPLAY] === true;
}

async function readSportingbet3fConfig() {
  const data = await chrome.storage.local.get([STORAGE_SPORTINGBET3F_CONFIG]);
  const stored = data[STORAGE_SPORTINGBET3F_CONFIG];
  if (!stored || typeof stored !== "object") return { ...SPORTINGBET3F_DEFAULTS };
  const legacyWrong =
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" && stored.mesaUrl.includes("roleta-ao-vivo"));
  return {
    tableId:
      legacyWrong
        ? SPORTINGBET3F_DEFAULTS.tableId
        : typeof stored.tableId === "number" && stored.tableId > 0
          ? stored.tableId
          : SPORTINGBET3F_DEFAULTS.tableId,
    mesaUrl: legacyWrong
      ? SPORTINGBET3F_DEFAULTS.mesaUrl
      : typeof stored.mesaUrl === "string" && stored.mesaUrl.trim()
        ? stored.mesaUrl.trim()
        : SPORTINGBET3F_DEFAULTS.mesaUrl,
    wsUrl:
      typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : SPORTINGBET3F_DEFAULTS.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : SPORTINGBET3F_DEFAULTS.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : SPORTINGBET3F_DEFAULTS.currency,
    maxRecovery: clampMaxGales(stored.maxRecovery ?? SPORTINGBET3F_DEFAULTS.maxRecovery),
    stakeMode: normalizeStakeMode(stored.stakeMode ?? SPORTINGBET3F_DEFAULTS.stakeMode),
    entryUnits: normalizeEntryUnits(stored.entryUnits ?? SPORTINGBET3F_DEFAULTS.entryUnits),
  };
}

async function readSportingbet3fMachineState() {
  const data = await chrome.storage.local.get([STORAGE_SPORTINGBET3F_MACHINE]);
  const raw = data[STORAGE_SPORTINGBET3F_MACHINE];
  if (!raw || typeof raw !== "object") return null;
  const recovery =
    typeof raw.recovery === "number" && Number.isFinite(raw.recovery)
      ? Math.max(0, Math.floor(raw.recovery))
      : 0;
  const lastSpinHead =
    typeof raw.lastSpinHead === "string" && raw.lastSpinHead.trim()
      ? raw.lastSpinHead.trim()
      : null;
  return {
    recovery,
    lastSpinHead,
    entryUnits: normalizeEntryUnits(raw.entryUnits ?? 1),
    stakeMode: normalizeStakeMode(raw.stakeMode),
    winsTowardEntryBump: Math.max(0, Math.floor(raw.winsTowardEntryBump ?? 0)),
  };
}

async function persistSportingbet3fMachineState(machine) {
  if (!machine || typeof machine !== "object") return;
  const live = machine.cycle ? machine : machine;
  const entryUnits = normalizeEntryUnits(
    live.entryUnits ?? engine?.getStakeConfig?.()?.entryUnits ?? 1,
  );
  const stakeMode = normalizeStakeMode(
    live.stakeMode ?? engine?.getStakeConfig?.()?.stakeMode ?? "auto",
  );
  const winsTowardEntryBump = Math.max(
    0,
    Math.floor(
      live.winsTowardEntryBump ?? engine?.getStakeConfig?.()?.winsTowardEntryBump ?? 0,
    ),
  );
  await chrome.storage.local.set({
    [STORAGE_SPORTINGBET3F_MACHINE]: {
      recovery:
        typeof machine.recovery === "number" && Number.isFinite(machine.recovery)
          ? Math.max(0, Math.floor(machine.recovery))
          : typeof live.cycle?.unitScale === "number"
            ? Math.max(0, Math.floor(live.cycle.unitScale))
            : 0,
      lastSpinHead:
        typeof machine.lastSpinHead === "string"
          ? machine.lastSpinHead
          : typeof live.lastSpinHead === "string"
            ? live.lastSpinHead
            : null,
      entryUnits,
      stakeMode,
      winsTowardEntryBump,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function clearSportingbet3fMachineState() {
  await chrome.storage.local.remove([STORAGE_SPORTINGBET3F_MACHINE]);
}

async function readSportingbet3fStats(maxRecovery) {
  const data = await chrome.storage.local.get([STORAGE_SPORTINGBET3F_STATS]);
  const raw = data[STORAGE_SPORTINGBET3F_STATS];
  if (!raw?.stats || typeof raw.stats !== "object") return null;
  return { stats: raw.stats, maxRecovery: clampMaxGales(raw.maxRecovery ?? maxRecovery) };
}

async function persistSportingbet3fStats(stats, maxRecovery) {
  const mr = clampMaxGales(maxRecovery);
  await chrome.storage.local.set({
    [STORAGE_SPORTINGBET3F_STATS]: { stats, maxRecovery: mr, updatedAt: new Date().toISOString() },
  });
  await writeSportingbet3fStatus({ wins: stats.wins ?? 0, losses: stats.losses ?? 0, maxRecovery: mr });
}

async function resetSportingbet3fStats() {
  const cfg = await readSportingbet3fConfig();
  const empty = { wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] };
  await persistSportingbet3fStats(empty, cfg.maxRecovery);
  await clearSportingbet3fMachineState();
  if (engine?.resetStats) engine.resetStats();
  if (engine?.reset) engine.reset();
  return { ok: true, wins: 0, losses: 0, maxRecovery: cfg.maxRecovery };
}

async function getSportingbet3fConfigForPopup() {
  return readSportingbet3fConfig();
}

async function setSportingbet3fConfigFromPopup(config) {
  const prev = await readSportingbet3fConfig();
  const next = {
    ...prev,
    ...(config && typeof config === "object" ? config : {}),
  };
  next.maxRecovery = clampMaxGales(next.maxRecovery);
  next.stakeMode = normalizeStakeMode(next.stakeMode);
  next.entryUnits = normalizeEntryUnits(next.entryUnits);
  await chrome.storage.local.set({ [STORAGE_SPORTINGBET3F_CONFIG]: next });
  if (engine?.setStakeConfig) {
    engine.setStakeConfig({
      stakeMode: next.stakeMode,
      entryUnits: next.entryUnits,
    });
    const live = engine.getState?.()?.machine;
    if (live) await persistSportingbet3fMachineState(live);
  }
  await writeSportingbet3fStatus({
    stakeMode: next.stakeMode,
    entryUnits: next.entryUnits,
  });
  return { ok: true, config: next };
}

async function writeSportingbet3fStatus(patch) {
  const data = await chrome.storage.local.get([STORAGE_SPORTINGBET3F_STATUS]);
  const prev = data[STORAGE_SPORTINGBET3F_STATUS] ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_SPORTINGBET3F_STATUS]: next });
  return next;
}

function summarizeBridgeBetResults(results) {
  const clicks = (results ?? []).filter(
    (r) => r?.target === "factor-1" || r?.target === "factor-2",
  );
  const doubles = (results ?? []).filter((r) => r?.target === "repeat-bet");
  const f1 = clicks.find((r) => r?.target === "factor-1");
  const f2 = clicks.find((r) => r?.target === "factor-2");
  const ok = (r) => r?.ok === true && r?.skipped !== true;
  const doublesOk = doubles.length === 0 || doubles.every(ok);
  const placed = ok(f1) && ok(f2) && doublesOk;
  const detail = [...clicks, ...doubles]
    .map((r) => `${r.target}: ${r.ok ? "ok" : "falhou"}${r.skipped ? " (ignorado)" : ""} — ${r.detail ?? ""}`)
    .join(" | ");
  return { placed, detail, f1, f2 };
}

function formatActiveLabel(active, unitScale) {
  if (!active) return null;
  if (Array.isArray(active.factors) && active.factors.length >= 2) {
    const labels = active.factors.map((f) => f?.value ?? "").filter(Boolean);
    const scale = unitScale > 1 ? ` · ${unitScale}×` : "";
    const eco =
      active.triggerNumber != null
        ? ` · eco ${active.triggerNumber}`
        : "";
    return `${labels.join(" · ")}${scale}${eco} · pos${active.criticalPosition ?? "?"}`;
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
  void watch;
  return "eco · última ocorrência → 3F à esquerda";
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

  await writeSportingbet3fStatus({
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
      if (live?.machine) await persistSportingbet3fMachineState(live.machine);
      await writeSportingbet3fStatus({
        lastBetDetail: detail || "Aposta enviada (factor-1 + factor-2)",
        lastError: null,
      });
    } else {
      engine?.abortBetCommit?.();
      lastEmittedSignalId = null;
      const errDetail = detail || "Cliques não confirmados — calibre Preto/Vermelho/Par/Ímpar na mesa";
      await writeSportingbet3fStatus({
        lastError: errDetail,
        lastBetDetail: detail || null,
      });
      const cfg = await readSportingbet3fConfig();
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
    await writeSportingbet3fStatus({
      lastError: msg,
    });
    const cfg = await readSportingbet3fConfig();
    scheduleBetAttempt(engine.runTick(), mesaUrl, cfg);
  }
}

function betDelayRemainingMs(result) {
  const state = engine?.getState?.();
  const at = state?.lastLiveSpinAt;
  if (at == null) return BET_RETRY_MS;

  const settleMs = SinglestakeSportingbet3f?.ICE_3F_BET_DELAY_MS ?? 5000;
  const elapsed = Date.now() - at;
  return Math.max(BET_RETRY_MS, settleMs - elapsed);
}

function scheduleBetAttempt(result, mesaUrl, cfg) {
  if (!engine || !result?.active) {
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    void writeSportingbet3fStatus({
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

    void writeSportingbet3fStatus({
      active: true,
      tableId,
      label,
      waitingBet: true,
      waitRemainingSec: Math.ceil(remaining / 1000),
      unitScale,
      watch: engine?.getState?.()?.machine?.watch ?? null,
    });

    const signalKey = `sportingbet3f:pos${active?.criticalPosition ?? "?"}:ref${active?.referenceNumber ?? "?"}:s${unitScale}`;
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
    await persistSportingbet3fMachineState(result.machine);
  }
  if (result.stats) {
    await persistSportingbet3fStats(result.stats, cfg.maxRecovery);
  }

  const stakeSnap = {
    stakeMode: result.stakeMode ?? result.machine?.stakeMode ?? cfg.stakeMode ?? "auto",
    entryUnits: result.entryUnits ?? result.machine?.entryUnits ?? cfg.entryUnits ?? 1,
    winsTowardEntryBump:
      result.winsTowardEntryBump ?? result.machine?.winsTowardEntryBump ?? 0,
    winsPerBump: SinglestakeSportingbet3f?.ICE_3F_WINS_PER_ENTRY_BUMP ?? 63,
  };

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
      flashKind === "tie"
        ? `Empate (1 factor) — repete${unitScale > 1 ? ` · ${unitScale}×` : ""}`
        : flashKind === "loss" && result.active
          ? `Derrota — gale ${unitScale > 1 ? unitScale + "×" : ""} · nova indicação`
          : flashKind === "cycle_fail"
            ? stakeSnap.stakeMode === "auto" && stakeSnap.entryUnits <= 1
              ? "Derrota final (5 gales) — entrada 1u · aguarda eco"
              : "Derrota final (5 gales) — auto volta a 1u"
            : flashKind === "loss"
              ? `Derrota — aguarda novo eco${unitScale > 1 ? ` · gale ${unitScale}×` : ""}`
              : flashKind === "win"
                ? `Vitória — entrada ${stakeSnap.entryUnits}u${
                    stakeSnap.stakeMode === "auto"
                      ? ` · bump ${stakeSnap.winsTowardEntryBump}/${stakeSnap.winsPerBump}`
                      : ""
                  }`
                : unitScale > 1
                  ? `Aguarda eco · gale ${unitScale}×`
                  : "Aguarda eco (última ocorrência → cor/altura)";
    await writeSportingbet3fStatus({
      lastFlash: flashKind,
      lastResult: result.flash.resultNumber,
      ...stakeSnap,
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
        : flashKind === "tie"
          ? { reason: idleReason }
          : {}),
    });
  } else {
    await writeSportingbet3fStatus(stakeSnap);
  }

  const watch = result.machine?.watch ?? engine?.getState?.()?.machine?.watch ?? null;
  const watchLabel = formatWatchCounters(watch);

  if (result.active) {
    if (result.flash?.kind === "win" || result.flash?.kind === "cycle_fail") {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
    }
    if (result.flash?.kind === "tie") {
      lastEmittedSignalId = null;
    }
    const label = formatActiveLabel(result.active, result.unitScale ?? result.recovery ?? 1);
    await writeSportingbet3fStatus({
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
    await writeSportingbet3fStatus({
      watch,
      watchLabel,
      reason: watchLabel,
    });
  }

  if (!bridgeHandler) return;

  scheduleBetAttempt(result, mesaUrl, cfg);
}

async function startSportingbet3fAutopilot(handleBridgePayload) {
  if (typeof handleBridgePayload === "function") {
    bridgeHandler = handleBridgePayload;
    globalThis.__SinglestakeSportingbet3fBridgeHandler = handleBridgePayload;
  }
  const enabled = await readSportingbet3fAutopilotEnabled();
  if (!enabled) {
    await writeSportingbet3fStatus({ running: false, reason: "autopilot Sportingbet 3F desligado" });
    return;
  }

  if (!globalThis.SinglestakeSportingbet3f?.createSportingbet3fEngine) {
    await writeSportingbet3fStatus({
      running: false,
      reason: "sportingbet3f-engine.js em falta — corra npm run extension:sportingbet3f:build",
    });
    return;
  }

  stopSportingbet3fAutopilot();

  const cfg = await readSportingbet3fConfig();
  const saved = await readSportingbet3fStats(cfg.maxRecovery);
  const savedMachine = await readSportingbet3fMachineState();
  engine = SinglestakeSportingbet3f.createSportingbet3fEngine({
    maxRecovery: cfg.maxRecovery,
    initialStats: saved?.stats ?? null,
    initialMachine: {
      lastSpinHead: savedMachine?.lastSpinHead ?? null,
      entryUnits: savedMachine?.entryUnits ?? cfg.entryUnits,
      stakeMode: savedMachine?.stakeMode ?? cfg.stakeMode,
      winsTowardEntryBump: savedMachine?.winsTowardEntryBump ?? 0,
    },
  });
  // Config do popup manda em modo/entrada ao ligar (manual); auto recupera progresso guardado.
  if (cfg.stakeMode === "manual" || !savedMachine?.entryUnits) {
    engine.setStakeConfig?.({
      stakeMode: cfg.stakeMode,
      entryUnits: cfg.entryUnits,
    });
  } else {
    engine.setStakeConfig?.({ stakeMode: cfg.stakeMode });
  }
  lastEmittedSignalId = null;
  clearPendingBetTimers();

  const stake = engine.getStakeConfig?.() ?? {
    entryUnits: cfg.entryUnits,
    stakeMode: cfg.stakeMode,
    winsTowardEntryBump: 0,
  };

  dgaHub = SinglestakeDgaHub.createDgaHub({
    tableIds: [cfg.tableId],
    config: {
      wsUrl: cfg.wsUrl,
      casinoId: cfg.casinoId,
      currency: cfg.currency,
    },
    onLog: (msg) => void writeSportingbet3fStatus({ log: msg }),
    onStatus: (status) => void writeSportingbet3fStatus({ dga: status }),
    onHistorySnapshot: async (_tableId, spins) => {
      if (!engine) return;
      const result = engine.ingestHistorySnapshot(spins);
      const cfgNow = await readSportingbet3fConfig();
      void processEngineResult(result, cfgNow.mesaUrl, cfgNow);
    },
    onSpin: (_tableId, spin) => {
      if (!engine) return;
      const result = engine.ingestSpin(spin.number, spin.gameId);
      if (!result) return;
      void readSportingbet3fConfig().then((cfgNow) =>
        processEngineResult(result, cfgNow.mesaUrl, cfgNow),
      );
    },
  });

  dgaHub.start();
  await writeSportingbet3fStatus({
    running: true,
    reason: null,
    tableId: cfg.tableId,
    mesaUrl: cfg.mesaUrl,
    maxRecovery: cfg.maxRecovery,
    wins: saved?.stats?.wins ?? 0,
    losses: saved?.stats?.losses ?? 0,
    stakeMode: stake.stakeMode,
    entryUnits: stake.entryUnits,
    winsTowardEntryBump: stake.winsTowardEntryBump ?? 0,
    winsPerBump: SinglestakeSportingbet3f?.ICE_3F_WINS_PER_ENTRY_BUMP ?? 63,
    watch: engine?.getState?.()?.machine?.watch ?? null,
    watchLabel: formatWatchCounters(engine?.getState?.()?.machine?.watch),
  });
}

function stopSportingbet3fAutopilot() {
  clearPendingBetTimers();
  dgaHub?.stop();
  dgaHub = null;
  engine = null;
  lastEmittedSignalId = null;
  void writeSportingbet3fStatus({ running: false, active: false, waitingBet: false });
}

async function setSportingbet3fAutopilotEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_SPORTINGBET3F_AUTOPLAY]: enabled === true });
  if (enabled) {
    await startSportingbet3fAutopilot(bridgeHandler ?? globalThis.__SinglestakeSportingbet3fBridgeHandler ?? null);
    if (!bridgeHandler && !globalThis.__SinglestakeSportingbet3fBridgeHandler) {
      await writeSportingbet3fStatus({
        running: false,
        reason: "Extensão a iniciar — clique Parado/Activo outra vez",
      });
    }
  } else {
    stopSportingbet3fAutopilot();
    await writeSportingbet3fStatus({ running: false, reason: "autopilot Sportingbet 3F desligado" });
  }
  return getSportingbet3fAutopilotStatus();
}

async function getSportingbet3fAutopilotStatus() {
  const data = await chrome.storage.local.get([STORAGE_SPORTINGBET3F_STATUS, STORAGE_SPORTINGBET3F_AUTOPLAY, STORAGE_SPORTINGBET3F_STATS]);
  const statsPack = data[STORAGE_SPORTINGBET3F_STATS];
  const live = engine?.getState?.();
  const wins = live?.stats?.wins ?? statsPack?.stats?.wins ?? data[STORAGE_SPORTINGBET3F_STATUS]?.wins ?? 0;
  const losses = live?.stats?.losses ?? statsPack?.stats?.losses ?? data[STORAGE_SPORTINGBET3F_STATUS]?.losses ?? 0;
  const watch = live?.machine?.watch ?? data[STORAGE_SPORTINGBET3F_STATUS]?.watch ?? null;
  const watchLabel = formatWatchCounters(watch);
  const pendingRecovery =
    live?.machine?.cycle?.unitScale ??
    live?.unitScale ??
    (await readSportingbet3fMachineState())?.recovery ??
    0;
  const stake = engine?.getStakeConfig?.() ?? null;
  const maxRecovery =
    live?.maxRecovery ?? statsPack?.maxRecovery ?? data[STORAGE_SPORTINGBET3F_STATUS]?.maxRecovery ?? DEFAULT_MAX_GALES;
  return {
    enabled: data[STORAGE_SPORTINGBET3F_AUTOPLAY] === true,
    status: {
      ...(data[STORAGE_SPORTINGBET3F_STATUS] ?? { running: false }),
      wins,
      losses,
      maxRecovery,
      recovery: pendingRecovery,
      stakeMode:
        stake?.stakeMode ??
        data[STORAGE_SPORTINGBET3F_STATUS]?.stakeMode ??
        "auto",
      entryUnits:
        stake?.entryUnits ??
        data[STORAGE_SPORTINGBET3F_STATUS]?.entryUnits ??
        1,
      winsTowardEntryBump:
        stake?.winsTowardEntryBump ??
        data[STORAGE_SPORTINGBET3F_STATUS]?.winsTowardEntryBump ??
        0,
      winsPerBump:
        stake?.winsPerBump ??
        SinglestakeSportingbet3f?.ICE_3F_WINS_PER_ENTRY_BUMP ??
        63,
      watch,
      watchLabel,
      extensionVersion: chrome.runtime.getManifest().version,
    },
  };
}

function initSportingbet3fSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  globalThis.__SinglestakeSportingbet3fBridgeHandler = handleBridgePayload;
  void readSportingbet3fAutopilotEnabled().then((on) => {
    if (on) void startSportingbet3fAutopilot(handleBridgePayload);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_SPORTINGBET3F_AUTOPLAY] && bridgeHandler) {
      if (changes[STORAGE_SPORTINGBET3F_AUTOPLAY].newValue === true) {
        void startSportingbet3fAutopilot(bridgeHandler);
      } else {
        stopSportingbet3fAutopilot();
      }
    }
    if (changes[STORAGE_SPORTINGBET3F_CONFIG] && bridgeHandler) {
      void readSportingbet3fAutopilotEnabled().then((on) => {
        if (on) void startSportingbet3fAutopilot(bridgeHandler);
      });
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeSportingbet3fSignalRunner = {
    initSportingbet3fSignalRunner,
    startSportingbet3fAutopilot,
    stopSportingbet3fAutopilot,
    setSportingbet3fAutopilotEnabled,
    getSportingbet3fAutopilotStatus,
    getSportingbet3fConfigForPopup,
    setSportingbet3fConfigFromPopup,
    resetSportingbet3fStats,
    STORAGE_SPORTINGBET3F_AUTOPLAY,
    STORAGE_SPORTINGBET3F_CONFIG,
  };
}
