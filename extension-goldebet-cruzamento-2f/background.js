importScripts("shared.js", "golde2f-engine.js", "dga-hub.js", "golde2f-signal-runner.js");

const CLICK_STAGGER_MS = 450;
const DEFAULT_CHIP_VALUE = 0.5;
const FIBONACCI_RECOVERY_SETTLE_MS = GOG.FIBONACCI_RECOVERY_SETTLE_MS ?? 5000;
/** Espera a barra «A depurar» estabilizar o viewport antes de calcular coordenadas. */
const CDP_BAR_SETTLE_MS = 1500;

/** @type {{ fingerprint: string; at: string; actions: unknown[] } | null} */
let lastBridge = null;
/** Evita apostar duas vezes no mesmo alvo do sinal (demo e real). Chave: `${signalId}:factor-1`. */
const lastExecutedClickKeys = new Set();
/** Ignora payloads duplicados enquanto o mesmo sinal está activo. */
let lastBridgeDedupeKey = null;
/** Bloqueia reentrância durante execução CDP. */
let bridgeInFlightKey = null;
/** Último gale/mesa — permite nova aposta quando recovery sobe. */
let lastBridgeRecovery = null;
let lastBridgeTableId = null;
let lastBridgeSignalId = null;
/** tableId da mesa → separador Chrome onde a aposta foi executada. */
const mesaTabByTableId = new Map();
/** Fechos agendados por mesa (evita duplicar). */
const mesaTabCloseTimers = new Map();

const STORAGE_BRIDGE_ENABLED = "gogBridgeEnabled";
const CLOSE_MESA_DELAY_MS = GOG.CLOSE_MESA_DELAY_MS ?? 2500;

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    void setStoredMode(GOG.DEFAULT_MODE);
    void chrome.storage.local.set({ gogGolde2fAutopilotEnabled: false });
  }
  void ensureGolde2fPanelOnOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureGolde2fPanelOnOpenTabs();
});

/** Janela fixa do painel ICE 3F (não fecha ao clicar na mesa). */
let golde2fPanelWindowId = null;

async function openOrFocusGolde2fPanel() {
  if (golde2fPanelWindowId != null) {
    try {
      const existing = await chrome.windows.get(golde2fPanelWindowId);
      if (existing?.id != null) {
        await chrome.windows.update(existing.id, { focused: true });
        return;
      }
    } catch {
      golde2fPanelWindowId = null;
    }
  }

  const url = chrome.runtime.getURL("popup.html");
  const win = await chrome.windows.create({
    url,
    type: "popup",
    width: 400,
    height: 720,
    focused: true,
  });
  golde2fPanelWindowId = win?.id ?? null;
}

chrome.action.onClicked.addListener(() => {
  void openOrFocusGolde2fPanel();
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === golde2fPanelWindowId) golde2fPanelWindowId = null;
});

const GOLDE2F_DEFAULT_TABLE_ID = 230;
/** Chave única de calibração — o ICE muda o pathname ao carregar o jogo. */
const GOLDE2F_CALIB_SITE_KEY = "goldebet.bet.br|pragmatic-roulette";

function isGolde2fHost(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "goldebet.bet.br" || host.endsWith(".goldebet.bet.br");
  } catch {
    return /goldebet\.bet\.br/i.test(url);
  }
}

