/* global SinglestakeFootballBlitzObs, SinglestakeFootballBlitzDga */

importScripts("football-blitz-obs-engine.js", "dga-football-blitz.js");

const STORAGE = {
  config: "fbBlitzObsRealsConfig",
  history: "fbBlitzObsRealsHistory",
  active: "fbBlitzObsRealsActive",
  status: "fbBlitzObsRealsStatus",
  suppressedIds: "fbBlitzObsRealsSuppressed",
  clearedAt: "fbBlitzObsRealsClearedAt",
  seedSuppress: "fbBlitzObsRealsSeedSuppress",
  sessionOutcomes: "fbBlitzObsRealsSessionOutcomes",
  deckOutcomeSynced: "fbBlitzObsRealsDeckOutcomeSynced",
};

const DEFAULT_CONFIG = {
  tableKey: 4001,
  casinoId: "ppcdk00000005148",
  currency: "BRL",
  maxHistory: 200,
  minSamples: 2,
  signalMinSamples: 1,
  mesaUrl: "https://reals.bet.br/",
};

const HISTORY_GRID_COLS = 8;
const HISTORY_GRID_ROWS = 8;
const HISTORY_GRID_SIZE = HISTORY_GRID_COLS * HISTORY_GRID_ROWS;

const state = {
  active: true,
  config: { ...DEFAULT_CONFIG },
  history: [],
  dgaStatus: "idle",
  lastError: null,
  lastResultId: null,
  updatedAt: null,
  suppressedIds: {},
  clearedAt: 0,
  seedSuppressOnNextFetch: false,
  shuffleNote: null,
  /** Placar W/L da sessão — sobrevive ao zerar histórico no shuffle. */
  sessionOutcomes: [],
  /** Quantos outcomes do baralho actual já foram copiados para sessionOutcomes. */
  deckOutcomeSynced: 0,
};

let dga = null;
let obsPanelWindowId = null;
const uiPorts = new Set();

function cardRank(card) {
  if (!card) return null;
  const fromField = String(card.rank ?? "").trim().toUpperCase();
  if (fromField) return fromField === "T" ? "10" : fromField;
  const label = String(card.label ?? "").trim().toUpperCase();
  const match = label.match(/^(10|[2-9]|[AJQK])/);
  return match ? match[1] : null;
}

function pairKey(round) {
  const homeRank = cardRank(round?.home);
  const awayRank = cardRank(round?.away);
  if (!homeRank || !awayRank || !round?.winner) return null;
  return `${homeRank}|${awayRank}|${round.winner}`;
}

function hasCardLabels(round) {
  return Boolean(round?.home?.label && round?.away?.label);
}

function expandRound(round) {
  return SinglestakeFootballBlitzObs.expandFootballBlitzRound(round);
}

function isSuppressed(gameId) {
  return Boolean(state.suppressedIds[String(gameId)]);
}

function rememberSuppressed(ids) {
  const next = { ...state.suppressedIds };
  for (const id of ids) {
    if (id != null && String(id).trim()) next[String(id)] = true;
  }
  const keys = Object.keys(next);
  if (keys.length > 800) {
    for (const key of keys.slice(0, keys.length - 600)) delete next[key];
  }
  state.suppressedIds = next;
}

function buildDisplayRounds() {
  const rounds = [];
  for (const raw of state.history.slice(0, HISTORY_GRID_SIZE)) {
    const expanded = expandRound(raw);
    if (expanded) rounds.push(expanded);
    else rounds.push({ ...raw, home: null, away: null, bridgeOnly: true });
  }
  return rounds;
}

function buildHistoryGrid(displayRounds) {
  const slots = displayRounds.slice(0, HISTORY_GRID_SIZE);
  const headKey = pairKey(slots[0]);
  let matchCount = 0;
  if (headKey) {
    for (const round of slots) {
      if (pairKey(round) === headKey) matchCount += 1;
    }
  }
  const highlight = Boolean(headKey && matchCount >= 2);
  const cells = [];
  for (let i = 0; i < HISTORY_GRID_SIZE; i += 1) {
    const round = slots[i] ?? null;
    cells.push({
      empty: !round,
      matchHl: highlight && round && pairKey(round) === headKey,
      round,
    });
  }
  return { cells, highlightKey: highlight ? headKey : null };
}

