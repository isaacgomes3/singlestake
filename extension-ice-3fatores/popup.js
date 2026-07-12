const out = document.getElementById("out");
const calStatus = document.getElementById("calStatus");
const ice3fStatus = document.getElementById("ice3fStatus");
const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const modePill = document.getElementById("modePill");
const ice3fOnBtn = document.getElementById("ice3fOn");
const ice3fOffBtn = document.getElementById("ice3fOff");
const ice3fResetBtn = document.getElementById("ice3fReset");
const ice3fCasinoId = document.getElementById("ice3fCasinoId");
const maxGales = document.getElementById("maxGales");
const ice3fSaveBtn = document.getElementById("ice3fSave");
const ice3fConfigStatus = document.getElementById("ice3fConfigStatus");
const stakeAutoBtn = document.getElementById("stakeAuto");
const stakeManualBtn = document.getElementById("stakeManual");
const entryUnitsSel = document.getElementById("entryUnits");
const stakeProgress = document.getElementById("stakeProgress");

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

function normalizeEntryUnits(value) {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  const floored = Math.max(1, Math.floor(n));
  const pow = 2 ** Math.round(Math.log2(floored));
  return Math.min(32, Math.max(1, pow));
}

function renderStakeUi(ice3f, cfg) {
  const st = ice3f?.status ?? {};
  const mode = st.stakeMode ?? cfg?.stakeMode ?? "auto";
  const entry = normalizeEntryUnits(st.entryUnits ?? cfg?.entryUnits ?? 1);
  const toward = Math.max(0, Math.floor(st.winsTowardEntryBump ?? 0));
  const perBump = Math.max(1, Math.floor(st.winsPerBump ?? 63));

  stakeAutoBtn?.classList.toggle("active-real", mode === "auto");
  stakeManualBtn?.classList.toggle("active-demo", mode === "manual");
  if (entryUnitsSel instanceof HTMLSelectElement) {
    entryUnitsSel.value = String(entry);
    entryUnitsSel.disabled = mode === "auto";
  }
  if (stakeProgress) {
    stakeProgress.textContent =
      mode === "auto"
        ? `Auto · entrada ${entry}u · progresso ${toward}/${perBump} vitórias → próxima ${Math.min(32, entry * 2)}u`
        : `Manual · entrada ${entry}u (não sobe sozinho; gale 5 não reseta)`;
  }
}

function renderKtoAutopilot(ice3f, mode) {
  const st = ice3f?.status ?? {};
  const on = ice3f?.enabled === true;
  const running = st.running === true;
  const wins = st.wins ?? 0;
  const losses = st.losses ?? 0;

  if (winsEl) winsEl.textContent = String(wins);
  if (lossesEl) lossesEl.textContent = String(losses);

  ice3fOnBtn?.classList.toggle("active-real", on);
  ice3fOffBtn?.classList.toggle("active-demo", !on);

  if (!ice3fStatus) return;

  if (!on) {
    ice3fStatus.textContent = "Parada — clique Ligar para seguir a mesa 201 via DGA.";
    return;
  }

  if (st.lastError) {
    ice3fStatus.textContent = `Erro: ${st.lastError}`;
    return;
  }

  if (st.waitingBet) {
    ice3fStatus.textContent = `Aguardando janela de aposta · ${st.label ?? "—"} (${st.entryUnits ?? 1}u)`;
    return;
  }

  if (st.active && st.label) {
    ice3fStatus.textContent = `Activa · ${st.label} · ${st.entryUnits ?? 1}u · modo ${mode === "real" ? "REAL" : "demo"}`;
    return;
  }

  if (running) {
    const watch = st.watchLabel ? ` · ${st.watchLabel}` : "";
    const ver = st.extensionVersion ? ` · v${st.extensionVersion}` : "";
    ice3fStatus.textContent =
      (st.reason ?? "A monitorizar eco → 3F…") + watch + ver;
    return;
  }

  ice3fStatus.textContent = (st.reason ?? "A ligar DGA…") + (st.extensionVersion ? ` · v${st.extensionVersion}` : "");
}

