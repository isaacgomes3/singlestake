const out = document.getElementById("out");
const calStatus = document.getElementById("calStatus");
const goldeStatus = document.getElementById("goldeStatus");
const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const modePill = document.getElementById("modePill");
const goldeOnBtn = document.getElementById("goldeOn");
const goldeOffBtn = document.getElementById("goldeOff");
const goldeResetBtn = document.getElementById("goldeReset");
const goldeCasinoId = document.getElementById("goldeCasinoId");
const maxGales = document.getElementById("maxGales");
const goldeSaveBtn = document.getElementById("goldeSave");
const goldeConfigStatus = document.getElementById("goldeConfigStatus");

function send(kind, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ kind, ...extra }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(resp ?? { ok: false, error: "Sem resposta" });
    });
  });
}

function setModeUi(mode) {
  const isDemo = mode !== "real";
  modeDemoBtn?.classList.toggle("active-demo", isDemo);
  modeRealBtn?.classList.toggle("active-real", !isDemo);
  if (modePill) {
    modePill.textContent = isDemo ? "DEMO" : "REAL";
    modePill.className = `pill ${isDemo ? "demo" : "real"}`;
  }
}

function clampMaxGales(value) {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return 5;
  return Math.min(6, Math.max(0, n));
}

function renderGoldeAutopilot(golde, mode) {
  const st = golde?.status ?? {};
  const on = golde?.enabled === true;
  const running = st.running === true;
  const wins = st.wins ?? 0;
  const losses = st.losses ?? 0;

  if (winsEl) winsEl.textContent = String(wins);
  if (lossesEl) lossesEl.textContent = String(losses);

  goldeOnBtn?.classList.toggle("active-real", on);
  goldeOffBtn?.classList.toggle("active-demo", !on);

  if (!goldeStatus) return;

  if (!on) {
    goldeStatus.textContent = "Parada — clique Ligar para seguir a mesa 28401 via DGA.";
    return;
  }

  if (st.lastError) {
    goldeStatus.textContent = `Erro: ${st.lastError}`;
    return;
  }

  if (st.waitingBet) {
    goldeStatus.textContent = `Aguardando janela de aposta · ${st.label ?? "—"} (gale ${st.recovery ?? 0})`;
    return;
  }

  if (st.active && st.label) {
    goldeStatus.textContent = `Activa · ${st.label} · gale ${st.recovery ?? 0} · modo ${mode === "real" ? "REAL" : "demo"}`;
    return;
  }

  if (running) {
    const galeHint =
      (st.recovery ?? 0) > 0 ? ` · gale pendente ${st.recovery}` : "";
    const ver = st.extensionVersion ? ` · v${st.extensionVersion}` : "";
    goldeStatus.textContent =
      (st.reason ?? "A monitorizar gatilhos (2 factores em comum)…") + galeHint + ver;
    return;
  }

  goldeStatus.textContent = (st.reason ?? "A ligar DGA…") + (st.extensionVersion ? ` · v${st.extensionVersion}` : "");
}