function syncSessionOutcomes(cardPairTrack) {
  const deckOutcomes = Array.isArray(cardPairTrack?.outcomeHistory)
    ? cardPairTrack.outcomeHistory
    : [];
  if (deckOutcomes.length < state.deckOutcomeSynced) {
    state.deckOutcomeSynced = deckOutcomes.length;
  }
  if (deckOutcomes.length > state.deckOutcomeSynced) {
    state.sessionOutcomes = [
      ...state.sessionOutcomes,
      ...deckOutcomes.slice(state.deckOutcomeSynced),
    ];
    state.deckOutcomeSynced = deckOutcomes.length;
  }
}

function publicStatus() {
  const Api = SinglestakeFootballBlitzObs;
  const displayRounds = buildDisplayRounds();
  const historyGrid = buildHistoryGrid(displayRounds);
  const patterns = Api.analyzeFootballBlitzSidePatterns?.(state.history, {
    minSamples: state.config.minSamples,
  }) ?? { transitions: [], rounds: 0 };
  const cardPairPatterns = Api.analyzeFootballBlitzCardPairPatterns?.(state.history, {
    minSamples: state.config.minSamples,
  }) ?? { perfectWinsNext: [], perfectLosesNext: [], transitions: 0, pairsTracked: 0 };
  const cardPairTrack = Api.buildFootballBlitzCardPairTrack?.(state.history, {
    signalMinSamples: state.config.signalMinSamples ?? 1,
  }) ?? {
    activeSignal: null,
    outcomeHistory: [],
    streak: {
      outcomes: [],
      winStreakSeries: [],
      lossStreakSeries: [],
      currentWinStreak: 0,
      currentLossStreak: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      totalWins: 0,
      totalLosses: 0,
    },
    signalMinSamples: 1,
  };
  syncSessionOutcomes(cardPairTrack);
  const streak =
    Api.buildStreakFromOutcomes?.(state.sessionOutcomes) ??
    cardPairTrack.streak;
  const shoe =
    Api.buildFootballBlitzShoeStats?.(state.history, { decks: 8 }) ?? null;

  return {
    ok: true,
    active: state.active,
    dgaStatus: state.dgaStatus,
    channel: `pragmatic.football-blitz.${state.config.tableKey}`,
    tableKey: state.config.tableKey,
    mesaUrl: state.config.mesaUrl,
    history: state.history.slice(0, 40),
    displayRounds,
    historyGrid: historyGrid.cells,
    historyHighlightKey: historyGrid.highlightKey,
    displayHead: displayRounds[0] ?? null,
    lastResultId: state.lastResultId,
    patterns,
    cardPairPatterns,
    activeSignal: cardPairTrack.activeSignal,
    outcomeHistory: state.sessionOutcomes,
    streak,
    shoe,
    signalMinSamples: cardPairTrack.signalMinSamples,
    updatedAt: state.updatedAt,
    lastError: state.lastError,
    shuffleNote: state.shuffleNote,
    note:
      state.shuffleNote ||
      (state.dgaStatus === "open"
        ? "DGA ao vivo — coincidência + cor à esquerda (filtro direita=penúltima)."
        : "A ligar DGA Football Blitz…"),
  };
}

function broadcastStatus(data = null) {
  const payload = data ?? publicStatus();
  for (const port of uiPorts) {
    try {
      port.postMessage({ kind: "status", data: payload });
    } catch {
      uiPorts.delete(port);
    }
  }
  return payload;
}

async function persist() {
  await chrome.storage.local.set({
    [STORAGE.config]: state.config,
    [STORAGE.history]: state.history,
    [STORAGE.active]: state.active,
    [STORAGE.status]: publicStatus(),
    [STORAGE.suppressedIds]: state.suppressedIds,
    [STORAGE.clearedAt]: state.clearedAt,
    [STORAGE.seedSuppress]: state.seedSuppressOnNextFetch,
    [STORAGE.sessionOutcomes]: state.sessionOutcomes,
    [STORAGE.deckOutcomeSynced]: state.deckOutcomeSynced,
  });
}

function mergeSnapshot(rows, { seeding = false } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  if (seeding || state.seedSuppressOnNextFetch) {
    rememberSuppressed(rows.map((r) => r.gameId));
    state.seedSuppressOnNextFetch = false;
    state.history = [];
    state.lastResultId = null;
    state.updatedAt = new Date().toISOString();
    return true;
  }

  const byId = new Map(state.history.map((r) => [r.gameId, r]));
  let changed = false;
  for (const row of rows) {
    if (!row?.gameId || isSuppressed(row.gameId)) continue;
    if (!byId.has(row.gameId)) changed = true;
    byId.set(row.gameId, row);
  }
  if (!changed && byId.size === state.history.length) {
    // ainda assim actualiza ordem se snapshot trouxe ordem nova
  }
  state.history = [...byId.values()]
    .sort((a, b) => {
      const ta = a.time ? Date.parse(a.time) : 0;
      const tb = b.time ? Date.parse(b.time) : 0;
      if (tb !== ta) return tb - ta;
      return String(b.gameId).localeCompare(String(a.gameId));
    })
    .slice(0, state.config.maxHistory);
  state.lastResultId = state.history[0]?.gameId ?? null;
  state.updatedAt = new Date().toISOString();
  return true;
}

