importScripts("shared.js", "um-fator-engine.js", "dga-hub.js", "signal-runner.js");

const CLICK_STAGGER_MS = 450;
const DEFAULT_CHIP_VALUE = 0.5;
const FIBONACCI_RECOVERY_SETTLE_MS = GOG.FIBONACCI_RECOVERY_SETTLE_MS ?? 5000;
/** Espera a barra «A depurar» estabilizar o viewport antes de calcular coordenadas. */
const CDP_BAR_SETTLE_MS = 220;

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

chrome.runtime.onInstalled.addListener(() => {
  void setStoredMode(GOG.DEFAULT_MODE);
  void chrome.storage.local.set({
    gogAutopilotEnabled: false,
    [STORAGE_BRIDGE_ENABLED]: true,
  });
  void ensureContentBridgeOnAppTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureContentBridgeOnAppTabs();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isSinglestakeAppUrl(tab.url)) {
    void ensureContentBridgeOnTab(tabId);
  }
});

function isSinglestakeAppUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) return true;
    if (isAppProductionHostname(u.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

async function ensureContentBridgeOnTab(tabId) {
  try {
    const live = await chrome.tabs
      .sendMessage(tabId, { kind: "bridge-ping" })
      .then((r) => r?.ok === true)
      .catch(() => false);
    if (live) return;

    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          delete globalThis.__singlestakeContentBridgeLoaded;
          delete document.documentElement.dataset.singlestakeExtension;
        } catch {
          /* ignore */
        }
      },
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-bridge.js"],
    });
  } catch {
    /* aba restrita ou sem permissão */
  }
}

async function ensureContentBridgeOnAppTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id != null && isSinglestakeAppUrl(tab.url)) {
      await ensureContentBridgeOnTab(tab.id);
    }
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[GOG.STORAGE_MODE]) {
    updateActionBadge(changes[GOG.STORAGE_MODE].newValue === "real" ? "real" : "demo");
  }
});

void readStoredMode().then(updateActionBadge);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.kind === "bridge-from-page") {
    const payload = normalizeBridgePayload(message.payload);
    if (!payload) {
      sendResponse({ ok: false, error: "Payload inválido" });
      return;
    }
    void readBridgeEnabled().then((on) => {
      if (!on) {
        sendResponse({
          ok: true,
          results: [
            {
              target: "bridge",
              ok: true,
              skipped: true,
              detail: "Extensão desligada — active «Ligar» no popup",
            },
          ],
        });
        return;
      }
      void handleBridgePayload(payload, sender.tab?.id ?? null).then(sendResponse);
    });
    return true;
  }

  if (message.kind === "set-bridge-enabled") {
    const enabled = message.enabled === true;
    void chrome.storage.local.set({ [STORAGE_BRIDGE_ENABLED]: enabled }).then(async () => {
      await ensureContentBridgeOnAppTabs();
      sendResponse({ ok: true, enabled });
    });
    return true;
  }

  if (message.kind === "set-mode") {
    const mode = message.mode === "real" ? "real" : "demo";
    void setStoredMode(mode).then(() => sendResponse({ ok: true, mode }));
    return true;
  }

  if (message.kind === "get-status") {
    void buildStatus().then(sendResponse);
    return true;
  }

  if (message.kind === "set-autopilot") {
    void SinglestakeSignalRunner.setAutopilotEnabled(message.enabled === true).then(() =>
      SinglestakeSignalRunner.getAutopilotStatus().then(sendResponse),
    );
    return true;
  }

  if (message.kind === "get-autopilot") {
    void SinglestakeSignalRunner.getAutopilotStatus().then(sendResponse);
    return true;
  }

  if (message.kind === "reset-autopilot-stats") {
    void SinglestakeSignalRunner.resetAutopilotStats().then(sendResponse);
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
    void readStoredMode().then((mode) => sendResponse({ ok: true, lastBridge, mode }));
    return true;
  }

  if (message.kind === "arm-calibration") {
    void armCalibration(message.betKey, message.label, message.chipValue).then(sendResponse);
    return true;
  }

  if (message.kind === "calibration-click") {
    void saveCalibrationClick(message, sender.tab?.id ?? null).then(sendResponse);
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

const DEFAULT_BRIDGE_PREFS = { maxRecovery: 5, wins: 0, losses: 0, closeMesaOnFinish: true };

function clampBridgeMaxRecovery(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BRIDGE_PREFS.maxRecovery;
  return Math.min(6, Math.max(0, Math.floor(n)));
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
  ]);
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const siteKey = activeTabs[0]?.url ? siteKeyFromUrl(activeTabs[0].url) : null;
  const siteCalib = siteKey ? stored.gogBetCalibration?.sites?.[siteKey] : null;
  const autopilot = await SinglestakeSignalRunner.getAutopilotStatus();
  const dgaConfig = await SinglestakeSignalRunner.getDgaConfigForPopup();
  const bridgePrefs = await readBridgePrefs();
  const bridgeEnabled = await readBridgeEnabled();
  return {
    ok: true,
    mode,
    bridgeEnabled,
    autopilot,
    dgaConfig,
    bridgePrefs,
    lastBridge: stored.gogLastBridge ?? null,
    lastContext: stored.gogLastContext ?? null,
    lastResults: stored.gogLastResults ?? null,
    lastTest: stored.gogLastTest ?? null,
    calibration: siteCalib ?? null,
    calibrationSiteKey: siteKey,
    calibrationArmed: stored.gogCalibrationArmed ?? null,
    clickChipBeforeBet: stored.gogClickChipBeforeBet === true,
  };
}

