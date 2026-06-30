const __EXT_LOAD_ERRORS = [];
try {
  importScripts("shared.js");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  __EXT_LOAD_ERRORS.push(`shared.js: ${msg}`);
  console.error("[Singlestake] shared.js falhou:", e);
  globalThis.GOG = {
    BRIDGE_TYPE: "game-odds-glow/rotating-room-extension",
    PANEL_SIGNAL_TYPE: "singlestake/playtech-signal",
    VERSION: 1,
    STORAGE_MODE: "gogExecutionMode",
    STORAGE_BRIDGE_PREFS: "gogBridgePrefs",
    DEFAULT_MODE: "demo",
  };
  globalThis.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  globalThis.readStoredMode = async () => "demo";
  globalThis.isDryRun = async () => true;
  globalThis.resolveExecutionMode = async () => "demo";
  globalThis.recoveryFromContext = () => 0;
  globalThis.clickStaggerMsForRecovery = () => 450;
  globalThis.isAppProductionHostname = () => false;
  globalThis.panelSignalToBridge = () => null;
  globalThis.updateActionBadge = () => {};
}
for (const __extFile of ["um-fator-engine.js", "dga-hub.js", "server-sync.js", "signal-runner.js"]) {
  try {
    importScripts(__extFile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    __EXT_LOAD_ERRORS.push(`${__extFile}: ${msg}`);
    console.error("[Singlestake] importScripts falhou:", __extFile, e);
  }
}
const GOG = globalThis.GOG;
const readStoredMode = globalThis.readStoredMode;
const setStoredMode = globalThis.setStoredMode;
const isDryRun = globalThis.isDryRun;
const resolveExecutionMode = globalThis.resolveExecutionMode;
const recoveryFromContext = globalThis.recoveryFromContext;
const clickStaggerMsForRecovery = globalThis.clickStaggerMsForRecovery;
const clickSpeedMultiplierForRecovery = globalThis.clickSpeedMultiplierForRecovery;
const scaledClickDelayMs = globalThis.scaledClickDelayMs;
const panelSignalToBridge = globalThis.panelSignalToBridge;
const isAppProductionHostname = globalThis.isAppProductionHostname;
const sleep = globalThis.sleep;
const updateActionBadge = globalThis.updateActionBadge;

const DEFAULT_CHIP_VALUE = 50;
/** Espera a barra «A depurar» estabilizar o viewport antes de calcular coordenadas. */
const CDP_BAR_SETTLE_MS = 220;
/** Aguarda poker/roleta carregar após navegação (espelha ensureMesaTab). */
const LOBBY_NAV_SETTLE_MS = 6500;
/** URL do lobby poker — igual ao iframe «Aguarde no Lobby» do app. */
const LOBBY_POKER_URL = "https://br4.bet.br/play/pragmatic/poker";
/** Roleta por defeito para testes / calibração quando só o poker está aberto. */
const DEFAULT_ROULETTE_MESA_URL = "https://br4.bet.br/play/pragmatic/roulette-macao";

/** @type {{ fingerprint: string; at: string; actions: unknown[] } | null} */
let lastBridge = null;
/** Evita apostar duas vezes no mesmo sinal (demo e real). */
let lastExecutedSignalId = null;
/** Ignora payloads duplicados enquanto o mesmo sinal está activo. */
let lastBridgeDedupeKey = null;
/** Bloqueia reentrância durante execução CDP. */
let bridgeInFlightKey = null;
/** Último gale/mesa — permite nova aposta quando recovery sobe. */
let lastBridgeRecovery = null;
let lastBridgeTableId = null;
/** Bloqueia abrir roleta enquanto poker do lobby ainda carrega. */
let mesaNavLockUntil = 0;
/** Serializa execuções da bridge — evita poker + roleta em paralelo. */
let bridgePlanChain = Promise.resolve();

const STORAGE_BRIDGE_ENABLED = "gogBridgeEnabled";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get([GOG.STORAGE_MODE, STORAGE_BRIDGE_ENABLED], (data) => {
    const patch = { gogAutopilotEnabled: false };
    if (data[GOG.STORAGE_MODE] === undefined) {
      void setStoredMode(GOG.DEFAULT_MODE);
    } else if (data[GOG.STORAGE_MODE] === "real" || data[GOG.STORAGE_MODE] === "demo") {
      void updateActionBadge(data[GOG.STORAGE_MODE]);
    }
    if (data[STORAGE_BRIDGE_ENABLED] === undefined) {
      patch[STORAGE_BRIDGE_ENABLED] = true;
    }
    void chrome.storage.local.set(patch);
  });
  void ensureContentBridgeOnAppTabs();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureContentBridgeOnAppTabs();
  void readBridgeEnabled().then((on) => {
    if (on) return navigateBridgeToLobbyWait();
  });
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
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.documentElement.dataset.singlestakeExtension = "1";
      },
    });
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

