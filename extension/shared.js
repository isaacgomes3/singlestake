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
  /** Após resultado na mesma mesa — aguardar UI da roleta antes de nova ficha (Fibonacci/Repetição). */
  FIBONACCI_RECOVERY_SETTLE_MS: 5000,
  /** Stake base real (R$) — enviado pela automação global. */
  REAL_BASE_STAKE: 50,
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

/** Gale / recuperação — lê currentRecovery ou extrai do signalId (Fibonacci e Repetição). */
function recoveryFromContext(context) {
  const explicit = context?.currentRecovery;
  if (typeof explicit === "number" && Number.isFinite(explicit)) {
    return Math.max(0, Math.floor(explicit));
  }
  const signalId = context?.signalId;
  if (typeof signalId === "string" && signalId.trim()) {
    const parts = signalId.trim().split(":");
    // rep:tableId:kind:id:recovery:cN
    if (parts[0] === "rep" && parts.length >= 5) {
      const n = parseInt(parts[4] ?? "", 10);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
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

/** Fibonacci / Repetição — mesma família operacional (stakes vindos da automação). */
function isZoneFibonacciFamily(context) {
  if (context?.zoneFibonacciMode === true) return true;
  const s = context?.strategy;
  if (s === "fibonacci" || s === "repeticao") return true;
  const t = context?.rotativaTrigger;
  if (t === "fibonacci" || t === "repeticao") return true;
  const signalId = context?.signalId;
  return typeof signalId === "string" && signalId.trim().startsWith("rep:");
}

function zoneFibStepLabel(context, recovery) {
  const tag =
    context?.strategy === "repeticao" ||
    context?.rotativaTrigger === "repeticao" ||
    (typeof context?.signalId === "string" && context.signalId.startsWith("rep:"))
      ? "Rep"
      : "Fibo";
  return recovery > 0 ? `${tag} ${recovery + 1}` : "Sinal";
}

function isRepeticaoContext(context) {
  return (
    context?.strategy === "repeticao" ||
    context?.rotativaTrigger === "repeticao" ||
    (typeof context?.signalId === "string" && context.signalId.trim().startsWith("rep:"))
  );
}

const CLICK_STAGGER_BASE_MS = 450;

/** Repetição — 3 últimas entradas Fibonacci (8/13/21 cliques): ritmo mais rápido na janela de apostas. */
function clickStaggerMsForContext(context, recovery) {
  const r =
    typeof recovery === "number" && Number.isFinite(recovery)
      ? Math.max(0, Math.floor(recovery))
      : 0;
  if (!isRepeticaoContext(context) || r < 5) return CLICK_STAGGER_BASE_MS;
  const mult = r >= 7 ? 4 : r >= 6 ? 3 : 2;
  return Math.max(40, Math.round(CLICK_STAGGER_BASE_MS / mult));
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
