const powerToggle = document.getElementById("powerToggle");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const modeBadge = document.getElementById("modeBadge");
const toast = document.getElementById("toast");

const STORAGE_BRIDGE_ENABLED = "gogBridgeEnabled";
const STORAGE_MODE = "gogExecutionMode";

function showToast(text, kind = "") {
  if (!toast) return;
  toast.textContent = text ?? "";
  toast.className = `toast${kind ? ` ${kind}` : ""}`;
}

function setModeUi(mode) {
  const isDemo = mode !== "real";
  modeDemoBtn?.classList.toggle("active-demo", isDemo);
  modeRealBtn?.classList.toggle("active-real", !isDemo);
  if (modeBadge) {
    modeBadge.textContent = isDemo ? "Demo" : "Real";
    modeBadge.className = `mode-badge ${isDemo ? "demo" : "real"}`;
  }
}

function setPowerUi(enabled) {
  const on = enabled !== false;
  powerToggle?.classList.toggle("on", on);
  powerToggle?.classList.toggle("off", !on);
  powerToggle?.setAttribute("aria-pressed", on ? "true" : "false");
  powerToggle?.setAttribute("title", on ? "Ligada — clique para desligar" : "Desligada — clique para ligar");
}

function readBridgeEnabled(cb) {
  chrome.storage.local.get([STORAGE_BRIDGE_ENABLED], (data) => {
    cb(data[STORAGE_BRIDGE_ENABLED] !== false);
  });
}

function readMode(cb) {
  chrome.storage.local.get([STORAGE_MODE, "gogExteriorDryRun", "gogPragmaticDryRun"], (data) => {
    if (data[STORAGE_MODE] === "real" || data[STORAGE_MODE] === "demo") {
      cb(data[STORAGE_MODE]);
      return;
    }
    if (data.gogExteriorDryRun === false || data.gogPragmaticDryRun === false) {
      cb("real");
      return;
    }
    cb("demo");
  });
}

function loadBridgeState() {
  readBridgeEnabled((bridgeOn) => setPowerUi(bridgeOn));
  readMode((mode) => setModeUi(mode));
}

function togglePower() {
  readBridgeEnabled((currentlyOn) => {
    const next = !currentlyOn;
    setPowerUi(next);
    chrome.storage.local.set({ [STORAGE_BRIDGE_ENABLED]: next }, () => {
      if (chrome.runtime.lastError) {
        showToast(chrome.runtime.lastError.message, "err");
        setPowerUi(currentlyOn);
        return;
      }
      showToast(next ? "Extensão ligada" : "Extensão desligada", "ok");
    });
  });
}

function setMode(mode) {
  setModeUi(mode);
  chrome.runtime.sendMessage({ kind: "set-mode", mode }, () => {
    if (chrome.runtime.lastError) {
      showToast(chrome.runtime.lastError.message, "err");
      loadBridgeState();
      return;
    }
    showToast(mode === "real" ? "Modo Real activo" : "Modo Demo activo", "ok");
  });
}

powerToggle?.addEventListener("click", togglePower);
modeDemoBtn?.addEventListener("click", () => setMode("demo"));
modeRealBtn?.addEventListener("click", () => {
  if (!window.confirm("Modo REAL envia cliques na mesa. Confirma?")) return;
  setMode("real");
});

document.querySelectorAll("button[data-bet]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const betKey = btn.getAttribute("data-bet");
    const label = btn.getAttribute("data-label") ?? betKey;
    chrome.runtime.sendMessage({ kind: "test-bet", betKey, label }, (resp) => {
      if (chrome.runtime.lastError) {
        showToast(chrome.runtime.lastError.message, "err");
        return;
      }
      const ok = resp?.ok !== false;
      showToast(resp?.detail || (ok ? `${label} enviado` : "Falha no teste"), ok ? "ok" : "err");
    });
  });
});

document.querySelectorAll("button.cal").forEach((btn) => {
  btn.addEventListener("click", () => {
    const betKey = btn.getAttribute("data-cal");
    const label = btn.getAttribute("data-cal-label") ?? betKey;
    showToast(`${label}: clique na mesa…`, "ok");
    chrome.runtime.sendMessage({ kind: "arm-calibration", betKey, label }, (resp) => {
      if (chrome.runtime.lastError) {
        showToast(chrome.runtime.lastError.message, "err");
        return;
      }
      if (resp?.ok) {
        showToast(`${label}: overlay na mesa`, "ok");
        window.close();
        return;
      }
      showToast(resp?.detail || "Erro ao calibrar", "err");
    });
  });
});

document.getElementById("calClear")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ kind: "clear-calibration" }, (resp) => {
    showToast(resp?.detail || "Calibração apagada", resp?.ok === false ? "err" : "ok");
  });
});

document.getElementById("primeFile")?.addEventListener("change", (ev) => {
  const input = ev.target;
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    chrome.storage.local.set(
      {
        gogPrimeBackup: {
          name: file.name,
          at: new Date().toISOString(),
          raw: String(reader.result ?? "").trim(),
        },
      },
      () => {
        showToast(`Backup: ${file.name}`, "ok");
        input.value = "";
      },
    );
  };
  reader.readAsText(file);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_BRIDGE_ENABLED]) {
    setPowerUi(changes[STORAGE_BRIDGE_ENABLED].newValue !== false);
  }
  if (changes[STORAGE_MODE] || changes.gogExteriorDryRun || changes.gogPragmaticDryRun) {
    readMode((mode) => setModeUi(mode));
  }
});

loadBridgeState();