void (typeof readStoredMode === "function"
  ? readStoredMode().then(updateActionBadge)
  : Promise.resolve());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.kind === "bridge-from-page") {
    const payload = normalizeBridgePayload(message.payload);
    if (!payload) {
      sendResponse({ ok: false, error: "Payload inválido" });
      return true;
    }
    if (sender.tab?.id != null) {
      void ensureContentBridgeOnTab(sender.tab.id);
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
      if (enabled) {
        const nav = await navigateBridgeToLobbyWait();
        sendResponse({
          ok: true,
          enabled,
          navigated: nav?.results?.[0]?.ok === true,
          detail: nav?.results?.[0]?.detail ?? null,
        });
        return;
      }
      sendResponse({ ok: true, enabled });
    });
    return true;
  }

  if (message.kind === "set-mode") {
    const mode = message.mode === "real" ? "real" : "demo";
    const apply =
      typeof setStoredMode === "function"
        ? () => setStoredMode(mode)
        : () =>
            chrome.storage.local.set({
              gogExecutionMode: mode,
              gogExteriorDryRun: mode === "demo",
              gogPragmaticDryRun: mode === "demo",
            });
    void apply().then(() => {
      if (typeof updateActionBadge === "function") updateActionBadge(mode);
      sendResponse({ ok: true, mode });
    });
    return true;
  }

  if (message.kind === "get-status") {
    void buildStatus().then(sendResponse);
    return true;
  }

  if (message.kind === "set-autopilot") {
    if (!globalThis.SinglestakeSignalRunner?.setAutopilotEnabled) {
      sendResponse({ enabled: false, status: { running: false, reason: "Autopilot indisponível" } });
      return;
    }
    void globalThis.SinglestakeSignalRunner.setAutopilotEnabled(message.enabled === true).then(() =>
      globalThis.SinglestakeSignalRunner.getAutopilotStatus().then(sendResponse),
    );
    return true;
  }

  if (message.kind === "get-autopilot") {
    if (!globalThis.SinglestakeSignalRunner?.getAutopilotStatus) {
      sendResponse({ enabled: false, status: { running: false } });
      return;
    }
    void globalThis.SinglestakeSignalRunner.getAutopilotStatus().then(sendResponse);
    return true;
  }

  if (message.kind === "reset-autopilot-stats") {
    if (!globalThis.SinglestakeSignalRunner?.resetAutopilotStats) {
      sendResponse({ ok: false });
      return;
    }
    void globalThis.SinglestakeSignalRunner.resetAutopilotStats().then(sendResponse);
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

const DEFAULT_BRIDGE_PREFS = { maxRecovery: 5, wins: 0, losses: 0 };

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
  const activeUrl = activeTabs[0]?.url ?? null;
  const siteKey = await resolveCalibrationStatusSiteKey(activeUrl);
  const siteCalib = siteKey ? stored.gogBetCalibration?.sites?.[siteKey] : null;
  const autopilot =
    globalThis.SinglestakeSignalRunner?.getAutopilotStatus != null
      ? await globalThis.SinglestakeSignalRunner.getAutopilotStatus()
      : {
          enabled: false,
          status: {
            running: false,
            reason:
              __EXT_LOAD_ERRORS[0] ??
              "signal-runner não carregou — recarregue a extensão em chrome://extensions",
          },
        };
  const dgaConfig =
    globalThis.SinglestakeSignalRunner?.getDgaConfigForPopup != null
      ? await globalThis.SinglestakeSignalRunner.getDgaConfigForPopup()
      : null;
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

async function navigateBridgeToLobbyWait() {
  const context = {
    lobbyWait: true,
    mesaEmbedUrl: LOBBY_POKER_URL,
    mesaCatalog: [],
    currentTableId: null,
    singleFactorMode: true,
  };
  const payload = {
    fingerprint: `bridge-lobby-${Date.now()}`,
    actions: [
      {
        kind: "click",
        target: "prepare-open",
        label: "Lobby — Poker",
        reason: "Sala ligada — posicionar no lobby",
      },
    ],
    context,
    type: GOG.BRIDGE_TYPE,
    version: GOG.VERSION,
  };
  lastBridgeDedupeKey = null;
  lastExecutedSignalId = null;
  return handleBridgePayload(payload, null);
}

async function handleBridgePayload(payload, sourceTabId) {
  const run = () => handleBridgePayloadInner(payload, sourceTabId);
  const ticket = bridgePlanChain.then(run, run);
  bridgePlanChain = ticket.catch(() => {});
  return ticket;
}

async function handleBridgePayloadInner(payload, sourceTabId) {
  const ctx = payload.context ?? {};
  const signalId =
    typeof ctx.signalId === "string" && ctx.signalId.trim() ? ctx.signalId.trim() : null;
  const recovery = recoveryFromContext(ctx);
  const tableId = ctx.currentTableId ?? null;
  const isBetPayload =
    !ctx.lobbyWait &&
    Array.isArray(payload.actions) &&
    payload.actions.some((a) => a?.kind === "click" && (a.target === "factor-1" || a.target === "factor-2"));
  const cooldownUntil =
    typeof ctx.lobbyCooldownUntilMs === "number" && Number.isFinite(ctx.lobbyCooldownUntilMs)
      ? ctx.lobbyCooldownUntilMs
      : 0;
  const postResultHoldUntil =
    typeof ctx.postResultHoldUntilMs === "number" && Number.isFinite(ctx.postResultHoldUntilMs)
      ? ctx.postResultHoldUntilMs
      : 0;
  const isLobbyPayload = ctx.lobbyWait === true;

  if (isLobbyPayload && postResultHoldUntil > Date.now()) {
    const waitSec = Math.ceil((postResultHoldUntil - Date.now()) / 1000);
    return {
      ok: true,
      results: [
        {
          target: "bridge",
          ok: true,
          skipped: true,
          detail: `Resultado — aguardar ${waitSec}s antes do lobby`,
        },
      ],
      mode: await resolveExecutionMode(payload.context),
    };
  }

  if (isBetPayload && (cooldownUntil > Date.now() || postResultHoldUntil > Date.now())) {
    const until = Math.max(cooldownUntil, postResultHoldUntil);
    const waitSec = Math.ceil((until - Date.now()) / 1000);
    return {
      ok: true,
      results: [
        {
          target: "bridge",
          ok: true,
          skipped: true,
          detail: `Cooldown pós-lobby — aguardar ${waitSec}s antes de nova indicação`,
        },
      ],
      mode: await resolveExecutionMode(payload.context),
    };
  }

  if (isBetPayload) {
    const navWaitMs = mesaNavLockUntil - Date.now();
    if (navWaitMs > 0) await sleep(navWaitMs);
  }

  if (
    recovery > (lastBridgeRecovery ?? 0) ||
    recovery !== lastBridgeRecovery ||
    tableId !== lastBridgeTableId
  ) {
    lastBridgeDedupeKey = null;
    lastExecutedSignalId = null;
  }
  lastBridgeRecovery = recovery;
  lastBridgeTableId = tableId;

  const dedupeKey =
    signalId != null
      ? `${signalId}:r${recovery}${ctx.betAttemptKey ? `:${ctx.betAttemptKey}` : ""}`
      : payload.fingerprint
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
  const staggerMs = clickStaggerMsForRecovery(recoveryFromContext(payload.context), payload.context);

  for (let i = 0; i < filtered.length; i++) {
    if (i > 0) await sleep(staggerMs);
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

async function dispatchClickAction(action, context, sourceTabId) {
  if (action.target === "prepare-open") {
    const url = mesaUrlFromContext(context);
    if (!url) {
      return { target: action.target, ok: false, detail: "Sem URL da mesa no sinal" };
    }
    const isLobbyNav = context?.lobbyWait === true;
    const tabId = await ensureMesaTab(context, sourceTabId);
    if (isLobbyNav && tabId != null) {
      mesaNavLockUntil = Date.now() + LOBBY_NAV_SETTLE_MS;
    } else if (!isLobbyNav && tabId != null) {
      mesaNavLockUntil = 0;
    }
    return {
      target: action.target,
      ok: tabId != null,
      detail: tabId != null ? `Mesa aberta: ${url}` : `Falha ao abrir: ${url}`,
      tabId,
    };
  }

  const navWaitMs = mesaNavLockUntil - Date.now();
  if (navWaitMs > 0) await sleep(navWaitMs);

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

  if (
    signalId &&
    (action.target === "factor-1" || action.target === "factor-2") &&
    lastExecutedSignalId === signalId
  ) {
    return {
      target: action.target,
      ok: true,
      detail: `Sinal ${signalId} já executado — ignorado`,
      betKey,
      skipped: true,
      dryRun,
      mode: dryRun ? "demo" : "real",
    };
  }

  const clickResult = await executeBetWithChip(
    targetTabId,
    String(betKey),
    String(label ?? betKey),
    dryRun,
    context,
  );

  if (clickResult.ok && signalId) {
    lastExecutedSignalId = signalId;
  }

  return {
    target: action.target,
    betKey,
    dryRun,
    mode: dryRun ? "demo" : "real",
    ...clickResult,
  };
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
async function cdpViewportClick(tabId, x, y, keepSession = false, speedMultiplier = 1) {
  const attach = await ensureCdpAttached(tabId);
  if (!attach.ok) {
    return {
      ok: false,
      detail: `Debugger: ${attach.detail} (feche DevTools nessa aba)`,
    };
  }

  const mult = speedMultiplier > 1 ? speedMultiplier : 1;
  const pressDelayMs = Math.max(15, Math.round(40 / mult));
  const releaseDelayMs = Math.max(25, Math.round(90 / mult));

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
    await sleep(pressDelayMs);
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...base,
    });
    await sleep(releaseDelayMs);
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

  const speedMultiplier =
    typeof options.speedMultiplier === "number" && options.speedMultiplier > 1
      ? options.speedMultiplier
      : 1;
  const cdpResult = await cdpViewportClick(
    tabId,
    pixels.x,
    pixels.y,
    keepSession,
    speedMultiplier,
  );
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
  const baseStake =
    typeof context?.baseStake === "number" && context.baseStake > 0
      ? context.baseStake
      : DEFAULT_CHIP_VALUE;
  const explicitStake =
    typeof context?.stakeAmount === "number" && context.stakeAmount > 0
      ? context.stakeAmount
      : null;
  const FIBONACCI_LEVELS = [1, 1, 2, 3, 5, 8, 13, 21];
  const stakeAmount =
    explicitStake ??
    (context?.strategy === "fibonacci"
      ? baseStake * FIBONACCI_LEVELS[Math.min(recovery, FIBONACCI_LEVELS.length - 1)]
      : baseStake * 2 ** recovery);
  let units;
  if (context?.strategy === "fibonacci" && Math.abs(chipValue - baseStake) < 0.001) {
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

  const recovery = recoveryFromContext(context ?? {});
  const staggerMs = clickStaggerMsForRecovery(recovery, context);
  const speedMultiplier = clickSpeedMultiplierForRecovery(recovery, context);
  const cdpOpts = { keepSession: !dryRun, speedMultiplier };

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
      await sleep(scaledClickDelayMs(CDP_BAR_SETTLE_MS, recovery, context));
    }

    if (await shouldClickChipBeforeBet()) {
      chipResult = await selectChipOnTab(tabId, dryRun, cdpOpts);
      if (!dryRun && chipResult.ok && !chipResult.skipped) {
        await sleep(staggerMs);
      }
    }

    const chip = await getSavedChipForTab(tabId);
    const { stakeAmount, chipValue, units } = stakeUnitsForContext(context ?? {}, chip);

    let clickResult = { ok: false, detail: "Aposta não executada" };
    for (let u = 0; u < units; u++) {
      if (u > 0) await sleep(staggerMs);
      clickResult = await executeExteriorBetOnTab(tabId, betKey, label, dryRun, cdpOpts);
      if (!clickResult.ok) break;
    }

    const galeNote = recovery > 0 ? ` · gale ${recovery}` : "";
    const stakeNote =
      units > 1
        ? ` · R$${stakeAmount} (${units}× R$${chipValue})${galeNote}`
        : stakeAmount
          ? ` · R$${stakeAmount}${galeNote}`
          : galeNote;
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

  const anyPlay = tabs.find((t) => t.url && isRouletteCasinoUrl(t.url));
  if (anyPlay?.id != null) return anyPlay.id;

  const anyCasino = tabs.find((t) => t.url && isCasinoPlayUrl(t.url));
  if (anyCasino?.id != null) return anyCasino.id;

  return null;
}

function mesaUrlFromContext(context) {
  if (context?.lobbyWait === true && typeof context?.mesaEmbedUrl === "string") {
    return context.mesaEmbedUrl.trim();
  }
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

  let safePreferred = preferredTabId;
  if (preferredTabId != null) {
    try {
      const prefTab = await chrome.tabs.get(preferredTabId);
      if (prefTab.url && isSinglestakeAppUrl(prefTab.url)) safePreferred = null;
    } catch {
      safePreferred = null;
    }
  }

  let tabId = await resolveMesaTabId(context, safePreferred);

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

function isPokerLobbyUrl(url) {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\/play\/(playtech|pragmatic)\/poker\/?$/i.test(path);
  } catch {
    return /\/poker\/?$/i.test(String(url).toLowerCase());
  }
}

function isRouletteCasinoUrl(url) {
  return isCasinoPlayUrl(url) && !isPokerLobbyUrl(url);
}

/**
 * Encontra ou abre separador de roleta (não poker).
 * Testes e calibração precisam do iframe da roleta, não do lobby poker.
 */
async function findRouletteTabForAction(preferredTabId, mesaUrl = DEFAULT_ROULETTE_MESA_URL) {
  const tabs = await chrome.tabs.query({});
  const targetUrl = mesaUrl || DEFAULT_ROULETTE_MESA_URL;

  if (preferredTabId != null) {
    const pref = tabs.find((t) => t.id === preferredTabId);
    if (pref?.url && isRouletteCasinoUrl(pref.url)) {
      return { tabId: preferredTabId, navigated: false };
    }
  }

  if (targetUrl) {
    const exact = tabs.find((t) => t.url && casinoPathsMatch(t.url, targetUrl));
    if (exact?.id != null) return { tabId: exact.id, navigated: false };

    let slug = null;
    try {
      slug = new URL(targetUrl).pathname.split("/").filter(Boolean).pop();
    } catch {
      slug = null;
    }
    if (slug) {
      const bySlug = tabs.find(
        (t) => t.url && t.url.toLowerCase().includes(slug.toLowerCase()) && isRouletteCasinoUrl(t.url),
      );
      if (bySlug?.id != null) return { tabId: bySlug.id, navigated: false };
    }
  }

  const roulette = tabs.find((t) => t.url && isRouletteCasinoUrl(t.url));
  if (roulette?.id != null) return { tabId: roulette.id, navigated: false };

  const reuse = tabs.find((t) => t.url && isCasinoPlayUrl(t.url));
  if (reuse?.id != null) {
    await chrome.tabs.update(reuse.id, { url: targetUrl, active: true });
    await sleep(LOBBY_NAV_SETTLE_MS);
    return { tabId: reuse.id, navigated: true };
  }

  const tab = await chrome.tabs.create({ url: targetUrl, active: true });
  await sleep(5500);
  return { tabId: tab.id ?? null, navigated: true };
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
  const tabs = await chrome.tabs.query({});
  const reuseId = pickCasinoTabForNavigation(tabs, url);
  if (reuseId != null) {
    await chrome.tabs.update(reuseId, { url, active: true });
    await sleep(LOBBY_NAV_SETTLE_MS);
    return reuseId;
  }
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

  const { tabId: id, navigated } = await findRouletteTabForAction(tabId ?? null);
  if (id == null) {
    return {
      ok: false,
      detail:
        "Não foi possível abrir a roleta — abra br4.bet.br/play/pragmatic/roulette-macao num separador.",
      betKey,
      mode: dryRun ? "demo" : "real",
    };
  }

  const result = await executeBetWithChip(id, betKey, label ?? betKey, dryRun, {});
  const navNote = navigated ? " · navegou do poker para a roleta" : "";
  await chrome.storage.local.set({
    gogLastTest: {
      at: new Date().toISOString(),
      betKey,
      mode: dryRun ? "demo" : "real",
      tabId: id,
      ...result,
    },
  });
  return {
    ...result,
    mode: dryRun ? "demo" : "real",
    tabId: id,
    detail: `${result.detail ?? ""}${navNote}`.trim(),
  };
}

async function scanExteriorBets(tabId) {
  const { tabId: id } = await findRouletteTabForAction(tabId ?? null);
  if (id == null) {
    return {
      ok: false,
      detail: "Abra a roleta Pragmatic (ex.: roulette-macao) num separador antes da varredura",
    };
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

async function resolveCalibrationSiteKey(tabUrl, message) {
  const stored = await chrome.storage.local.get(["gogLastContext", "gogCalibrationArmed"]);
  const embedUrl =
    (typeof stored.gogLastContext?.mesaEmbedUrl === "string" && stored.gogLastContext.mesaEmbedUrl) ||
    (typeof stored.gogCalibrationArmed?.operatorUrl === "string" && stored.gogCalibrationArmed.operatorUrl) ||
    null;
  if (embedUrl && /\/play\/(pragmatic|playtech)\//i.test(embedUrl)) {
    return siteKeyFromUrl(embedUrl);
  }

  if (isSinglestakeAppUrl(tabUrl)) {
    const { tabId } = await findRouletteTabForAction(null);
    if (tabId != null) {
      try {
        const operatorTab = await chrome.tabs.get(tabId);
        if (operatorTab.url) return siteKeyFromUrl(operatorTab.url);
      } catch {
        /* ignore */
      }
    }
  }

  if (tabUrl && /\/play\/(pragmatic|playtech)\//i.test(tabUrl)) {
    return siteKeyFromUrl(tabUrl);
  }

  return siteKeyFromUrl(tabUrl);
}

async function resolveCalibrationStatusSiteKey(activeUrl) {
  const stored = await chrome.storage.local.get(["gogLastContext", "gogBetCalibration"]);
  const embed = stored.gogLastContext?.mesaEmbedUrl;
  if (typeof embed === "string" && /\/play\/(pragmatic|playtech)\//i.test(embed)) {
    const key = siteKeyFromUrl(embed);
    if (stored.gogBetCalibration?.sites?.[key]) return key;
  }
  const tabs = await chrome.tabs.query({});
  const casino = tabs.find((t) => t.url && isCasinoPlayUrl(t.url));
  if (casino?.url) return siteKeyFromUrl(casino.url);
  return activeUrl ? siteKeyFromUrl(activeUrl) : null;
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

  const siteKey = await resolveCalibrationSiteKey(tab.url, message);
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
  const appTab = await findSinglestakeAppTab();
  if (appTab?.id != null) {
    try {
      await postCalibrationToAppPageMainWorld(appTab.id, "disarm", "", "");
    } catch {
      /* ignore */
    }
    try {
      await chrome.tabs.sendMessage(appTab.id, { kind: "disarm-calibration-overlay" });
    } catch {
      /* ignore */
    }
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        if (typeof window.__gogStopCalibration === "function") {
          try {
            window.__gogStopCalibration();
          } catch {
            /* ignore */
          }
        }
        delete document.documentElement.dataset.gogCalBetKey;
        delete document.documentElement.dataset.gogCalLabel;
        delete window.__gogCalBetKey;
        delete window.__gogCalLabel;
        delete window.__gogCalibrationActive;
      },
    });
  } catch {
    /* tab closed */
  }
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return true;
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(false);
    }, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function findSinglestakeAppTab() {
  const tabs = await chrome.tabs.query({});
  const activeInWindow = tabs.find(
    (t) => t.active && t.id != null && isSinglestakeAppUrl(t.url),
  );
  if (activeInWindow?.id) return activeInWindow;
  return tabs.find((t) => t.id != null && isSinglestakeAppUrl(t.url)) ?? null;
}

const APP_CALIB_ARM_TYPE = "singlestake-arm-calibration";
const APP_CALIB_DISARM_TYPE = "singlestake-disarm-calibration";

/** Envia calibração ao React da app (mundo MAIN — postMessage do content script não chega à página). */
async function postCalibrationToAppPageMainWorld(tabId, action, betKey, label) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (armType, disarmType, act, bk, lb) => {
      if (act === "disarm") {
        try {
          delete document.documentElement.dataset.singlestakeArmCalibration;
        } catch {
          /* ignore */
        }
        window.postMessage({ type: disarmType }, window.location.origin);
        return;
      }
      const detail = { betKey: bk, label: lb };
      try {
        document.documentElement.dataset.singlestakeArmCalibration = JSON.stringify(detail);
      } catch {
        /* ignore */
      }
      window.postMessage({ type: armType, ...detail }, window.location.origin);
      window.dispatchEvent(new CustomEvent(armType, { detail }));
    },
    args: [APP_CALIB_ARM_TYPE, APP_CALIB_DISARM_TYPE, action, betKey, label],
  });
}

