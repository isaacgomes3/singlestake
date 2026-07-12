const out = document.getElementById("out");
const calStatus = document.getElementById("calStatus");
const kto1fStatus = document.getElementById("kto1fStatus");
const winsEl = document.getElementById("wins");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const modePill = document.getElementById("modePill");
const kto1fOnBtn = document.getElementById("kto1fOn");
const kto1fOffBtn = document.getElementById("kto1fOff");
const kto1fResetBtn = document.getElementById("kto1fReset");
const kto1fCasinoId = document.getElementById("kto1fCasinoId");
const kto1fSaveBtn = document.getElementById("kto1fSave");
const kto1fConfigStatus = document.getElementById("kto1fConfigStatus");

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

function setLastEl(el, value) {
  if (!el) return;
  el.textContent = value || "—";
  el.classList.toggle("last-red", value === "Vermelho");
}

function renderScoreboard(st) {
  const board = st?.scoreboard ?? {};
  const best = st?.bestKind ?? null;
  const kinds = [
    ["paridade", "cardParidade", "parWins", "parLosses", "parLast"],
    ["cor", "cardCor", "corWins", "corLosses", "corLast"],
    ["altura", "cardAltura", "altWins", "altLosses", "altLast"],
  ];
  for (const [kind, cardId, winsId, lossesId, lastId] of kinds) {
    const card = document.getElementById(cardId);
    const s = board[kind] ?? { wins: 0, losses: 0, last: null };
    card?.classList.toggle("best", best === kind);
    const w = document.getElementById(winsId);
    const l = document.getElementById(lossesId);
    if (w) w.textContent = String(s.wins ?? 0);
    if (l) l.textContent = String(s.losses ?? 0);
    setLastEl(document.getElementById(lastId), s.last);
  }

  const totalEl = document.getElementById("totalRounds");
  const galeEl = document.getElementById("galeAtual");
  const maxEl = document.getElementById("maxGale");
  if (totalEl) totalEl.textContent = String(st?.totalRounds ?? 0);
  if (winsEl) winsEl.textContent = String(st?.wins ?? 0);
  if (galeEl) galeEl.textContent = String(st?.recovery ?? 0);
  if (maxEl) maxEl.textContent = String(st?.maxRecovery ?? 5);
}

function renderKtoAutopilot(kto1f, mode) {
  const st = kto1f?.status ?? {};
  const on = kto1f?.enabled === true;
  const running = st.running === true;

  renderScoreboard(st);

  kto1fOnBtn?.classList.toggle("active-real", on);
  kto1fOffBtn?.classList.toggle("active-demo", !on);

  if (!kto1fStatus) return;

  if (!on) {
    kto1fStatus.textContent = "Parada — clique Ligar para seguir a mesa 230 via DGA.";
    return;
  }

  if (st.lastError) {
    kto1fStatus.textContent = `Erro: ${st.lastError}`;
    return;
  }

  if (st.waitingBet) {
    kto1fStatus.textContent = `Aguardando janela · ${st.label ?? "—"} (gale ${st.recovery ?? 0})`;
    return;
  }

  if (st.active && st.label) {
    kto1fStatus.textContent = `Activa · ${st.label} · gale ${st.recovery ?? 0} · ${mode === "real" ? "REAL" : "demo"}`;
    return;
  }

  if (running) {
    const galeHint = (st.recovery ?? 0) > 0 ? ` · gale pendente ${st.recovery}` : "";
    kto1fStatus.textContent =
      (st.reason ?? "A monitorizar coincidências 1×13…") + galeHint;
    return;
  }

  kto1fStatus.textContent = st.reason ?? "A ligar DGA…";
}

function renderStatus(status) {
  const mode = status?.mode ?? "demo";
  setModeUi(mode);
  renderKtoAutopilot(status?.kto1fAutopilot, mode);

  const cfg = status?.kto1fConfig ?? {};
  if (kto1fCasinoId instanceof HTMLInputElement && !kto1fCasinoId.dataset.touched) {
    kto1fCasinoId.value = cfg.casinoId ?? "";
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
    lines.push("", "Calibração: pendente — use 📍 na mesa KTO 1F");
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
        : "Abra a roleta KTO 1F, aguarde carregar, clique na aba e use 📍.";
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
  if (!window.confirm("Modo REAL — a extensão vai clicar na mesa KTO 1F. Confirma?")) return;
  await send("set-mode", { mode: "real" });
  await loadStatus();
});

kto1fOnBtn?.addEventListener("click", async () => {
  await send("set-kto1f-autopilot", { enabled: true });
  await loadStatus();
});

kto1fOffBtn?.addEventListener("click", async () => {
  await send("set-kto1f-autopilot", { enabled: false });
  await loadStatus();
});

kto1fResetBtn?.addEventListener("click", async () => {
  await send("reset-kto1f-stats");
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

kto1fCasinoId?.addEventListener("input", () => {
  if (kto1fCasinoId instanceof HTMLInputElement) kto1fCasinoId.dataset.touched = "1";
});

kto1fSaveBtn?.addEventListener("click", async () => {
  const status = await send("get-status");
  const prev = status?.kto1fConfig ?? {};
  const config = {
    ...prev,
    casinoId:
      (kto1fCasinoId instanceof HTMLInputElement ? kto1fCasinoId.value : "").trim() || prev.casinoId,
    maxRecovery: 5,
  };
  const r = await send("set-kto1f-config", { config });
  if (kto1fConfigStatus) {
    kto1fConfigStatus.textContent = r?.ok !== false ? "Guardado — reinicia autopilot se activo" : r?.error ?? "Erro";
  }
  await loadStatus();
});

loadStatus();
setInterval(loadStatus, 3000);