function isGolde2fRoulettePageUrl(url) {
  if (!isGolde2fHost(url)) return false;
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.hash}${u.search}`.toLowerCase();
    return /\/play\/pragmatic\/roulette-3(?:\/|$|\?|#)/i.test(path);
  } catch {
    return /goldebet\.bet\.br/i.test(url);
  }
}

async function ensureGolde2fPanelOnTab(tabId) {
  if (tabId == null) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isGolde2fRoulettePageUrl(tab.url)) return;
    const live = await chrome.tabs
      .sendMessage(tabId, { kind: "golde2f-panel-ping" })
      .then((r) => r?.ok === true)
      .catch(() => false);
    if (live) return;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-golde2f-panel.js"],
    });
  } catch {
    /* aba restrita */
  }
}

async function ensureGolde2fPanelOnOpenTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null && isGolde2fRoulettePageUrl(tab.url)) {
      await ensureGolde2fPanelOnTab(tab.id);
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? tab.url;
  if (
    (changeInfo.status === "complete" || changeInfo.url) &&
    isGolde2fRoulettePageUrl(url)
  ) {
    registerMesaTab(GOLDE2F_DEFAULT_TABLE_ID, tabId);
    void ensureGolde2fPanelOnTab(tabId);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[GOG.STORAGE_MODE]) {
    updateActionBadge(changes[GOG.STORAGE_MODE].newValue === "real" ? "real" : "demo");
  }
});

void readStoredMode().then(updateActionBadge);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.kind === "set-mode") {
    const mode = message.mode === "real" ? "real" : "demo";
    void setStoredMode(mode).then(() => sendResponse({ ok: true, mode }));
    return true;
  }

  if (message.kind === "get-status") {
    void buildStatus().then(sendResponse);
    return true;
  }

  if (message.kind === "set-golde2f-autopilot") {
    void SinglestakeGolde2fSignalRunner.setGolde2fAutopilotEnabled(message.enabled === true).then(async (resp) => {
      if (message.enabled === true) await ensureGolde2fPanelOnTab(sender.tab?.id ?? null);
      sendResponse(resp);
    });
    return true;
  }

  if (message.kind === "get-golde2f-autopilot") {
    void SinglestakeGolde2fSignalRunner.getGolde2fAutopilotStatus().then(sendResponse);
    return true;
  }

  if (message.kind === "reset-golde2f-stats") {
    void SinglestakeGolde2fSignalRunner.resetGolde2fStats().then(sendResponse);
    return true;
  }

  if (message.kind === "get-golde2f-config") {
    void SinglestakeGolde2fSignalRunner.getGolde2fConfigForPopup().then(sendResponse);
    return true;
  }

  if (message.kind === "set-golde2f-config") {
    void SinglestakeGolde2fSignalRunner.setGolde2fConfigFromPopup(message.config ?? {}).then(sendResponse);
    return true;
  }

  if (message.kind === "get-bridge-prefs") {
    void Promise.all([readBridgePrefs(), readBridgeEnabled(), readStoredMode()]).then(
      ([prefs, bridgeEnabled, mode]) =>
        sendResponse({ ...prefs, bridgeEnabled, executionMode: mode }),
    );
    return true;
  }

  if (message.kind === "get-bridge-enabled") {
    void readBridgeEnabled().then((enabled) => sendResponse({ ok: true, enabled }));
    return true;
  }

  if (message.kind === "set-bridge-prefs") {
    void writeBridgePrefs(message.prefs ?? {}).then(sendResponse);
    return true;
  }

  if (message.kind === "reset-bridge-stats") {
    void resetBridgeStats().then(sendResponse);
    return true;
  }

  if (message.kind === "bridge-stats-sync") {
    void writeBridgePrefs({
      wins: message.wins,
      losses: message.losses,
    }).then(sendResponse);
    return true;
  }

  if (message.kind === "bridge-close-mesa") {
    const tableId = typeof message.tableId === "number" ? message.tableId : Number(message.tableId);
    const mesaUrl = typeof message.mesaUrl === "string" ? message.mesaUrl.trim() : "";
    void scheduleCloseMesaTab(tableId, mesaUrl || null).then(sendResponse);
    return true;
  }

  if (message.kind === "test-bet") {
    void testExteriorBet(message.tabId, message.betKey, message.label, message.mode).then(sendResponse);
    return true;
  }

  if (message.kind === "scan-bets") {
    void scanExteriorBets(message.tabId).then(sendResponse);
    return true;
  }

  if (message.kind === "ping") {
    if (sender.tab?.id != null && isGolde2fRoulettePageUrl(sender.tab.url)) {
      registerMesaTab(GOLDE2F_DEFAULT_TABLE_ID, sender.tab.id);
    }
    void readStoredMode().then((mode) =>
      sendResponse({ ok: true, lastBridge, mode, version: chrome.runtime.getManifest().version }),
    );
    return true;
  }

  if (message.kind === "arm-calibration") {
    void armCalibration(message.betKey, message.label, message.chipValue).then(sendResponse);
    return true;
  }

  if (message.kind === "calibration-click") {
    void saveCalibrationClick(message, message.tabId ?? sender.tab?.id ?? null).then(sendResponse);
    return true;
  }

  if (message.kind === "clear-calibration") {
    void clearCalibration(message.siteKey).then(sendResponse);
    return true;
  }

  if (message.kind === "export-calibration") {
    void exportCalibration().then(sendResponse);
    return true;
  }

  if (message.kind === "import-calibration") {
    void importCalibration(message.payload).then(sendResponse);
    return true;
  }

  if (message.kind === "set-click-chip-before-bet") {
    void chrome.storage.local
      .set({ gogClickChipBeforeBet: message.enabled === true })
      .then(() => sendResponse({ ok: true, enabled: message.enabled === true }));
    return true;
  }
});

function normalizeBridgePayload(raw) {
  if (!raw || typeof raw !== "object") return null;

  if (raw.type === GOG.BRIDGE_TYPE && raw.version === GOG.VERSION) {
    return raw;
  }

  if (raw.type === GOG.PANEL_SIGNAL_TYPE && raw.version === GOG.VERSION) {
    return panelSignalToBridge(raw);
  }

  return null;
}

const DEFAULT_BRIDGE_PREFS = { maxRecovery: 8, wins: 0, losses: 0, closeMesaOnFinish: true };

function clampBridgeMaxRecovery(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BRIDGE_PREFS.maxRecovery;
  return Math.min(8, Math.max(0, Math.floor(n)));
}

async function readBridgeEnabled() {
  const stored = await chrome.storage.local.get([STORAGE_BRIDGE_ENABLED]);
  return stored[STORAGE_BRIDGE_ENABLED] !== false;
}

async function readBridgePrefs() {
  const stored = await chrome.storage.local.get([GOG.STORAGE_BRIDGE_PREFS]);
  const raw = stored[GOG.STORAGE_BRIDGE_PREFS] ?? {};
  return {
    maxRecovery: clampBridgeMaxRecovery(raw.maxRecovery ?? DEFAULT_BRIDGE_PREFS.maxRecovery),
    wins: Math.max(0, Number(raw.wins) || 0),
    losses: Math.max(0, Number(raw.losses) || 0),
    closeMesaOnFinish: raw.closeMesaOnFinish !== false,
  };
}

async function writeBridgePrefs(patch) {
  const prev = await readBridgePrefs();
  const next = {
    ...prev,
    ...patch,
  };
  if (patch?.maxRecovery != null) {
    next.maxRecovery = clampBridgeMaxRecovery(patch.maxRecovery);
  }
  if (patch?.wins != null) next.wins = Math.max(0, Number(patch.wins) || 0);
  if (patch?.losses != null) next.losses = Math.max(0, Number(patch.losses) || 0);
  await chrome.storage.local.set({ [GOG.STORAGE_BRIDGE_PREFS]: next });
  return next;
}

async function resetBridgeStats() {
  const prev = await readBridgePrefs();
  return writeBridgePrefs({ wins: 0, losses: 0, maxRecovery: prev.maxRecovery });
}

async function buildStatus() {
  const mode = await readStoredMode();
  const stored = await chrome.storage.local.get([
    "gogLastBridge",
    "gogLastContext",
    "gogLastResults",
    "gogLastTest",
    "gogBetCalibration",
    "gogCalibrationArmed",
    "gogClickChipBeforeBet",
    "gogLastCalibSave",
  ]);
  const tabs = await chrome.tabs.query({});
  const mesaTab =
    tabs.find((t) => t.url && isGolde2fRoulettePageUrl(t.url)) ??
    (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  const calibUrl = mesaTab?.url ?? null;
  const store = stored.gogBetCalibration ?? { sites: {} };
  const calibLookup = calibUrl
    ? lookupSiteCalib(store, calibUrl)
    : lookupAnyIceCalib(store);
  const siteKey = calibLookup.siteKey;
  const siteCalib = calibLookup.site;
  const golde2fAutopilot = await SinglestakeGolde2fSignalRunner.getGolde2fAutopilotStatus();
  const golde2fConfig = await SinglestakeGolde2fSignalRunner.getGolde2fConfigForPopup();
  return {
    ok: true,
    mode,
    golde2fAutopilot,
    golde2fConfig,
    lastBridge: stored.gogLastBridge ?? null,
    lastContext: stored.gogLastContext ?? null,
    lastResults: stored.gogLastResults ?? null,
    lastTest: stored.gogLastTest ?? null,
    calibration: siteCalib ?? null,
    calibrationSiteKey: siteKey,
    calibrationArmed: stored.gogCalibrationArmed ?? null,
    lastCalibSave: stored.gogLastCalibSave ?? null,
    clickChipBeforeBet: stored.gogClickChipBeforeBet === true,
  };
}

async function handleBridgePayload(payload, sourceTabId) {
  const ctx = payload.context ?? {};
  const signalId =
    typeof ctx.signalId === "string" && ctx.signalId.trim() ? ctx.signalId.trim() : null;
  const recovery = recoveryFromContext(ctx);
  const tableId = ctx.currentTableId ?? null;

  let resolvedTabId = sourceTabId;
  if (resolvedTabId == null && tableId != null) {
    resolvedTabId = await resolveMesaTabId(ctx, null);
    if (resolvedTabId != null) {
      registerMesaTab(tableId, resolvedTabId);
    }
  }

  if (
    recovery > (lastBridgeRecovery ?? 0) ||
    recovery !== lastBridgeRecovery ||
    tableId !== lastBridgeTableId ||
    signalId !== lastBridgeSignalId
  ) {
    lastBridgeDedupeKey = null;
    lastExecutedClickKeys.clear();
  }
  lastBridgeRecovery = recovery;
  lastBridgeTableId = tableId;
  lastBridgeSignalId = signalId;

  const dedupeKey =
    signalId != null ? `${signalId}:r${recovery}` : payload.fingerprint
      ? `${payload.fingerprint}:r${recovery}`
      : null;

  if (dedupeKey && (bridgeInFlightKey === dedupeKey || lastBridgeDedupeKey === dedupeKey)) {
    return {
      ok: true,
      results: [
        {
          target: "bridge",
          ok: true,
          skipped: true,
          detail: `Sinal duplicado ignorado (${dedupeKey})`,
        },
      ],
      mode: await resolveExecutionMode(payload.context),
    };
  }

  bridgeInFlightKey = dedupeKey;
  try {
    lastBridge = {
      fingerprint: payload.fingerprint,
      at: new Date().toISOString(),
      actions: payload.actions,
    };
    await chrome.storage.local.set({ gogLastBridge: lastBridge, gogLastContext: payload.context });

    const results = await runBridgePlan(payload, resolvedTabId);
    const placedBet = results.some(
      (r) =>
        (r.target === "factor-1" ||
          r.target === "factor-2" ||
          r.r.target === "repeat-bet") &&
        r.ok === true &&
        r.skipped !== true,
    );
    if (dedupeKey && placedBet) {
      lastBridgeDedupeKey = dedupeKey;
    }
    return { ok: true, results, mode: await resolveExecutionMode(payload.context) };
  } finally {
    bridgeInFlightKey = null;
  }
}

function isGolde2fCrossingContext(context) {
  return context?.strategy === "golde2fcruzamento";
}

/** Pausa entre cliques do plano bridge — ritmo de cruzamento 2F entre factores. */
function bridgeActionStaggerMs(prevAction, action, context) {
  if (
    isGolde2fCrossingContext(context) &&
    prevAction?.target === "factor-1" &&
    action?.target === "factor-2"
  ) {
    return GOG.GOLDE2F_FACTOR_BRIDGE_STAGGER_MS ?? 5;
  }
  if (isGolde2fCrossingContext(context) && action?.target === "repeat-bet") {
    return GOG.GOLDE2F_DOUBLE_CLICK_STAGGER_MS ?? 20;
  }
  return CLICK_STAGGER_MS;
}

function isBettingClickTarget(target) {
  return (
    target === "factor-1" ||
    target === "factor-2"  ||
    target === "repeat-bet"
  );
}

/** Stagger + pausa antes do 1.º clique de aposta após abrir a mesa. */
function bridgeActionDelayMs(prevAction, action, context) {
  let delay = prevAction ? bridgeActionStaggerMs(prevAction, action, context) : 0;
  const baseSettle = GOG.MESA_FIRST_CLICK_SETTLE_MS ?? 3000;
  const settleMs = lastMesaTabReused ? Math.min(baseSettle, 1200) : baseSettle;
  if (
    isBettingClickTarget(action?.target) &&
    (prevAction?.target === "prepare-open" || prevAction == null)
  ) {
    delay += settleMs;
  }
  return delay;
}

async function runBridgePlan(payload, sourceTabId) {
  const clicks = (payload.actions || []).filter((a) => a.kind === "click");
  const singleFactor = payload.context?.singleFactorMode === true;
  let filtered = singleFactor
    ? clicks.filter((a) => a.target === "factor-1" || a.target === "prepare-open")
    : clicks;
  const hadPrepareOpen = filtered[0]?.target === "prepare-open";
  filtered = await filterClicksSkippingReadyPrepareOpen(filtered, payload.context);
  const results = [];

  if (hadPrepareOpen && filtered[0]?.target !== "prepare-open") {
    results.push({
      target: "prepare-open",
      ok: true,
      skipped: true,
      detail: "Mesa já aberta — foco directo no repetir/aposta",
    });
  }

  let cdpBarSettled = false;
  for (let i = 0; i < filtered.length; i++) {
    if (i > 0) {
      await sleep(bridgeActionDelayMs(filtered[i - 1], filtered[i], payload.context));
    } else if (isBettingClickTarget(filtered[0]?.target)) {
      const motorSettled =
        isGolde2fCrossingContext(payload.context) &&
        typeof payload.context?.betDelayUntilMs === "number";
      if (!motorSettled) {
        await sleep(bridgeFirstBetSettleMs(filtered[0]?.target));
      }
    }
    const action = filtered[i];
    const betting = isBettingClickTarget(action?.target);
    const result = await dispatchClickAction(action, payload.context, sourceTabId, {
      keepPlanSession: true,
      skipBetDelay: i > 0,
      // 1.º clique de aposta espera a barra «A depurar»; seguintes já têm CDP ligado.
      skipBarSettle: cdpBarSettled,
    });
    if (betting) cdpBarSettled = true;
    results.push(result);
  }
  await releaseCdpSession();

  if (filtered.length === 0 && payload.actions?.length) {
    results.push({
      target: "wait",
      ok: true,
      detail: payload.actions.map((a) => (a.kind === "wait" ? a.reason : "")).join("; "),
    });
  }

  await chrome.storage.local.set({ gogLastResults: results });
  return results;
}

async function waitForFibonacciRecoverySettle(context) {
  if (!isZoneFibonacciFamily(context)) return;
  const recovery = recoveryFromContext(context);
  if (recovery <= 0) return;
  const minUntil = Date.now() + FIBONACCI_RECOVERY_SETTLE_MS;
  const until =
    typeof context?.betDelayUntilMs === "number" && Number.isFinite(context.betDelayUntilMs)
      ? Math.max(context.betDelayUntilMs, minUntil)
      : minUntil;
  const waitMs = Math.max(0, until - Date.now());
  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

async function waitForCrossingBetDelay(context) {
  if (context?.strategy === "golde2fcruzamento") return;
  const candidates = [context?.betDelayUntilMs, context?.postResultHoldUntilMs].filter(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  if (candidates.length === 0) return;
  const until = Math.min(...candidates);
  const waitMs = Math.max(0, until - Date.now());
  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

async function waitForBetDelaySettle(context) {
  await waitForCrossingBetDelay(context);
  await waitForFibonacciRecoverySettle(context);
}

async function dispatchClickAction(action, context, sourceTabId, execOpts = {}) {
  if (action.target === "repeat-bet") {
    const targetTabId = await ensureMesaTab(context, sourceTabId);
    if (targetTabId == null) {
      return {
        target: action.target,
        ok: false,
        detail: "Mesa não aberta — calibre «Dobrar» e abra a mesa num separador",
      };
    }

    const dryRun = await isDryRun(context);
    if (execOpts?.skipBetDelay !== true) {
      await waitForBetDelaySettle(context);
    }

    if (targetTabId != null && context?.currentTableId != null) {
      registerMesaTab(context.currentTableId, targetTabId);
    }

    const label = action.label ?? "Dobrar";
    const clickResult = await executeRepeatBetOnTab(targetTabId, label, dryRun, {
      skipBarSettle: execOpts?.skipBarSettle === true,
      keepPlanSession: execOpts?.keepPlanSession === true,
    });

    return {
      target: action.target,
      betKey: "repeat",
      dryRun,
      mode: dryRun ? "demo" : "real",
      ...clickResult,
    };
  }

  if (action.target === "prepare-open") {
    const url = mesaUrlFromContext(context);
    if (!url) {
      return { target: action.target, ok: false, detail: "Sem URL da mesa no sinal" };
    }
    if (isLobbyPokerUrl(url)) {
      return {
        target: action.target,
        ok: true,
        skipped: true,
        detail: "Lobby poker ignorado — extensão só abre mesas de roleta",
      };
    }
    const tabId = await ensureMesaTab(context, sourceTabId);
    if (tabId != null && context?.currentTableId != null) {
      registerMesaTab(context.currentTableId, tabId);
    }
    return {
      target: action.target,
      ok: tabId != null,
      detail: tabId != null ? `Mesa aberta: ${url}` : `Falha ao abrir: ${url}`,
      tabId,
    };
  }

  const targetTabId = await ensureMesaTab(context, sourceTabId);
  if (targetTabId == null) {
    const label =
      context.currentTableId != null && Array.isArray(context.mesaCatalog)
        ? context.mesaCatalog.find((e) => e?.tableId === context.currentTableId)?.label
        : null;
    const catalogHasUrl =
      context.currentTableId != null &&
      Array.isArray(context.mesaCatalog) &&
      context.mesaCatalog.some((e) => e?.tableId === context.currentTableId && e?.url);
    return {
      target: action.target,
      ok: false,
      detail: label
        ? catalogHasUrl
          ? `Mesa ${label} não aberta — abra o link guardado num separador`
          : `Sem URL para ${label} — abra a mesa Playtech/Pragmatic num separador ou configure em Ferramentas da mesa`
        : "Mesa não encontrada — abra br4.bet.br/play/playtech num separador (mesma janela do Chrome)",
    };
  }

  const betKey =
    action.target === "factor-1"
      ? context.factor1BetKey
      : action.target === "factor-2"
        ? context.factor2BetKey
        : null;
  const label =
    action.target === "factor-1"
      ? context.factor1Label
      : action.target === "factor-2"
        ? context.factor2Label
        : action.label;

  if (!betKey) {
    return {
      target: action.target,
      ok: false,
      detail: "Sem chave de aposta (factor1BetKey) no sinal",
    };
  }

  const dryRun = await isDryRun(context);
  const signalId =
    typeof context.signalId === "string" && context.signalId.trim()
      ? context.signalId.trim()
      : null;

  const clickDedupeKey =
    signalId && (action.target === "factor-1" || action.target === "factor-2")
      ? `${signalId}:${action.target}`
      : null;
  const isGolde2fSignal =
    isGolde2fCrossingContext(context) &&
    typeof context?.signalId === "string" &&
    context.signalId.startsWith("golde2f:");
  if (clickDedupeKey && lastExecutedClickKeys.has(clickDedupeKey) && !isGolde2fSignal) {
    return {
      target: action.target,
      ok: true,
      detail: `Sinal ${signalId} (${action.target}) já executado — ignorado`,
      betKey,
      skipped: true,
      dryRun,
      mode: dryRun ? "demo" : "real",
    };
  }

  if (execOpts?.skipBetDelay !== true) {
    await waitForBetDelaySettle(context);
  }

  if (targetTabId != null && context?.currentTableId != null) {
    registerMesaTab(context.currentTableId, targetTabId);
  }

  const clickResult = await executeBetWithChip(
    targetTabId,
    String(betKey),
    String(label ?? betKey),
    dryRun,
    context,
    {
      skipBarSettle: execOpts?.skipBarSettle === true,
      keepPlanSession: execOpts?.keepPlanSession === true,
    },
  );

  if (clickResult.ok && clickDedupeKey && !isGolde2fSignal) {
    lastExecutedClickKeys.add(clickDedupeKey);
  }

  return {
    target: action.target,
    betKey,
    dryRun,
    mode: dryRun ? "demo" : "real",
    ...clickResult,
  };
}

async function registerMesaTab(tableId, tabId) {
  if (tableId == null || tabId == null) return;
  mesaTabByTableId.set(tableId, tabId);
}

async function scheduleCloseMesaTab(tableId, mesaUrl = null, options = {}) {
  const id = typeof tableId === "number" ? tableId : Number(tableId);
  if (!Number.isFinite(id)) {
    return { ok: false, detail: "tableId inválido" };
  }

  const force = options?.force === true;
  const prefs = await readBridgePrefs();
  if (!force && prefs.closeMesaOnFinish === false) {
    return { ok: true, skipped: true, detail: "Fechar mesa desactivado" };
  }

  if (bridgeInFlightKey) {
    await sleep(CLOSE_MESA_DELAY_MS);
  }

  const existing = mesaTabCloseTimers.get(id);
  if (existing) clearTimeout(existing);

  const resolvedUrl = mesaUrl;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      mesaTabCloseTimers.delete(id);
      void closeMesaTabNow(id, resolvedUrl).then(resolve);
    }, CLOSE_MESA_DELAY_MS);
    mesaTabCloseTimers.set(id, timer);
  });
}

globalThis.__singlestakeScheduleCloseMesaTab = scheduleCloseMesaTab;

async function resolveMesaTabIdForClose(tableId, mesaUrl) {
  const registered = mesaTabByTableId.get(tableId);
  if (registered != null) return registered;

  let targetUrl = mesaUrl;
  if (!targetUrl) {
    const stored = await chrome.storage.local.get(["gogLastContext"]);
    const catalog = stored.gogLastContext?.mesaCatalog;
    const entry = Array.isArray(catalog) ? catalog.find((e) => e?.tableId === tableId) : null;
    targetUrl = entry?.url ?? null;
  }

  if (targetUrl) {
    const tabs = await chrome.tabs.query({});
    const exact = tabs.find((t) => t.url && casinoPathsMatch(t.url, targetUrl));
    if (exact?.id != null) return exact.id;

    let mesa;
    try {
      mesa = new URL(targetUrl);
    } catch {
      mesa = null;
    }
    if (mesa) {
      const slug = mesa.pathname.split("/").filter(Boolean).pop();
      if (slug && slug.length > 2) {
        const bySlug = tabs.find(
          (t) => t.url && isCasinoPlayUrl(t.url) && t.url.toLowerCase().includes(slug.toLowerCase()),
        );
        if (bySlug?.id != null) return bySlug.id;
      }
    }
  }

  const tabs = await chrome.tabs.query({});
  const rouletteTab = tabs.find((t) => t.url && isGolde2fRoulettePageUrl(t.url));
  if (rouletteTab?.id != null) return rouletteTab.id;

  return null;
}

async function closeMesaTabNow(tableId, mesaUrl = null) {
  let tabId = await resolveMesaTabIdForClose(tableId, mesaUrl);
  mesaTabByTableId.delete(tableId);

  if (tabId == null) {
    return { ok: true, skipped: true, detail: `Sem separador registado para mesa ${tableId}` };
  }

  if (cdpAttach?.tabId === tabId) {
    await releaseCdpSession();
  }

  try {
    await chrome.tabs.remove(tabId);
    return { ok: true, tabId, tableId };
  } catch {
    return { ok: true, skipped: true, detail: `Separador ${tabId} já fechado` };
  }
}

async function getSavedChipForTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return null;
  const store = await readCalibrationStore();
  const { site } = lookupSiteCalib(store, tab.url);
  const chip = site?.chip ?? null;
  if (!chip) return null;
  if (chip.value === 50) return { ...chip, value: DEFAULT_CHIP_VALUE };
  return chip;
}

async function shouldClickChipBeforeBet() {
  const data = await chrome.storage.local.get("gogClickChipBeforeBet");
  return data.gogClickChipBeforeBet === true;
}

async function focusMesaTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const alreadyActive = tab.active === true;
    if (tab.windowId != null) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    if (!alreadyActive) {
      await chrome.tabs.update(tabId, { active: true });
    }
    // Sem sleep fixo — o atraso ~1s entre F1/F2/Dobrar vinha daqui + ensureMesaTab.
  } catch {
    /* tab closed */
  }
}

function rankResolvedPixels(savedCoord, pixels) {
  if (!pixels) return -1;
  let score = 0;
  if (savedCoord?.surface === "viewport") {
    if (pixels.isTop) score += 200;
    else score -= 100;
  }
  const hint = String(savedCoord?.frameHint || "").toLowerCase();
  if (hint && String(pixels.href || "").toLowerCase().includes(hint)) score += 150;
  if (pixels.pragmatic) score += 120;
  if (pixels.isTop) score += 20;
  return score;
}

/** Offset acumulado do iframe do jogo até ao topo do separador ICE (sem webNavigation). */
async function measureGameIframeOffsetFromTop(tabId, frameHref) {
  let host = "";
  try {
    host = new URL(frameHref || "https://local/").hostname.toLowerCase();
  } catch {
    host = "";
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (hostArg) => {
        function findOffset(doc, depth) {
          if (!doc || depth > 10) return null;
          const iframes = Array.from(doc.querySelectorAll("iframe"));
          for (const iframe of iframes) {
            const r = iframe.getBoundingClientRect();
            const src = (iframe.src || iframe.getAttribute("src") || "").toLowerCase();
            const isGame =
              (hostArg && src.includes(hostArg)) ||
              src.includes("pragmatic") ||
              src.includes("game") ||
              src.includes("launch") ||
              src.includes("casino");
            if (isGame && r.width * r.height > 40000) {
              return { left: r.left, top: r.top };
            }
            try {
              const childDoc = iframe.contentDocument;
              if (childDoc) {
                const inner = findOffset(childDoc, depth + 1);
                if (inner) {
                  return { left: r.left + inner.left, top: r.top + inner.top };
                }
              }
            } catch {
              if (isGame) return { left: r.left, top: r.top };
            }
          }
          let best = null;
          let area = 0;
          for (const iframe of iframes) {
            const r = iframe.getBoundingClientRect();
            const a = r.width * r.height;
            if (a > area) {
              area = a;
              best = { left: r.left, top: r.top };
            }
          }
          return best;
        }
        return findOffset(document, 0);
      },
      args: [host],
    });
    return results[0]?.result ?? null;
  } catch {
    return null;
  }
}

/** Converte clique no iframe do jogo para coordenadas absolutas do separador. */
async function computeTabAbsCoords(tabId, localX, localY, frameHref) {
  const lx = Number(localX);
  const ly = Number(localY);
  if (!Number.isFinite(lx) || !Number.isFinite(ly)) {
    return { x: Number(localX) || 0, y: Number(localY) || 0 };
  }

  let host = "";
  try {
    host = new URL(frameHref || "https://local/").hostname.toLowerCase();
  } catch {
    host = "";
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (x, y, hostArg, hrefArg) => {
        const href = String(hrefArg || "").toLowerCase();
        const here = location.href.toLowerCase();
        const h = String(hostArg || "").toLowerCase();
        const inTarget =
          (h && here.includes(h)) ||
          (href && (here === href || here.startsWith(href))) ||
          /pragmaticplay/i.test(here);
        if (!inTarget) return null;

        let tx = x;
        let ty = y;
        let win = window;
        let partial = false;
        for (let i = 0; i < 20 && win !== win.top; i++) {
          const fe = win.frameElement;
          if (!fe) {
            partial = true;
            break;
          }
          const r = fe.getBoundingClientRect();
          tx += r.left;
          ty += r.top;
          try {
            win = win.parent;
          } catch {
            partial = true;
            break;
          }
        }
        return { x: tx, y: ty, partial, href: location.href };
      },
      args: [lx, ly, host, frameHref || ""],
    });

    const hits = (results || [])
      .map((r) => r.result)
      .filter((h) => h && Number.isFinite(h.x) && Number.isFinite(h.y));

    const full = hits.find((h) => h.partial !== true);
    if (full) return { x: full.x, y: full.y };

    const off = await measureGameIframeOffsetFromTop(tabId, frameHref);
    if (off) return { x: lx + off.left, y: ly + off.top };

    if (hits[0]) return { x: hits[0].x, y: hits[0].y };
  } catch {
    /* fallback abaixo */
  }

  const off = await measureGameIframeOffsetFromTop(tabId, frameHref);
  if (off) return { x: lx + off.left, y: ly + off.top };
  return { x: lx, y: ly };
}

async function resolveSavedClickPixelsInTab(tabId, savedCoord) {
  if (!savedCoord) return null;

  if (savedCoord.tabX != null && savedCoord.tabY != null) {
    return {
      x: savedCoord.tabX,
      y: savedCoord.tabY,
      via: `tab-abs@${Math.round(savedCoord.tabX)},${Math.round(savedCoord.tabY)}`,
      href: savedCoord.frameHref || "",
      isTop: true,
      pragmatic: /pragmatic/i.test(String(savedCoord.frameHref || savedCoord.frameHint || "")),
    };
  }

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["exterior-bets.js"],
  });

  const frameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (saved) => window.__gogResolveSavedClickPixels?.(saved),
    args: [savedCoord],
  });

  const ranked = frameResults
    .map((r) => ({ frameId: r.frameId, pixels: r.result }))
    .filter((r) => r.pixels && r.pixels.x != null && r.pixels.y != null)
    .sort(
      (a, b) => rankResolvedPixels(savedCoord, b.pixels) - rankResolvedPixels(savedCoord, a.pixels),
    );

  if (ranked.length === 0) return null;

  const best = ranked[0];
  const tab = await computeTabAbsCoords(
    tabId,
    best.pixels.x,
    best.pixels.y,
    savedCoord.frameHref || "",
  );

  return {
    ...best.pixels,
    x: tab.x,
    y: tab.y,
    via: `${best.pixels.via} → tab(${Math.round(tab.x)},${Math.round(tab.y)})`,
  };
}

let cdpAttach = null;

chrome.debugger.onDetach.addListener((source) => {
  if (cdpAttach?.tabId === source.tabId) cdpAttach = null;
});

async function ensureCdpAttached(tabId) {
  if (cdpAttach?.tabId != null && cdpAttach.tabId !== tabId) {
    await releaseCdpSession();
  }
  if (cdpAttach?.tabId === tabId) return { ok: true };
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    cdpAttach = { tabId };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function releaseCdpSession() {
  if (cdpAttach?.tabId == null) return;
  try {
    await chrome.debugger.detach({ tabId: cdpAttach.tabId });
  } catch {
    /* ignore */
  }
  cdpAttach = null;
}

/** Clique real na viewport — fallback quando o clique no iframe falha. */
async function cdpViewportClick(tabId, x, y, keepSession = false) {
  const attach = await ensureCdpAttached(tabId);
  if (!attach.ok) {
    return {
      ok: false,
      detail: `Debugger: ${attach.detail} (feche DevTools nessa aba)`,
    };
  }

  const target = { tabId };
  try {
    await chrome.debugger.sendCommand(target, "Page.bringToFront");
    const px = Math.round(x);
    const py = Math.round(y);
    const base = { x: px, y: py, button: "left", clickCount: 1, buttons: 1 };

    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: px,
      y: py,
    });
    await sleep(10);
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...base,
    });
    await sleep(25);
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: px,
      y: py,
      button: "left",
      clickCount: 1,
      buttons: 0,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  } finally {
    if (!keepSession) await releaseCdpSession();
  }
}

async function tryContentScriptSavedClick(tabId, betKey, label, savedCoord, dryRun) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["exterior-bets.js"],
  });

  const frameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (key, lbl, dry, saved) => window.__gogExecuteExteriorBet?.(key, lbl, dry, saved),
    args: [betKey, label, dryRun, savedCoord],
  });

  const ranked = frameResults
    .map((r) => r.result)
    .filter((r) => r && r.ok && !r.skipped)
    .sort((a, b) => rankFrameResult(b) - rankFrameResult(a));

  return ranked[0] ?? null;
}

async function showClickMarkerOnTab(tabId, clientX, clientY, dryRun, kind) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["exterior-bets.js"],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (x, y, dry, k) => window.__gogShowClickMarkerAt?.(x, y, dry, k),
      args: [clientX, clientY, dryRun, kind],
    });
  } catch {
    /* tab closed */
  }
}

async function realClickSavedCoord(tabId, savedCoord, label, kind, options = {}) {
  const keepSession = options.keepSession === true;
  const pixels = await resolveSavedClickPixelsInTab(tabId, savedCoord);
  if (!pixels) {
    return {
      ok: false,
      detail: "Coord. gravada inválida — recalibre Par/Ímpar com a mesa aberta",
    };
  }

  if (!keepSession) await focusMesaTab(tabId);

  const cdpResult = await cdpViewportClick(tabId, pixels.x, pixels.y, keepSession);
  if (!cdpResult.ok) {
    return { ok: false, detail: `Clique real falhou: ${cdpResult.detail}` };
  }

  await showClickMarkerOnTab(tabId, pixels.x, pixels.y, false, kind ?? "bet");

  return {
    ok: true,
    method: "cdp",
    via: pixels.via,
    frame: pixels.href,
    detail: `Clique real · ${label} · ${pixels.via}`,
    dryRun: false,
  };
}

async function selectChipOnTab(tabId, dryRun, options = {}) {
  const keepSession = options.keepSession === true;
  const chip = await getSavedChipForTab(tabId);
  if (!chip) {
    return { ok: true, skipped: true, target: "chip", detail: "Sem ficha calibrada" };
  }

  if (!dryRun) {
    const cdpChip = await realClickSavedCoord(
      tabId,
      chip,
      `Ficha R$ ${chip.value ?? DEFAULT_CHIP_VALUE}`,
      "chip",
      { keepSession },
    );
    if (cdpChip.ok) {
      return {
        ...cdpChip,
        target: "chip",
        chipValue: chip.value ?? DEFAULT_CHIP_VALUE,
      };
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ["exterior-bets.js"],
      });
      const chipResults = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: (saved, dry) => window.__gogClickSavedChip?.(saved, dry),
        args: [chip, false],
      });
      const chipClick = chipResults.map((r) => r.result).find((r) => r?.ok);
      if (chipClick?.ok) {
        return { ...chipClick, target: "chip", chipValue: chip.value ?? DEFAULT_CHIP_VALUE };
      }
    } catch {
      /* ignore */
    }
    return {
      ...cdpChip,
      target: "chip",
      chipValue: chip.value ?? DEFAULT_CHIP_VALUE,
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => window.__gogClearVisualArtifacts?.(),
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["exterior-bets.js"],
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (saved, dry) => window.__gogClickSavedChip?.(saved, dry),
      args: [chip, dryRun],
    });

    const result = results[0]?.result ?? { ok: false, detail: "Sem resposta do clique na ficha" };
    return { ...result, target: "chip" };
  } catch (e) {
    return {
      ok: false,
      target: "chip",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

function stakeUnitsForContext(context, chip) {
  const recovery = recoveryFromContext(context);

  if (isGolde2fCrossingContext(context)) {
    const baseStake =
      typeof context?.baseStake === "number" && context.baseStake > 0 ? context.baseStake : 0.5;
    const units =
      typeof context?.units === "number" && Number.isFinite(context.units) && context.units > 0
        ? Math.max(1, Math.floor(context.units))
        : 1;
    const stakeAmount =
      typeof context?.stakeAmount === "number" && context.stakeAmount > 0
        ? context.stakeAmount
        : baseStake * units;
    const rawChip = chip?.value === 50 ? DEFAULT_CHIP_VALUE : chip?.value;
    const chipValue =
      typeof rawChip === "number" && rawChip > 0 ? rawChip : baseStake;
    return { stakeAmount, chipValue, units, recovery };
  }

  const rawChip = chip?.value === 50 ? DEFAULT_CHIP_VALUE : chip?.value;
  const chipValue =
    typeof rawChip === "number" && rawChip > 0
      ? rawChip
      : typeof context?.baseStake === "number" && context.baseStake > 0
        ? context.baseStake
        : DEFAULT_CHIP_VALUE;
  const explicitStake =
    typeof context?.stakeAmount === "number" && context.stakeAmount > 0
      ? context.stakeAmount
      : null;

  // Stake e recovery vêm da automação — extensão só traduz em cliques na ficha.
  if (explicitStake != null) {
    const stakeBase =
      typeof context?.baseStake === "number" && context.baseStake >= 1
        ? context.baseStake
        : explicitStake >= 1
          ? GOG.REAL_BASE_STAKE
          : chipValue;
    const units =
      chipValue > 0
        ? Math.max(1, Math.round(explicitStake / stakeBase))
        : 1;
    return { stakeAmount: explicitStake, chipValue, units, recovery };
  }

  const baseStake =
    typeof context?.baseStake === "number" && context.baseStake > 0
      ? context.baseStake
      : DEFAULT_CHIP_VALUE;
  const FIBONACCI_LEVELS = [1, 1, 2, 3, 5, 8, 13, 21];
  const stakeAmount = isZoneFibonacciFamily(context)
    ? baseStake * FIBONACCI_LEVELS[Math.min(recovery, FIBONACCI_LEVELS.length - 1)]
    : baseStake * 2 ** recovery;
  let units;
  if (isZoneFibonacciFamily(context) && Math.abs(chipValue - baseStake) < 0.001) {
    units = Math.max(1, FIBONACCI_LEVELS[Math.min(recovery, FIBONACCI_LEVELS.length - 1)]);
  } else if (Math.abs(chipValue - baseStake) < 0.001) {
    units = Math.max(1, 2 ** recovery);
  } else {
    units = chipValue > 0 ? Math.max(1, Math.ceil(stakeAmount / chipValue)) : 1;
  }
  return { stakeAmount, chipValue, units, recovery };
}

async function executeBetWithChip(tabId, betKey, label, dryRun, context, execOpts = {}) {
  const skipBarSettle = execOpts.skipBarSettle === true;
  const keepPlanSession = execOpts.keepPlanSession === true;
  let chipResult = {
    ok: true,
    skipped: true,
    target: "chip",
    detail: "Ficha já seleccionada (não clica)",
  };

  const cdpOpts = { keepSession: !dryRun };

  try {
    if (!dryRun) {
      await focusMesaTab(tabId);
      const attach = await ensureCdpAttached(tabId);
      if (!attach.ok) {
        return {
          ok: false,
          detail: `Debugger: ${attach.detail} — feche DevTools nessa aba`,
          chip: chipResult,
        };
      }
      // Barra «A depurar» reduz o viewport — calcular coords só depois dela aparecer.
      if (!skipBarSettle) {
        await sleep(CDP_BAR_SETTLE_MS);
      }
    }

    if (await shouldClickChipBeforeBet()) {
      chipResult = await selectChipOnTab(tabId, dryRun, cdpOpts);
      if (!dryRun && chipResult.ok && !chipResult.skipped) {
        const chipStagger = clickStaggerMsForContext(
          context ?? {},
          recoveryFromContext(context ?? {}),
        );
        await sleep(chipStagger);
      }
    }

    const chip = await getSavedChipForTab(tabId);
    const { stakeAmount, chipValue, units, recovery } = stakeUnitsForContext(context ?? {}, chip);
    const staggerMs = clickStaggerMsForContext(context ?? {}, recovery);
    const useDoubleGale = context?.useDoubleGale === true;
    const chipClicks = useDoubleGale
      ? 1
      : typeof context?.chipClicks === "number" && context.chipClicks > 0
        ? Math.max(1, Math.floor(context.chipClicks))
        : units;

    let clickResult = { ok: false, detail: "Aposta não executada" };
    for (let u = 0; u < chipClicks; u++) {
      if (u > 0) await sleep(staggerMs);
      clickResult = await executeExteriorBetOnTab(tabId, betKey, label, dryRun, cdpOpts);
      if (!clickResult.ok) break;
    }

    if (isGolde2fCrossingContext(context ?? {})) {
      const padUnits = useDoubleGale ? Math.max(1, units) : chipClicks;
      const padMs =
        typeof SinglestakeGolde2f?.ice2fPadFactorPlacementMs === "function"
          ? SinglestakeGolde2f.ice2fPadFactorPlacementMs(padUnits)
          : Math.max(0, (GOLDE2F_GALE3_REFERENCE_UNITS - padUnits) * (GOG.CROSSING_FACTOR_CLICK_STAGGER_MS ?? 150));
      if (padMs > 0) await sleep(padMs);
    }

    const recoveryNote = isZoneFibonacciFamily(context ?? {})
      ? recovery > 0
        ? ` · ${zoneFibStepLabel(context ?? {}, recovery)}`
        : ""
      : recovery > 0
        ? ` · gale ${recovery}`
        : "";
    const doubleNote =
      useDoubleGale && (context?.doubleClicks ?? 0) > 0
        ? ` · dobrar ×${context.doubleClicks}`
        : "";
    const stakeNote =
      units > 1
        ? ` · R$${stakeAmount} (${useDoubleGale ? `1 ficha→${units}u` : `${units}×`} R$${chipValue})${recoveryNote}${doubleNote}`
        : stakeAmount
          ? ` · R$${stakeAmount}${recoveryNote}${doubleNote}`
          : `${recoveryNote}${doubleNote}`;
    const chipNote =
      chipResult?.ok && !chipResult.skipped ? `Ficha R$${chipValue} → ` : "";

    return {
      ...clickResult,
      chip: chipResult,
      units,
      stakeAmount,
      detail: `${chipNote}${clickResult.detail ?? ""}${stakeNote}`,
    };
  } finally {
    if (!dryRun && !keepPlanSession) await releaseCdpSession();
  }
}

async function resolveMesaTabId(context, preferredTabId) {
  const mesaUrl = mesaUrlFromContext(context);
  const tableId = context?.currentTableId;
  if (tableId != null) {
    const registered = mesaTabByTableId.get(tableId);
    if (registered != null) {
      try {
        const regTab = await chrome.tabs.get(registered);
        if (regTab?.id != null && regTab.url && isCasinoPlayUrl(regTab.url)) {
          if (!mesaUrl || casinoPathsMatch(regTab.url, mesaUrl)) {
            return registered;
          }
        }
      } catch {
        mesaTabByTableId.delete(tableId);
      }
    }
  }

  const tabs = await chrome.tabs.query({});

  if (preferredTabId != null) {
    const pref = tabs.find((t) => t.id === preferredTabId);
    if (pref?.url && isCasinoPlayUrl(pref.url)) return preferredTabId;
  }

  if (mesaUrl) {
    let mesa;
    try {
      mesa = new URL(mesaUrl);
    } catch {
      mesa = null;
    }

    if (mesa) {
      const origin = mesa.origin;
      const pathname = mesa.pathname;

      const exact = tabs.find((t) => {
        if (!t.url) return false;
        try {
          const tu = new URL(t.url);
          return tu.origin === origin && tu.pathname === pathname;
        } catch {
          return false;
        }
      });
      if (exact?.id != null) return exact.id;

      const slug = pathname.split("/").filter(Boolean).pop();
      if (slug && slug.length > 2) {
        const bySlug = tabs.find((t) => t.url && t.url.includes(slug));
        if (bySlug?.id != null) return bySlug.id;
      }

      const reuseId = pickCasinoTabForNavigation(tabs, mesaUrl);
      if (reuseId != null) return reuseId;
    }
  }

  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = activeTabs[0];
  if (active?.id != null && active.url && isCasinoPlayUrl(active.url)) {
    return active.id;
  }

  const anyPlay = tabs.find((t) => t.url && isCasinoPlayUrl(t.url));
  if (anyPlay?.id != null) return anyPlay.id;

  return null;
}

function mesaUrlFromContext(context) {
  const tableId = context?.currentTableId;
  if (tableId != null && Array.isArray(context?.mesaCatalog)) {
    const entry = context.mesaCatalog.find((e) => e && e.tableId === tableId && e.url);
    if (entry?.url) return String(entry.url).trim();
  }
  return typeof context?.mesaEmbedUrl === "string" ? context.mesaEmbedUrl.trim() : null;
}

function casinoPathsMatch(tabUrl, targetUrl) {
  try {
    const a = new URL(tabUrl);
    const b = new URL(targetUrl);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch {
    return false;
  }
}

/** Separador do mesmo operador/provedor para reutilizar ao mudar de mesa. */
function pickCasinoTabForNavigation(tabs, mesaUrl) {
  if (!mesaUrl) return null;
  let mesa;
  try {
    mesa = new URL(mesaUrl);
  } catch {
    return null;
  }
  const provider =
    mesa.pathname.match(/\/play\/(playtech|pragmatic)\b/i)?.[1]?.toLowerCase() ?? null;
  if (!provider) return null;
  const seg = `/play/${provider}/`;
  const sameOrigin = tabs.filter((t) => {
    if (!t.url) return false;
    try {
      const u = new URL(t.url);
      return u.origin === mesa.origin && u.href.toLowerCase().includes(seg);
    } catch {
      return false;
    }
  });
  if (sameOrigin.length > 0) return sameOrigin[0].id;
  return null;
}

/** Último prepare-open reutilizou separador já aberto — settle mais curto antes da aposta. */
let lastMesaTabReused = false;

/** Separador registado para a mesa com URL correcta — não precisa de prepare-open. */
async function isMesaTabReadyForContext(context) {
  const tableId = context?.currentTableId;
  if (tableId == null) return false;
  const registered = mesaTabByTableId.get(tableId);
  if (registered == null) return false;
  const mesaUrl = mesaUrlFromContext(context);
  try {
    const tab = await chrome.tabs.get(registered);
    if (tab?.id == null || !tab.url || !isCasinoPlayUrl(tab.url)) return false;
    if (mesaUrl && !casinoPathsMatch(tab.url, mesaUrl)) return false;
    return true;
  } catch {
    mesaTabByTableId.delete(tableId);
    return false;
  }
}

/** Empate / mesa já aberta — salta prepare-open e foca o separador existente. */
async function filterClicksSkippingReadyPrepareOpen(clicks, context) {
  if (!clicks.length || clicks[0]?.target !== "prepare-open") return clicks;
  if (!(await isMesaTabReadyForContext(context))) return clicks;
  const tableId = context.currentTableId;
  const tabId = tableId != null ? mesaTabByTableId.get(tableId) : null;
  if (tabId != null) await focusMesaTab(tabId);
  lastMesaTabReused = true;
  return clicks.slice(1);
}

function bridgeFirstBetSettleMs(firstTarget) {
  const baseSettle = GOG.MESA_FIRST_CLICK_SETTLE_MS ?? 3000;
  if (!lastMesaTabReused) return baseSettle;
  if (firstTarget === "repeat-bet") return 400;
  return Math.min(baseSettle, 1200);
}

/** Activa separador da mesa ou navega para o URL correcto do catálogo. */
async function ensureMesaTab(context, preferredTabId) {
  const url = mesaUrlFromContext(context);
  lastMesaTabReused = false;

  let tabId = await resolveMesaTabId(context, preferredTabId);

  if (tabId != null && url) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !casinoPathsMatch(tab.url, url)) {
        await chrome.tabs.update(tabId, { url, active: true });
        await sleep(4500);
        const after = await chrome.tabs.get(tabId);
        if (after.url && !casinoPathsMatch(after.url, url)) {
          tabId = await openMesaTabAndWait(url);
          return tabId;
        }
        return tabId;
      }
      await chrome.tabs.update(tabId, { active: true });
      lastMesaTabReused = true;
      return tabId;
    } catch {
      tabId = null;
    }
  }

  if (tabId != null) {
    await chrome.tabs.update(tabId, { active: true });
    lastMesaTabReused = true;
    return tabId;
  }

  if (url) {
    tabId = await openMesaTabAndWait(url);
  }

  return tabId;
}

function isCasinoPlayUrl(url) {
  return isGolde2fRoulettePageUrl(url);
}

function isLobbyPokerUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /\/play\/pragmatic\/poker\/?$/i.test(u.pathname);
  } catch {
    return /\/poker\/?$/i.test(url);
  }
}

/** Prefer iframe Pragmatic/Playtech sobre a shell do operador (br4.bet). */
function rankFrameResult(result) {
  const href = String(result?.href || result?.frame || "").toLowerCase();
  let bonus = 0;
  if (href.includes("pragmaticplaylive.net")) bonus += 100;
  else if (href.includes("playtech")) bonus += 80;
  else if (/\/play\/(pragmatic|playtech)\//.test(href)) bonus += 20;
  else if (href.includes("br4.bet.br")) bonus -= 50;
  if (result?.method === "canvas") bonus += 15;
  if (result?.method === "saved") bonus += 120;
  if (result?.method === "saved" && result?.isTop === true) bonus += 40;
  return (result?.score ?? 0) + bonus;
}

async function openMesaTabAndWait(url) {
  const tab = await chrome.tabs.create({ url, active: true });
  await sleep(4000);
  return tab.id ?? null;
}

async function executeExteriorBetOnTab(tabId, betKey, label, dryRun, options = {}) {
  const keepSession = options.keepSession === true;
  try {
    const savedCoord = await getSavedCoordForTab(tabId, betKey);
    const hasSaved = savedCoord != null && savedCoord.x != null && savedCoord.y != null;

    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => window.__gogClearVisualArtifacts?.(),
    });

    if (hasSaved && !dryRun) {
      // Canvas/WebGL ignora eventos sintéticos — CDP envia clique real ao SO.
      const cdpClick = await realClickSavedCoord(tabId, savedCoord, label ?? betKey, "bet", {
        keepSession,
      });
      if (cdpClick.ok) {
        return {
          ok: true,
          detail: cdpClick.detail,
          method: cdpClick.method,
          frame: cdpClick.frame,
          dryRun: false,
          framesMatched: 1,
        };
      }
      const domClick = await tryContentScriptSavedClick(tabId, betKey, label ?? betKey, savedCoord, false);
      return {
        ok: domClick?.ok === true,
        detail: domClick?.detail ?? cdpClick.detail,
        method: domClick?.method ?? "saved-fallback",
        frame: domClick?.href ?? cdpClick.frame,
        dryRun: false,
        framesMatched: domClick?.ok ? 1 : 0,
      };
    }

    const injectTarget = hasSaved ? { tabId } : { tabId, allFrames: true };

    await chrome.scripting.executeScript({
      target: injectTarget,
      files: ["exterior-bets.js"],
    });

    const frameResults = await chrome.scripting.executeScript({
      target: injectTarget,
      func: (key, lbl, dry, saved) => window.__gogExecuteExteriorBet?.(key, lbl, dry, saved),
      args: [betKey, label, dryRun, savedCoord],
    });

    const ranked = frameResults
      .map((r) => r.result)
      .filter((r) => r && r.ok && !r.skipped)
      .sort((a, b) => rankFrameResult(b) - rankFrameResult(a));

    if (ranked.length === 0) {
      const tried = frameResults.map((r) => r.result).filter(Boolean);
      return {
        ok: false,
        detail: `«${betKey}» não encontrado (${tried.length} frames)`,
        frameResults: tried.slice(0, 5),
      };
    }

    const best = ranked[0];
    return {
      ok: true,
      detail: best.detail,
      score: best.score,
      frame: best.href,
      dryRun: best.dryRun,
      framesMatched: ranked.length,
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function testExteriorBet(tabId, betKey, label, modeOverride) {
  const dryRun =
    modeOverride === "real" ? false : modeOverride === "demo" ? true : await isDryRun(null);

  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const preferredId = tabId ?? activeTabs[0]?.id ?? null;
  let id = await resolveMesaTabId({ mesaEmbedUrl: null, mesaProvider: null }, preferredId);
  if (id == null) {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeUrl = activeTabs[0]?.url ?? "";
    return {
      ok: false,
      detail: `Separador activo não é a mesa (${activeUrl.slice(0, 60)}…). Clique na aba da roleta e teste de novo.`,
      betKey,
      mode: dryRun ? "demo" : "real",
    };
  }

  const result = await executeBetWithChip(id, betKey, label ?? betKey, dryRun, {});
  await chrome.storage.local.set({
    gogLastTest: {
      at: new Date().toISOString(),
      betKey,
      mode: dryRun ? "demo" : "real",
      tabId: id,
      ...result,
    },
  });
  return { ...result, mode: dryRun ? "demo" : "real", tabId: id };
}

async function scanExteriorBets(tabId) {
  const id = await resolveMesaTabId({ mesaEmbedUrl: null, mesaProvider: null }, tabId);
  if (id == null) {
    return { ok: false, detail: "Abra Roulette 3 no GoldeBet num separador e aguarde carregar." };
  }

  await chrome.scripting.executeScript({
    target: { tabId: id, allFrames: true },
    files: ["exterior-bets.js"],
  });

  const frameResults = await chrome.scripting.executeScript({
    target: { tabId: id, allFrames: true },
    func: () => window.__gogScanExteriorBets?.(),
  });

  const scans = frameResults.map((r) => r.result).filter(Boolean);
  await chrome.storage.local.set({ gogLastScan: { at: new Date().toISOString(), scans } });
  return { ok: true, scans };
}

const CALIB_STORAGE_KEY = "gogBetCalibration";
const CALIB_EXPORT_KIND = "singlestake-ext-calibration";

function betGroupFromKey(betKey) {
  if (betKey === "odd" || betKey === "even") return "paridade";
  if (betKey === "red" || betKey === "black") return "cor";
  if (betKey === "low" || betKey === "high") return "altura";
  if (betKey.startsWith("doz:")) return "duzias";
  if (betKey.startsWith("col:")) return "colunas";
  if (betKey === "repeat") return "repetir";
  return null;
}

async function executeRepeatBetOnTab(tabId, label, dryRun, execOpts = {}) {
  const skipBarSettle = execOpts.skipBarSettle === true;
  const keepPlanSession = execOpts.keepPlanSession === true;
  const cdpOpts = { keepSession: !dryRun };
  try {
    if (!dryRun) {
      await focusMesaTab(tabId);
      const attach = await ensureCdpAttached(tabId);
      if (!attach.ok) {
        return {
          ok: false,
          detail: `Debugger: ${attach.detail} — feche DevTools nessa aba`,
        };
      }
      if (!skipBarSettle) await sleep(CDP_BAR_SETTLE_MS);
    }

    const clickResult = await executeExteriorBetOnTab(tabId, "repeat", label, dryRun, cdpOpts);
    return {
      ...clickResult,
      detail: clickResult.detail
        ? `Dobrar · ${clickResult.detail}`
        : "Dobrar não executado — calibre 📍 Dobrar no popup",
    };
  } finally {
    if (!dryRun && !keepPlanSession) await releaseCdpSession();
  }
}

async function exportCalibration() {
  const stored = await chrome.storage.local.get(["gogBetCalibration", "gogClickChipBeforeBet"]);
  const bridgePrefs = await readBridgePrefs();
  return {
    ok: true,
    payload: {
      kind: CALIB_EXPORT_KIND,
      version: 2,
      exportedAt: new Date().toISOString(),
      calibration: stored.gogBetCalibration ?? { version: 2, sites: {} },
      prefs: {
        clickChipBeforeBet: stored.gogClickChipBeforeBet === true,
        chipUnitValue: DEFAULT_CHIP_VALUE,
        maxRecovery: bridgePrefs.maxRecovery,
        wins: bridgePrefs.wins,
        losses: bridgePrefs.losses,
      },
    },
  };
}

async function importCalibration(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, detail: "Ficheiro inválido" };
  }

  let calibration = raw.calibration ?? raw;
  if (raw.kind === CALIB_EXPORT_KIND && raw.calibration) {
    calibration = raw.calibration;
  }

  if (!calibration.sites || typeof calibration.sites !== "object") {
    return { ok: false, detail: "Sem sites de calibração no ficheiro" };
  }

  const store = {
    version: 2,
    sites: calibration.sites,
  };

  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const toSet = { [CALIB_STORAGE_KEY]: store };
  if (typeof prefs.clickChipBeforeBet === "boolean") {
    toSet.gogClickChipBeforeBet = prefs.clickChipBeforeBet;
  }
  if (prefs.maxRecovery != null || prefs.wins != null || prefs.losses != null) {
    await writeBridgePrefs({
      maxRecovery: prefs.maxRecovery,
      wins: prefs.wins,
      losses: prefs.losses,
    });
  }

  await chrome.storage.local.set(toSet);

  const siteCount = Object.keys(store.sites).length;
  const betCount = Object.values(store.sites).reduce(
    (n, site) => n + Object.keys(site?.bets ?? {}).length,
    0,
  );

  return {
    ok: true,
    detail: `Importado: ${siteCount} mesa(s), ${betCount} aposta(s)`,
    siteCount,
    betCount,
  };
}

function siteKeyFromUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "goldebet.bet.br" || host.endsWith(".goldebet.bet.br")) {
      return GOLDE2F_CALIB_SITE_KEY;
    }

    const m = u.pathname.match(/\/play\/(pragmatic|playtech)\//i);
    if (m) return `${host}|/play/${m[1].toLowerCase()}/`;

    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${host}|${path}`;
  } catch {
    return "unknown";
  }
}