function renderStatus(status) {
  const mode = status?.mode ?? "demo";
  setModeUi(mode);
  renderGoldeAutopilot(status?.goldeAutopilot, mode);

  if (!status?.ok && status?.error && goldeStatus) {
    goldeStatus.textContent = `Erro: ${status.error}`;
  }

  const cfg = status?.goldeConfig ?? {};
  if (goldeCasinoId instanceof HTMLInputElement && !goldeCasinoId.dataset.touched) {
    goldeCasinoId.value = cfg.casinoId ?? "";
  }
  if (maxGales instanceof HTMLSelectElement) {
    maxGales.value = String(clampMaxGales(cfg.maxRecovery ?? 5));
  }

  const lines = [];
  lines.push(`Modo: ${mode === "real" ? "REAL (cliques CDP)" : "DEMO (simulado)"}`);
  lines.push(`Mesa: ${cfg.mesaUrl ?? "golde.bet.br/french-roulette-la-partage"}`);
  lines.push(`Table ID: ${cfg.tableId ?? 28401}`);
  lines.push(`Extensão: v${chrome.runtime.getManifest().version}`);

  if (status?.lastTest) {
    const t = status.lastTest;
    lines.push("", `Teste ${t.betKey}: ${t.ok ? "✓" : "⚠"} ${t.detail}`);
  }

  if (status?.calibration?.bets) {
    lines.push("", "Calibração:");
    for (const [key, info] of Object.entries(status.calibration.bets)) {
      lines.push(`  ✓ ${key}: ${Math.round((info.x ?? 0) * 100)}%, ${Math.round((info.y ?? 0) * 100)}%`);
    }
  } else {
    lines.push("", "Calibração: pendente — use 📍 na mesa GoldeBet");
  }

  if (status?.calibrationArmed) {
    lines.push("", `Aguardando clique: ${status.calibrationArmed.label}`);
  }

  if (out) out.textContent = lines.join("\n");

  if (calStatus) {
    calStatus.textContent = status?.calibrationArmed
      ? `Overlay activo — clique em ${status.calibrationArmed.label} na roleta`
      : status?.calibration?.bets
        ? "Calibração gravada para este site."
        : "Abra a roleta GoldeBet, aguarde carregar, clique na aba e use 📍.";
  }
}

async function loadStatus() {
  const status = await send("get-status");
  renderStatus(status);
}

modeDemoBtn?.addEventListener("click", async () => {
  await send("set-mode", { mode: "demo" });
  await loadStatus();
});

modeRealBtn?.addEventListener("click", async () => {
  if (!window.confirm("Modo REAL — a extensão vai clicar na mesa GoldeBet. Confirma?")) return;
  await send("set-mode", { mode: "real" });
  await loadStatus();
});

goldeOnBtn?.addEventListener("click", async () => {
  await send("set-golde-autopilot", { enabled: true });
  await loadStatus();
});

goldeOffBtn?.addEventListener("click", async () => {
  await send("set-golde-autopilot", { enabled: false });
  await loadStatus();
});

goldeResetBtn?.addEventListener("click", async () => {
  await send("reset-golde-stats");
  await loadStatus();
});

document.getElementById("refresh")?.addEventListener("click", loadStatus);

document.querySelectorAll("[data-bet]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const betKey = btn.getAttribute("data-bet");
    const label = btn.getAttribute("data-label");
    const r = await send("test-bet", { betKey, label });
    if (out) out.textContent = `${betKey}: ${r.ok ? "✓" : "⚠"} ${r.detail ?? r.error ?? ""}`;
    await loadStatus();
  });
});

document.querySelectorAll(".cal").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const betKey = btn.getAttribute("data-cal");
    const label = btn.getAttribute("data-cal-label");
    const r = await send("arm-calibration", { betKey, label });
    if (calStatus) calStatus.textContent = r.detail ?? r.error ?? "Overlay activo";
    await loadStatus();
  });
});

document.getElementById("calClear")?.addEventListener("click", async () => {
  const r = await send("clear-calibration");
  if (calStatus) calStatus.textContent = r.detail ?? "Calibração apagada";
  await loadStatus();
});

goldeCasinoId?.addEventListener("input", () => {
  if (goldeCasinoId instanceof HTMLInputElement) goldeCasinoId.dataset.touched = "1";
});

goldeSaveBtn?.addEventListener("click", async () => {
  const status = await send("get-status");
  const prev = status?.goldeConfig ?? {};
  const config = {
    ...prev,
    casinoId:
      (goldeCasinoId instanceof HTMLInputElement ? goldeCasinoId.value : "").trim() || prev.casinoId,
    maxRecovery: clampMaxGales(
      maxGales instanceof HTMLSelectElement ? maxGales.value : prev.maxRecovery,
    ),
  };
  const r = await send("set-golde-config", { config });
  if (goldeConfigStatus) {
    goldeConfigStatus.textContent = r?.ok !== false ? "Guardado — reinicia autopilot se activo" : r?.error ?? "Erro";
  }
  await loadStatus();
});

loadStatus();
setInterval(loadStatus, 3000);
