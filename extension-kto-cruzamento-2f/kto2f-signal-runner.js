/** Autopilot KTO — Cruzamento 2F (230) · cruzamento sequencial 2 fatores. */
const STORAGE_KTO2F_AUTOPLAY = "gogKto2fAutopilotEnabled";
const STORAGE_KTO2F_CONFIG = "gogKto2fConfig";
const STORAGE_KTO2F_STATUS = "gogKto2fAutopilotStatus";
const STORAGE_KTO2F_STATS = "gogKto2fAutopilotSessionStats";
const STORAGE_KTO2F_MACHINE = "gogKto2fMachineState";

const DEFAULT_MAX_GALES = 8;
const BET_RETRY_MS = 1500;

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeKto2f['createKto2fEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
let pendingBetTimers = new Map();
/** Evita corridas: dois giros a escrever status/placar fora de ordem. */
let engineResultTail = Promise.resolve();

function enqueueEngineResult(task) {
  engineResultTail = engineResultTail.then(task, task).catch(() => {});
  return engineResultTail;
}

const KTO2F_DEFAULTS = {
  tableId: SinglestakeKto2f?.KTO2F_TABLE_ID ?? 230,
  mesaUrl:
    SinglestakeKto2f?.KTO2F_MESA_URL ??
    "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/",
  wsUrl: SinglestakeDgaHub?.DGA_DEFAULTS?.wsUrl ?? "wss://dga.pragmaticplaylive.net/ws",
  casinoId: SinglestakeDgaHub?.DGA_DEFAULTS?.casinoId ?? "ppcdk00000005148",
  currency: SinglestakeDgaHub?.DGA_DEFAULTS?.currency ?? "BRL",
  maxRecovery: DEFAULT_MAX_GALES,
  noGale: false,
  observeOnly: false,
  enabledPairIds: ["2x4"],
};

function knownPairIds() {
  const known = SinglestakeKto2f?.ICE_2F_KNOWN_COMPARE_PAIRS;
  if (Array.isArray(known) && known.length > 0) {
    return known.map((p) => p.id).filter((id) => typeof id === "string");
  }
  return ["2x4"];
}

function defaultEnabledPairIds() {
  const ids = SinglestakeKto2f?.ICE_2F_DEFAULT_ENABLED_PAIR_IDS;
  if (Array.isArray(ids) && ids.length > 0) return ids.map(String);
  return ["2x4"];
}

function normalizeEnabledPairIds(raw) {
  const known = new Set(knownPairIds());
  const fallback = defaultEnabledPairIds().filter((id) => known.has(id));
  if (!Array.isArray(raw)) return fallback.length > 0 ? fallback : ["2x4"];
  const next = [];
  for (const item of raw) {
    const id = typeof item === "string" ? item.trim() : "";
    if (!id || !known.has(id) || next.includes(id)) continue;
    next.push(id);
  }
  return next.length > 0 ? next : fallback.length > 0 ? fallback : ["2x4"];
}

function applyEnabledPairsFromConfig(cfg) {
  const ids = normalizeEnabledPairIds(cfg?.enabledPairIds);
  const api =
    typeof SinglestakeKto2f !== "undefined"
      ? SinglestakeKto2f.applyIce2fEnabledPairIds
        ? SinglestakeKto2f
        : SinglestakeKto2f.default
      : null;
  if (typeof api?.applyIce2fEnabledPairIds === "function") {
    api.applyIce2fEnabledPairIds(ids);
  }
  // Ciclo activo de gatilho desligado → cancelar e limpar status.
  if (typeof engine?.dropCycleIfPairDisabled === "function") {
    const dropped = engine.dropCycleIfPairDisabled(ids);
    if (dropped) {
      clearPendingBetTimers();
      lastEmittedSignalId = null;
      void writeKto2fStatus({
        active: false,
        label: null,
        waitingBet: false,
        waitingReference: false,
        reason: `Gatilho desactivado — activos: ${ids.map((id) => String(id).replace(/x/gi, "×")).join(" · ")}`,
        criticalPosition: null,
        matchPosition: null,
        triggerNumber: null,
        matchNumber: null,
        pairId: null,
      });
    }
  }
  return ids;
}

function mergePairIndicationForUi(pairIndication) {
  const map =
    pairIndication && typeof pairIndication === "object" && !Array.isArray(pairIndication)
      ? { ...pairIndication }
      : {};
  for (const id of knownPairIds()) {
    if (!map[id]) map[id] = { wins: 0, losses: 0 };
  }
  return map;
}

function clampMaxGales(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MAX_GALES;
  return Math.min(8, Math.max(0, Math.floor(n)));
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
  if (!stored || typeof stored !== "object") {
    return {
      ...KTO2F_DEFAULTS,
      maxRecoveryPreference: KTO2F_DEFAULTS.maxRecovery,
      enabledPairIds: defaultEnabledPairIds(),
    };
  }
  const legacyWrong =
    (typeof stored.tableId === "number" && stored.tableId !== 230) ||
    (typeof stored.mesaUrl === "string" &&
      stored.mesaUrl.trim() !== "" &&
      !stored.mesaUrl.toLowerCase().includes("kto.bet.br"));
  const noGale = stored.noGale === true;
  const maxRecoveryPreference = clampMaxGales(
    stored.maxRecovery ?? KTO2F_DEFAULTS.maxRecovery,
  );
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
    noGale,
    maxRecoveryPreference,
    /** Efectivo no motor: 0 = stake única, W/L sem recuperação. */
    maxRecovery: noGale ? 0 : maxRecoveryPreference,
    observeOnly: stored.observeOnly === true,
    enabledPairIds: normalizeEnabledPairIds(stored.enabledPairIds),
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
  const phase =
    raw.phase === "awaiting_bet" ||
    raw.phase === "awaiting_result" ||
    raw.phase === "awaiting_reference"
      ? raw.phase
      : null;
  const criticalPosition =
    typeof raw.criticalPosition === "number" && Number.isFinite(raw.criticalPosition)
      ? Math.floor(raw.criticalPosition)
      : null;
  const lockedPosition =
    typeof raw.lockedPosition === "number" && Number.isFinite(raw.lockedPosition)
      ? Math.floor(raw.lockedPosition)
      : null;
  const pendingRecovery =
    typeof raw.pendingRecovery === "number" && Number.isFinite(raw.pendingRecovery)
      ? Math.max(0, Math.floor(raw.pendingRecovery))
      : 0;
  const axis =
    raw.axis === "cor-altura" ||
    raw.axis === "altura-paridade" ||
    raw.axis === "cor-paridade"
      ? raw.axis
      : null;
  const nextEntryAxis =
    raw.nextEntryAxis === "cor-altura" ||
    raw.nextEntryAxis === "altura-paridade" ||
    raw.nextEntryAxis === "cor-paridade"
      ? raw.nextEntryAxis
      : null;
  const relaxedEntry = raw.relaxedEntry === true;
  const gatePairId =
    typeof raw.gatePairId === "string" && raw.gatePairId.trim()
      ? raw.gatePairId.trim()
      : null;
  const watch =
    raw.watch && typeof raw.watch === "object" && !Array.isArray(raw.watch)
      ? raw.watch
      : null;
  return {
    recovery,
    lastSpinHead,
    phase,
    criticalPosition,
    axis,
    nextEntryAxis,
    lockedPosition,
    pendingRecovery,
    relaxedEntry,
    gatePairId,
    watch,
  };
}

async function persistKto2fMachineState(machine) {
  if (!machine || typeof machine !== "object") return;
  const cycle = machine.cycle;
  const cycleRecovery = cycle?.recovery;
  const watchOut = {};
  if (machine.watch && typeof machine.watch === "object") {
    for (const [id, slot] of Object.entries(machine.watch)) {
      const f = slot?.failures;
      if (typeof f === "number" && Number.isFinite(f)) {
        watchOut[id] = { failures: Math.max(0, Math.floor(f)) };
      }
    }
  }
  await chrome.storage.local.set({
    [STORAGE_KTO2F_MACHINE]: {
      recovery:
        typeof cycleRecovery === "number" && Number.isFinite(cycleRecovery)
          ? Math.max(0, Math.floor(cycleRecovery))
          : typeof machine.pendingRecovery === "number"
            ? Math.max(0, Math.floor(machine.pendingRecovery))
            : 0,
      lastSpinHead:
        typeof machine.lastSpinHead === "string" ? machine.lastSpinHead : null,
      phase: cycle?.phase ?? null,
      criticalPosition: cycle?.active?.criticalPosition ?? null,
      axis: cycle?.active?.axis ?? null,
      nextEntryAxis: machine.nextEntryAxis ?? "cor-altura",
      lockedPosition: machine.lockedPosition ?? cycle?.active?.criticalPosition ?? null,
      pendingRecovery:
        typeof machine.pendingRecovery === "number" ? machine.pendingRecovery : 0,
      relaxedEntry: cycle?.relaxedEntry === true,
      gatePairId: typeof machine.gatePairId === "string" ? machine.gatePairId : null,
      watch: watchOut,
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
  await writeKto2fStatus({
    wins: stats.wins ?? 0,
    losses: stats.losses ?? 0,
    pairIndication: stats.pairIndication ?? {},
    maxRecovery: mr,
  });
}

async function resetKto2fStats() {
  const cfg = await readKto2fConfig();
  const empty =
    globalThis.SinglestakeKto2f?.emptyIce2fStats?.(cfg.maxRecovery) ?? {
      wins: 0,
      losses: 0,
      winsAtRecovery: [],
      lossesAtRecovery: [],
      pairIndication: {
        "2x4": { wins: 0, losses: 0 },
      },
    };
  await persistKto2fStats(empty, cfg.maxRecovery);
  await clearKto2fMachineState();
  if (engine?.resetStats) engine.resetStats();
  if (engine?.reset) engine.reset();
  return {
    ok: true,
    wins: 0,
    losses: 0,
    pairIndication: empty.pairIndication ?? {},
    maxRecovery: cfg.maxRecovery,
  };
}

async function getKto2fConfigForPopup() {
  return readKto2fConfig();
}

async function setKto2fConfigFromPopup(config) {
  const data = await chrome.storage.local.get([STORAGE_KTO2F_CONFIG]);
  const stored =
    data[STORAGE_KTO2F_CONFIG] && typeof data[STORAGE_KTO2F_CONFIG] === "object"
      ? data[STORAGE_KTO2F_CONFIG]
      : {};
  const prev = await readKto2fConfig();
  const patch = config && typeof config === "object" ? config : {};
  const noGale =
    patch.noGale === true ? true : patch.noGale === false ? false : stored.noGale === true;
  const observeOnly =
    patch.observeOnly === true
      ? true
      : patch.observeOnly === false
        ? false
        : stored.observeOnly === true;

  let maxRecoveryPreference = prev.maxRecoveryPreference ?? DEFAULT_MAX_GALES;
  if (patch.maxRecoveryPreference != null) {
    maxRecoveryPreference = clampMaxGales(patch.maxRecoveryPreference);
  } else if (patch.maxRecovery != null) {
    const requested = clampMaxGales(patch.maxRecovery);
    // Evitar gravar 0 efectivo do modo sem gale por cima da preferência.
    if (!(noGale && requested === 0 && (prev.maxRecoveryPreference ?? 0) > 0)) {
      maxRecoveryPreference = requested;
    }
  }

  const enabledPairIds =
    patch.enabledPairIds != null
      ? normalizeEnabledPairIds(patch.enabledPairIds)
      : normalizeEnabledPairIds(prev.enabledPairIds);

  const next = {
    ...KTO2F_DEFAULTS,
    ...stored,
    tableId: patch.tableId ?? prev.tableId,
    mesaUrl: patch.mesaUrl ?? prev.mesaUrl,
    wsUrl: patch.wsUrl ?? prev.wsUrl,
    casinoId: patch.casinoId ?? prev.casinoId,
    currency: patch.currency ?? prev.currency,
    maxRecovery: maxRecoveryPreference,
    noGale,
    observeOnly,
    enabledPairIds,
  };
  await chrome.storage.local.set({ [STORAGE_KTO2F_CONFIG]: next });
  applyEnabledPairsFromConfig(next);
  if (noGale) {
    await clearKto2fMachineState();
    await writeKto2fStatus({ recovery: 0, waitingReference: false });
  }
  return { ok: true, ...(await readKto2fConfig()) };
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

function formatActiveLabel(active, recovery) {
  if (!active) return null;
  const f1 = active.factor1?.value ?? "";
  const f2 = active.factor2?.value ?? "";
  const axis =
    active.axis === "cor-altura"
      ? "c/a"
      : active.axis === "altura-paridade"
        ? "p/a"
        : active.axis === "cor-paridade"
          ? "c/p"
          : (active.axis ?? "");
  const gale = recovery > 0 ? ` · gale ${recovery}` : "";
  const posA = active?.criticalPosition;
  const posB = active?.matchPosition;
  const pair =
    active?.pairId ??
    (posA != null && posB != null ? `${posA}x${posB}` : "pos?");
  const pairLabel = String(pair).replace(/x/gi, "×");
  const n1 = active?.triggerNumber ?? active?.referenceNumber;
  const n2 = active?.matchNumber;
  const nums =
    n1 != null && n2 != null && Number.isFinite(n1) && Number.isFinite(n2)
      ? ` · nº${n1}·${n2}`
      : "";
  return `${f1} · ${f2}${gale} · ${pairLabel}${nums} ${axis}`.trim();
}

function axisFromActive(active) {
  return active?.axis === "cor-altura" ||
    active?.axis === "altura-paridade" ||
    active?.axis === "cor-paridade"
    ? active.axis
    : null;
}

function positionFieldsFromActive(active) {
  if (!active) {
    return {
      criticalPosition: null,
      matchPosition: null,
      triggerNumber: null,
      matchNumber: null,
      pairId: null,
    };
  }
  return {
    criticalPosition:
      typeof active.criticalPosition === "number" ? active.criticalPosition : null,
    matchPosition: typeof active.matchPosition === "number" ? active.matchPosition : null,
    triggerNumber:
      typeof active.triggerNumber === "number"
        ? active.triggerNumber
        : typeof active.referenceNumber === "number"
          ? active.referenceNumber
          : null,
    matchNumber: typeof active.matchNumber === "number" ? active.matchNumber : null,
    pairId: typeof active.pairId === "string" ? active.pairId : null,
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
  return `Aguarda referência na pos${pos}${gale}`;
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
  if ((cycle.recovery ?? 0) !== expected) return false;
  const payloadHead = payload?.context?.armedHead;
  if (typeof payloadHead === "string" && payloadHead.length > 0) {
    if (cycle.armedHead !== payloadHead) return false;
  }
  const payloadPair = payload?.context?.pairId;
  if (typeof payloadPair === "string" && payloadPair.length > 0) {
    if ((cycle.active?.pairId ?? null) !== payloadPair) return false;
  }
  return true;
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

  const cfg = await readKto2fConfig();
  const observeOnly = cfg.observeOnly === true;

  const committedSignalId = payload.context.signalId;
  lastEmittedSignalId = committedSignalId;
  const cycle = liveAwaitingBetCycle();
  const recovery = cycle?.recovery ?? 0;
  const active = cycle?.active;
  const label =
    payload.context.factor1Label && payload.context.factor2Label
      ? `${payload.context.factor1Label} · ${payload.context.factor2Label}${
          recovery > 0 ? ` · gale ${recovery}` : ""
        } · ${
          active?.pairId ??
          (active?.criticalPosition != null
            ? `pos${active.criticalPosition}/${active.matchPosition ?? "?"}`
            : "?")
        } ${
          active?.axis === "cor-altura"
            ? "c/a"
            : active?.axis === "altura-paridade"
              ? "p/a"
              : active?.axis === "cor-paridade"
                ? "c/p"
                : ""
        }`.trim()
      : formatActiveLabel(active, recovery);

  await writeKto2fStatus({
    active: true,
    tableId: payload.context.currentTableId,
    label,
    axis: axisFromActive(active),
    signalId: payload.context.signalId,
    recovery,
    waitingBet: false,
    observeOnly,
    lastError: null,
    lastBetDetail: null,
  });

  engine?.beginBetCommit?.();
  const commitArmedHead = cycle?.armedHead ?? null;

  if (observeOnly) {
    const confirmed = engine?.markBetPlaced?.();
    if (confirmed === false) {
      engine?.abortBetCommit?.();
      if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
      await writeKto2fStatus({
        lastError: "Observação — histórico mudou antes de confirmar",
        waitingBet: true,
      });
      return;
    }
    const live = engine?.getState?.();
    if (live?.machine) await persistKto2fMachineState(live.machine);
    await writeKto2fStatus({
      lastBetDetail: "Sem clique — só observação (aposta virtual)",
      lastError: null,
      observeOnly: true,
      recovery: liveRecoveryForStatus(),
    });
    return;
  }

  try {
    const bridgeResult = await bridgeHandler(payload, null);
    const { placed, detail } = summarizeBridgeBetResults(bridgeResult?.results);
    if (placed && engine?.markBetPlaced) {
      const liveCycle = engine?.getState?.()?.machine?.cycle ?? null;
      if (
        !liveCycle ||
        liveCycle.phase !== "awaiting_bet" ||
        (liveCycle.recovery ?? 0) !== recovery ||
        (commitArmedHead != null && liveCycle.armedHead !== commitArmedHead)
      ) {
        engine?.abortBetCommit?.();
        if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
        await writeKto2fStatus({
          lastError: "Janela de aposta expirou — giro novo antes dos cliques confirmados",
          lastBetDetail: detail || null,
          waitingBet: true,
        });
        return;
      }
      const confirmed = engine.markBetPlaced();
      if (confirmed === false) {
        engine?.abortBetCommit?.();
        if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
        await writeKto2fStatus({
          lastError: "Aposta não confirmada — histórico mudou durante os cliques",
          lastBetDetail: detail || null,
          waitingBet: true,
        });
        return;
      }
      const live = engine.getState?.();
      if (live?.machine) await persistKto2fMachineState(live.machine);
      await writeKto2fStatus({
        lastBetDetail: detail || "Aposta enviada (factor-1 + factor-2 + dobrar)",
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
  const cycle = state?.machine?.cycle ?? result?.machine?.cycle ?? null;
  const recovery = result?.recovery ?? cycle?.recovery ?? 0;
  const at = state?.lastLiveSpinAt;
  const immediate = cycle?.immediateBet === true;
  if (at == null) return immediate ? 0 : BET_RETRY_MS;

  const settleMs =
    typeof SinglestakeKto2f?.ice2fBetDelayMs === "function"
      ? SinglestakeKto2f.ice2fBetDelayMs(recovery, immediate)
      : immediate
        ? (SinglestakeKto2f?.ICE_2F_IMMEDIATE_REBET_DELAY_MS ?? 6000)
        : (SinglestakeKto2f?.ROTATING_ROOM_CROSSING_BET_DELAY_MS ??
          SinglestakeKto2f?.ICE_2F_RECOVERY_BET_DELAY_MS ?? 6000);
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
  await writeKto2fStatus({
    active: true,
    tableId: cfg.tableId,
    label: referencePauseLabel(cycle),
    recovery: cycle?.recovery ?? 0,
    waitingBet: true,
    waitingReference: true,
    lastError: null,
    lastBetDetail: null,
    reason: `Gale ${cycle?.recovery ?? 0} mantido — aguarda referência na posição crítica`,
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
    await writeKto2fStatus({
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
      await writeKto2fStatus({
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

    void writeKto2fStatus({
      active: true,
      tableId,
      label,
      axis: axisFromActive(active),
      waitingBet: true,
      waitingReference: false,
      waitRemainingSec: Math.ceil(remaining / 1000),
      recovery: result.recovery,
      lastError: null,
      ...positionFieldsFromActive(active),
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
  return enqueueEngineResult(() => processEngineResultLocked(result, mesaUrl, cfg));
}

async function processEngineResultLocked(result, mesaUrl, cfg) {
  if (!result || !engine) return;
  if (result.machine) {
    await persistKto2fMachineState(result.machine);
  }
  if (result.stats) {
    await persistKto2fStats(result.stats, cfg.maxRecovery);
  }

  if (result.missedBetWindow) {
    lastEmittedSignalId = null;
    engine.abortBetCommit?.();
    clearPendingBetTimers();
    // Limpa o painel; se o mesmo tick rearma (match novo), o bloco
    // `result.active` volta a activar. Sem isso o status ficava
    // "ligado" sem ciclo até ao giro seguinte.
    await writeKto2fStatus({
      active: false,
      tableId: cfg.tableId,
      label: null,
      lastTrigger: null,
      signalId: null,
      axis: null,
      recovery: result.recovery ?? idleRecoveryFromResult(result, engine),
      waitingBet: false,
      waitingReference: false,
      lastError: "Giro novo antes da aposta — não contou",
      reason: "Janela de aposta perdida (sem cliques confirmados)",
      ...positionFieldsFromActive(null),
    });
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
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    const idleRecovery = idleRecoveryFromResult(result, engine);
    const idleReason = cycleClosed
      ? flashKind === "tie"
        ? idleRecovery > 0
          ? `Empate — indicação única fechada · insiste no gatilho · gale ${idleRecovery}`
          : "Empate — indicação única fechada · insiste no gatilho"
        : flashKind === "loss"
          ? idleRecovery > 0
            ? `Aguarda novo gatilho · próxima entrada gale ${idleRecovery}`
            : idleRecovery === 0 && (result.stats?.losses ?? 0) > 0
              ? "Derrota final — aguarda novo gatilho"
              : "Aguarda novo gatilho"
          : flashKind === "win"
            ? "Vitória — aguarda novo gatilho"
            : idleRecovery > 0
              ? `Aguarda novo gatilho · próxima entrada gale ${idleRecovery}`
              : "Aguarda novo gatilho"
      : isAwaitingReference(pausedCycle)
        ? `Aguarda referência na pos${pausedCycle.active?.criticalPosition ?? "?"} · gale ${pausedCycle.recovery ?? 0}`
        : flashKind === "win"
          ? "Vitória — liquidado"
          : flashKind === "loss"
            ? "Derrota — liquidado"
            : flashKind === "tie"
              ? "Empate — liquidado"
              : "Liquidado";

    // Sempre limpa a indicação liquidada. Se o mesmo giro rearma,
    // `result.active` (ou pausa de referência) volta a activar a seguir.
    await writeKto2fStatus({
      lastFlash: flashKind,
      lastResult: result.flash.resultNumber,
      active: false,
      label: null,
      lastTrigger: null,
      signalId: null,
      axis: null,
      waitingBet: false,
      waitingReference: false,
      lastBetDetail: null,
      lastError: null,
      reason: idleReason,
      ...positionFieldsFromActive(null),
      ...(flashKind === "win" && cycleClosed ? { recovery: 0 } : {}),
      ...(cycleOpen && pausedCycle
        ? { recovery: pausedCycle.recovery ?? result.recovery ?? 0 }
        : {}),
      ...(cycleClosed
        ? { recovery: flashKind === "win" ? 0 : idleRecovery }
        : {}),
      ...(cycleOpen && pausedCycle && isAwaitingReference(pausedCycle)
        ? {
            active: true,
            label: referencePauseLabel(pausedCycle),
            waitingBet: true,
            waitingReference: true,
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
    await writeKto2fStatus({
      active: true,
      label,
      axis: axisFromActive(result.active),
      recovery: displayRecovery,
      lastTrigger: result.active.triggerNumbers ?? null,
      tableId: cfg.tableId,
      reason: null,
      waitingBet: false,
      waitingReference: false,
      lastError: null,
      ...positionFieldsFromActive(result.active),
    });
  }

  const machineState =
    result.machine ?? engine?.getState?.()?.machine ?? null;
  if (machineState?.watch) {
    const watchLabelFn =
      SinglestakeKto2f?.ice2fWatchLabelForMachine ??
      SinglestakeKto2f?.formatIce2fWatchLabel;
    if (typeof watchLabelFn === "function") {
      await writeKto2fStatus({
        watchLabel: watchLabelFn(
          SinglestakeKto2f?.ice2fWatchLabelForMachine ? machineState : machineState.watch,
        ),
        inactiveSpins: machineState.inactiveSpinsWithoutEntry ?? 0,
        relaxedEntry: machineState.cycle?.relaxedEntry === true,
        zeroDebt: machineState.zeroDebtUnits ?? 0,
        zeroRecovered: machineState.zeroRecoveredUnits ?? 0,
        zeroShift: machineState.zeroShift ?? 0,
      });
    }
  }

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
  applyEnabledPairsFromConfig(cfg);
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
    noGale: cfg.noGale === true,
    observeOnly: cfg.observeOnly === true,
    wins: saved?.stats?.wins ?? 0,
    losses: saved?.stats?.losses ?? 0,
    pairIndication: saved?.stats?.pairIndication ?? {},
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
  const pairIndication = mergePairIndicationForUi(
    live?.stats?.pairIndication ??
      statsPack?.stats?.pairIndication ??
      data[STORAGE_KTO2F_STATUS]?.pairIndication ??
      {},
  );
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
  const cfg = await readKto2fConfig();
  const streak =
    globalThis.SinglestakeKto2f?.buildIce2fStreakChartMetrics?.(
      live?.stats ?? statsPack?.stats ?? { wins, losses, outcomeHistory: [] },
    ) ?? null;
  const knownPairs = knownPairIds().map((id) => ({
    id,
    label:
      typeof SinglestakeKto2f?.ice2fPairLabel === "function"
        ? SinglestakeKto2f.ice2fPairLabel(id)
        : String(id).replace(/x/gi, "×"),
  }));
  const enabledPairIds = normalizeEnabledPairIds(cfg.enabledPairIds);
  return {
    enabled: data[STORAGE_KTO2F_AUTOPLAY] === true,
    status: {
      ...(data[STORAGE_KTO2F_STATUS] ?? { running: false }),
      wins,
      losses,
      pairIndication,
      knownPairs,
      enabledPairIds,
      outcomeHistory:
        live?.stats?.outcomeHistory ??
        statsPack?.stats?.outcomeHistory ??
        [],
      indicationOutcomeHistory:
        live?.stats?.indicationOutcomeHistory ??
        statsPack?.stats?.indicationOutcomeHistory ??
        [],
      streak,
      maxRecovery,
      noGale: cfg.noGale === true,
      observeOnly: cfg.observeOnly === true,
      recovery: pendingRecovery,
      extensionVersion: chrome.runtime.getManifest().version,
    },
  };
}

function initKto2fSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  globalThis.__singlestakeKto2fBridgeHandler = handleBridgePayload;
  void readKto2fConfig().then((cfg) => applyEnabledPairsFromConfig(cfg));
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
      void readKto2fConfig().then((cfg) => {
        applyEnabledPairsFromConfig(cfg);
        return readKto2fAutopilotEnabled().then((on) => {
          if (on) void startKto2fAutopilot(bridgeHandler);
        });
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