async function handleBridgePayload(payload, sourceTabId) {
  const ctx = payload.context ?? {};
  const signalId =
    typeof ctx.signalId === "string" && ctx.signalId.trim() ? ctx.signalId.trim() : null;
  const recovery = recoveryFromContext(ctx);
  const tableId = ctx.currentTableId ?? null;

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

    const results = await runBridgePlan(payload, sourceTabId);
    const placedBet = results.some(
      (r) =>
        (r.target === "factor-1" || r.target === "factor-2") && r.ok === true && r.skipped !== true,
    );
    if (dedupeKey && placedBet) {
      lastBridgeDedupeKey = dedupeKey;
    }
    return { ok: true, results, mode: await resolveExecutionMode(payload.context) };
  } finally {
    bridgeInFlightKey = null;
  }
}

async function runBridgePlan(payload, sourceTabId) {
  const clicks = (payload.actions || []).filter((a) => a.kind === "click");
  const singleFactor = payload.context?.singleFactorMode === true;
  const filtered = singleFactor
    ? clicks.filter((a) => a.target === "factor-1" || a.target === "prepare-open")
    : clicks;
  const results = [];

  for (let i = 0; i < filtered.length; i++) {
    if (i > 0) await sleep(CLICK_STAGGER_MS);
    const action = filtered[i];
    const result = await dispatchClickAction(action, payload.context, sourceTabId);
    results.push(result);
  }

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
  if (context?.strategy !== "dois2fatores") return;
  const until =
    typeof context?.betDelayUntilMs === "number" && Number.isFinite(context.betDelayUntilMs)
      ? context.betDelayUntilMs
      : null;
  if (until == null) return;
  const waitMs = Math.max(0, until - Date.now());
  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

async function waitForBetDelaySettle(context) {
  await waitForCrossingBetDelay(context);
  await waitForFibonacciRecoverySettle(context);
}

async function dispatchClickAction(action, context, sourceTabId) {
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
  if (clickDedupeKey && lastExecutedClickKeys.has(clickDedupeKey)) {
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

  await waitForBetDelaySettle(context);

  if (targetTabId != null && context?.currentTableId != null) {
    registerMesaTab(context.currentTableId, targetTabId);
  }

  const clickResult = await executeBetWithChip(
    targetTabId,
    String(betKey),
    String(label ?? betKey),
    dryRun,
    context,
  );

  if (clickResult.ok && clickDedupeKey) {
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

async function scheduleCloseMesaTab(tableId, mesaUrl = null) {
  const id = typeof tableId === "number" ? tableId : Number(tableId);
  if (!Number.isFinite(id)) {
    return { ok: false, detail: "tableId inválido" };
  }

  const prefs = await readBridgePrefs();
  if (prefs.closeMesaOnFinish === false) {
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
  const siteKey = siteKeyFromUrl(tab.url);
  const store = await readCalibrationStore();
  const chip = store.sites?.[siteKey]?.chip ?? null;
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
    if (tab.windowId != null) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
    await sleep(280);
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

async function resolveSavedClickPixelsInTab(tabId, savedCoord) {
  if (!savedCoord) return null;

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["exterior-bets.js"],
  });

  const frameResults = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: (saved) => window.__gogResolveSavedClickTabPixels?.(saved),
    args: [savedCoord],
  });

  const candidates = frameResults.map((r) => r.result).filter((p) => p && p.x != null && p.y != null);
  if (candidates.length === 0) return null;

  return candidates.sort(
    (a, b) => rankResolvedPixels(savedCoord, b) - rankResolvedPixels(savedCoord, a),
  )[0];
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
    await sleep(40);
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...base,
    });
    await sleep(90);
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
  const rawChip = chip?.value === 50 ? DEFAULT_CHIP_VALUE : chip?.value;
  const chipValue =
    typeof rawChip === "number" && rawChip > 0
      ? rawChip
      : typeof context?.baseStake === "number" && context.baseStake > 0
        ? context.baseStake
        : DEFAULT_CHIP_VALUE;
  const recovery = recoveryFromContext(context);
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

async function executeBetWithChip(tabId, betKey, label, dryRun, context) {
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
      await sleep(CDP_BAR_SETTLE_MS);
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

    let clickResult = { ok: false, detail: "Aposta não executada" };
    for (let u = 0; u < units; u++) {
      if (u > 0) await sleep(staggerMs);
      clickResult = await executeExteriorBetOnTab(tabId, betKey, label, dryRun, cdpOpts);
      if (!clickResult.ok) break;
    }

    const recoveryNote = isZoneFibonacciFamily(context ?? {})
      ? recovery > 0
        ? ` · ${zoneFibStepLabel(context ?? {}, recovery)}`
        : ""
      : recovery > 0
        ? ` · gale ${recovery}`
        : "";
    const stakeNote =
      units > 1
        ? ` · R$${stakeAmount} (${units}× R$${chipValue})${recoveryNote}`
        : stakeAmount
          ? ` · R$${stakeAmount}${recoveryNote}`
          : recoveryNote;
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
    if (!dryRun) await releaseCdpSession();
  }
}

