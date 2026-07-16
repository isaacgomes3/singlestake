/** Autopilot Bet365 — 24D Spin Cruzamento 2F (3426) · 2×4. */
const STORAGE_BET36524D2F_AUTOPLAY = "gogBet36524d2fAutopilotEnabled";
const STORAGE_BET36524D2F_CONFIG = "gogBet36524d2fConfig";
const STORAGE_BET36524D2F_STATUS = "gogBet36524d2fAutopilotStatus";
const STORAGE_BET36524D2F_STATS = "gogBet36524d2fAutopilotSessionStats";
const STORAGE_BET36524D2F_MACHINE = "gogBet36524d2fMachineState";

const DEFAULT_MAX_GALES = 8;
const BET_RETRY_MS = 1500;

/** @type {ReturnType<import('./dga-hub.js').createDgaHub>|null} */
let dgaHub = null;
/** @type {ReturnType<SinglestakeBet36524d2f['createBet36524d2fEngine']>|null} */
let engine = null;
let lastEmittedSignalId = null;
/** @type {((payload: unknown, tabId: number|null) => Promise<unknown>)|null} */
let bridgeHandler = null;
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
let pendingBetTimers = new Map();
/** Evita corridas: dois giros a escrever status/placar fora de ordem. */
let engineResultTail = Promise.resolve();
/** Invalida writes atrasados (bridge/timer) após liquidar. */
let indicationEpoch = 0;

function enqueueEngineResult(task) {
  engineResultTail = engineResultTail.then(task, task).catch(() => {});
  return engineResultTail;
}

function bumpIndicationEpoch() {
  indicationEpoch += 1;
  return indicationEpoch;
}

function idleIndicationPatch(extra = {}) {
  return {
    active: false,
    label: null,
    lastTrigger: null,
    signalId: null,
    axis: null,
    waitingBet: false,
    waitingReference: false,
    lastBetDetail: null,
    waitRemainingSec: null,
    criticalPosition: null,
    matchPosition: null,
    triggerNumber: null,
    matchNumber: null,
    pairId: null,
    ...extra,
  };
}

async function writeIndicationStatus(patch, epoch = indicationEpoch) {
  if (epoch !== indicationEpoch) return null;
  return writeBet36524d2fStatus({ ...patch, indicationEpoch: epoch });
}

const BET36524D2F_DEFAULTS = {
  tableId: SinglestakeBet36524d2f?.BET36524D2F_TABLE_ID ?? 3426,
  mesaUrl:
    SinglestakeBet36524d2f?.BET36524D2F_MESA_URL ??
    "https://casino.bet365.bet.br/play/24DSpin",
  wsUrl: SinglestakeDgaHub?.DGA_DEFAULTS?.wsUrl ?? "wss://dga.pragmaticplaylive.net/ws",
  casinoId: SinglestakeDgaHub?.DGA_DEFAULTS?.casinoId ?? "ppcdk00000005148",
  currency: SinglestakeDgaHub?.DGA_DEFAULTS?.currency ?? "BRL",
  maxRecovery: DEFAULT_MAX_GALES,
  noGale: false,
  observeOnly: false,
  enabledPairIds: ["2x4"],
};

function knownPairIds() {
  const known = SinglestakeBet36524d2f?.ICE_2F_KNOWN_COMPARE_PAIRS;
  if (Array.isArray(known) && known.length > 0) {
    return known.map((p) => p.id).filter((id) => typeof id === "string");
  }
  return ["2x4"];
}

