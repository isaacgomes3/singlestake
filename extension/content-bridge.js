const GOG = {
  BRIDGE_TYPE: "game-odds-glow/rotating-room-extension",
  PANEL_SIGNAL_TYPE: "singlestake/playtech-signal",
  PING_TYPE: "game-odds-glow/rotating-room-extension-ping",
  PONG_TYPE: "game-odds-glow/rotating-room-extension-pong",
  ACK_TYPE: "game-odds-glow/rotating-room-extension-ack",
  STATS_TYPE: "game-odds-glow/rotating-room-extension-stats",
  VERSION: 1,
  STORAGE_BRIDGE_ENABLED: "gogBridgeEnabled",
  STORAGE_MODE: "gogExecutionMode",
};

const EXT_CALIBRATION_CLICK = "gog-ext/calibration-click";
const EXT_CALIBRATION_CLICK_RESPONSE = "gog-ext/calibration-click-response";
const EXT_ARM_CALIBRATION = "singlestake-arm-calibration";
const EXT_DISARM_CALIBRATION = "singlestake-disarm-calibration";
const EXT_CALIBRATION_RESULT = "singlestake-calibration-result";

/** Mesmas chaves que `rotatingRoomExtensionPrefs.ts` na app. */
const APP_EXTENSION_ENABLED_KEY = "roulette.rotatingRoom.extensionEnabled";
const APP_EXTENSION_REAL_KEY = "roulette.rotatingRoom.extensionRealMode";
const APP_PREFS_EVENT = "singlestake-extension-prefs";

function syncAppLocalPrefsFromExtension(patch) {
  try {
    if (typeof patch.bridgeEnabled === "boolean") {
      localStorage.setItem(APP_EXTENSION_ENABLED_KEY, patch.bridgeEnabled ? "1" : "0");
    }
    if (patch.executionMode === "real" || patch.executionMode === "demo") {
      localStorage.setItem(APP_EXTENSION_REAL_KEY, patch.executionMode === "real" ? "1" : "0");
    }
    window.dispatchEvent(new CustomEvent(APP_PREFS_EVENT));
  } catch {
    /* ignore */
  }
}

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
        resolve({ maxRecovery: 5, wins: 0, losses: 0, bridgeEnabled: true, executionMode: "demo" });
        return;
      }
      const out = prefs ?? { maxRecovery: 5, wins: 0, losses: 0, bridgeEnabled: true, executionMode: "demo" };
      syncAppLocalPrefsFromExtension({
        bridgeEnabled: out.bridgeEnabled !== false,
        executionMode: out.executionMode === "real" ? "real" : "demo",
      });
      resolve(out);
    });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const patch = {};
  if (changes[GOG.STORAGE_BRIDGE_ENABLED]) {
    patch.bridgeEnabled = changes[GOG.STORAGE_BRIDGE_ENABLED].newValue !== false;
  }
  if (changes[GOG.STORAGE_MODE]) {
    const mode = changes[GOG.STORAGE_MODE].newValue;
    if (mode === "real" || mode === "demo") patch.executionMode = mode;
  }
  if (Object.keys(patch).length === 0) return;
  syncAppLocalPrefsFromExtension(patch);
  void requestBridgePrefs().then((prefs) => postPong(prefs));
});

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

  if (data?.type === EXT_CALIBRATION_CLICK && data.betKey) {
    chrome.runtime.sendMessage(
      {
        kind: "calibration-click",
        betKey: String(data.betKey),
        label: String(data.label || data.betKey),
        coord: data.coord,
        frameHref: data.frameHref || location.href,
        isTop: data.isTop === true,
        requestId: data.requestId,
      },
      (resp) => {
        if (chrome.runtime.lastError) {
          window.postMessage(
            {
              type: EXT_CALIBRATION_CLICK_RESPONSE,
              requestId: data.requestId,
              response: { ok: false, detail: chrome.runtime.lastError.message },
            },
            window.location.origin,
          );
          return;
        }
        window.postMessage(
          {
            type: EXT_CALIBRATION_CLICK_RESPONSE,
            requestId: data.requestId,
            response: resp,
          },
          window.location.origin,
        );
        if (resp?.ok) {
          window.postMessage(
            {
              type: EXT_CALIBRATION_RESULT,
              result: resp,
            },
            window.location.origin,
          );
        }
      },
    );
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
  getExecutionMode() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ kind: "get-bridge-prefs" }, (prefs) => {
        if (chrome.runtime.lastError) {
          resolve("demo");
          return;
        }
        resolve(prefs?.executionMode === "real" ? "real" : "demo");
      });
    });
  },
  setExecutionMode(mode) {
    const next = mode === "real" ? "real" : "demo";
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ kind: "set-mode", mode: next }, (out) => {
        if (!chrome.runtime.lastError) {
          syncAppLocalPrefsFromExtension({ executionMode: next });
        }
        resolve(out);
      });
    });
  },
  setBridgeEnabled(enabled) {
    const on = enabled === true;
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ kind: "set-bridge-enabled", enabled: on }, (out) => {
        if (!chrome.runtime.lastError) {
          syncAppLocalPrefsFromExtension({ bridgeEnabled: on });
        }
        resolve(out);
      });
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

/** Anuncia presença com prefs completas (incl. bridgeEnabled persistido). */
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
  if (message?.kind === "arm-calibration-overlay") {
    const betKey = String(message.betKey || "");
    const label = String(message.label || betKey);
    if (!betKey) {
      sendResponse({ ok: false, detail: "Chave de aposta em falta" });
      return true;
    }
    window.postMessage(
      {
        type: EXT_ARM_CALIBRATION,
        betKey,
        label,
      },
      window.location.origin,
    );
    sendResponse({ ok: true, detail: `Overlay activo — clique em ${label}` });
    return true;
  }
  if (message?.kind === "disarm-calibration-overlay") {
    window.postMessage({ type: EXT_DISARM_CALIBRATION }, window.location.origin);
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
}