function lookupAnyIceCalib(store) {
  const sites = store?.sites ?? {};
  if (sites[GOLDE2F_CALIB_SITE_KEY]) {
    return { siteKey: GOLDE2F_CALIB_SITE_KEY, site: sites[GOLDE2F_CALIB_SITE_KEY] };
  }
  for (const [key, site] of Object.entries(sites)) {
    if (/ice\.bet\.br/i.test(key)) return { siteKey: key, site };
  }
  return { siteKey: GOLDE2F_CALIB_SITE_KEY, site: null };
}

/** Resolve calibração mesmo com chaves antigas (www vs apex, pathname antes/depois do redirect). */
function lookupSiteCalib(store, url) {
  const siteKey = siteKeyFromUrl(url);
  const sites = store?.sites ?? {};
  if (sites[siteKey]) return { siteKey, site: sites[siteKey] };

  if (isGolde2fHost(url)) {
    for (const [key, site] of Object.entries(sites)) {
      if (/ice\.bet\.br/i.test(key)) return { siteKey: key, site };
    }
    if (sites[GOLDE2F_CALIB_SITE_KEY]) return { siteKey: GOLDE2F_CALIB_SITE_KEY, site: sites[GOLDE2F_CALIB_SITE_KEY] };
  }

  return { siteKey, site: null };
}

