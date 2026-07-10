const out = document.getElementById("out");
const calStatus = document.getElementById("calStatus");
const kto2fStatus = document.getElementById("kto2fStatus");
const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const modePill = document.getElementById("modePill");
const kto2fOnBtn = document.getElementById("kto2fOn");
const kto2fOffBtn = document.getElementById("kto2fOff");
const kto2fResetBtn = document.getElementById("kto2fReset");
const kto2fCasinoId = document.getElementById("kto2fCasinoId");
const maxGales = document.getElementById("maxGales");
const kto2fSaveBtn = document.getElementById("kto2fSave");
const kto2fConfigStatus = document.getElementById("kto2fConfigStatus");

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
  if (!Number.isFinite(n)) return 6;
  return Math.min(6, Math.max(0, n));
}

function renderKtoAutopilot(kto2f, mode) {
  const st = kto2f?.status ?? {};
  const on = kto2f?.enabled === true;
  const running = st.running === true;
  const wins = st.wins ?? 0;
  const losses = st.losses ?? 0;

  if (winsEl) winsEl.textContent = String(wins);
  if (lossesEl) lossesEl.textContent = String(losses);

  kto2fOnBtn?.classList.toggle("active-real", on);
  kto2fOffBtn?.classList.toggle("active-demo", !on);

  if (!kto2fStatus) return;

  if (!on) {
    kto2fStatus.textContent = "Parada — clique Ligar para seguir a mesa 230 via DGA.";
    return;
  }

  if (st.lastError) {
    kto2fStatus.textContent = `Erro: ${st.lastError}`;
    return;
  }

  if (st.waitingBet) {
    kto2fStatus.textContent = `Aguardando janela de aposta · ${st.label ?? "—"} (gale ${st.recovery ?? 0})`;
    return;
  }

  if (st.active && st.label) {
    kto2fStatus.textContent = `Activa · ${st.label} · gale ${st.recovery ?? 0} · modo ${mode === "real" ? "REAL" : "demo"}`;
    return;
  }

  if (running) {
    const galeHint =
      (st.recovery ?? 0) > 0 ? ` · gale pendente ${st.recovery}` : "";
    const ver = st.extensionVersion ? ` · v${st.extensionVersion}` : "";
    kto2fStatus.textContent =
      (st.reason ?? "A monitorizar gatilhos (2 factores em comum)…") + galeHint + ver;
    return;
  }

  kto2fStatus.textContent = (st.reason ?? "A ligar DGA…") + (st.extensionVersion ? ` · v${st.extensionVersion}` : "");
}

function renderStatus(status) {
  const mode = status?.mode ?? "demo";
  setModeUi(mode);
  renderKtoAutopilot(status?.kto2fAutopilot, mode);

  const cfg = status?.kto2fConfig ?? {};
  if (kto2fCasinoId instanceof HTMLInputElement && !kto2fCasinoId.dataset.touched) {
    kto2fCasinoId.value = cfg.casinoId ?? "";
  }
  if (maxGales instanceof HTMLSelectElement) {
    maxGales.value = String(clampMaxGales(cfg.maxRecovery ?? 6));
  }

  const lines = [];
  lines.push(`Modo: ${mode === "real" ? "REAL (cliques CDP)" : "DEMO (simulado)"}`);
  lines.push(`Mesa: ${cfg.mesaUrl ?? "kto.bet.br/roulette-3-ppl"}`);
  lines.push(`Table ID: ${cfg.tableId ?? 230}`);
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
    lines.push("", "Calibração: pendente — use 📍 na mesa KTO 2F");
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
        : "Abra a roleta KTO 2F, aguarde carregar, clique na aba e use 📍.";
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
  if (!window.confirm("Modo REAL — a extensão vai clicar na mesa KTO 2F. Confirma?")) return;
  await send("set-mode", { mode: "real" });
  await loadStatus();
});

kto2fOnBtn?.addEventListener("click", async () => {
  await send("set-kto2f-autopilot", { enabled: true });
  await loadStatus();
});

kto2fOffBtn?.addEventListener("click", async () => {
  await send("set-kto2f-autopilot", { enabled: false });
  await loadStatus();
});

kto2fResetBtn?.addEventListener("click", async () => {
  await send("reset-kto2f-stats");
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

kto2fCasinoId?.addEventListener("input", () => {
  if (kto2fCasinoId instanceof HTMLInputElement) kto2fCasinoId.dataset.touched = "1";
});

kto2fSaveBtn?.addEventListener("click", async () => {
  const status = await send("get-status");
  const prev = status?.kto2fConfig ?? {};
  const config = {
    ...prev,
    casinoId:
      (kto2fCasinoId instanceof HTMLInputElement ? kto2fCasinoId.value : "").trim() || prev.casinoId,
    maxRecovery: clampMaxGales(
      maxGales instanceof HTMLSelectElement ? maxGales.value : prev.maxRecovery,
    ),
  };
  const r = await send("set-kto2f-config", { config });
  if (kto2fConfigStatus) {
    kto2fConfigStatus.textContent = r?.ok !== false ? "Guardado — reinicia autopilot se activo" : r?.error ?? "Erro";
  }
  await loadStatus();
});

loadStatus();
setInterval(loadStatus, 3000);
