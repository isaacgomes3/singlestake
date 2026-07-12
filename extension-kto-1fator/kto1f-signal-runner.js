/** Autopilot KTO — 1 Fator (230) · score pos 1×13 → alerta pos 12. */
const STORAGE_KTO1F_AUTOPLAY = "gogKto1fAutopilotEnabled";
const STORAGE_KTO1F_CONFIG = "gogKto1fConfig";
const STORAGE_KTO1F_STATUS = "gogKto1fAutopilotStatus";
const STORAGE_KTO1F_STATS = "gogKto1fAutopilotSessionStats";
const STORAGE_KTO1F_MACHINE = "gogKto1fMachineState";

const DEFAULT_MAX_GALES = 5;
const BET_RETRY_MS = 1500;

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeKto1f['createKto1fEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingBetTimers = new Map();

const KTO1F_DEFAULTS = {
  tableId: SinglestakeKto1f?.KTO1F_TABLE_ID ?? 230,
  mesaUrl:
    SinglestakeKto1f?.KTO1F_MESA_URL ??
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

async function readKto1fAutopilotEnabled() {
  const data = await chrome.storage.local.get([STORAGE_KTO1F_AUTOPLAY]);
  return data[STORAGE_KTO1F_AUTOPLAY] === true;
}

async function readKto1fConfig() {
  const data = await chrome.storage.local.get([STORAGE_KTO1F_CONFIG]);
  const stored = data[STORAGE_KTO1F_CONFIG];
  if (!stored || typeof stored !== "object") return { ...KTO1F_DEFAULTS };
  const legacyWrong =
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" && stored.mesaUrl.includes("roleta-ao-vivo"));
  return {
    tableId:
      legacyWrong
        ? KTO1F_DEFAULTS.tableId
        : typeof stored.tableId === "number" && stored.tableId > 0
          ? stored.tableId
          : KTO1F_DEFAULTS.tableId,
    mesaUrl: legacyWrong
      ? KTO1F_DEFAULTS.mesaUrl
      : typeof stored.mesaUrl === "string" && stored.mesaUrl.trim()
        ? stored.mesaUrl.trim()
        : KTO1F_DEFAULTS.mesaUrl,
    wsUrl:
      typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : KTO1F_DEFAULTS.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : KTO1F_DEFAULTS.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : KTO1F_DEFAULTS.currency,
    maxRecovery: clampMaxGales(stored.maxRecovery ?? KTO1F_DEFAULTS.maxRecovery),
  };
}

async function readKto1fMachineState() {
  const data = await chrome.storage.local.get([STORAGE_KTO1F_MACHINE]);
  const raw = data[STORAGE_KTO1F_MACHINE];
  if (!raw || typeof raw !== "object") return null;
  const recovery =
    typeof raw.recovery === "number" && Number.isFinite(raw.recovery)
      ? Math.max(0, Math.floor(raw.recovery))
      : 0;
  const lastSpinHead =
    typeof raw.lastSpinHead === "string" && raw.lastSpinHead.trim()
      ? raw.lastSpinHead.trim()
      : null;
  const phase =
    raw.phase === "awaiting_bet" || raw.phase === "awaiting_result" ? raw.phase : null;
  const alertKind =
    raw.alertKind === "paridade" || raw.alertKind === "cor" || raw.alertKind === "altura"
      ? raw.alertKind
      : null;
  const pendingRecovery =
    typeof raw.pendingRecovery === "number" && Number.isFinite(raw.pendingRecovery)
      ? Math.max(0, Math.floor(raw.pendingRecovery))
      : 0;
  const totalRounds =
    typeof raw.totalRounds === "number" && Number.isFinite(raw.totalRounds)
      ? Math.max(0, Math.floor(raw.totalRounds))
      : 0;
  return {
    recovery,
    lastSpinHead,
    phase,
    alertKind,
    pendingRecovery,
    totalRounds,
  };
}

async function persistKto1fMachineState(machine) {
  if (!machine || typeof machine !== "object") return;
  const cycle = machine.cycle;
  const cycleRecovery = cycle?.recovery;
  await chrome.storage.local.set({
    [STORAGE_KTO1F_MACHINE]: {
      recovery:
        typeof cycleRecovery === "number" && Number.isFinite(cycleRecovery)
          ? Math.max(0, Math.floor(cycleRecovery))
          : 0,
      lastSpinHead:
        typeof machine.lastSpinHead === "string" ? machine.lastSpinHead : null,
      phase: cycle?.phase ?? null,
      alertKind: cycle?.active?.alertKind ?? null,
      pendingRecovery:
        typeof machine.pendingRecovery === "number" ? machine.pendingRecovery : 0,
      totalRounds: typeof machine.totalRounds === "number" ? machine.totalRounds : 0,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function clearKto1fMachineState() {
  await chrome.storage.local.remove([STORAGE_KTO1F_MACHINE]);
}

async function readKto1fStats(maxRecovery) {
  const data = await chrome.storage.local.get([STORAGE_KTO1F_STATS]);
  const raw = data[STORAGE_KTO1F_STATS];
  if (!raw?.stats || typeof raw.stats !== "object") return null;
  return { stats: raw.stats, maxRecovery: clampMaxGales(raw.maxRecovery ?? maxRecovery) };
}

async function persistKto1fStats(stats, maxRecovery) {
  const mr = clampMaxGales(maxRecovery);
  await chrome.storage.local.set({
    [STORAGE_KTO1F_STATS]: { stats, maxRecovery: mr, updatedAt: new Date().toISOString() },
  });
  await writeKto1fStatus({ wins: stats.wins ?? 0, losses: stats.losses ?? 0, maxRecovery: mr });
}

async function resetKto1fStats() {
  const cfg = await readKto1fConfig();
  const empty = { wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] };
  await persistKto1fStats(empty, cfg.maxRecovery);
  await clearKto1fMachineState();
  if (engine?.resetStats) engine.resetStats();
  if (engine?.reset) engine.reset();
  return { ok: true, wins: 0, losses: 0, maxRecovery: cfg.maxRecovery };
}

async function getKto1fConfigForPopup() {
  return readKto1fConfig();
}

async function setKto1fConfigFromPopup(config) {
  await chrome.storage.local.set({ [STORAGE_KTO1F_CONFIG]: config });
}

async function writeKto1fStatus(patch) {
  const data = await chrome.storage.local.get([STORAGE_KTO1F_STATUS]);
  const prev = data[STORAGE_KTO1F_STATUS] ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_KTO1F_STATUS]: next });
  return next;
}

function summarizeBridgeBetResults(results) {
  const clicks = (results ?? []).filter((r) => r?.target === "factor-1");
  const doubles = (results ?? []).filter((r) => r?.target === "repeat-bet");
  const f1 = clicks.find((r) => r?.target === "factor-1");
  const ok = (r) => r?.ok === true && r?.skipped !== true;
  const doublesOk = doubles.length === 0 || doubles.every(ok);
  const placed = ok(f1) && doublesOk;
  const detail = [...clicks, ...doubles]
    .map((r) => `${r.target}: ${r.ok ? "ok" : "falhou"}${r.skipped ? " (ignorado)" : ""} — ${r.detail ?? ""}`)
    .join(" | ");
  return { placed, detail, f1 };
}

function formatActiveLabel(active, recovery) {
  if (!active) return null;
  const kind = active.alertKind ?? "";
  const label =
    active.alertFactor?.value === "Impar"
      ? "Ímpar"
      : active.alertFactor?.value ?? "";
  const score = active.scoreWins != null ? ` · score ${active.scoreWins}` : "";
  const gale = recovery > 0 ? ` · gale ${recovery}` : "";
  return `${kind} ${label}${score}${gale} · pos12`.trim();
}

function kindFromActive(active) {
  return active?.alertKind === "paridade" ||
    active?.alertKind === "cor" ||
    active?.alertKind === "altura"
    ? active.alertKind
    : null;
}

function scoreboardPatch(machine) {
  const board = machine?.scoreboard;
  if (!board) return {};
  const best =
    typeof SinglestakeKto1f?.kto1fBestKind === "function"
      ? SinglestakeKto1f.kto1fBestKind(board)
      : null;
  return {
    scoreboard: {
      paridade: board.paridade ?? { wins: 0, losses: 0, last: null },
      cor: board.cor ?? { wins: 0, losses: 0, last: null },
      altura: board.altura ?? { wins: 0, losses: 0, last: null },
    },
    totalRounds: machine.totalRounds ?? 0,
    bestKind: best,
  };
}

function idleRecoveryFromResult(result, engine) {
  const cycle = cycleFromResult(result);
  if (result.flash?.kind === "win" && !cycle) return 0;
  return cycle?.recovery ?? result.recovery ?? engine?.getState?.()?.machine?.cycle?.recovery ?? 0;
}

function resolvedRecoveryForStatus(result, engine) {
  const cycle = cycleFromResult(result);
  if (result?.flash?.kind === "win" && !cycle) return 0;
  if (cycle) return cycle.recovery ?? 0;
  if (result?.active) return result.recovery ?? 0;
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
  const label = payload.context.factor1Label
    ? `${active?.alertKind ?? "1F"} ${payload.context.factor1Label}${
        recovery > 0 ? ` · gale ${recovery}` : ""
      } · pos12`.trim()
    : formatActiveLabel(active, recovery);

  await writeKto1fStatus({
    active: true,
    tableId: payload.context.currentTableId,
    label,
    alertKind: kindFromActive(active),
    signalId: payload.context.signalId,
    recovery,
    waitingBet: false,
    lastError: null,
    lastBetDetail: null,
    ...scoreboardPatch(engine?.getState?.()?.machine),
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
      if (live?.machine) await persistKto1fMachineState(live.machine);
      await writeKto1fStatus({
        lastBetDetail: detail || "Aposta enviada (factor-1 + dobrar)",
        lastError: null,
        recovery: liveRecoveryForStatus(),
      });
    } else {
      engine?.abortBetCommit?.();
      lastEmittedSignalId = null;
      if (!liveAwaitingBetCycle()) return;
      const errDetail = detail || "Cliques não confirmados — calibre Preto/Vermelho/Par/Ímpar na mesa";
      await writeKto1fStatus({
        lastError: errDetail,
        lastBetDetail: detail || null,
      });
      if (!liveAwaitingBetCycle()) return;
      const cfg = await readKto1fConfig();
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
    await writeKto1fStatus({
      lastError: msg,
    });
    const cfg = await readKto1fConfig();
    scheduleBetAttempt(engine.runTick(), mesaUrl, cfg);
  }
}

function betDelayRemainingMs(result) {
  const state = engine?.getState?.();
  const cycle = state?.machine?.cycle ?? result?.machine?.cycle ?? null;
  const recovery = result?.recovery ?? cycle?.recovery ?? 0;
  const at = state?.lastLiveSpinAt;
  const immediate = cycle?.immediateBet === true;
  if (at == null) return immediate ? 0 : BET_RETRY_MS;

  const settleMs =
    typeof SinglestakeKto1f?.kto1fBetDelayMs === "function"
      ? SinglestakeKto1f.kto1fBetDelayMs(recovery, immediate)
      : immediate
        ? (SinglestakeKto1f?.KTO_1F_IMMEDIATE_REBET_DELAY_MS ?? 6000)
        : (SinglestakeKto1f?.ROTATING_ROOM_CROSSING_BET_DELAY_MS ??
          SinglestakeKto1f?.KTO_1F_RECOVERY_BET_DELAY_MS ?? 6000);
  const remaining = settleMs - (Date.now() - at);
  if (immediate) return Math.max(0, remaining);
  return Math.max(BET_RETRY_MS, remaining);
}

async function syncReferencePauseStatus(result, cfg) {
  const cycle = cycleFromResult(result);
  if (!isAwaitingReference(cycle)) return false;
  clearPendingBetTimers();
  lastEmittedSignalId = null;
  engine?.abortBetCommit?.();
  await writeKto1fStatus({
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

  // Ciclo aberto à espera do resultado da aposta — não ir para idle.
  if (cycle?.phase === "awaiting_result") {
    await writeKto1fStatus({
      active: true,
      tableId: cfg.tableId,
      recovery: cycle.recovery ?? 0,
      waitingBet: false,
      waitingReference: false,
      lastError: null,
    });
    return;
  }

  const active = result?.active ?? (cycle?.phase === "awaiting_bet" ? cycle.active : null);
  if (!active) {
    // Só idle quando o ciclo realmente terminou (não confundir empate/pausa com fim).
    if (cycle) {
      await writeKto1fStatus({
        active: true,
        tableId: cfg.tableId,
        recovery: cycle.recovery ?? 0,
        waitingBet: cycle.phase === "awaiting_bet",
        waitingReference: false,
        lastError: null,
      });
      return;
    }
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    await writeKto1fStatus({
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

  // Garante result.active para o resto do fluxo (empate pode ter active só no cycle).
  if (!result.active) {
    result = { ...result, active, recovery: cycle?.recovery ?? result.recovery ?? 0 };
  }

  const payload = engine.buildBridgePayload(mesaUrl);
  if (!payload?.context?.signalId) {
    const remaining = betDelayRemainingMs(result);
    const tableId = cfg.tableId;
    const active = result.active;
    const label = formatActiveLabel(active, result.recovery ?? 0);

    void writeKto1fStatus({
      active: true,
      tableId,
      label,
      alertKind: kindFromActive(active),
      waitingBet: true,
      waitingReference: false,
      waitRemainingSec: Math.ceil(remaining / 1000),
      recovery: result.recovery,
      lastError: null,
      ...scoreboardPatch(engine?.getState?.()?.machine),
    });

    const signalKey = `kto1f:${active?.alertKind ?? "?"}:${result.recovery}`;
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
    await persistKto1fMachineState(result.machine);
  }
  if (result.stats) {
    await persistKto1fStats(result.stats, cfg.maxRecovery);
  }

  if (isAwaitingReference(cycleFromResult(result)) && !result.flash) {
    await syncReferencePauseStatus(result, cfg);
  }

  if (result.flash) {
    const flashKind = result.flash.kind;
    const pausedCycle = cycleFromResult(result);
    const cycleOpen = pausedCycle != null;
    // result.active só existe em awaiting_bet — empate/vitória parcial podem
    // ficar em awaiting_reference com ciclo aberto; não tratar como fim de ciclo.
    const cycleClosed = !cycleOpen;
    if (cycleClosed) {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
    } else if (result.flash) {
      // Nova aposta do mesmo ciclo (empate / gale) — permite reemitir o mesmo signalId.
      lastEmittedSignalId = null;
      clearPendingBetTimers();
    }
    const idleRecovery = idleRecoveryFromResult(result, engine);
    const idleReason = cycleClosed
      ? flashKind === "tie"
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
              : "Aguarda novo gatilho (4 falhas cruzamento)"
      : isAwaitingReference(pausedCycle)
        ? flashKind === "tie"
          ? `Empate (${result.flash.resultNumber}) — gale ${pausedCycle.recovery ?? 0} mantido · zero na pos${pausedCycle.active?.criticalPosition ?? "?"}`
          : flashKind === "win"
            ? `Vitória parcial — gale ${pausedCycle.recovery ?? 0} · zero na pos${pausedCycle.active?.criticalPosition ?? "?"}`
            : flashKind === "zero"
              ? `Zero na indicação — gale ${pausedCycle.recovery ?? 0} mantido · recup. ${result.machine?.zeroRecoveredUnits ?? 0}/${result.machine?.zeroDebtUnits ?? 0}u · +${result.machine?.zeroShift ?? 0}×`
              : `Gale ${pausedCycle.recovery ?? 0} mantido — zero na posição crítica`
        : null;
    await writeKto1fStatus({
      lastFlash: flashKind,
      lastResult: result.flash.resultNumber,
      // Só zera recovery no status quando o ciclo fechou de verdade.
      ...(flashKind === "win" && cycleClosed ? { recovery: 0 } : {}),
      ...(cycleOpen && pausedCycle
        ? {
            recovery: pausedCycle.recovery ?? result.recovery ?? 0,
            ...(isAwaitingReference(pausedCycle)
              ? {
                  active: true,
                  label: referencePauseLabel(pausedCycle),
                  waitingBet: true,
                  waitingReference: true,
                  lastError: null,
                  reason: idleReason,
                }
              : {}),
          }
        : {}),
      ...(cycleClosed && idleReason
        ? {
            active: false,
            label: null,
            lastTrigger: null,
            signalId: null,
            waitingBet: false,
            waitingReference: false,
            recovery: flashKind === "win" ? 0 : idleRecovery,
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
    const displayRecovery = result.recovery ?? 0;
    await writeKto1fStatus({
      active: true,
      label,
      alertKind: kindFromActive(result.active),
      recovery: displayRecovery,
      tableId: cfg.tableId,
      reason: null,
      waitingBet: false,
      waitingReference: false,
      lastError: null,
      ...scoreboardPatch(result.machine ?? engine?.getState?.()?.machine),
    });
  }

  const machineState =
    result.machine ?? engine?.getState?.()?.machine ?? null;
  if (machineState) {
    const watchLabelFn = SinglestakeKto1f?.kto1fWatchLabelForMachine;
    if (typeof watchLabelFn === "function") {
      await writeKto1fStatus({
        watchLabel: watchLabelFn(machineState),
        ...scoreboardPatch(machineState),
      });
    }
  }

  await scheduleBetAttempt(result, mesaUrl, cfg);
}

async function startKto1fAutopilot(handleBridgePayload) {
  if (typeof handleBridgePayload === "function") {
    bridgeHandler = handleBridgePayload;
    globalThis.__SinglestakeKto1fBridgeHandler = handleBridgePayload;
  }
  const enabled = await readKto1fAutopilotEnabled();
  if (!enabled) {
    await writeKto1fStatus({ running: false, reason: "autopilot KTO 1F desligado" });
    return;
  }

  if (!globalThis.SinglestakeKto1f?.createKto1fEngine) {
    await writeKto1fStatus({
      running: false,
      reason: "kto1f-engine.js em falta — corra npm run extension:kto1f:build",
    });
    return;
  }

  stopKto1fAutopilot();

  const cfg = await readKto1fConfig();
  const saved = await readKto1fStats(cfg.maxRecovery);
  const savedMachine = await readKto1fMachineState();
  engine = SinglestakeKto1f.createKto1fEngine({
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
    onLog: (msg) => void writeKto1fStatus({ log: msg }),
    onStatus: (status) => void writeKto1fStatus({ dga: status }),
    onHistorySnapshot: async (_tableId, spins) => {
      if (!engine) return;
      const result = engine.ingestHistorySnapshot(spins);
      const cfgNow = await readKto1fConfig();
      void processEngineResult(result, cfgNow.mesaUrl, cfgNow);
    },
    onSpin: (_tableId, spin) => {
      if (!engine) return;
      const result = engine.ingestSpin(spin.number, spin.gameId);
      if (!result) return;
      void readKto1fConfig().then((cfgNow) =>
        processEngineResult(result, cfgNow.mesaUrl, cfgNow),
      );
    },
  });

  dgaHub.start();
  await writeKto1fStatus({
    running: true,
    reason: null,
    tableId: cfg.tableId,
    mesaUrl: cfg.mesaUrl,
    maxRecovery: cfg.maxRecovery,
    wins: saved?.stats?.wins ?? 0,
    losses: saved?.stats?.losses ?? 0,
  });
}

function stopKto1fAutopilot() {
  clearPendingBetTimers();
  dgaHub?.stop();
  dgaHub = null;
  engine = null;
  lastEmittedSignalId = null;
  void writeKto1fStatus({ running: false, active: false, waitingBet: false });
}

async function setKto1fAutopilotEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_KTO1F_AUTOPLAY]: enabled === true });
  if (enabled) {
    await startKto1fAutopilot(bridgeHandler ?? globalThis.__SinglestakeKto1fBridgeHandler ?? null);
    if (!bridgeHandler && !globalThis.__SinglestakeKto1fBridgeHandler) {
      await writeKto1fStatus({
        running: false,
        reason: "Extensão a iniciar — clique Parado/Activo outra vez",
      });
    }
  } else {
    stopKto1fAutopilot();
    await writeKto1fStatus({ running: false, reason: "autopilot KTO 1F desligado" });
  }
  return getKto1fAutopilotStatus();
}

async function getKto1fAutopilotStatus() {
  const data = await chrome.storage.local.get([STORAGE_KTO1F_STATUS, STORAGE_KTO1F_AUTOPLAY, STORAGE_KTO1F_STATS]);
  const statsPack = data[STORAGE_KTO1F_STATS];
  const live = engine?.getState?.();
  const wins = live?.stats?.wins ?? statsPack?.stats?.wins ?? data[STORAGE_KTO1F_STATUS]?.wins ?? 0;
  const losses = live?.stats?.losses ?? statsPack?.stats?.losses ?? data[STORAGE_KTO1F_STATUS]?.losses ?? 0;
  const stored = data[STORAGE_KTO1F_STATUS] ?? {};
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
          : (await readKto1fMachineState())?.recovery ?? 0;
    }
  }
  const maxRecovery =
    live?.maxRecovery ?? statsPack?.maxRecovery ?? data[STORAGE_KTO1F_STATUS]?.maxRecovery ?? DEFAULT_MAX_GALES;
  return {
    enabled: data[STORAGE_KTO1F_AUTOPLAY] === true,
    status: {
      ...(data[STORAGE_KTO1F_STATUS] ?? { running: false }),
      wins,
      losses,
      maxRecovery,
      recovery: pendingRecovery,
      extensionVersion: chrome.runtime.getManifest().version,
    },
  };
}

function initKto1fSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  globalThis.__SinglestakeKto1fBridgeHandler = handleBridgePayload;
  void readKto1fAutopilotEnabled().then((on) => {
    if (on) void startKto1fAutopilot(handleBridgePayload);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_KTO1F_AUTOPLAY] && bridgeHandler) {
      if (changes[STORAGE_KTO1F_AUTOPLAY].newValue === true) {
        void startKto1fAutopilot(bridgeHandler);
      } else {
        stopKto1fAutopilot();
      }
    }
    if (changes[STORAGE_KTO1F_CONFIG] && bridgeHandler) {
      void readKto1fAutopilotEnabled().then((on) => {
        if (on) void startKto1fAutopilot(bridgeHandler);
      });
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeKto1fSignalRunner = {
    initKto1fSignalRunner,
    startKto1fAutopilot,
    stopKto1fAutopilot,
    setKto1fAutopilotEnabled,
    getKto1fAutopilotStatus,
    getKto1fConfigForPopup,
    setKto1fConfigFromPopup,
    resetKto1fStats,
    STORAGE_KTO1F_AUTOPLAY,
    STORAGE_KTO1F_CONFIG,
  };
}