function frameHintFromHref(href) {
  try {
    return new URL(href).hostname;
  } catch {
    return String(href || "").slice(0, 80);
  }
}

async function readCalibrationStore() {
  const data = await chrome.storage.local.get(CALIB_STORAGE_KEY);
  return data[CALIB_STORAGE_KEY] ?? { version: 1, sites: {} };
}

async function applyTabAbsCoords(tabId, entry, frameHref, clientX, clientY) {
  if (!entry || clientX == null || clientY == null) return entry;
  try {
    const tab = await computeTabAbsCoords(tabId, clientX, clientY, frameHref);
    entry.tabX = Math.round(tab.x);
    entry.tabY = Math.round(tab.y);
  } catch {
    /* mantém coords relativas */
  }
  return entry;
}

async function getSavedCoordForTab(tabId, betKey) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return null;
  const store = await readCalibrationStore();
  const { site } = lookupSiteCalib(store, tab.url);
  return site?.bets?.[betKey] ?? null;
}

/** Evita gravação duplicada (pointerdown + click). */
let calibrationSaveLock = null;

async function saveCalibrationClick(message, tabId) {
  try {
  tabId =
    tabId ??
    (typeof message.tabId === "number" ? message.tabId : null) ??
    null;
  if (!tabId) {
    const armed = (await chrome.storage.local.get("gogCalibrationArmed")).gogCalibrationArmed;
    tabId = armed?.tabId ?? null;
  }
  if (!tabId) {
    return { ok: false, detail: "Separador desconhecido — clique na aba da mesa primeiro" };
  }

  const lockKey = `${tabId}:${message.betKey}`;
  if (
    calibrationSaveLock &&
    calibrationSaveLock.key === lockKey &&
    Date.now() - calibrationSaveLock.at < 4000
  ) {
    return { ok: true, detail: "Já gravado", skipped: true };
  }
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return { ok: false, detail: "URL do separador indisponível" };

  const betKey = message.betKey;
  const coord = message.coord;
  if (!betKey || !coord || coord.x == null || coord.y == null) {
    return { ok: false, detail: "Coordenadas inválidas" };
  }

  const siteKey = isGolde2fHost(tab.url) ? GOLDE2F_CALIB_SITE_KEY : siteKeyFromUrl(tab.url);
  const store = await readCalibrationStore();
  if (!store.sites) store.sites = {};
  if (!store.sites[siteKey]) {
    store.sites[siteKey] = { label: siteKey, bets: {}, updatedAt: null };
  }

  if (siteKey === GOLDE2F_CALIB_SITE_KEY && isGolde2fHost(tab.url)) {
    for (const [legacyKey, legacySite] of Object.entries({ ...store.sites })) {
      if (legacyKey === siteKey || !/ice\.bet\.br/i.test(legacyKey)) continue;
      const target = store.sites[siteKey];
      target.bets = { ...legacySite.bets, ...target.bets };
      if (!target.chip && legacySite.chip) target.chip = legacySite.chip;
      delete store.sites[legacyKey];
    }
  }

  let detail;

  if (betKey === "chip") {
    const armed = (await chrome.storage.local.get("gogCalibrationArmed")).gogCalibrationArmed;
    const chipValue = Number(message.chipValue ?? armed?.chipValue) || DEFAULT_CHIP_VALUE;
    store.sites[siteKey].chip = {
      x: coord.x,
      y: coord.y,
      surface: coord.surface || "viewport",
      value: chipValue,
      frameHint: frameHintFromHref(message.frameHref),
      frameHref: message.frameHref,
      at: new Date().toISOString(),
    };
    await applyTabAbsCoords(
      tabId,
      store.sites[siteKey].chip,
      message.frameHref,
      message.clickClientX,
      message.clickClientY,
    );
    detail = `Ficha R$ ${chipValue} gravada (${Math.round(coord.x * 100)}%, ${Math.round(coord.y * 100)}%)`;
  } else {
    const group = betGroupFromKey(betKey);
    store.sites[siteKey].bets[betKey] = {
      x: coord.x,
      y: coord.y,
      surface: coord.surface || "canvas",
      group,
      frameHint: frameHintFromHref(message.frameHref),
      frameHref: message.frameHref,
      at: new Date().toISOString(),
    };
    await applyTabAbsCoords(
      tabId,
      store.sites[siteKey].bets[betKey],
      message.frameHref,
      message.clickClientX,
      message.clickClientY,
    );
    const groupLabel =
      group === "cor"
        ? "cor"
        : group === "altura"
          ? "altura"
          : group === "paridade"
            ? "paridade"
            : group === "duzias"
              ? "dúzia"
              : group === "colunas"
                ? "coluna"
                : group === "repetir"
                  ? "repetir/dobrar"
                  : "";
    detail = `${message.label || betKey} gravado${groupLabel ? ` (${groupLabel})` : ""} (${Math.round(coord.x * 100)}%, ${Math.round(coord.y * 100)}%)`;
  }
  store.sites[siteKey].updatedAt = new Date().toISOString();

  await chrome.storage.local.set({
    [CALIB_STORAGE_KEY]: store,
    gogCalibrationArmed: null,
    gogLastCalibSave: {
      ok: true,
      siteKey,
      betKey,
      tabId,
      tabUrl: tab.url,
      tabX: store.sites[siteKey].bets?.[betKey]?.tabX ?? store.sites[siteKey].chip?.tabX ?? null,
      tabY: store.sites[siteKey].bets?.[betKey]?.tabY ?? store.sites[siteKey].chip?.tabY ?? null,
      at: new Date().toISOString(),
    },
  });

  calibrationSaveLock = { key: lockKey, at: Date.now() };

  await disarmCalibration(tabId);

  return {
    ok: true,
    detail,
    siteKey,
    betKey,
  };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function clearCalibration(siteKey) {
  const store = await readCalibrationStore();
  if (siteKey && store.sites?.[siteKey]) {
    delete store.sites[siteKey];
  } else if (!siteKey) {
    store.sites = {};
  }
  await chrome.storage.local.set({ [CALIB_STORAGE_KEY]: store });
  return { ok: true, detail: "Calibração apagada" };
}

async function countCalibrationActiveFrames(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => Boolean(window.__gogCalibrationInteractive || window.__gogCalibrationActive),
    });
    return results.filter((r) => r.result === true).length;
  } catch {
    return 0;
  }
}