async function injectStake37SurfaceHelper(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => {
        window.__gogFindGameSurface = function stake37FindEmbed() {
          const shell = document.querySelector(".rotating-room-iframe-shell");
          const iframe =
            shell?.querySelector("iframe") ||
            [...document.querySelectorAll("iframe")].find((el) => {
              const hint = `${el.title || ""} ${el.getAttribute("aria-label") || ""} ${el.src || ""}`;
              return /casino|roleta|game|pragmatic|playtech/i.test(hint);
            });
          if (!iframe) return null;
          const r = iframe.getBoundingClientRect();
          if (r.width < 60 || r.height < 40) return null;
          return { el: iframe, kind: "embed-iframe" };
        };
      },
    });
  } catch {
    /* opcional */
  }
}

async function verifyCalibrationOverlayActive(tabId) {
  try {
    const rows = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () =>
        Boolean(
          window.__gogCalibrationActive ||
            document.getElementById("gog-ext-cal-root"),
        ),
    });
    return rows.some((row) => row.result === true);
  } catch {
    return false;
  }
}

async function injectAppTabCalibrationOverlay(tabId, betKey, label) {
  await waitForTabComplete(tabId);

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        if (typeof window.__gogStopCalibration === "function") {
          try {
            window.__gogStopCalibration();
          } catch {
            /* ignore */
          }
        }
        delete document.documentElement.dataset.gogCalBetKey;
        delete document.documentElement.dataset.gogCalLabel;
        delete window.__gogCalBetKey;
        delete window.__gogCalLabel;
      },
    });
  } catch {
    /* ignore */
  }

  await injectStake37SurfaceHelper(tabId);
  await stampCalibrationDataset(tabId, [0], betKey, label);
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    files: ["calibrate-bets.js"],
  });
  return 1;
}

