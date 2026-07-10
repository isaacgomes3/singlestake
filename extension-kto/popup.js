const out = document.getElementById("out");
const calStatus = document.getElementById("calStatus");
const ktoStatus = document.getElementById("ktoStatus");
const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const modePill = document.getElementById("modePill");
const ktoOnBtn = document.getElementById("ktoOn");
const ktoOffBtn = document.getElementById("ktoOff");
const ktoResetBtn = document.getElementById("ktoReset");
const ktoCasinoId = document.getElementById("ktoCasinoId");
const maxGales = document.getElementById("maxGales");
const ktoSaveBtn = document.getElementById("ktoSave");
const ktoConfigStatus = document.getElementById("ktoConfigStatus");

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

function renderKtoAutopilot(kto, mode) {
  const st = kto?.status ?? {};
  const on = kto?.enabled === true;
  const running = st.running === true;
  const wins = st.wins ?? 0;
  const losses = st.losses ?? 0;

  if (winsEl) winsEl.textContent = String(wins);
  if (lossesEl) lossesEl.textContent = String(losses);

  ktoOnBtn?.classList.toggle("active-real", on);
  ktoOffBtn?.classList.toggle("active-demo", !on);

  if (!ktoStatus) return;

  if (!on) {
    ktoStatus.textContent = "Parada — clique Ligar para seguir a mesa 230 via DGA.";
    return;
  }

  if (st.lastError) {
    ktoStatus.textContent = `Erro: ${st.lastError}`;
    return;
  }

  if (st.waitingBet) {
    ktoStatus.textContent = `Aguardando janela de aposta · ${st.label ?? "—"} (gale ${st.recovery ?? 0})`;
    return;
  }

  if (st.active && st.label) {
    ktoStatus.textContent = `Activa · ${st.label} · gale ${st.recovery ?? 0} · modo ${mode === "real" ? "REAL" : "demo"}`;
    return;
  }

  if (running) {
    const galeHint =
      (st.recovery ?? 0) > 0 ? ` · gale pendente ${st.recovery}` : "";
    const ver = st.extensionVersion ? ` · v${st.extensionVersion}` : "";
    ktoStatus.textContent =
      (st.reason ?? "A monitorizar gatilhos (2 factores em comum)…") + galeHint + ver;
    return;
  }

  ktoStatus.textContent = (st.reason ?? "A ligar DGA…") + (st.extensionVersion ? ` · v${st.extensionVersion}` : "");
}

function renderStatus(status) {
  const mode = status?.mode ?? "demo";
  setModeUi(mode);
  renderKtoAutopilot(status?.ktoAutopilot, mode);

  const cfg = status?.ktoConfig ?? {};
  if (ktoCasinoId instanceof HTMLInputElement && !ktoCasinoId.dataset.touched) {
    ktoCasinoId.value = cfg.casinoId ?? "";
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
    lines.push("", "Calibração: pendente — use 📍 na mesa KTO");
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
        : "Abra a roleta KTO, aguarde carregar, clique na aba e use 📍.";
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
  if (!window.confirm("Modo REAL — a extensão vai clicar na mesa KTO. Confirma?")) return;
  await send("set-mode", { mode: "real" });
  await loadStatus();
});

ktoOnBtn?.addEventListener("click", async () => {
  await send("set-kto-autopilot", { enabled: true });
  await loadStatus();
});

ktoOffBtn?.addEventListener("click", async () => {
  await send("set-kto-autopilot", { enabled: false });
  await loadStatus();
});

ktoResetBtn?.addEventListener("click", async () => {
  await send("reset-kto-stats");
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

ktoCasinoId?.addEventListener("input", () => {
  if (ktoCasinoId instanceof HTMLInputElement) ktoCasinoId.dataset.touched = "1";
});

ktoSaveBtn?.addEventListener("click", async () => {
  const status = await send("get-status");
  const prev = status?.ktoConfig ?? {};
  const config = {
    ...prev,
    casinoId:
      (ktoCasinoId instanceof HTMLInputElement ? ktoCasinoId.value : "").trim() || prev.casinoId,
    maxRecovery: clampMaxGales(
      maxGales instanceof HTMLSelectElement ? maxGales.value : prev.maxRecovery,
    ),
  };
  const r = await send("set-kto-config", { config });
  if (ktoConfigStatus) {
    ktoConfigStatus.textContent = r?.ok !== false ? "Guardado — reinicia autopilot se activo" : r?.error ?? "Erro";
  }
  await loadStatus();
});

loadStatus();
setInterval(loadStatus, 3000);