/** Prefer frames que realmente capturam o clique (não só tint no shell ICE). */
async function countCalibrationInteractiveFrames(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => Boolean(window.__gogCalibrationInteractive),
    });
    return results.filter((r) => r.result === true).length;
  } catch {
    return 0;
  }
}

async function disarmCalibration(tabId) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        if (typeof window.__gogStopCalibrationOverlay === "function") {
          window.__gogStopCalibrationOverlay();
        } else if (typeof window.__gogStopCalibration === "function") {
          window.__gogStopCalibration();
        }
        document.getElementById("gog-ext-cal-root")?.remove();
        document.getElementById("gog-ext-cal-banner")?.remove();
        document.getElementById("gog-ext-cal-cancel")?.remove();
        window.__gogCalibrationActive = false;
        window.__gogCalibrationInteractive = false;
      },
    });
  } catch {
    /* tab closed */
  }
}

async function findIceCalibrationTabId(preferredId) {
  const tabs = await chrome.tabs.query({});
  const scored = [];
  for (const t of tabs) {
    if (t.id == null || !t.url) continue;
    if (/^(chrome|chrome-extension|edge|about):/i.test(t.url)) continue;
    if (isGolde2fRoulettePageUrl(t.url)) scored.push({ id: t.id, score: 5, url: t.url });
    else if (isGolde2fHost(t.url)) scored.push({ id: t.id, score: 4, url: t.url });
    else if (/pragmaticplaylive\.net|pragmaticplay\.net/i.test(t.url)) {
      scored.push({ id: t.id, score: 2, url: t.url });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  if (preferredId != null && scored.some((s) => s.id === preferredId)) return preferredId;

  // Preferir aba activa numa janela normal (não o painel popup da extensão).
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
  for (const w of windows) {
    const active = (w.tabs || []).find((t) => t.active && t.id != null);
    if (active?.id != null && scored.some((s) => s.id === active.id)) return active.id;
  }
  return scored[0]?.id ?? null;
}

async function probeCalibrationFrames(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => ({
        href: String(location.href || "").slice(0, 120),
        host: location.hostname,
        active: Boolean(window.__gogCalibrationActive),
        interactive: Boolean(window.__gogCalibrationInteractive),
        hasMount: typeof window.__gogMountCalibrationOverlay === "function",
        hasBody: Boolean(document.body),
      }),
    });
    return results.map((r) => r.result).filter(Boolean);
  } catch (e) {
    return [{ error: e instanceof Error ? e.message : String(e) }];
  }
}