async function armCalibrationOnAppOverlay(betKey, label) {
  const appTab = await findSinglestakeAppTab();
  if (!appTab?.id) return null;
  await ensureContentBridgeOnTab(appTab.id);
  await chrome.tabs.update(appTab.id, { active: true });
  await waitForTabComplete(appTab.id, 12000);

  let operatorUrl = null;
  try {
    const stored = await chrome.storage.local.get("gogLastContext");
    if (typeof stored.gogLastContext?.mesaEmbedUrl === "string") {
      operatorUrl = stored.gogLastContext.mesaEmbedUrl;
    }
  } catch {
    /* ignore */
  }

  let injected = 0;
  try {
    injected = await injectAppTabCalibrationOverlay(appTab.id, betKey, label);
  } catch {
    injected = 0;
  }

  if (injected >= 1 && (await verifyCalibrationOverlayActive(appTab.id))) {
    return { tabId: appTab.id, via: "app-extension-overlay", operatorUrl };
  }

  try {
    await postCalibrationToAppPageMainWorld(appTab.id, "arm", betKey, label);
    await sleep(300);
    const reactArmed =
      (await chrome.scripting.executeScript({
        target: { tabId: appTab.id },
        world: "MAIN",
        func: () => Boolean(document.documentElement.dataset.singlestakeArmCalibration),
      }))?.[0]?.result === true;
    if (reactArmed) {
      return { tabId: appTab.id, via: "app-react-overlay", operatorUrl };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Inject clássico no separador do operador (br4) — overlay azul directo, como extensão ≤1.4.5. */
async function injectOperatorCalibrationClassic(tabId, betKey, label) {
  await waitForTabComplete(tabId);

  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.__gogClearVisualArtifacts?.(),
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["exterior-bets.js"],
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (bk, lb) => {
      const root = document.documentElement;
      root.dataset.gogCalBetKey = bk;
      root.dataset.gogCalLabel = lb;
      window.__gogCalBetKey = bk;
      window.__gogCalLabel = lb;
    },
    args: [betKey, label],
  });

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["calibrate-bets.js"],
  });

  return (await verifyCalibrationOverlayActive(tabId)) ? 1 : 0;
}

