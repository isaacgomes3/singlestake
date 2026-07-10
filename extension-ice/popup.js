const out = document.getElementById("out");
const calStatus = document.getElementById("calStatus");
const iceStatus = document.getElementById("iceStatus");
const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const modePill = document.getElementById("modePill");
const iceOnBtn = document.getElementById("iceOn");
const iceOffBtn = document.getElementById("iceOff");
const iceResetBtn = document.getElementById("iceReset");
const iceCasinoId = document.getElementById("iceCasinoId");
const maxGales = document.getElementById("maxGales");
const iceSaveBtn = document.getElementById("iceSave");
const iceConfigStatus = document.getElementById("iceConfigStatus");

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

function renderIceAutopilot(ice, mode) {
  const st = ice?.status ?? {};
  const on = ice?.enabled === true;
  const running = st.running === true;
  const wins = st.wins ?? 0;
  const losses = st.losses ?? 0;
  const units = st.units ?? 1;

  if (winsEl) winsEl.textContent = String(wins);
  if (lossesEl) lossesEl.textContent = String(losses);

  iceOnBtn?.classList.toggle("active-real", on);
  iceOffBtn?.classList.toggle("active-demo", !on);

  if (!iceStatus) return;

  if (!on) {
    iceStatus.textContent = "Parada — clique Ligar para seguir a mesa 201 via DGA.";
    return;
  }

  if (st.lastError) {
    iceStatus.textContent = `Erro: ${st.lastError}`;
    return;
  }

  if (st.waitingBet) {
    iceStatus.textContent = `Aguardando janela · ${st.label ?? "—"} (fib ${units} un.)`;
    return;
  }

  if (st.active && st.label) {
    iceStatus.textContent = `Activa · ${st.label} · modo ${mode === "real" ? "REAL" : "demo"}`;
    return;
  }

  if (running) {
    const unitsHint =
      (st.recovery ?? 0) > 0 ? ` · próxima fib ${units} un.` : units > 1 ? ` · ${units} un.` : "";
    const ver = st.extensionVersion ? ` · v${st.extensionVersion}` : "";
    iceStatus.textContent =
      (st.reason ?? "A monitorizar gatilhos (2 dúzias + números)…") + unitsHint + ver;
    return;
  }

  iceStatus.textContent = (st.reason ?? "A ligar DGA…") + (st.extensionVersion ? ` · v${st.extensionVersion}` : "");
}

function renderStatus(status) {
  const mode = status?.mode ?? "demo";
  setModeUi(mode);
  renderIceAutopilot(status?.iceAutopilot, mode);

  const cfg = status?.iceConfig ?? {};
  if (iceCasinoId instanceof HTMLInputElement && !iceCasinoId.dataset.touched) {
    iceCasinoId.value = cfg.casinoId ?? "";
  }
  if (maxGales instanceof HTMLSelectElement) {
    maxGales.style.display = "none";
  }

  const lines = [];
  lines.push(`Modo: ${mode === "real" ? "REAL (cliques CDP)" : "DEMO (simulado)"}`);
  lines.push(`Mesa: ${cfg.mesaUrl ?? "ice.bet.br/liveroulettea-pragmaticexternal"}`);
  lines.push(`Table ID: ${cfg.tableId ?? 201}`);
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
  }
  if (status?.calibration?.chip) {
    const c = status.calibration.chip;
    lines.push(`  ✓ chip: ${Math.round((c.x ?? 0) * 100)}%, ${Math.round((c.y ?? 0) * 100)}%`);
  }
  if (!status?.calibration?.bets && !status?.calibration?.chip) {
    lines.push("", "Calibração: pendente — use 📍 na mesa ICE");
  }

  if (status?.lastCalibSave?.at) {
    lines.push(
      "",
      `Última gravação: ${status.lastCalibSave.ok ? "✓" : "⚠"} ${status.lastCalibSave.betKey ?? "—"} · ${status.lastCalibSave.at}`,
    );
  }

  if (status?.calibrationArmed) {
    lines.push("", `Aguardando clique: ${status.calibrationArmed.label}`);
  }

  if (out) out.textContent = lines.join("\n");

  if (calStatus) {
    calStatus.textContent = status?.calibrationArmed
      ? `Overlay activo — clique em ${status.calibrationArmed.label} na roleta`
      : status?.calibration?.bets || status?.calibration?.chip
        ? "Calibração gravada para este site."
        : "Abra a roleta ICE, aguarde carregar, clique na aba e use 📍.";
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
  if (!window.confirm("Modo REAL — a extensão vai clicar na mesa ICE. Confirma?")) return;
  await send("set-mode", { mode: "real" });
  await loadStatus();
});

iceOnBtn?.addEventListener("click", async () => {
  await send("set-ice-autopilot", { enabled: true });
  await loadStatus();
});

iceOffBtn?.addEventListener("click", async () => {
  await send("set-ice-autopilot", { enabled: false });
  await loadStatus();
});

iceResetBtn?.addEventListener("click", async () => {
  await send("reset-ice-stats");
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

function mountNumberCalibrationGrid() {
  const grid = document.getElementById("numCalGrid");
  if (!grid || grid.dataset.ready === "1") return;
  grid.dataset.ready = "1";
  for (let n = 0; n <= 36; n++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal";
    btn.setAttribute("data-cal", `num:${n}`);
    btn.setAttribute("data-cal-label", `Número ${n}`);
    btn.textContent = `📍 ${n}`;
    btn.addEventListener("click", async () => {
      const r = await send("arm-calibration", {
        betKey: `num:${n}`,
        label: `Número ${n}`,
      });
      if (calStatus) calStatus.textContent = r.detail ?? r.error ?? `Overlay · número ${n}`;
      await loadStatus();
    });
    grid.appendChild(btn);
  }
}

mountNumberCalibrationGrid();

document.getElementById("calClear")?.addEventListener("click", async () => {
  const r = await send("clear-calibration");
  if (calStatus) calStatus.textContent = r.detail ?? "Calibração apagada";
  await loadStatus();
});

iceCasinoId?.addEventListener("input", () => {
  if (iceCasinoId instanceof HTMLInputElement) iceCasinoId.dataset.touched = "1";
});

iceSaveBtn?.addEventListener("click", async () => {
  const status = await send("get-status");
  const prev = status?.iceConfig ?? {};
  const config = {
    ...prev,
    casinoId:
      (iceCasinoId instanceof HTMLInputElement ? iceCasinoId.value : "").trim() || prev.casinoId,
  };
  const r = await send("set-ice-config", { config });
  if (iceConfigStatus) {
    iceConfigStatus.textContent = r?.ok !== false ? "Guardado — reinicia autopilot se activo" : r?.error ?? "Erro";
  }
  await loadStatus();
});

loadStatus();
setInterval(loadStatus, 3000);