function ingestRound(round) {
  if (!round?.gameId || isSuppressed(round.gameId)) return;
  if (state.clearedAt > 0) {
    const t = round.time ? Date.parse(round.time) : Date.now();
    if (Number.isFinite(t) && t < state.clearedAt) return;
  }
  const existing = state.history.findIndex((r) => r.gameId === round.gameId);
  if (existing >= 0) state.history[existing] = round;
  else state.history = [round, ...state.history].slice(0, state.config.maxHistory);
  state.lastResultId = state.history[0]?.gameId ?? null;
  state.updatedAt = new Date().toISOString();
}

/** Zera histórico na mudança de baralho (DGA shuffle). Placar da sessão mantém-se. */
function clearHistoryOnShuffle(event = {}) {
  const ids = Array.isArray(event.suppressGameIds) ? event.suppressGameIds : [];
  if (ids.length) rememberSuppressed(ids);
  // Flush outcomes do baralho actual antes de limpar o histórico.
  syncSessionOutcomes(
    SinglestakeFootballBlitzObs.buildFootballBlitzCardPairTrack?.(state.history, {
      signalMinSamples: state.config.signalMinSamples ?? 1,
    }) ?? { outcomeHistory: [] },
  );
  state.history = [];
  state.lastResultId = null;
  state.deckOutcomeSynced = 0;
  state.clearedAt = Date.now();
  state.lastError = null;
  state.updatedAt =
    typeof event.detectedAt === "string" ? event.detectedAt : new Date().toISOString();
  state.shuffleNote = `Baralho novo · histórico zerado · placar mantido · ${String(state.updatedAt).slice(11, 19)}`;
}

function startDga() {
  if (dga) {
    try {
      dga.stop();
    } catch {
      /* */
    }
    dga = null;
  }
  dga = SinglestakeFootballBlitzDga.createFootballBlitzDga({
    config: {
      tableKey: state.config.tableKey,
      casinoId: state.config.casinoId,
      currency: state.config.currency,
    },
    onStatus(status) {
      state.dgaStatus = status;
      broadcastStatus();
    },
    onSnapshot(snapshot) {
      mergeSnapshot(snapshot, { seeding: state.seedSuppressOnNextFetch });
      void persist();
      broadcastStatus();
    },
    onShuffle(event) {
      clearHistoryOnShuffle(event);
      void persist();
      broadcastStatus();
    },
    onRound(latest) {
      ingestRound(latest);
      if (state.history.length > 0) state.shuffleNote = null;
      void persist();
      broadcastStatus();
    },
    onLog() {
      /* silencioso */
    },
  });
  if (state.active) dga.start();
}

async function openOrFocusGameTab() {
  const mesaUrl = state.config.mesaUrl || DEFAULT_CONFIG.mesaUrl;
  if (state.config.mesaUrl !== mesaUrl) {
    state.config.mesaUrl = mesaUrl;
    await chrome.storage.local.set({ [STORAGE.config]: state.config });
  }
  const tabs = await chrome.tabs.query({});
  const match =
    tabs.find((tab) => {
      const href = String(tab.url || "");
      return /reals\.bet\.br/i.test(href) && /football.?blitz|top.?card|blitz|4001|super.?trunfo|liveCassino/i.test(href);
    }) ||
    tabs.find((tab) => /reals\.bet\.br/i.test(String(tab.url || "")));
  if (match?.id != null) {
    try {
      await chrome.tabs.update(match.id, { active: true, url: mesaUrl });
      if (match.windowId != null) await chrome.windows.update(match.windowId, { focused: true });
      return match.id;
    } catch {
      /* cria nova */
    }
  }
  const created = await chrome.tabs.create({ url: mesaUrl, active: true });
  return created?.id ?? null;
}

