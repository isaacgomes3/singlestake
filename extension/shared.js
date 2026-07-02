/** Constantes partilhadas (importadas via importScripts no service worker). */
const GOG = {
  BRIDGE_TYPE: "game-odds-glow/rotating-room-extension",
  PANEL_SIGNAL_TYPE: "singlestake/playtech-signal",
  PING_TYPE: "game-odds-glow/rotating-room-extension-ping",
  PONG_TYPE: "game-odds-glow/rotating-room-extension-pong",
  ACK_TYPE: "game-odds-glow/rotating-room-extension-ack",
  STATS_TYPE: "game-odds-glow/rotating-room-extension-stats",
  CLOSE_MESA_TYPE: "game-odds-glow/rotating-room-extension-close-mesa",
  VERSION: 1,
  STORAGE_MODE: "gogExecutionMode",
  STORAGE_BRIDGE_PREFS: "gogBridgePrefs",
  DEFAULT_MODE: "demo",
  /** Após resultado na mesma mesa — aguardar UI da roleta antes de nova ficha (Fibonacci). */
  FIBONACCI_RECOVERY_SETTLE_MS: 5000,
  /** Aguardar cliques CDP antes de fechar o separador da mesa. */
  CLOSE_MESA_DELAY_MS: 2500,
};

/** Hostnames da app em produção (content-bridge + painel). */
const APP_PRODUCTION_HOSTS = [
  "stake37.com.br",
  "www.stake37.com.br",
  "singlestake.bet.br",
  "www.singlestake.bet.br",
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

/** Gale — lê recovery do contexto ou do signalId (`mesa:kind:id:recovery:cN`). */
function recoveryFromContext(context) {
  const explicit = context?.currentRecovery;
  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return Math.max(0, Math.floor(explicit));
  }
  const signalId = context?.signalId;
  if (typeof signalId === "string" && signalId.trim()) {
    const parts = signalId.trim().split(":");
    if (parts.length >= 4 && (parts[1] === "dozen" || parts[1] === "column")) {
      const n = parseInt(parts[3] ?? "", 10);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
    const part = parts[parts.length - 1];
    const n = parseInt(part ?? "", 10);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
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
      stakeAmount: recovery > 0 ? 0.5 * 2 ** recovery : 0.5,
      currentRecovery: recovery,
      baseStake: 0.5,
      executionMode: data.mode ?? data.executionMode ?? null,
    },
  };
}