function stampCalibrationDataset(tabId, frameIds, betKey, label) {
  const target =
    frameIds != null && frameIds.length > 0
      ? { tabId, frameIds }
      : { tabId, allFrames: true };
  return chrome.scripting.executeScript({
    target,
    func: (bk, lb) => {
      const root = document.documentElement;
      root.dataset.gogCalBetKey = bk;
      root.dataset.gogCalLabel = lb;
      window.__gogCalBetKey = bk;
      window.__gogCalLabel = lb;
      const findSurface =
        typeof window.__gogFindGameSurface === "function"
          ? window.__gogFindGameSurface
          : null;
      const surface = findSurface ? findSurface() : null;
      const isTop = window === window.top;
      return {
        armed: isTop || Boolean(surface?.el),
        href: location.href,
        isTop,
      };
    },
    args: [betKey, label],
  });
}

async function injectOperatorCalibration(tabId, betKey, label) {
  await waitForTabComplete(tabId);
  await disarmCalibration(tabId);

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => window.__gogClearVisualArtifacts?.(),
  });

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["exterior-bets.js"],
  });

  const stamped = await stampCalibrationDataset(tabId, null, betKey, label);
  const frameIds = stamped
    .filter((row) => row.result?.armed && row.frameId != null)
    .map((row) => row.frameId);

  const injectTargets =
    frameIds.length > 0
      ? frameIds
      : (() => {
          const topRow = stamped.find((row) => row.result?.isTop);
          return topRow ? [topRow.frameId ?? 0] : [0];
        })();

  for (const frameId of injectTargets) {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      files: ["calibrate-bets.js"],
    });
  }

  return injectTargets.length;
}