function renderStatus(status) {
  const mode = status?.mode ?? "demo";
  setModeUi(mode);
  renderKtoAutopilot(status?.ice3fAutopilot, mode);

  const cfg = status?.ice3fConfig ?? {};
  renderStakeUi(status?.ice3fAutopilot, cfg);
  if (ice3fCasinoId instanceof HTMLInputElement && !ice3fCasinoId.dataset.touched) {
    ice3fCasinoId.value = cfg.casinoId ?? "";
  }
  if (maxGales instanceof HTMLSelectElement) {
    maxGales.value = String(clampMaxGales(cfg.maxRecovery ?? 5));
  }

  const lines = [];
  lines.push(`Modo: ${mode === "real" ? "REAL (cliques CDP)" : "DEMO (simulado)"}`);
  lines.push(`Mesa: ${cfg.mesaUrl ?? "ice.bet.br/liveroulettea-pragmaticexternal"}`);
  lines.push(`Table ID: ${cfg.tableId ?? 201}`);
  lines.push(`Stake: ${cfg.stakeMode ?? "auto"} · ${cfg.entryUnits ?? 1}u`);
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
    lines.push("", "Calibração: pendente — use 📍 na mesa ICE 3F");
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
        : "Abra a roleta ICE 3F, aguarde carregar, clique na aba e use 📍.";
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
  if (!window.confirm("Modo REAL — a extensão vai clicar na mesa ICE 3F. Confirma?")) return;
  await send("set-mode", { mode: "real" });
  await loadStatus();
});

ice3fOnBtn?.addEventListener("click", async () => {
  await send("set-ice3f-autopilot", { enabled: true });
  await loadStatus();
});

ice3fOffBtn?.addEventListener("click", async () => {
  await send("set-ice3f-autopilot", { enabled: false });
  await loadStatus();
});

ice3fResetBtn?.addEventListener("click", async () => {
  await send("reset-ice3f-stats");
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

ice3fCasinoId?.addEventListener("input", () => {
  if (ice3fCasinoId instanceof HTMLInputElement) ice3fCasinoId.dataset.touched = "1";
});

ice3fSaveBtn?.addEventListener("click", async () => {
  const status = await send("get-status");
  const prev = status?.ice3fConfig ?? {};
  const config = {
    ...prev,
    casinoId:
      (ice3fCasinoId instanceof HTMLInputElement ? ice3fCasinoId.value : "").trim() || prev.casinoId,
    maxRecovery: clampMaxGales(
      maxGales instanceof HTMLSelectElement ? maxGales.value : prev.maxRecovery,
    ),
    stakeMode: stakeManualBtn?.classList.contains("active-demo") ? "manual" : "auto",
    entryUnits: normalizeEntryUnits(
      entryUnitsSel instanceof HTMLSelectElement ? entryUnitsSel.value : prev.entryUnits,
    ),
  };
  const r = await send("set-ice3f-config", { config });
  if (ice3fConfigStatus) {
    ice3fConfigStatus.textContent = r?.ok !== false ? "Guardado" : r?.error ?? "Erro";
  }
  await loadStatus();
});

async function saveStakeConfig(patch) {
  const status = await send("get-status");
  const prev = status?.ice3fConfig ?? {};
  const st = status?.ice3fAutopilot?.status ?? {};
  const config = {
    ...prev,
    stakeMode: patch.stakeMode ?? st.stakeMode ?? prev.stakeMode ?? "auto",
    entryUnits: normalizeEntryUnits(
      patch.entryUnits ??
        (entryUnitsSel instanceof HTMLSelectElement ? entryUnitsSel.value : null) ??
        st.entryUnits ??
        prev.entryUnits ??
        1,
    ),
  };
  await send("set-ice3f-config", { config });
  await loadStatus();
}

stakeAutoBtn?.addEventListener("click", () => saveStakeConfig({ stakeMode: "auto" }));
stakeManualBtn?.addEventListener("click", () => saveStakeConfig({ stakeMode: "manual" }));
entryUnitsSel?.addEventListener("change", () => {
  if (entryUnitsSel instanceof HTMLSelectElement) {
    void saveStakeConfig({
      stakeMode: "manual",
      entryUnits: normalizeEntryUnits(entryUnitsSel.value),
    });
  }
});

loadStatus();
setInterval(loadStatus, 3000);