async function armCalibration(betKey, label, chipValue) {
  // preferredId: ignorar o painel da extensão (janela popup).
  let preferredId = null;
  try {
    const normalWins = await chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
    for (const w of normalWins) {
      const active = (w.tabs || []).find((t) => t.active && t.url && !/^chrome-extension:/i.test(t.url));
      if (active?.id != null && (isGolde2fHost(active.url) || /pragmaticplay/i.test(active.url || ""))) {
        preferredId = active.id;
        break;
      }
    }
  } catch {
    preferredId = null;
  }

  let tabId = await findIceCalibrationTabId(preferredId);
  if (tabId == null) {
    tabId = await resolveMesaTabId(
      {
        mesaEmbedUrl:
          (typeof SinglestakeGolde2f !== "undefined" && SinglestakeGolde2f.GOLDE2F_MESA_URL) ||
          "https://goldebet.bet.br/play/pragmatic/roulette-3",
        mesaProvider: null,
        currentTableId: GOLDE2F_DEFAULT_TABLE_ID,
      },
      preferredId,
    );
  }

  if (tabId == null) {
    return {
      ok: false,
      detail:
        "Nenhuma aba GoldeBet encontrada. Abra Roulette 3 no GoldeBet num separador normal do Chrome (não neste painel).",
    };
  }

  const resolvedChipValue = betKey === "chip" ? Number(chipValue) || DEFAULT_CHIP_VALUE : null;
  const resolvedLabel =
    label ??
    (betKey === "chip" ? `Ficha R$ ${resolvedChipValue}` : betKey);

  await disarmCalibration(tabId);

  await chrome.storage.local.set({
    gogCalibrationArmed: {
      betKey,
      label: resolvedLabel,
      tabId,
      chipValue: resolvedChipValue,
      at: new Date().toISOString(),
    },
  });

  async function injectAndMount(forceInteractive) {
    // Garante content-casino (mount) em todos os frames acessíveis.
    await chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        files: ["content-casino.js"],
      })
      .catch(() => {});

    await chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        files: ["calibration-relay.js"],
      })
      .catch(() => {});

    const mounted = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (bk, lb, tid, force) => {
        const host = location.hostname || "";
        const isPrag = /pragmaticplaylive\.net|pragmaticplay\.net/i.test(host);
        const isIce = /ice\.bet\.br/i.test(host);
        const hasCanvas = Boolean(document.querySelector("canvas"));
        const hasIframe = Boolean(document.querySelector("iframe"));
        // Shell ICE: tint sem capturar. Pragmatic/canvas/force: captura clique.
        const interactive =
          force === true || isPrag || hasCanvas || (isIce && !hasIframe) || window !== window.top;

        if (typeof window.__gogMountCalibrationOverlay === "function") {
          const ok = window.__gogMountCalibrationOverlay({
            betKey: bk,
            label: lb,
            tabId: tid,
            interactive,
          });
          return { ok: ok === true, host, interactive, via: "mount" };
        }

        // Fallback mínimo se o content script não carregou.
        const mount = document.body || document.documentElement;
        if (!mount) return { ok: false, host, reason: "no-body" };
        document.getElementById("gog-ext-cal-root")?.remove();
        const root = document.createElement("div");
        root.id = "gog-ext-cal-root";
        root.style.cssText =
          "position:fixed;inset:0;z-index:2147483646;background:rgba(37,99,235,0.55);pointer-events:" +
          (interactive ? "auto" : "none");
        const banner = document.createElement("div");
        banner.id = "gog-ext-cal-banner";
        banner.style.cssText =
          "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:12px 16px;border-radius:10px;background:#0f172a;color:#dbeafe;font:700 13px system-ui;pointer-events:none;border:2px solid #60a5fa";
        banner.textContent = `Calibrar: ${lb}`;
        mount.append(root, banner);
        window.__gogCalibrationActive = true;
        window.__gogCalibrationInteractive = interactive;
        return { ok: true, host, interactive, via: "fallback" };
      },
      args: [betKey, resolvedLabel, tabId, forceInteractive === true],
    });
    return mounted.map((r) => r.result).filter(Boolean);
  }

  try {
    let results = await injectAndMount(false);
    let okCount = results.filter((r) => r?.ok).length;
    let interactiveCount = results.filter((r) => r?.ok && r.interactive).length;

    if (okCount === 0) {
      await sleep(1200);
      results = await injectAndMount(false);
      okCount = results.filter((r) => r?.ok).length;
      interactiveCount = results.filter((r) => r?.ok && r.interactive).length;
    }
    if (okCount === 0) {
      await sleep(2000);
      results = await injectAndMount(true);
      okCount = results.filter((r) => r?.ok).length;
      interactiveCount = results.filter((r) => r?.ok && r.interactive).length;
    }

    if (okCount === 0) {
      const probe = await probeCalibrationFrames(tabId);
      await chrome.storage.local.set({ gogCalibrationArmed: null });
      const hosts = probe.map((p) => p?.host || p?.error || "?").slice(0, 8).join(", ");
      return {
        ok: false,
        detail: `Falha ao pintar overlay. Frames: ${hosts || "inacessíveis"}. Recarregue a aba da roleta (F5) e a extensão.`,
        tabId,
        probe,
        results,
      };
    }

    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
    } catch {
      /* ignore */
    }

    return {
      ok: true,
      detail:
        interactiveCount > 0
          ? `Overlay AZUL activo — clique em ${resolvedLabel} no tapete`
          : `Overlay AZUL no ICE — se o clique não gravar, aguarde o jogo carregar e clique 📍 outra vez`,
      tabId,
      frames: okCount,
      interactive: interactiveCount,
    };
  } catch (e) {
    await chrome.storage.local.set({ gogCalibrationArmed: null });
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

SinglestakeGolde2fSignalRunner.initGolde2fSignalRunner(handleBridgePayload);
