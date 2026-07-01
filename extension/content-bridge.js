const GOG = {
  BRIDGE_TYPE: "game-odds-glow/rotating-room-extension",
  PANEL_SIGNAL_TYPE: "singlestake/playtech-signal",
  PING_TYPE: "game-odds-glow/rotating-room-extension-ping",
  PONG_TYPE: "game-odds-glow/rotating-room-extension-pong",
  ACK_TYPE: "game-odds-glow/rotating-room-extension-ack",
  STATS_TYPE: "game-odds-glow/rotating-room-extension-stats",
  CLOSE_MESA_TYPE: "game-odds-glow/rotating-room-extension-close-mesa",
  VERSION: 1,
};

if (globalThis.__singlestakeContentBridgeLoaded) {
  /* já injectado — evita listeners duplicados */
} else {
  globalThis.__singlestakeContentBridgeLoaded = true;

document.documentElement.dataset.singlestakeExtension = "1";
function postAck(fingerprint, response) {
  window.postMessage(
    {
      type: GOG.ACK_TYPE,
      version: GOG.VERSION,
      fingerprint,
      response,
    },
    window.location.origin,
  );
}

function forwardToBackground(payload) {
  chrome.runtime.sendMessage({ kind: "bridge-from-page", payload }, (response) => {
    if (chrome.runtime.lastError) {
      postAck(payload.fingerprint ?? "unknown", {
        ok: false,
        error: chrome.runtime.lastError.message,
        results: [{ target: "bridge", ok: false, detail: chrome.runtime.lastError.message }],
      });
      return;
    }
    postAck(payload.fingerprint ?? "unknown", response);
  });
}

function isBridgePayload(data) {
  if (!data || typeof data !== "object") return false;
  if (data.type === GOG.BRIDGE_TYPE && data.version === GOG.VERSION) return true;
  if (data.type === GOG.PANEL_SIGNAL_TYPE && data.version === GOG.VERSION) return true;
  return false;
}

function postPong(prefs) {
  const payload = { type: GOG.PONG_TYPE, version: GOG.VERSION, ...(prefs ? { prefs } : {}) };
  window.postMessage(payload, window.location.origin);
  window.dispatchEvent(new CustomEvent("singlestake-extension-present", { detail: { prefs } }));
}

function requestBridgePrefs() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ kind: "get-bridge-prefs" }, (prefs) => {
      if (chrome.runtime.lastError) {
        resolve({ maxRecovery: 5, wins: 0, losses: 0 });
        return;
      }
      resolve(prefs ?? { maxRecovery: 5, wins: 0, losses: 0 });
    });
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  const data = event.data;

  if (data?.type === GOG.PING_TYPE && data.version === GOG.VERSION) {
    postPong();
    void requestBridgePrefs().then((prefs) => postPong(prefs));
    return;
  }
  if (data?.type === GOG.STATS_TYPE && data.version === GOG.VERSION) {
    chrome.runtime.sendMessage({
      kind: "bridge-stats-sync",
      wins: data.wins,
      losses: data.losses,
    });
    return;
  }
  if (data?.type === GOG.CLOSE_MESA_TYPE && data.version === GOG.VERSION) {
    const tableId = typeof data.tableId === "number" ? data.tableId : Number(data.tableId);
    if (!Number.isFinite(tableId)) return;
    chrome.runtime.sendMessage({ kind: "bridge-close-mesa", tableId }, () => {
      if (chrome.runtime.lastError) {
        /* service worker inactivo */
      }
    });
    return;
  }

  if (!isBridgePayload(data)) return;
  forwardToBackground(data);
});

/** API opcional para o painel Singlestake chamar directamente. */
window.__singlestakeExtension = {
  ping() {
    window.postMessage({ type: GOG.PING_TYPE, version: GOG.VERSION }, window.location.origin);
  },
  getPrefs() {
    return requestBridgePrefs();
  },
  setPrefs(prefs) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ kind: "set-bridge-prefs", prefs }, (out) => resolve(out));
    });
  },
  getBridgeEnabled() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ kind: "get-bridge-enabled" }, (out) => {
        if (chrome.runtime.lastError) {
          resolve(true);
          return;
        }
        resolve(out?.enabled !== false);
      });
    });
  },
  setBridgeEnabled(enabled) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ kind: "set-bridge-enabled", enabled: enabled === true }, (out) =>
        resolve(out),
      );
    });
  },
  sendSignal(signal) {
    const payload = {
      type: GOG.PANEL_SIGNAL_TYPE,
      version: GOG.VERSION,
      ...signal,
    };
    forwardToBackground(payload);
    return payload;
  },
  getPrimeBackup() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["gogPrimeBackup"], (data) => resolve(data.gogPrimeBackup ?? null));
    });
  },
};

/** Anuncia presença assim que o script carrega (antes do primeiro ping da página). */
postPong();
void requestBridgePrefs().then((prefs) => postPong(prefs));
try {
  chrome.runtime.sendMessage({ kind: "ping" });
} catch {
  /* extensão recarregada */
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.kind === "bridge-ping") {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
}