async function resolveMesaTabId(context, preferredTabId) {
  const mesaUrl = mesaUrlFromContext(context);
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

/** Activa separador da mesa ou navega para o URL correcto do catálogo. */
async function ensureMesaTab(context, preferredTabId) {
  const url = mesaUrlFromContext(context);

  let tabId = await resolveMesaTabId(context, preferredTabId);

  if (tabId != null && url) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !casinoPathsMatch(tab.url, url)) {
        await chrome.tabs.update(tabId, { url, active: true });
        await sleep(6500);
        const after = await chrome.tabs.get(tabId);
        if (after.url && !casinoPathsMatch(after.url, url)) {
          tabId = await openMesaTabAndWait(url);
          return tabId;
        }
        return tabId;
      }
      await chrome.tabs.update(tabId, { active: true });
      await sleep(1100);
      return tabId;
    } catch {
      tabId = null;
    }
  }

  if (tabId != null) {
    await chrome.tabs.update(tabId, { active: true });
    await sleep(1100);
    return tabId;
  }

  if (url) {
    tabId = await openMesaTabAndWait(url);
  }

  return tabId;
}

function isCasinoPlayUrl(url) {
  return /\/play\/(playtech|pragmatic)\//i.test(url);
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
  await sleep(5500);
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
    return { ok: false, detail: "Abra a mesa Pragmatic/Playtech num separador antes da varredura" };
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
  return null;
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
    const m = u.pathname.match(/\/play\/(pragmatic|playtech)\//i);
    if (m) return `${u.hostname}|/play/${m[1].toLowerCase()}/`;
    return `${u.hostname}|${u.pathname}`;
  } catch {
    return "unknown";
  }
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

async function getSavedCoordForTab(tabId, betKey) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return null;
  const siteKey = siteKeyFromUrl(tab.url);
  const store = await readCalibrationStore();
  return store.sites?.[siteKey]?.bets?.[betKey] ?? null;
}