async function armCalibration(betKey, label, chipValue) {
  const resolvedLabel =
    label ?? (betKey === "chip" ? `Ficha R$ ${Number(chipValue) || DEFAULT_CHIP_VALUE}` : betKey);

  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const preferredId = activeTabs[0]?.id ?? null;
  const { tabId, navigated } = await findRouletteTabForAction(preferredId);

  if (tabId != null) {
    await chrome.tabs.update(tabId, { active: true });
    await disarmCalibration(tabId);

    try {
      let injected = await injectOperatorCalibrationClassic(tabId, betKey, resolvedLabel);
      if (injected < 1) {
        injected = await injectOperatorCalibration(tabId, betKey, resolvedLabel);
      }
      if (injected >= 1 && (await verifyCalibrationOverlayActive(tabId))) {
        await chrome.storage.local.set({
          gogCalibrationArmed: {
            betKey,
            label: resolvedLabel,
            tabId,
            chipValue: betKey === "chip" ? Number(chipValue) || DEFAULT_CHIP_VALUE : null,
            at: new Date().toISOString(),
            via: "operator",
          },
        });
        return {
          ok: true,
          detail: `Overlay azul na mesa — clique em ${resolvedLabel}${navigated ? " (roleta aberta)" : ""}`,
          tabId,
        };
      }
    } catch {
      /* fallback stake37 abaixo */
    }
  }

  const appOverlay = await armCalibrationOnAppOverlay(betKey, resolvedLabel);
  if (appOverlay) {
    await chrome.storage.local.set({
      gogCalibrationArmed: {
        betKey,
        label: resolvedLabel,
        tabId: appOverlay.tabId,
        operatorUrl: appOverlay.operatorUrl ?? null,
        chipValue: betKey === "chip" ? Number(chipValue) || DEFAULT_CHIP_VALUE : null,
        at: new Date().toISOString(),
        via: appOverlay.via,
      },
    });
    return {
      ok: true,
      detail: `Overlay no app — clique em ${resolvedLabel} sobre o casino`,
      tabId: appOverlay.tabId,
    };
  }

  if (tabId == null) {
    return {
      ok: false,
      detail: "Abra br4.bet.br/play/pragmatic num separador ou stake37 com o casino.",
    };
  }

  return {
    ok: false,
    detail: "Não foi possível activar o overlay — recarregue a mesa e a extensão em chrome://extensions",
  };
}

SinglestakeSignalRunner?.initSignalRunner?.(handleBridgePayload);
