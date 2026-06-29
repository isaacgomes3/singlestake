/** Stake base — igual à automação global (R$ 50 → 100 → 200…). */
const EXTENSION_REAL_BASE_STAKE = 50;
const GOG = {
  BRIDGE_TYPE: "game-odds-glow/rotating-room-extension",
  PANEL_SIGNAL_TYPE: "singlestake/playtech-signal",
  PING_TYPE: "game-odds-glow/rotating-room-extension-ping",
  PONG_TYPE: "game-odds-glow/rotating-room-extension-pong",
  ACK_TYPE: "game-odds-glow/rotating-room-extension-ack",
  STATS_TYPE: "game-odds-glow/rotating-room-extension-stats",
  VERSION: 1,
  STORAGE_MODE: "gogExecutionMode",
  STORAGE_BRIDGE_PREFS: "gogBridgePrefs",
  DEFAULT_MODE: "demo",
};

/** Hostnames da app em produção (content-bridge + painel). */
const APP_PRODUCTION_HOSTS = [
  "stake37.com.br",
  "www.stake37.com.br",
  "singlestake.bet.br",
  "www.singlestake.bet.br",
  "auto.stake37.com.br",
];

function isAppProductionHostname(hostname) {
  return APP_PRODUCTION_HOSTS.includes(hostname);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @returns {"demo"|"real"} */
async function readStoredMode() {
  const prefs = await chrome.storage.local.get([GOG.STORAGE_MODE, "gogExteriorDryRun", "gogPragmaticDryRun"]);
  if (prefs[GOG.STORAGE_MODE] === "real" || prefs[GOG.STORAGE_MODE] === "demo") {
    return prefs[GOG.STORAGE_MODE];
  }
  if (prefs.gogExteriorDryRun === false || prefs.gogPragmaticDryRun === false) return "real";
  return GOG.DEFAULT_MODE;
}

/** @param {Record<string, unknown>|null|undefined} context */
async function resolveExecutionMode(context) {
  const stored = await readStoredMode();
  if (context?.executionMode === "real" || context?.mode === "real") return "real";
  if (context?.executionMode === "demo" || context?.mode === "demo") {
    // Popup REAL → clica na mesa mesmo se a app enviar demo na faixa
    if (stored === "real") return "real";
    return "demo";
  }
  if (context?.demo === true) return stored === "real" ? "real" : "demo";
  if (context?.demo === false) return "real";
  return stored;
}

async function isDryRun(context) {
  return (await resolveExecutionMode(context)) === "demo";
}

/** Gale — lê recovery do contexto ou do sufixo do signalId (`mesa:num:fator:recovery`). */
function recoveryFromContext(context) {
  const explicit = context?.currentRecovery;
  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return Math.max(0, Math.floor(explicit));
  }
  const signalId = context?.signalId;
  if (typeof signalId === "string" && signalId.trim()) {
    const part = signalId.trim().split(":").pop();
    const n = parseInt(part ?? "", 10);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

/** Intervalo base entre cliques de aposta (ms). */
const CLICK_STAGGER_BASE_MS = 450;

/**
 * Gales altos exigem 2^recovery cliques — acelera o ritmo para caber na janela de apostas.
 * Gale 4 (recovery 4): 2× · Gale 5 (recovery 5): 4×.
 * 2 Fatores em recuperação: +2× (dois campos com fichas).
 */
function clickSpeedMultiplierForRecovery(recovery, context) {
  const r =
    typeof recovery === "number" && Number.isFinite(recovery)
      ? Math.max(0, Math.floor(recovery))
      : 0;
  let mult = 1;
  if (r >= 5) mult = 4;
  else if (r >= 4) mult = 2;

  const is2F =
    context?.singleFactorMode === false ||
    context?.rotativaTrigger === "crossing" ||
    context?.strategy === "dois2fatores";
  if (is2F && r > 0) mult *= 2;

  return mult;
}

function clickStaggerMsForRecovery(recovery, context) {
  const mult = clickSpeedMultiplierForRecovery(recovery, context);
  return Math.max(40, Math.round(CLICK_STAGGER_BASE_MS / mult));
}

function scaledClickDelayMs(baseMs, recovery, context) {
  const mult = clickSpeedMultiplierForRecovery(recovery, context);
  return Math.max(15, Math.round(baseMs / mult));
}

async function setStoredMode(mode) {
  await chrome.storage.local.set({
    [GOG.STORAGE_MODE]: mode,
    gogExteriorDryRun: mode === "demo",
    gogPragmaticDryRun: mode === "demo",
  });
  updateActionBadge(mode);
}

function updateActionBadge(mode) {
  chrome.action.setBadgeText({ text: mode === "demo" ? "D" : "R" });
  chrome.action.setBadgeBackgroundColor({ color: mode === "demo" ? "#2563eb" : "#15803d" });
}

globalThis.GOG = GOG;
globalThis.readStoredMode = readStoredMode;
globalThis.setStoredMode = setStoredMode;
globalThis.isDryRun = isDryRun;
globalThis.resolveExecutionMode = resolveExecutionMode;
globalThis.recoveryFromContext = recoveryFromContext;
globalThis.clickStaggerMsForRecovery = clickStaggerMsForRecovery;
globalThis.clickSpeedMultiplierForRecovery = clickSpeedMultiplierForRecovery;
globalThis.scaledClickDelayMs = scaledClickDelayMs;
globalThis.panelSignalToBridge = panelSignalToBridge;
globalThis.isAppProductionHostname = isAppProductionHostname;
globalThis.sleep = sleep;
globalThis.updateActionBadge = updateActionBadge;

/** Converte sinal simplificado do painel Playtech → payload bridge. */
function panelSignalToBridge(data) {
  if (!data || typeof data !== "object") return null;
  const betKey = data.betKey ?? data.factor1BetKey;
  const label = data.label ?? data.factor1Label ?? betKey;
  const mesaEmbedUrl = data.mesaUrl ?? data.mesaEmbedUrl ?? null;
  const signalId =
    typeof data.signalId === "string" && data.signalId.trim()
      ? data.signalId.trim()
      : `${Date.now()}:${betKey}`;
  const recovery = recoveryFromContext(data);

  if (!betKey) return null;

  const provider =
    typeof data.mesaProvider === "string"
      ? data.mesaProvider
      : typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/playtech")
        ? "playtech"
        : typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/pragmatic")
          ? "pragmatic"
          : "outro";

  return {
    type: GOG.BRIDGE_TYPE,
    version: GOG.VERSION,
    fingerprint: signalId,
    actions: [
      {
        kind: "click",
        target: "factor-1",
        label: String(label),
        reason: data.reason ?? `Painel Playtech · ${label}`,
      },
    ],
    context: {
      sessionMode: "active",
      prepareTableId: null,
      currentTableId: data.tableId ?? null,
      mesaEmbedUrl,
      mesaProvider: provider,
      factor1Label: String(label),
      factor2Label: null,
      factor1BetKey: betKey,
      factor2BetKey: null,
      singleFactorMode: true,
      signalId,
      stakeAmount:
        recovery > 0
          ? EXTENSION_REAL_BASE_STAKE * 2 ** recovery
          : EXTENSION_REAL_BASE_STAKE,
      currentRecovery: recovery,
      baseStake: EXTENSION_REAL_BASE_STAKE,
      executionMode: data.mode ?? data.executionMode ?? null,
    },
  };
}
