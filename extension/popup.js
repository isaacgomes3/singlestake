const powerToggle = document.getElementById("powerToggle");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const toast = document.getElementById("toast");

function showToast(text, kind = "") {
  if (!toast) return;
  toast.textContent = text ?? "";
  toast.className = `toast${kind ? ` ${kind}` : ""}`;
}

function setModeUi(mode) {
  const isDemo = mode !== "real";
  modeDemoBtn?.classList.toggle("active-demo", isDemo);
  modeRealBtn?.classList.toggle("active-real", !isDemo);
}

function setPowerUi(enabled) {
  const on = enabled !== false;
  powerToggle?.classList.toggle("on", on);
  powerToggle?.classList.toggle("off", !on);
  powerToggle?.setAttribute("aria-pressed", on ? "true" : "false");
}

function loadBridgeState() {
  chrome.runtime.sendMessage({ kind: "get-status" }, (status) => {
    if (chrome.runtime.lastError) {
      showToast(chrome.runtime.lastError.message, "err");
      return;
    }
    setModeUi(status?.mode ?? "demo");
    setPowerUi(status?.bridgeEnabled !== false);
  });
}

function togglePower() {
  chrome.runtime.sendMessage({ kind: "get-status" }, (status) => {
    const currentlyOn = status?.bridgeEnabled !== false;
    const next = !currentlyOn;
    chrome.runtime.sendMessage({ kind: "set-bridge-enabled", enabled: next }, () => {
      setPowerUi(next);
      showToast("");
    });
  });
}

function setMode(mode) {
  chrome.runtime.sendMessage({ kind: "set-mode", mode }, () => {
    setModeUi(mode);
    showToast("");
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
  if (changes.gogBridgeEnabled) {
    setPowerUi(changes.gogBridgeEnabled.newValue !== false);
  }
});

loadBridgeState();