async function openOrFocusObsPanel() {
  if (obsPanelWindowId != null) {
    try {
      const existing = await chrome.windows.get(obsPanelWindowId);
      if (existing?.id != null) {
        await chrome.windows.update(existing.id, { state: "normal", focused: true });
        return;
      }
    } catch {
      obsPanelWindowId = null;
    }
  }
  const url = chrome.runtime.getURL("obs-panel.html");
  try {
    const win = await chrome.windows.create({
      url,
      type: "popup",
      width: 520,
      height: 820,
      focused: true,
    });
    obsPanelWindowId = win?.id ?? null;
  } catch {
    obsPanelWindowId = null;
    await chrome.tabs.create({ url });
  }
}

async function loadState() {
  const stored = await chrome.storage.local.get([
    STORAGE.config,
    STORAGE.history,
    STORAGE.active,
    STORAGE.suppressedIds,
    STORAGE.clearedAt,
    STORAGE.seedSuppress,
    STORAGE.sessionOutcomes,
    STORAGE.deckOutcomeSynced,
  ]);
  const prevTableKey = Number(stored[STORAGE.config]?.tableKey);
  state.config = {
    ...DEFAULT_CONFIG,
    ...(stored[STORAGE.config] ?? {}),
    mesaUrl:
      typeof stored[STORAGE.config]?.mesaUrl === "string" &&
      (/reals\.bet\.br/i.test(stored[STORAGE.config].mesaUrl) ||
        /football.?blitz|top.?card|4001|super.?trunfo/i.test(stored[STORAGE.config].mesaUrl))
        ? stored[STORAGE.config].mesaUrl.trim()
        : DEFAULT_CONFIG.mesaUrl,
    tableKey: 4001,
  };
  // Histórico antigo da mesa 4022 (Super Trunfo) não serve para Top Card.
  state.history =
    prevTableKey === 4001 && Array.isArray(stored[STORAGE.history])
      ? stored[STORAGE.history]
      : [];
  state.suppressedIds =
    stored[STORAGE.suppressedIds] && typeof stored[STORAGE.suppressedIds] === "object"
      ? stored[STORAGE.suppressedIds]
      : {};
  state.clearedAt = Number(stored[STORAGE.clearedAt]) || 0;
  state.seedSuppressOnNextFetch = stored[STORAGE.seedSuppress] === true;
  state.sessionOutcomes = Array.isArray(stored[STORAGE.sessionOutcomes])
    ? stored[STORAGE.sessionOutcomes].filter((x) => x === "W" || x === "L")
    : [];
  state.deckOutcomeSynced = Math.max(0, Math.floor(Number(stored[STORAGE.deckOutcomeSynced]) || 0));
  state.active = true;
  await chrome.storage.local.set({ [STORAGE.active]: true });
  startDga();
  await persist();
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "fb-blitz-obs-ui") return;
  uiPorts.add(port);
  try {
    port.postMessage({ kind: "status", data: publicStatus() });
  } catch {
    /* */
  }
  port.onDisconnect.addListener(() => uiPorts.delete(port));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const respond = async () => {
    if (message?.kind === "fb-blitz-obs-get-status") return publicStatus();
    if (message?.kind === "fb-blitz-obs-set-active") {
      state.active = message.active === true;
      if (state.active) startDga();
      else {
        dga?.stop();
        state.dgaStatus = "stopped";
      }
      await persist();
      broadcastStatus();
      return publicStatus();
    }
    if (message?.kind === "fb-blitz-obs-refresh") {
      startDga();
      return publicStatus();
    }
    if (message?.kind === "fb-blitz-obs-clear-history") {
      state.history = [];
      state.lastResultId = null;
      state.clearedAt = Date.now();
      state.seedSuppressOnNextFetch = true;
      state.suppressedIds = {};
      state.shuffleNote = null;
      state.sessionOutcomes = [];
      state.deckOutcomeSynced = 0;
      await persist();
      broadcastStatus();
      startDga();
      return publicStatus();
    }
    if (message?.kind === "fb-blitz-obs-open-panel") {
      await openOrFocusObsPanel();
      return { ok: true };
    }
    if (message?.kind === "fb-blitz-obs-open-game") {
      const tabId = await openOrFocusGameTab();
      return { ok: true, tabId };
    }
    return { ok: false, error: "unknown" };
  };
  void respond().then(sendResponse);
  return true;
});

chrome.action.onClicked.addListener(() => {
  void openOrFocusObsPanel();
  void openOrFocusGameTab();
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === obsPanelWindowId) obsPanelWindowId = null;
});

chrome.runtime.onInstalled.addListener(() => {
  void loadState();
});

void loadState();