/** Evita gravação duplicada (pointerdown + click). */
let calibrationSaveLock = null;

async function saveCalibrationClick(message, tabId) {
  if (!tabId) {
    const armed = (await chrome.storage.local.get("gogCalibrationArmed")).gogCalibrationArmed;
    tabId = armed?.tabId ?? null;
  }
  if (!tabId) return { ok: false, detail: "Separador desconhecido — clique na aba da mesa primeiro" };

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

  const siteKey = siteKeyFromUrl(tab.url);
  const store = await readCalibrationStore();
  if (!store.sites) store.sites = {};
  if (!store.sites[siteKey]) {
    store.sites[siteKey] = { label: siteKey, bets: {}, updatedAt: null };
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
                : "";
    detail = `${message.label || betKey} gravado${groupLabel ? ` (${groupLabel})` : ""} (${Math.round(coord.x * 100)}%, ${Math.round(coord.y * 100)}%)`;
  }
  store.sites[siteKey].updatedAt = new Date().toISOString();

  await chrome.storage.local.set({
    [CALIB_STORAGE_KEY]: store,
    gogCalibrationArmed: null,
  });

  calibrationSaveLock = { key: lockKey, at: Date.now() };

  await disarmCalibration(tabId);

  return {
    ok: true,
    detail,
    siteKey,
    betKey,
  };
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

async function disarmCalibration(tabId) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (typeof window.__gogStopCalibration === "function") window.__gogStopCalibration();
      },
    });
  } catch {
    /* tab closed */
  }
}

async function armCalibration(betKey, label, chipValue) {
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const preferredId = activeTabs[0]?.id ?? null;
  let tabId = await resolveMesaTabId({ mesaEmbedUrl: null, mesaProvider: null }, preferredId);

  if (tabId == null) {
    const anyPlay = (await chrome.tabs.query({})).find((t) => t.url && isCasinoPlayUrl(t.url));
    tabId = anyPlay?.id ?? null;
  }

  if (tabId == null) {
    return {
      ok: false,
      detail: "Abra a mesa Pragmatic num separador (br4.bet.br/play/pragmatic/…).",
    };
  }

  const resolvedChipValue = betKey === "chip" ? Number(chipValue) || DEFAULT_CHIP_VALUE : null;
  const resolvedLabel =
    label ??
    (betKey === "chip" ? `Ficha R$ ${resolvedChipValue}` : betKey);

  await chrome.tabs.update(tabId, { active: true });
  await disarmCalibration(tabId);

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => window.__gogClearVisualArtifacts?.(),
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["exterior-bets.js"],
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (bk, lb) => {
        window.__gogCalBetKey = bk;
        window.__gogCalLabel = lb;
      },
      args: [betKey, resolvedLabel],
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["calibrate-bets.js"],
    });
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  await chrome.storage.local.set({
    gogCalibrationArmed: {
      betKey,
      label: resolvedLabel,
      tabId,
      chipValue: resolvedChipValue,
      at: new Date().toISOString(),
    },
  });

  return {
    ok: true,
    detail: `Overlay activo — clique em ${resolvedLabel} na mesa (aba ${tabId})`,
    tabId,
  };
}

SinglestakeSignalRunner.initSignalRunner(handleBridgePayload);
