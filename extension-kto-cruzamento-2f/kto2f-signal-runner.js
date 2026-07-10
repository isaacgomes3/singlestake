/** Autopilot KTO — Cruzamento 2F (230) · cruzamento sequencial 2 fatores. */
const STORAGE_KTO2F_AUTOPLAY = "gogKto2fAutopilotEnabled";
const STORAGE_KTO2F_CONFIG = "gogKto2fConfig";
const STORAGE_KTO2F_STATUS = "gogKto2fAutopilotStatus";
const STORAGE_KTO2F_STATS = "gogKto2fAutopilotSessionStats";
const STORAGE_KTO2F_MACHINE = "gogKto2fMachineState";

const DEFAULT_MAX_GALES = 5;
const BET_RETRY_MS = 1500;

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeKto2f['createKto2fEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingBetTimers = new Map();

const KTO2F_DEFAULTS = {
  tableId: SinglestakeKto2f?.KTO2F_TABLE_ID ?? 230,
  mesaUrl:
    SinglestakeKto2f?.KTO2F_MESA_URL ??
    "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/",
  wsUrl: SinglestakeDgaHub?.DGA_DEFAULTS?.wsUrl ?? "wss://dga.pragmaticplaylive.net/ws",
  casinoId: SinglestakeDgaHub?.DGA_DEFAULTS?.casinoId ?? "ppcdk00000005148",
  currency: SinglestakeDgaHub?.DGA_DEFAULTS?.currency ?? "BRL",
  maxRecovery: DEFAULT_MAX_GALES,
};

function clampMaxGales(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_GALES;
  return Math.min(5, Math.max(0, Math.floor(n)));
}

function clearPendingBetTimers() {
  for (const timer of pendingBetTimers.values()) {
    clearTimeout(timer);
  }
  pendingBetTimers.clear();
}

async function readKto2fAutopilotEnabled() {
  const data = await chrome.storage.local.get([STORAGE_KTO2F_AUTOPLAY]);
  return data[STORAGE_KTO2F_AUTOPLAY] === true;
}

async function readKto2fConfig() {
  const data = await chrome.storage.local.get([STORAGE_KTO2F_CONFIG]);
  const stored = data[STORAGE_KTO2F_CONFIG];
  if (!stored || typeof stored !== "object") return { ...KTO2F_DEFAULTS };
  const legacyWrong =
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" && stored.mesaUrl.includes("roleta-ao-vivo"));
  return {
    tableId:
      legacyWrong
        ? KTO2F_DEFAULTS.tableId
        : typeof stored.tableId === "number" && stored.tableId > 0
          ? stored.tableId
          : KTO2F_DEFAULTS.tableId,
    mesaUrl: legacyWrong
      ? KTO2F_DEFAULTS.mesaUrl
      : typeof stored.mesaUrl === "string" && stored.mesaUrl.trim()
        ? stored.mesaUrl.trim()
        : KTO2F_DEFAULTS.mesaUrl,
    wsUrl:
      typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : KTO2F_DEFAULTS.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : KTO2F_DEFAULTS.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : KTO2F_DEFAULTS.currency,
    maxRecovery: clampMaxGales(stored.maxRecovery ?? KTO2F_DEFAULTS.maxRecovery),
  };
}

async function readKto2fMachineState() {
  const data = await chrome.storage.local.get([STORAGE_KTO2F_MACHINE]);
  const raw = data[STORAGE_KTO2F_MACHINE];
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

async function persistKto2fMachineState(machine) {
  if (!machine || typeof machine !== "object") return;
  const cycleRecovery = machine.cycle?.recovery;
  await chrome.storage.local.set({
    [STORAGE_KTO2F_MACHINE]: {
      recovery:
        typeof cycleRecovery === "number" && Number.isFinite(cycleRecovery)
          ? Math.max(0, Math.floor(cycleRecovery))
          : 0,
      lastSpinHead:
        typeof machine.lastSpinHead === "string" ? machine.lastSpinHead : null,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function clearKto2fMachineState() {
  await chrome.storage.local.remove([STORAGE_KTO2F_MACHINE]);
}

async function readKto2fStats(maxRecovery) {
  const data = await chrome.storage.local.get([STORAGE_KTO2F_STATS]);
  const raw = data[STORAGE_KTO2F_STATS];
  if (!raw?.stats || typeof raw.stats !== "object") return null;
  return { stats: raw.stats, maxRecovery: clampMaxGales(raw.maxRecovery ?? maxRecovery) };
}

async function persistKto2fStats(stats, maxRecovery) {
  const mr = clampMaxGales(maxRecovery);
  await chrome.storage.local.set({
    [STORAGE_KTO2F_STATS]: { stats, maxRecovery: mr, updatedAt: new Date().toISOString() },
  });
  await writeKto2fStatus({ wins: stats.wins ?? 0, losses: stats.losses ?? 0, maxRecovery: mr });
}

async function resetKto2fStats() {
  const cfg = await readKto2fConfig();
  const empty = { wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] };
  await persistKto2fStats(empty, cfg.maxRecovery);
  await clearKto2fMachineState();
  if (engine?.resetStats) engine.resetStats();
  if (engine?.reset) engine.reset();
  return { ok: true, wins: 0, losses: 0, maxRecovery: cfg.maxRecovery };
}

async function getKto2fConfigForPopup() {
  return readKto2fConfig();
}

async function setKto2fConfigFromPopup(config) {
  await chrome.storage.local.set({ [STORAGE_KTO2F_CONFIG]: config });
}

async function writeKto2fStatus(patch) {
  const data = await chrome.storage.local.get([STORAGE_KTO2F_STATUS]);
  const prev = data[STORAGE_KTO2F_STATUS] ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_KTO2F_STATUS]: next });
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
  const f1 = active.factor1?.value ?? "";
  const f2 = active.factor2?.value ?? "";
  const axis = active.axis === "cor-altura" ? "c/a" : active.axis === "altura-paridade" ? "p/a" : active.axis ?? "";
  const gale = recovery > 0 ? ` · gale ${recovery}` : "";
  return `${f1} · ${f2}${gale} · pos${active.criticalPosition ?? "?"} ${axis}`.trim();
}

function idleRecoveryFromResult(result, engine) {
  if (result.flash?.kind === "win") return 0;
  return result.recovery ?? engine?.getState?.()?.machine?.cycle?.recovery ?? 0;
}

function resolvedRecoveryForStatus(result, engine) {
  if (result?.flash?.kind === "win") return 0;
  const cycle = cycleFromResult(result);
  if (isAwaitingReference(cycle)) return cycle.recovery ?? 0;
  if (result?.active) return result.recovery ?? cycle?.recovery ?? 0;
  return idleRecoveryFromResult(result, engine);
}

function cycleFromResult(result) {
  return result?.machine?.cycle ?? engine?.getState?.()?.machine?.cycle ?? null;
}

function isAwaitingReference(cycle) {
  return cycle?.phase === "awaiting_reference";
}

function referencePauseLabel(cycle) {
  const pos = cycle?.active?.criticalPosition ?? "?";
  const recovery = cycle?.recovery ?? 0;
  const gale = recovery > 0 ? ` · gale ${recovery}` : "";
  return `Zero na pos${pos}${gale} — aguarda próxima rodada`;
}

function liveAwaitingBetCycle() {
  const cycle = engine?.getState?.()?.machine?.cycle ?? null;
  if (!cycle || cycle.phase !== "awaiting_bet") return null;
  return cycle;
}

function payloadMatchesEngine(payload) {
  const cycle = liveAwaitingBetCycle();
  if (!cycle) return false;
  const expected = payload?.context?.currentRecovery ?? 0;
  return (cycle.recovery ?? 0) === expected;
}

function liveRecoveryForStatus() {
  const cycle = engine?.getState?.()?.machine?.cycle ?? null;
  if (!cycle) return 0;
  if (
    cycle.phase === "awaiting_bet" ||
    cycle.phase === "awaiting_result" ||
    cycle.phase === "awaiting_reference"
  ) {
    return cycle.recovery ?? 0;
  }
  return 0;
}

async function executeBridgePayload(payload, mesaUrl) {
  if (!bridgeHandler || !payload?.context?.signalId) return;
  if (payload.context.signalId === lastEmittedSignalId) return;
  if (!payloadMatchesEngine(payload)) return;

  const committedSignalId = payload.context.signalId;
  lastEmittedSignalId = committedSignalId;
  const cycle = liveAwaitingBetCycle();
  const recovery = cycle?.recovery ?? 0;
  const active = cycle?.active;
  const label =
    payload.context.factor1Label && payload.context.factor2Label
      ? `${payload.context.factor1Label} · ${payload.context.factor2Label}${
          String(payload.context.signalId || "").includes(":opp") ? " · oposto" : ""
        }`
      : formatActiveLabel(active, recovery);

  await writeKto2fStatus({
    active: true,
    tableId: payload.context.currentTableId,
    label,
    signalId: payload.context.signalId,
    recovery,
    waitingBet: false,
    lastError: null,
    lastBetDetail: null,
  });

  engine?.beginBetCommit?.();

  try {
    const bridgeResult = await bridgeHandler(payload, null);
    const { placed, detail } = summarizeBridgeBetResults(bridgeResult?.results);
    if (placed && engine?.markBetPlaced) {
      const liveCycle = engine?.getState?.()?.machine?.cycle ?? null;
      if (
        !liveCycle ||
        liveCycle.phase !== "awaiting_bet" ||
        (liveCycle.recovery ?? 0) !== recovery
      ) {
        engine?.abortBetCommit?.();
        if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
        return;
      }
      engine.markBetPlaced();
      const live = engine.getState?.();
      if (live?.machine) await persistKto2fMachineState(live.machine);
      await writeKto2fStatus({
        lastBetDetail: detail || "Aposta enviada (factor-1 + factor-2)",
        lastError: null,
        recovery: liveRecoveryForStatus(),
      });
    } else {
      engine?.abortBetCommit?.();
      lastEmittedSignalId = null;
      if (!liveAwaitingBetCycle()) return;
      const errDetail = detail || "Cliques não confirmados — calibre Preto/Vermelho/Par/Ímpar na mesa";
      await writeKto2fStatus({
        lastError: errDetail,
        lastBetDetail: detail || null,
      });
      if (!liveAwaitingBetCycle()) return;
      const cfg = await readKto2fConfig();
      const retry = engine.runTick();
      const waitMs = Math.max(BET_RETRY_MS, betDelayRemainingMs(retry));
      const signalKey = `retry:${payload.context.signalId}`;
      if (!pendingBetTimers.has(signalKey)) {
        const timer = setTimeout(() => {
          pendingBetTimers.delete(signalKey);
          if (!engine || !liveAwaitingBetCycle()) return;
          scheduleBetAttempt(engine.runTick(), mesaUrl, cfg);
        }, waitMs);
        pendingBetTimers.set(signalKey, timer);
      }
    }
  } catch (e) {
    engine?.abortBetCommit?.();
    lastEmittedSignalId = null;
    if (!liveAwaitingBetCycle()) return;
    const msg = e instanceof Error ? e.message : String(e);
    await writeKto2fStatus({
      lastError: msg,
    });
    const cfg = await readKto2fConfig();
    scheduleBetAttempt(engine.runTick(), mesaUrl, cfg);
  }
}

function betDelayRemainingMs(result) {
  const state = engine?.getState?.();
  const recovery =
    result?.recovery ??
    state?.machine?.cycle?.recovery ??
    0;
  const at = state?.lastLiveSpinAt;
  if (at == null) return BET_RETRY_MS;

  const settleMs =
    recovery > 0
      ? SinglestakeKto2f?.ROTATING_ROOM_CROSSING_BET_DELAY_MS ?? 5000
      : SinglestakeKto2f?.ICE_2F_FIRST_BET_SETTLE_MS ?? 13000;
  return Math.max(BET_RETRY_MS, settleMs - (Date.now() - at));
}

async function syncReferencePauseStatus(result, cfg) {
  const cycle = cycleFromResult(result);
  if (!isAwaitingReference(cycle)) return false;
  clearPendingBetTimers();
  lastEmittedSignalId = null;
  engine?.abortBetCommit?.();
  await writeKto2fStatus({
    active: true,
    tableId: cfg.tableId,
    label: referencePauseLabel(cycle),
    recovery: cycle?.recovery ?? 0,
    waitingBet: true,
    waitingReference: true,
    lastError: null,
    lastBetDetail: null,
    reason: `Gale ${cycle?.recovery ?? 0} mantido — zero na posição crítica`,
  });
  return true;
}

async function scheduleBetAttempt(result, mesaUrl, cfg) {
  const cycle = cycleFromResult(result);
  if (!engine) return;

  if (isAwaitingReference(cycle)) {
    await syncReferencePauseStatus(result, cfg);
    return;
  }

  if (!result?.active) {
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    await writeKto2fStatus({
      active: false,
      tableId: null,
      label: null,
      signalId: null,
      waitingBet: false,
      waitingReference: false,
      recovery: resolvedRecoveryForStatus(result, engine),
    });
    return;
  }

  const payload = engine.buildBridgePayload(mesaUrl);
  if (!payload?.context?.signalId) {
    const remaining = betDelayRemainingMs(result);
    const tableId = cfg.tableId;
    const active = result.active;
    const label = formatActiveLabel(active, result.recovery ?? 0);

    void writeKto2fStatus({
      active: true,
      tableId,
      label,
      waitingBet: true,
      waitingReference: false,
      waitRemainingSec: Math.ceil(remaining / 1000),
      recovery: result.recovery,
      lastError: null,
    });

    const signalKey = `kto2f:pos${active?.criticalPosition ?? "?"}:${active?.axis ?? "?"}:${result.recovery}`;
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
    await persistKto2fMachineState(result.machine);
  }
  if (result.stats) {
    await persistKto2fStats(result.stats, cfg.maxRecovery);
  }

  if (isAwaitingReference(cycleFromResult(result)) && !result.flash) {
    await syncReferencePauseStatus(result, cfg);
  }

  if (result.flash) {
    const ended = result.flash.kind === "win" || result.flash.kind === "tie" || result.flash.kind === "loss";
    if (ended && !result.active) {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
    }
    const idleRecovery = idleRecoveryFromResult(result, engine);
    const flashKind = result.flash.kind;
    const pausedCycle = cycleFromResult(result);
    const idleReason =
      isAwaitingReference(pausedCycle)
        ? flashKind === "tie"
          ? `Empate (${result.flash.resultNumber}) — gale ${pausedCycle.recovery ?? 0} mantido · zero na pos${pausedCycle.active?.criticalPosition ?? "?"}`
          : `Gale ${pausedCycle.recovery ?? 0} mantido — zero na posição crítica`
        : flashKind === "tie"
        ? idleRecovery > 0
          ? `Empate — gale ${idleRecovery} mantido · aguarda novo gatilho`
          : "Empate — aguarda novo gatilho (4 falhas cruzamento)"
        : flashKind === "loss"
          ? idleRecovery > 0
            ? `Aguarda novo gatilho · próxima entrada gale ${idleRecovery}`
            : idleRecovery === 0 && (result.stats?.losses ?? 0) > 0
              ? "Derrota final — aguarda novo gatilho"
              : "Aguarda novo gatilho (4 falhas cruzamento)"
          : flashKind === "win"
            ? "Vitória — aguarda novo gatilho"
            : idleRecovery > 0
              ? `Aguarda novo gatilho · próxima entrada gale ${idleRecovery}`
              : "Aguarda novo gatilho (4 falhas cruzamento)";
    await writeKto2fStatus({
      lastFlash: flashKind,
      lastResult: result.flash.resultNumber,
      ...(flashKind === "win" ? { recovery: 0 } : {}),
      ...(ended && !result.active
        ? isAwaitingReference(pausedCycle)
          ? {
              active: true,
              label: referencePauseLabel(pausedCycle),
              recovery: pausedCycle.recovery ?? 0,
              waitingBet: true,
              waitingReference: true,
              lastError: null,
              reason: idleReason,
            }
          : {
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
    await writeKto2fStatus({
      active: true,
      label,
      recovery: displayRecovery,
      lastTrigger: result.active.triggerNumbers ?? null,
      tableId: cfg.tableId,
      reason: null,
      waitingBet: false,
      waitingReference: false,
      lastError: null,
    });
  }

  if (!bridgeHandler) return;

  await scheduleBetAttempt(result, mesaUrl, cfg);
}

async function startKto2fAutopilot(handleBridgePayload) {
  if (typeof handleBridgePayload === "function") {
    bridgeHandler = handleBridgePayload;
    globalThis.__singlestakeKto2fBridgeHandler = handleBridgePayload;
  }
  const enabled = await readKto2fAutopilotEnabled();
  if (!enabled) {
    await writeKto2fStatus({ running: false, reason: "autopilot KTO 2F desligado" });
    return;
  }

  if (!globalThis.SinglestakeKto2f?.createKto2fEngine) {
    await writeKto2fStatus({
      running: false,
      reason: "kto2f-engine.js em falta — corra npm run extension:kto2f:build",
    });
    return;
  }

  stopKto2fAutopilot();

  const cfg = await readKto2fConfig();
  const saved = await readKto2fStats(cfg.maxRecovery);
  const savedMachine = await readKto2fMachineState();
  engine = SinglestakeKto2f.createKto2fEngine({
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
    onLog: (msg) => void writeKto2fStatus({ log: msg }),
    onStatus: (status) => void writeKto2fStatus({ dga: status }),
    onHistorySnapshot: async (_tableId, spins) => {
      if (!engine) return;
      const result = engine.ingestHistorySnapshot(spins);
      const cfgNow = await readKto2fConfig();
      void processEngineResult(result, cfgNow.mesaUrl, cfgNow);
    },
    onSpin: (_tableId, spin) => {
      if (!engine) return;
      const result = engine.ingestSpin(spin.number, spin.gameId);
      if (!result) return;
      void readKto2fConfig().then((cfgNow) =>
        processEngineResult(result, cfgNow.mesaUrl, cfgNow),
      );
    },
  });

  dgaHub.start();
  await writeKto2fStatus({
    running: true,
    reason: null,
    tableId: cfg.tableId,
    mesaUrl: cfg.mesaUrl,
    maxRecovery: cfg.maxRecovery,
    wins: saved?.stats?.wins ?? 0,
    losses: saved?.stats?.losses ?? 0,
  });
}

function stopKto2fAutopilot() {
  clearPendingBetTimers();
  dgaHub?.stop();
  dgaHub = null;
  engine = null;
  lastEmittedSignalId = null;
  void writeKto2fStatus({ running: false, active: false, waitingBet: false });
}

async function setKto2fAutopilotEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_KTO2F_AUTOPLAY]: enabled === true });
  if (enabled) {
    await startKto2fAutopilot(bridgeHandler ?? globalThis.__singlestakeKto2fBridgeHandler ?? null);
    if (!bridgeHandler && !globalThis.__singlestakeKto2fBridgeHandler) {
      await writeKto2fStatus({
        running: false,
        reason: "Extensão a iniciar — clique Parado/Activo outra vez",
      });
    }
  } else {
    stopKto2fAutopilot();
    await writeKto2fStatus({ running: false, reason: "autopilot KTO 2F desligado" });
  }
  return getKto2fAutopilotStatus();
}

async function getKto2fAutopilotStatus() {
  const data = await chrome.storage.local.get([STORAGE_KTO2F_STATUS, STORAGE_KTO2F_AUTOPLAY, STORAGE_KTO2F_STATS]);
  const statsPack = data[STORAGE_KTO2F_STATS];
  const live = engine?.getState?.();
  const wins = live?.stats?.wins ?? statsPack?.stats?.wins ?? data[STORAGE_KTO2F_STATUS]?.wins ?? 0;
  const losses = live?.stats?.losses ?? statsPack?.stats?.losses ?? data[STORAGE_KTO2F_STATUS]?.losses ?? 0;
  const stored = data[STORAGE_KTO2F_STATUS] ?? {};
  const liveCycle = live?.machine?.cycle ?? null;
  let pendingRecovery = liveCycle?.recovery ?? 0;
  if (stored.lastFlash === "win") {
    pendingRecovery = liveCycle?.recovery ?? 0;
  } else if (!liveCycle) {
    if (stored.waitingReference && typeof stored.recovery === "number") {
      pendingRecovery = stored.recovery;
    } else {
      pendingRecovery =
        typeof stored.recovery === "number"
          ? stored.recovery
          : (await readKto2fMachineState())?.recovery ?? 0;
    }
  }
  const maxRecovery =
    live?.maxRecovery ?? statsPack?.maxRecovery ?? data[STORAGE_KTO2F_STATUS]?.maxRecovery ?? DEFAULT_MAX_GALES;
  return {
    enabled: data[STORAGE_KTO2F_AUTOPLAY] === true,
    status: {
      ...(data[STORAGE_KTO2F_STATUS] ?? { running: false }),
      wins,
      losses,
      maxRecovery,
      recovery: pendingRecovery,
      extensionVersion: chrome.runtime.getManifest().version,
    },
  };
}

function initKto2fSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  globalThis.__singlestakeKto2fBridgeHandler = handleBridgePayload;
  void readKto2fAutopilotEnabled().then((on) => {
    if (on) void startKto2fAutopilot(handleBridgePayload);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_KTO2F_AUTOPLAY] && bridgeHandler) {
      if (changes[STORAGE_KTO2F_AUTOPLAY].newValue === true) {
        void startKto2fAutopilot(bridgeHandler);
      } else {
        stopKto2fAutopilot();
      }
    }
    if (changes[STORAGE_KTO2F_CONFIG] && bridgeHandler) {
      void readKto2fAutopilotEnabled().then((on) => {
        if (on) void startKto2fAutopilot(bridgeHandler);
      });
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeKto2fSignalRunner = {
    initKto2fSignalRunner,
    startKto2fAutopilot,
    stopKto2fAutopilot,
    setKto2fAutopilotEnabled,
    getKto2fAutopilotStatus,
    getKto2fConfigForPopup,
    setKto2fConfigFromPopup,
    resetKto2fStats,
    STORAGE_KTO2F_AUTOPLAY,
    STORAGE_KTO2F_CONFIG,
  };
}