function defaultEnabledPairIds() {
  const ids = SinglestakeBet36524d2f?.ICE_2F_DEFAULT_ENABLED_PAIR_IDS;
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
    typeof SinglestakeBet36524d2f !== "undefined"
      ? SinglestakeBet36524d2f.applyIce2fEnabledPairIds
        ? SinglestakeBet36524d2f
        : SinglestakeBet36524d2f.default
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
      void writeBet36524d2fStatus({
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

async function readBet36524d2fAutopilotEnabled() {
  const data = await chrome.storage.local.get([STORAGE_BET36524D2F_AUTOPLAY]);
  return data[STORAGE_BET36524D2F_AUTOPLAY] === true;
}

async function readBet36524d2fConfig() {
  const data = await chrome.storage.local.get([STORAGE_BET36524D2F_CONFIG]);
  const stored = data[STORAGE_BET36524D2F_CONFIG];
  if (!stored || typeof stored !== "object") {
    return {
      ...BET36524D2F_DEFAULTS,
      maxRecoveryPreference: BET36524D2F_DEFAULTS.maxRecovery,
      enabledPairIds: defaultEnabledPairIds(),
    };
  }
  const legacyWrong =
    stored.tableId === 201 ||
    stored.tableId === 230 ||
    stored.tableId === 227 ||
    (typeof stored.mesaUrl === "string" &&
      (stored.mesaUrl.includes("ice.bet") ||
        stored.mesaUrl.includes("kto.bet") ||
        stored.mesaUrl.includes("roulette")));
  const noGale = stored.noGale === true;
  const maxRecoveryPreference = clampMaxGales(
    stored.maxRecovery ?? BET36524D2F_DEFAULTS.maxRecovery,
  );
  return {
    tableId:
      legacyWrong
        ? BET36524D2F_DEFAULTS.tableId
        : typeof stored.tableId === "number" && stored.tableId > 0
          ? stored.tableId
          : BET36524D2F_DEFAULTS.tableId,
    mesaUrl: legacyWrong
      ? BET36524D2F_DEFAULTS.mesaUrl
      : typeof stored.mesaUrl === "string" && stored.mesaUrl.trim()
        ? stored.mesaUrl.trim()
        : BET36524D2F_DEFAULTS.mesaUrl,
    wsUrl:
      typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : BET36524D2F_DEFAULTS.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : BET36524D2F_DEFAULTS.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : BET36524D2F_DEFAULTS.currency,
    noGale,
    maxRecoveryPreference,
    /** Efectivo no motor: 0 = stake única, W/L sem recuperação. */
    maxRecovery: noGale ? 0 : maxRecoveryPreference,
    observeOnly: stored.observeOnly === true,
    enabledPairIds: normalizeEnabledPairIds(stored.enabledPairIds),
  };
}

async function readBet36524d2fMachineState() {
  const data = await chrome.storage.local.get([STORAGE_BET36524D2F_MACHINE]);
  const raw = data[STORAGE_BET36524D2F_MACHINE];
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

async function persistBet36524d2fMachineState(machine) {
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
    [STORAGE_BET36524D2F_MACHINE]: {
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

async function clearBet36524d2fMachineState() {
  await chrome.storage.local.remove([STORAGE_BET36524D2F_MACHINE]);
}

async function readBet36524d2fStats(maxRecovery) {
  const data = await chrome.storage.local.get([STORAGE_BET36524D2F_STATS]);
  const raw = data[STORAGE_BET36524D2F_STATS];
  if (!raw?.stats || typeof raw.stats !== "object") return null;
  return { stats: raw.stats, maxRecovery: clampMaxGales(raw.maxRecovery ?? maxRecovery) };
}

async function persistBet36524d2fStats(stats, maxRecovery) {
  const mr = clampMaxGales(maxRecovery);
  await chrome.storage.local.set({
    [STORAGE_BET36524D2F_STATS]: { stats, maxRecovery: mr, updatedAt: new Date().toISOString() },
  });
  // Sem ciclo live → nunca deixar indicação antiga colada no merge do placar.
  const patch = {
    wins: stats.wins ?? 0,
    losses: stats.losses ?? 0,
    pairIndication: stats.pairIndication ?? {},
    maxRecovery: mr,
  };
  if (!liveIndicationCycle()) {
    Object.assign(patch, idleIndicationPatch());
  }
  await writeBet36524d2fStatus(patch);
}

async function resetBet36524d2fStats() {
  const cfg = await readBet36524d2fConfig();
  const empty =
    globalThis.SinglestakeBet36524d2f?.emptyIce2fStats?.(cfg.maxRecovery) ?? {
      wins: 0,
      losses: 0,
      winsAtRecovery: [],
      lossesAtRecovery: [],
      pairIndication: {
        "2x4": { wins: 0, losses: 0 },
      },
    };
  await persistBet36524d2fStats(empty, cfg.maxRecovery);
  await clearBet36524d2fMachineState();
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

async function getBet36524d2fConfigForPopup() {
  return readBet36524d2fConfig();
}

async function setBet36524d2fConfigFromPopup(config) {
  const data = await chrome.storage.local.get([STORAGE_BET36524D2F_CONFIG]);
  const stored =
    data[STORAGE_BET36524D2F_CONFIG] && typeof data[STORAGE_BET36524D2F_CONFIG] === "object"
      ? data[STORAGE_BET36524D2F_CONFIG]
      : {};
  const prev = await readBet36524d2fConfig();
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
    ...BET36524D2F_DEFAULTS,
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
  await chrome.storage.local.set({ [STORAGE_BET36524D2F_CONFIG]: next });
  applyEnabledPairsFromConfig(next);
  if (noGale) {
    await clearBet36524d2fMachineState();
    await writeBet36524d2fStatus({ recovery: 0, waitingReference: false });
  }
  return { ok: true, ...(await readBet36524d2fConfig()) };
}

async function writeBet36524d2fStatus(patch) {
  const data = await chrome.storage.local.get([STORAGE_BET36524D2F_STATUS]);
  const prev = data[STORAGE_BET36524D2F_STATUS] ?? {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [STORAGE_BET36524D2F_STATUS]: next });
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
  // `cycle: null` é valor válido (liquidou). Não fazer `?? engine` —
  // senão a indicação fantasma revive a partir do estado antigo.
  if (result && Object.prototype.hasOwnProperty.call(result, "machine") && result.machine) {
    return result.machine.cycle ?? null;
  }
  if (result && Object.prototype.hasOwnProperty.call(result, "machine") && result.machine == null) {
    return null;
  }
  return engine?.getState?.()?.machine?.cycle ?? null;
}

function liveIndicationCycle() {
  const cycle = engine?.getState?.()?.machine?.cycle ?? null;
  if (
    cycle &&
    (cycle.phase === "awaiting_bet" ||
      cycle.phase === "awaiting_result" ||
      cycle.phase === "awaiting_reference")
  ) {
    return cycle;
  }
  return null;
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

  const epochAtStart = indicationEpoch;
  const cfg = await readBet36524d2fConfig();
  const observeOnly = cfg.observeOnly === true;

  const committedSignalId = payload.context.signalId;
  lastEmittedSignalId = committedSignalId;
  const cycle = liveAwaitingBetCycle();
  if (!cycle || epochAtStart !== indicationEpoch) {
    if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
    return;
  }
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

  await writeIndicationStatus(
    {
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
      ...positionFieldsFromActive(active),
    },
    epochAtStart,
  );

  engine?.beginBetCommit?.();
  const commitArmedHead = cycle?.armedHead ?? null;

  if (observeOnly) {
    if (epochAtStart !== indicationEpoch || !liveAwaitingBetCycle()) {
      engine?.abortBetCommit?.();
      if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
      return;
    }
    const confirmed = engine?.markBetPlaced?.();
    if (confirmed === false) {
      engine?.abortBetCommit?.();
      if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
      await writeIndicationStatus(
        {
          lastError: "Observação — histórico mudou antes de confirmar",
          waitingBet: true,
        },
        epochAtStart,
      );
      return;
    }
    const live = engine?.getState?.();
    if (live?.machine) await persistBet36524d2fMachineState(live.machine);
    await writeIndicationStatus(
      {
        lastBetDetail: "Sem clique — só observação (aposta virtual)",
        lastError: null,
        observeOnly: true,
        recovery: liveRecoveryForStatus(),
      },
      epochAtStart,
    );
    return;
  }

  try {
    const bridgeResult = await bridgeHandler(payload, null);
    if (epochAtStart !== indicationEpoch) {
      engine?.abortBetCommit?.();
      if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
      return;
    }
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
        await writeIndicationStatus(
          {
            lastError: "Janela de aposta expirou — giro novo antes dos cliques confirmados",
            lastBetDetail: detail || null,
            waitingBet: true,
          },
          epochAtStart,
        );
        return;
      }
      const confirmed = engine.markBetPlaced();
      if (confirmed === false) {
        engine?.abortBetCommit?.();
        if (lastEmittedSignalId === committedSignalId) lastEmittedSignalId = null;
        await writeIndicationStatus(
          {
            lastError: "Aposta não confirmada — histórico mudou durante os cliques",
            lastBetDetail: detail || null,
            waitingBet: true,
          },
          epochAtStart,
        );
        return;
      }
      const live = engine.getState?.();
      if (live?.machine) await persistBet36524d2fMachineState(live.machine);
      await writeIndicationStatus(
        {
          lastBetDetail: detail || "Aposta enviada (factor-1 + factor-2 + dobrar)",
          lastError: null,
          recovery: liveRecoveryForStatus(),
        },
        epochAtStart,
      );
    } else {
      engine?.abortBetCommit?.();
      lastEmittedSignalId = null;
      if (!liveAwaitingBetCycle() || epochAtStart !== indicationEpoch) return;
      const errDetail = detail || "Cliques não confirmados — calibre Preto/Vermelho/Par/Ímpar na mesa";
      await writeIndicationStatus(
        {
          lastError: errDetail,
          lastBetDetail: detail || null,
        },
        epochAtStart,
      );
      const cfgRetry = await readBet36524d2fConfig();
      const retry = engine.runTick();
      const waitMs = Math.max(BET_RETRY_MS, betDelayRemainingMs(retry));
      const signalKey = `retry:${payload.context.signalId}`;
      if (!pendingBetTimers.has(signalKey)) {
        const timer = setTimeout(() => {
          pendingBetTimers.delete(signalKey);
          if (!engine || !liveAwaitingBetCycle() || epochAtStart !== indicationEpoch) return;
          void enqueueEngineResult(() =>
            scheduleBetAttempt(engine.runTick(), mesaUrl, cfgRetry, epochAtStart),
          );
        }, waitMs);
        pendingBetTimers.set(signalKey, timer);
      }
    }
  } catch (e) {
    engine?.abortBetCommit?.();
    lastEmittedSignalId = null;
    if (!liveAwaitingBetCycle() || epochAtStart !== indicationEpoch) return;
    const msg = e instanceof Error ? e.message : String(e);
    await writeIndicationStatus({ lastError: msg }, epochAtStart);
    const cfgErr = await readBet36524d2fConfig();
    void enqueueEngineResult(() =>
      scheduleBetAttempt(engine.runTick(), mesaUrl, cfgErr, epochAtStart),
    );
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
    typeof SinglestakeBet36524d2f?.ice2fBetDelayMs === "function"
      ? SinglestakeBet36524d2f.ice2fBetDelayMs(recovery, immediate)
      : immediate
        ? (SinglestakeBet36524d2f?.ICE_2F_IMMEDIATE_REBET_DELAY_MS ?? 9500)
        : (SinglestakeBet36524d2f?.ROTATING_ROOM_CROSSING_BET_DELAY_MS ??
          SinglestakeBet36524d2f?.ICE_2F_RECOVERY_BET_DELAY_MS ?? 9500);
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
  await writeBet36524d2fStatus({
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

async function scheduleBetAttempt(result, mesaUrl, cfg, epoch = indicationEpoch) {
  if (epoch !== indicationEpoch) return;
  const cycle = cycleFromResult(result);
  if (!engine) return;

  if (isAwaitingReference(cycle)) {
    await syncReferencePauseStatus(result, cfg);
    return;
  }

  // Ciclo aberto à espera do resultado da aposta — mantém label do ciclo live.
  if (cycle?.phase === "awaiting_result") {
    const active = cycle.active;
    await writeIndicationStatus(
      {
        active: true,
        tableId: cfg.tableId,
        label: formatActiveLabel(active, cycle.recovery ?? 0),
        axis: axisFromActive(active),
        recovery: cycle.recovery ?? 0,
        waitingBet: false,
        waitingReference: false,
        lastError: null,
        ...positionFieldsFromActive(active),
      },
      epoch,
    );
    return;
  }

  const active =
    result?.active ?? (cycle?.phase === "awaiting_bet" ? cycle.active : null);
  if (!active) {
    // Só idle quando o ciclo realmente terminou.
    if (cycle?.phase === "awaiting_bet") {
      await writeIndicationStatus(
        {
          active: true,
          tableId: cfg.tableId,
          label: formatActiveLabel(cycle.active, cycle.recovery ?? 0),
          axis: axisFromActive(cycle.active),
          recovery: cycle.recovery ?? 0,
          waitingBet: true,
          waitingReference: false,
          lastError: null,
          ...positionFieldsFromActive(cycle.active),
        },
        epoch,
      );
      return;
    }
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    await writeIndicationStatus(
      idleIndicationPatch({
        tableId: null,
        recovery: resolvedRecoveryForStatus(result, engine),
      }),
      epoch,
    );
    return;
  }

  // Garante result.active para o resto do fluxo.
  if (!result.active) {
    result = { ...result, active, recovery: cycle?.recovery ?? result.recovery ?? 0 };
  }

  const payload = engine.buildBridgePayload(mesaUrl);
  if (!payload?.context?.signalId) {
    const remaining = betDelayRemainingMs(result);
    const tableId = cfg.tableId;
    const label = formatActiveLabel(active, result.recovery ?? 0);

    await writeIndicationStatus(
      {
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
      },
      epoch,
    );

    const signalKey = `bet36524d2f:pos${active?.criticalPosition ?? "?"}:${active?.axis ?? "?"}:${result.recovery}`;
    if (pendingBetTimers.has(signalKey)) return;

    const timer = setTimeout(() => {
      pendingBetTimers.delete(signalKey);
      if (!engine || epoch !== indicationEpoch) return;
      void enqueueEngineResult(() =>
        scheduleBetAttempt(engine.runTick(), mesaUrl, cfg, epoch),
      );
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
    await persistBet36524d2fMachineState(result.machine);
  }
  if (result.stats) {
    await persistBet36524d2fStats(result.stats, cfg.maxRecovery);
  }

  let epoch = indicationEpoch;

  if (result.missedBetWindow) {
    epoch = bumpIndicationEpoch();
    lastEmittedSignalId = null;
    engine.abortBetCommit?.();
    clearPendingBetTimers();
    await writeIndicationStatus(
      idleIndicationPatch({
        tableId: cfg.tableId,
        recovery: result.recovery ?? idleRecoveryFromResult(result, engine),
        lastError: "Giro novo antes da aposta — não contou",
        reason: "Janela de aposta perdida (sem cliques confirmados)",
      }),
      epoch,
    );
  }

  if (isAwaitingReference(cycleFromResult(result)) && !result.flash) {
    await syncReferencePauseStatus(result, cfg);
  }

  if (result.flash) {
    epoch = bumpIndicationEpoch();
    const flashKind = result.flash.kind;
    const pausedCycle = cycleFromResult(result);
    const cycleOpen = pausedCycle != null;
    const cycleClosed = !cycleOpen;
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    engine.abortBetCommit?.();
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

    await writeIndicationStatus(
      {
        ...idleIndicationPatch({
          tableId: cfg.tableId,
          lastFlash: flashKind,
          lastResult: result.flash.resultNumber,
          reason: idleReason,
          recovery: cycleClosed
            ? flashKind === "win"
              ? 0
              : idleRecovery
            : (pausedCycle?.recovery ?? result.recovery ?? idleRecovery),
        }),
        ...(cycleOpen && pausedCycle && isAwaitingReference(pausedCycle)
          ? {
              active: true,
              label: referencePauseLabel(pausedCycle),
              waitingBet: true,
              waitingReference: true,
            }
          : {}),
      },
      epoch,
    );
  }

  // Só activa indicação se o motor tem ciclo real em awaiting_bet/result.
  const liveCycle = cycleFromResult(result);
  if (
    result.active &&
    liveCycle &&
    (liveCycle.phase === "awaiting_bet" || liveCycle.phase === "awaiting_result")
  ) {
    const label = formatActiveLabel(result.active, result.recovery ?? 0);
    const displayRecovery = result.recovery ?? 0;
    await writeIndicationStatus(
      {
        active: true,
        label,
        axis: axisFromActive(result.active),
        recovery: displayRecovery,
        lastTrigger: result.active.triggerNumbers ?? null,
        tableId: cfg.tableId,
        reason: null,
        waitingBet: liveCycle.phase === "awaiting_bet",
        waitingReference: false,
        lastError: null,
        ...positionFieldsFromActive(result.active),
      },
      epoch,
    );
  } else if (!liveCycle) {
    // Qualquer tick sem ciclo (inclui pós-flash) → idle obrigatório.
    await writeIndicationStatus(
      idleIndicationPatch({
        tableId: cfg.tableId,
        recovery: resolvedRecoveryForStatus(result, engine),
        ...(result.flash
          ? {
              lastFlash: result.flash.kind,
              lastResult: result.flash.resultNumber,
            }
          : {}),
      }),
      epoch,
    );
  }

  const machineState =
    result.machine ?? engine?.getState?.()?.machine ?? null;
  if (machineState?.watch) {
    const watchLabelFn =
      SinglestakeBet36524d2f?.ice2fWatchLabelForMachine ??
      SinglestakeBet36524d2f?.formatIce2fWatchLabel;
    if (typeof watchLabelFn === "function") {
      await writeBet36524d2fStatus({
        watchLabel: watchLabelFn(
          SinglestakeBet36524d2f?.ice2fWatchLabelForMachine ? machineState : machineState.watch,
        ),
        inactiveSpins: machineState.inactiveSpinsWithoutEntry ?? 0,
        relaxedEntry: machineState.cycle?.relaxedEntry === true,
        zeroDebt: machineState.zeroDebtUnits ?? 0,
        zeroRecovered: machineState.zeroRecoveredUnits ?? 0,
        zeroShift: machineState.zeroShift ?? 0,
      });
    }
  }

  // Pós-liquidação sem ciclo: não reagendar aposta (evita revive da indicação).
  if (!liveCycle && result.flash) {
    clearPendingBetTimers();
    lastEmittedSignalId = null;
    return;
  }

  await scheduleBetAttempt(result, mesaUrl, cfg, epoch);
}

async function startBet36524d2fAutopilot(handleBridgePayload) {
  if (typeof handleBridgePayload === "function") {
    bridgeHandler = handleBridgePayload;
    globalThis.__singlestakeBet36524d2fBridgeHandler = handleBridgePayload;
  }
  const enabled = await readBet36524d2fAutopilotEnabled();
  if (!enabled) {
    await writeBet36524d2fStatus({ running: false, reason: "autopilot Bet365 24D 2F desligado" });
    return;
  }

  if (!globalThis.SinglestakeBet36524d2f?.createBet36524d2fEngine) {
    await writeBet36524d2fStatus({
      running: false,
      reason: "bet36524d2f-engine.js em falta — corra npm run extension:bet36524d2f:build",
    });
    return;
  }

  stopBet36524d2fAutopilot();

  const cfg = await readBet36524d2fConfig();
  applyEnabledPairsFromConfig(cfg);
  const saved = await readBet36524d2fStats(cfg.maxRecovery);
  const savedMachine = await readBet36524d2fMachineState();
  engine = SinglestakeBet36524d2f.createBet36524d2fEngine({
    maxRecovery: cfg.maxRecovery,
    initialStats: saved?.stats ?? null,
    initialMachine: savedMachine,
  });
  lastEmittedSignalId = null;
  clearPendingBetTimers();
  bumpIndicationEpoch();

  dgaHub = SinglestakeDgaHub.createDgaHub({
    tableIds: [cfg.tableId],
    config: {
      wsUrl: cfg.wsUrl,
      casinoId: cfg.casinoId,
      currency: cfg.currency,
    },
    onLog: (msg) => void writeBet36524d2fStatus({ log: msg }),
    onStatus: (status) => void writeBet36524d2fStatus({ dga: status }),
    onHistorySnapshot: async (_tableId, spins) => {
      if (!engine) return;
      const result = engine.ingestHistorySnapshot(spins);
      const cfgNow = await readBet36524d2fConfig();
      void processEngineResult(result, cfgNow.mesaUrl, cfgNow);
    },
    onSpin: (_tableId, spin) => {
      if (!engine) return;
      const result = engine.ingestSpin(spin.number, spin.gameId);
      if (!result) return;
      void readBet36524d2fConfig().then((cfgNow) =>
        processEngineResult(result, cfgNow.mesaUrl, cfgNow),
      );
    },
  });

  dgaHub.start();
  await writeBet36524d2fStatus({
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

function stopBet36524d2fAutopilot() {
  clearPendingBetTimers();
  dgaHub?.stop();
  dgaHub = null;
  engine = null;
  lastEmittedSignalId = null;
  bumpIndicationEpoch();
  void writeBet36524d2fStatus(idleIndicationPatch({ running: false, waitingBet: false }));
}

async function setBet36524d2fAutopilotEnabled(enabled) {
  await chrome.storage.local.set({ [STORAGE_BET36524D2F_AUTOPLAY]: enabled === true });
  if (enabled) {
    await startBet36524d2fAutopilot(bridgeHandler ?? globalThis.__singlestakeBet36524d2fBridgeHandler ?? null);
    if (!bridgeHandler && !globalThis.__singlestakeBet36524d2fBridgeHandler) {
      await writeBet36524d2fStatus({
        running: false,
        reason: "Extensão a iniciar — clique Parado/Activo outra vez",
      });
    }
  } else {
    stopBet36524d2fAutopilot();
    await writeBet36524d2fStatus({ running: false, reason: "autopilot Bet365 24D 2F desligado" });
  }
  const status = await getBet36524d2fAutopilotStatus();
  return { ok: true, ...status };
}

async function getBet36524d2fAutopilotStatus() {
  const data = await chrome.storage.local.get([STORAGE_BET36524D2F_STATUS, STORAGE_BET36524D2F_AUTOPLAY, STORAGE_BET36524D2F_STATS]);
  const statsPack = data[STORAGE_BET36524D2F_STATS];
  const live = engine?.getState?.();
  const wins = live?.stats?.wins ?? statsPack?.stats?.wins ?? data[STORAGE_BET36524D2F_STATUS]?.wins ?? 0;
  const losses = live?.stats?.losses ?? statsPack?.stats?.losses ?? data[STORAGE_BET36524D2F_STATUS]?.losses ?? 0;
  const pairIndication = mergePairIndicationForUi(
    live?.stats?.pairIndication ??
      statsPack?.stats?.pairIndication ??
      data[STORAGE_BET36524D2F_STATUS]?.pairIndication ??
      {},
  );
  const stored = data[STORAGE_BET36524D2F_STATUS] ?? {};
  const liveCycle = liveIndicationCycle();
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
          : (await readBet36524d2fMachineState())?.recovery ?? 0;
    }
  }
  const maxRecovery =
    live?.maxRecovery ?? statsPack?.maxRecovery ?? data[STORAGE_BET36524D2F_STATUS]?.maxRecovery ?? DEFAULT_MAX_GALES;
  const cfg = await readBet36524d2fConfig();
  const streak =
    globalThis.SinglestakeBet36524d2f?.buildIce2fStreakChartMetrics?.(
      live?.stats ?? statsPack?.stats ?? { wins, losses, outcomeHistory: [] },
    ) ?? null;
  const knownPairs = knownPairIds().map((id) => ({
    id,
    label:
      typeof SinglestakeBet36524d2f?.ice2fPairLabel === "function"
        ? SinglestakeBet36524d2f.ice2fPairLabel(id)
        : String(id).replace(/x/gi, "×"),
  }));
  const enabledPairIds = normalizeEnabledPairIds(cfg.enabledPairIds);
  const storedStatus = data[STORAGE_BET36524D2F_STATUS] ?? { running: false };
  /** UI só a partir do ciclo live — nunca confiar em label/active stale do storage. */
  let reconciledStatus;
  if (!liveCycle) {
    reconciledStatus = {
      ...storedStatus,
      ...idleIndicationPatch(),
      running: storedStatus.running === true,
      reason: storedStatus.reason ?? null,
      lastFlash: storedStatus.lastFlash ?? null,
      lastResult: storedStatus.lastResult ?? null,
      watchLabel: storedStatus.watchLabel ?? null,
      dga: storedStatus.dga ?? null,
      log: storedStatus.log ?? null,
    };
  } else {
    const liveActive = liveCycle.active ?? null;
    reconciledStatus = {
      ...storedStatus,
      active: true,
      label: formatActiveLabel(liveActive, liveCycle.recovery ?? 0),
      axis: axisFromActive(liveActive),
      recovery: liveCycle.recovery ?? 0,
      waitingBet: liveCycle.phase === "awaiting_bet",
      waitingReference: liveCycle.phase === "awaiting_reference",
      lastError: null,
      reason: null,
      ...positionFieldsFromActive(liveActive),
    };
  }
  return {
    enabled: data[STORAGE_BET36524D2F_AUTOPLAY] === true,
    status: {
      ...reconciledStatus,
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

function initBet36524d2fSignalRunner(handleBridgePayload) {
  bridgeHandler = handleBridgePayload;
  globalThis.__singlestakeBet36524d2fBridgeHandler = handleBridgePayload;
  void readBet36524d2fConfig().then((cfg) => applyEnabledPairsFromConfig(cfg));
  void readBet36524d2fAutopilotEnabled().then((on) => {
    if (on) void startBet36524d2fAutopilot(handleBridgePayload);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_BET36524D2F_AUTOPLAY] && bridgeHandler) {
      if (changes[STORAGE_BET36524D2F_AUTOPLAY].newValue === true) {
        void startBet36524d2fAutopilot(bridgeHandler);
      } else {
        stopBet36524d2fAutopilot();
      }
    }
    if (changes[STORAGE_BET36524D2F_CONFIG] && bridgeHandler) {
      void readBet36524d2fConfig().then((cfg) => {
        applyEnabledPairsFromConfig(cfg);
        return readBet36524d2fAutopilotEnabled().then((on) => {
          if (on) void startBet36524d2fAutopilot(bridgeHandler);
        });
      });
    }
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.SinglestakeBet36524d2fSignalRunner = {
    initBet36524d2fSignalRunner,
    startBet36524d2fAutopilot,
    stopBet36524d2fAutopilot,
    setBet36524d2fAutopilotEnabled,
    getBet36524d2fAutopilotStatus,
    getBet36524d2fConfigForPopup,
    setBet36524d2fConfigFromPopup,
    resetBet36524d2fStats,
    STORAGE_BET36524D2F_AUTOPLAY,
    STORAGE_BET36524D2F_CONFIG,
  };
}
