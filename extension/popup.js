const STORAGE_DGA_CONFIG = "gogDgaConfig";
const STORAGE_BRIDGE_PREFS = "gogBridgePrefs";
const STORAGE_MODE = "gogExecutionMode";
const STORAGE_BRIDGE_ENABLED = "gogBridgeEnabled";

const DGA_CONFIG_DEFAULTS = {
  wsUrl: "wss://dga.pragmaticplaylive.net/ws",
  casinoId: "ppcdk00000005148",
  currency: "BRL",
  tableIds: [227, 203, 230, 201, 206, 237, 213],
  mesaEmbedUrl: "",
  preBetWaitSec: 11,
  maxRecovery: 5,
  syncSecret: "",
};

const dgaCasinoId = document.getElementById("dgaCasinoId");
const dgaCurrency = document.getElementById("dgaCurrency");
const dgaTableIds = document.getElementById("dgaTableIds");
const dgaMesaUrl = document.getElementById("dgaMesaUrl");
const dgaWsUrl = document.getElementById("dgaWsUrl");
const dgaPreBetWait = document.getElementById("dgaPreBetWait");
const dgaSyncSecret = document.getElementById("dgaSyncSecret");
const maxGales = document.getElementById("maxGales");
const bridgePrefsStatus = document.getElementById("bridgePrefsStatus");
const bridgeStatus = document.getElementById("bridgeStatus");
const bridgeOnBtn = document.getElementById("bridgeOn");
const bridgeOffBtn = document.getElementById("bridgeOff");
const dgaConfigStatus = document.getElementById("dgaConfigStatus");
const dgaSaveBtn = document.getElementById("dgaSave");
const dgaResetBtn = document.getElementById("dgaReset");

function parseTableIdsInput(raw) {
  return String(raw ?? "")
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function formatTableIdsInput(ids) {
  return (ids ?? []).join(", ");
}

function mergeDgaConfig(stored) {
  const base = { ...DGA_CONFIG_DEFAULTS };
  if (!stored || typeof stored !== "object") return base;
  const tableIds = Array.isArray(stored.tableIds)
    ? stored.tableIds.filter((n) => typeof n === "number" && n > 0)
    : base.tableIds;
  return {
    wsUrl: typeof stored.wsUrl === "string" && stored.wsUrl.trim() ? stored.wsUrl.trim() : base.wsUrl,
    casinoId:
      typeof stored.casinoId === "string" && stored.casinoId.trim()
        ? stored.casinoId.trim()
        : base.casinoId,
    currency:
      typeof stored.currency === "string" && stored.currency.trim()
        ? stored.currency.trim()
        : base.currency,
    tableIds: tableIds.length > 0 ? tableIds : base.tableIds,
    mesaEmbedUrl: typeof stored.mesaEmbedUrl === "string" ? stored.mesaEmbedUrl.trim() : "",
    preBetWaitSec:
      typeof stored.preBetWaitSec === "number" && stored.preBetWaitSec >= 0
        ? stored.preBetWaitSec
        : base.preBetWaitSec,
    maxRecovery: clampMaxGales(stored.maxRecovery ?? base.maxRecovery),
    syncSecret: typeof stored.syncSecret === "string" ? stored.syncSecret.trim() : "",
  };
}

function clampMaxGales(value) {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return DGA_CONFIG_DEFAULTS.maxRecovery;
  return Math.min(6, Math.max(0, n));
}

function fillDgaConfigForm(config) {
  if (dgaCasinoId instanceof HTMLInputElement) dgaCasinoId.value = config.casinoId;
  if (dgaCurrency instanceof HTMLInputElement) dgaCurrency.value = config.currency;
  if (dgaTableIds instanceof HTMLTextAreaElement) {
    dgaTableIds.value = formatTableIdsInput(config.tableIds);
  }
  if (dgaMesaUrl instanceof HTMLInputElement) dgaMesaUrl.value = config.mesaEmbedUrl ?? "";
  if (dgaWsUrl instanceof HTMLInputElement) dgaWsUrl.value = config.wsUrl;
  if (dgaPreBetWait instanceof HTMLInputElement) {
    dgaPreBetWait.value = String(config.preBetWaitSec ?? 11);
  }
  if (dgaSyncSecret instanceof HTMLInputElement) {
    dgaSyncSecret.value = config.syncSecret ?? "";
  }
}

function readDgaConfigForm() {
  const tableIds = parseTableIdsInput(
    dgaTableIds instanceof HTMLTextAreaElement ? dgaTableIds.value : "",
  );
  return {
    casinoId:
      (dgaCasinoId instanceof HTMLInputElement ? dgaCasinoId.value : "").trim() ||
      DGA_CONFIG_DEFAULTS.casinoId,
    currency:
      (dgaCurrency instanceof HTMLInputElement ? dgaCurrency.value : "").trim() ||
      DGA_CONFIG_DEFAULTS.currency,
    tableIds: tableIds.length > 0 ? tableIds : [...DGA_CONFIG_DEFAULTS.tableIds],
    mesaEmbedUrl: (dgaMesaUrl instanceof HTMLInputElement ? dgaMesaUrl.value : "").trim(),
    preBetWaitSec: Math.max(
      0,
      parseInt(dgaPreBetWait instanceof HTMLInputElement ? dgaPreBetWait.value : "11", 10) ||
        DGA_CONFIG_DEFAULTS.preBetWaitSec,
    ),
    maxRecovery: DGA_CONFIG_DEFAULTS.maxRecovery,
    wsUrl:
      (dgaWsUrl instanceof HTMLInputElement ? dgaWsUrl.value : "").trim() ||
      DGA_CONFIG_DEFAULTS.wsUrl,
    syncSecret:
      (dgaSyncSecret instanceof HTMLInputElement ? dgaSyncSecret.value : "").trim() ||
      DGA_CONFIG_DEFAULTS.syncSecret,
  };
}

function loadDgaConfigForm() {
  chrome.storage.local.get([STORAGE_DGA_CONFIG], (data) => {
    const config = mergeDgaConfig(data[STORAGE_DGA_CONFIG]);
    fillDgaConfigForm(config);
    if (dgaConfigStatus) {
      dgaConfigStatus.textContent = `${config.tableIds.length} mesas · ${config.casinoId} · ${config.currency}`;
    }
  });
}

function saveDgaConfigForm() {
  const config = readDgaConfigForm();
  chrome.storage.local.set({ [STORAGE_DGA_CONFIG]: config }, () => {
    if (chrome.runtime.lastError && dgaConfigStatus) {
      dgaConfigStatus.textContent = chrome.runtime.lastError.message;
      return;
    }
    if (dgaConfigStatus) {
      dgaConfigStatus.textContent = `Guardado · ${config.tableIds.length} mesas · reinicia autopilot se activo`;
    }
    loadStatus();
  });
}

function resetDgaConfigForm() {
  chrome.storage.local.set({ [STORAGE_DGA_CONFIG]: { ...DGA_CONFIG_DEFAULTS } }, () => {
    fillDgaConfigForm(DGA_CONFIG_DEFAULTS);
    if (dgaConfigStatus) dgaConfigStatus.textContent = "Configuração reposta — autopilot reinicia se activo";
    loadStatus();
  });
}

loadDgaConfigForm();
loadBridgePrefsForm();

/** Estado «Ligar» e modo Demo/Real logo ao abrir o popup. */
chrome.storage.local.get([STORAGE_BRIDGE_ENABLED, STORAGE_MODE], (data) => {
  if (chrome.runtime.lastError) return;
  setBridgeUi(data[STORAGE_BRIDGE_ENABLED] !== false);
  setModeUi(data[STORAGE_MODE] === "real" ? "real" : "demo");
});

dgaSaveBtn?.addEventListener("click", saveDgaConfigForm);
dgaResetBtn?.addEventListener("click", resetDgaConfigForm);

const out = document.getElementById("out");
const calStatus = document.getElementById("calStatus");
const calBackupStatus = document.getElementById("calBackupStatus");
const chipStatus = document.getElementById("chipStatus");
const clickChipBeforeBet = document.getElementById("clickChipBeforeBet");
const modeDemoBtn = document.getElementById("modeDemo");
const modeRealBtn = document.getElementById("modeReal");
const modePill = document.getElementById("modePill");
const autopilotStatus = document.getElementById("autopilotStatus");
const autopilotOnBtn = document.getElementById("autopilotOn");
const autopilotOffBtn = document.getElementById("autopilotOff");

function setModeUi(mode) {
  const isDemo = mode !== "real";
  modeDemoBtn?.classList.toggle("active-demo", isDemo);
  modeRealBtn?.classList.toggle("active-real", !isDemo);
  if (modePill) {
    modePill.textContent = isDemo ? "DEMO" : "REAL";
    modePill.className = `pill ${isDemo ? "demo" : "real"}`;
  }
}

const BET_GROUP_LABELS = {
  paridade: "Paridade",
  cor: "Cor",
  altura: "Altura",
};

const BET_GROUP_ORDER = ["paridade", "cor", "altura"];

function groupCalibrationBets(bets) {
  const grouped = {
    paridade: [],
    cor: [],
    altura: [],
    other: [],
  };
  for (const [key, info] of Object.entries(bets ?? {})) {
    const group = info?.group ?? (key === "odd" || key === "even" ? "paridade" : key === "red" || key === "black" ? "cor" : key === "low" || key === "high" ? "altura" : "other");
    if (grouped[group]) grouped[group].push({ key, info });
    else grouped.other.push({ key, info });
  }
  return grouped;
}

function formatBetLine(key, info) {
  return `${key}: ${Math.round((info.x ?? 0) * 100)}%, ${Math.round((info.y ?? 0) * 100)}%`;
}

function pickBestScanFrames(scans) {
  const result = {};
  for (const scan of scans) {
    if (!scan?.report) continue;
    for (const [key, info] of Object.entries(scan.report)) {
      const prev = result[key];
      if (!prev || (info.ok && (info.score ?? 0) > (prev.score ?? 0))) {
        result[key] = info;
      }
    }
  }
  return result;
}

function renderBridgePrefs(prefs) {
  const maxRecovery = clampMaxGales(prefs?.maxRecovery ?? 5);
  if (maxGales instanceof HTMLSelectElement) {
    maxGales.value = String(maxRecovery);
  }
  if (bridgePrefsStatus) {
    const label = maxRecovery === 0 ? "sem gales (só entrada)" : `máx ${maxRecovery} gales`;
    bridgePrefsStatus.textContent = `Gales: ${label} — sincronizado com a sala no app.`;
  }
}

function setBridgeUi(enabled) {
  const on = enabled !== false;
  bridgeOnBtn?.classList.toggle("active-real", on);
  bridgeOffBtn?.classList.toggle("active-demo", !on);
  if (bridgeStatus) {
    bridgeStatus.textContent = on
      ? "Ligada — segue sinais da sala rotativa no app."
      : "Desligada — ignora entradas da sala. Use «Ligar» para voltar a apostar.";
  }
}

function loadBridgePrefsForm() {
  chrome.runtime.sendMessage({ kind: "get-bridge-prefs" }, (prefs) => {
    if (!chrome.runtime.lastError) renderBridgePrefs(prefs);
  });
}

function renderStatus(status) {
  const mode = status?.mode ?? "demo";
  setModeUi(mode);

  const lines = [];
  lines.push(`Modo: ${mode === "real" ? "REAL (cliques)" : "DEMO (simulado)"}`);
  const bridgeOn = status?.bridgeEnabled !== false;
  lines.push(`Sala: ${bridgeOn ? "LIGADA" : "DESLIGADA"}`);
  setBridgeUi(bridgeOn);

  const bridge = status?.lastBridge;
  const ctx = status?.lastContext;
  const results = status?.lastResults;

  if (!bridge) {
    lines.push("", "Aguarda sinal da sala rotativa no app…");
    lines.push("Ou teste Ímpar/Par com a mesa aberta.");
  } else {
    lines.push("", `Último sinal: ${bridge.at}`);
    lines.push("Acções:");
    (bridge.actions || []).forEach((a) => {
      lines.push(a.kind === "wait" ? `  ⏳ ${a.reason}` : `  🖱 ${a.target} → ${a.label}`);
    });
  }

  if (ctx?.mesaEmbedUrl) lines.push("", `Mesa: ${ctx.mesaEmbedUrl}`);
  if (ctx?.mesaProvider && ctx.mesaProvider !== "outro") lines.push(`Provedor: ${ctx.mesaProvider}`);
  if (ctx?.factor1BetKey) lines.push(`Aposta: ${ctx.factor1Label} → ${ctx.factor1BetKey}`);
  if (typeof ctx?.stakeAmount === "number") {
    const stake =
      ctx.stakeAmount >= 1
        ? `R$ ${ctx.stakeAmount.toFixed(0)}`
        : `R$ ${ctx.stakeAmount.toFixed(2).replace(".", ",")}`;
    lines.push(
      `Stake: ${stake}${ctx.currentRecovery > 0 ? ` (gale ${ctx.currentRecovery}/${ctx.maxRecovery ?? "?"})` : ""}`,
    );
  }
  if (ctx?.executionMode === "real") lines.push("Execução: REAL (sinal da app)");
  else if (ctx?.executionMode === "demo" && mode === "real") {
    lines.push("Execução: REAL (popup) — app enviou demo");
  } else if (ctx?.executionMode === "demo") {
    lines.push("Execução: DEMO (sinal da app)");
  }

  if (results?.length) {
    lines.push("", "Resultado:");
    results.forEach((r) => {
      const modeTag = r.dryRun ? "[demo]" : "[real]";
      lines.push(`  ${r.ok ? "✓" : "⚠"} ${modeTag} ${r.target}: ${r.detail}`);
    });
  }

  if (status?.lastTest) {
    const t = status.lastTest;
    lines.push("", `Teste ${t.betKey} (${t.mode ?? "?"}): ${t.ok ? "✓" : "⚠"} ${t.detail}`);
  }

  if (status?.calibration?.bets) {
    lines.push("", "Calibração gravada:");
    const grouped = groupCalibrationBets(status.calibration.bets);
    for (const group of BET_GROUP_ORDER) {
      const items = grouped[group];
      if (!items.length) continue;
      lines.push(`  ${BET_GROUP_LABELS[group]}:`);
      for (const { key, info } of items) {
        lines.push(`    ✓ ${formatBetLine(key, info)}`);
      }
    }
    if (grouped.other.length) {
      lines.push("  Outros:");
      for (const { key, info } of grouped.other) {
        lines.push(`    ✓ ${formatBetLine(key, info)}`);
      }
    }
  } else if (status?.calibrationSiteKey) {
    lines.push("", "Calibração: nenhuma — use 📍 Par/Ímpar");
  }

  if (status?.calibration?.chip) {
    const chip = status.calibration.chip;
    lines.push(
      "",
      `Ficha: R$ ${chip.value ?? "?"} · ${Math.round((chip.x ?? 0) * 100)}%, ${Math.round((chip.y ?? 0) * 100)}%`,
    );
  }

  if (status?.calibrationArmed) {
    lines.push("", `Aguardando clique: ${status.calibrationArmed.label}`);
  }

  out.textContent = lines.join("\n");

  if (calStatus && status?.calibration?.bets) {
    const grouped = groupCalibrationBets(status.calibration.bets);
    const parts = BET_GROUP_ORDER.map((g) => {
      const keys = grouped[g].map(({ key }) => key);
      return keys.length ? `${BET_GROUP_LABELS[g]}: ${keys.join(", ")}` : null;
    }).filter(Boolean);
    calStatus.textContent =
      parts.length > 0
        ? `Gravado — ${parts.join(" · ")}`
        : "Grave Par/Ímpar com 1 clique exacto na mesa.";
  }

  if (chipStatus) {
    const chip = status?.calibration?.chip;
    const clickChip = status?.clickChipBeforeBet === true;
    chipStatus.textContent = clickChip
      ? chip
        ? `Vai clicar ficha R$ ${chip.value ?? "?"} antes de cada aposta.`
        : "Active «Clicar na ficha» mas ainda não calibrada — grave abaixo."
      : "Ficha não é clicada (já seleccionada na mesa). Gale = vários cliques no tapete.";
  }

  if (clickChipBeforeBet instanceof HTMLInputElement) {
    clickChipBeforeBet.checked = status?.clickChipBeforeBet === true;
  }

  if (status?.dgaConfig && dgaConfigStatus) {
    const c = status.dgaConfig;
    dgaConfigStatus.textContent = `Activo: ${c.tableIds?.length ?? 0} mesas · ${c.casinoId} · ${c.currency}`;
  }

  if (status?.bridgePrefs) renderBridgePrefs(status.bridgePrefs);

  const ap = status?.autopilot;
  if (autopilotStatus && ap) {
    const st = ap.status ?? {};
    const on = ap.enabled === true;
    autopilotOnBtn?.classList.toggle("active-real", on && st.running);
    autopilotOffBtn?.classList.toggle("active-demo", !on || !st.running);
    const parts = [
      on ? (st.running ? "Autopilot ON · DGA ligada" : "Autopilot ON · a ligar…") : "Autopilot OFF",
    ];
    if (st.waitingBet) parts.push(`aguarda ${st.waitRemainingSec ?? "?"}s para apostar`);
    if (st.active && st.label) parts.push(`Sinal: ${st.label} (mesa ${st.tableId})`);
    if (st.recovery > 0) parts.push(`Gale ${st.recovery}/${st.maxRecovery ?? "?"}`);
    else if (st.maxRecovery) parts.push(`Gales máx: ${st.maxRecovery}`);
    if (st.reason) parts.push(st.reason);
    if (st.lastError) parts.push(`Erro: ${st.lastError}`);
    autopilotStatus.textContent = parts.join(" · ");
  }
}

function loadStatusFromStorage(extraLines = []) {
  chrome.storage.local.get(
    [
      STORAGE_MODE,
      STORAGE_BRIDGE_ENABLED,
      "gogLastBridge",
      "gogLastContext",
      "gogLastResults",
      "gogLastTest",
      "gogBetCalibration",
      "gogCalibrationArmed",
      "gogClickChipBeforeBet",
      STORAGE_BRIDGE_PREFS,
      "gogAutopilotStatus",
      "gogAutopilotEnabled",
    ],
    (data) => {
      if (chrome.runtime.lastError && out) {
        out.textContent = chrome.runtime.lastError.message;
        return;
      }
      const mode = data[STORAGE_MODE] === "real" ? "real" : "demo";
      renderStatus({
        mode,
        bridgeEnabled: data[STORAGE_BRIDGE_ENABLED] !== false,
        bridgePrefs: data[STORAGE_BRIDGE_PREFS] ?? {},
        lastBridge: data.gogLastBridge ?? null,
        lastContext: data.gogLastContext ?? null,
        lastResults: data.gogLastResults ?? null,
        lastTest: data.gogLastTest ?? null,
        calibration: null,
        calibrationArmed: data.gogCalibrationArmed ?? null,
        clickChipBeforeBet: data.gogClickChipBeforeBet === true,
        autopilot: {
          enabled: data.gogAutopilotEnabled === true,
          status: data.gogAutopilotStatus ?? { running: false },
        },
      });
      if (extraLines.length && out) {
        out.textContent = `${extraLines.join("\n")}\n\n${out.textContent}`;
      }
    },
  );
}

function loadStatus() {
  let settled = false;
  const timer = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    loadStatusFromStorage([
      "⚠ Service worker sem resposta (timeout)",
      "Modo e «Ligar» usam armazenamento local — os botões devem responder.",
      "Recarregue a extensão em chrome://extensions se o estado não actualizar.",
    ]);
  }, 3500);

  chrome.runtime.sendMessage({ kind: "get-status" }, (status) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    if (chrome.runtime.lastError || !status?.ok) {
      const err = chrome.runtime.lastError?.message ?? "Service worker sem resposta";
      loadStatusFromStorage([
        `⚠ ${err}`,
        "Modo e «Ligar» funcionam via armazenamento local.",
        "Se persistir: chrome://extensions → Recarregar → feche e reabra este popup.",
      ]);
      return;
    }
    renderStatus(status);
    chrome.storage.local.get(["gogLastScan"], (data) => {
      if (data.gogLastScan?.scans?.length) {
        const best = pickBestScanFrames(data.gogLastScan.scans);
        const extra = ["", "Varredura (melhor frame):"];
        for (const [key, info] of Object.entries(best)) {
          extra.push(`  ${info.ok ? "✓" : "·"} ${key}: ${info.ok ? `score ${info.score}` : "—"}`);
        }
        out.textContent += `\n${extra.join("\n")}`;
      }
    });
  });
}

function applyModeToStorage(mode, done) {
  const isReal = mode === "real";
  chrome.storage.local.set(
    {
      [STORAGE_MODE]: isReal ? "real" : "demo",
      gogExteriorDryRun: !isReal,
      gogPragmaticDryRun: !isReal,
    },
    () => {
      if (chrome.runtime.lastError) {
        if (out) out.textContent = chrome.runtime.lastError.message;
        return;
      }
      setModeUi(mode);
      done?.();
    },
  );
}

function setMode(mode) {
  applyModeToStorage(mode, () => {
    chrome.runtime.sendMessage({ kind: "set-mode", mode }, () => loadStatus());
  });
}

function setBridgeEnabled(enabled) {
  chrome.storage.local.set({ [STORAGE_BRIDGE_ENABLED]: enabled === true }, () => {
    if (chrome.runtime.lastError) {
      if (out) out.textContent = chrome.runtime.lastError.message;
      return;
    }
    setBridgeUi(enabled);
    chrome.runtime.sendMessage({ kind: "set-bridge-enabled", enabled: enabled === true }, () =>
      loadStatus(),
    );
  });
}

modeDemoBtn?.addEventListener("click", () => setMode("demo"));
modeRealBtn?.addEventListener("click", () => {
  if (!window.confirm("Modo REAL envia cliques na mesa. Confirma?")) return;
  setMode("real");
});

autopilotOnBtn?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ kind: "set-autopilot", enabled: true }, () => loadStatus());
});

autopilotOffBtn?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ kind: "set-autopilot", enabled: false }, () => loadStatus());
});

bridgeOnBtn?.addEventListener("click", () => setBridgeEnabled(true));

bridgeOffBtn?.addEventListener("click", () => setBridgeEnabled(false));

maxGales?.addEventListener("change", () => {
  if (!(maxGales instanceof HTMLSelectElement)) return;
  chrome.runtime.sendMessage(
    { kind: "set-bridge-prefs", prefs: { maxRecovery: clampMaxGales(maxGales.value) } },
    () => loadBridgePrefsForm(),
  );
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_MODE]) {
    setModeUi(changes[STORAGE_MODE].newValue === "real" ? "real" : "demo");
  }
  if (changes[STORAGE_BRIDGE_ENABLED]) {
    setBridgeUi(changes[STORAGE_BRIDGE_ENABLED].newValue !== false);
  }
  if (changes[STORAGE_BRIDGE_PREFS]) {
    renderBridgePrefs(changes[STORAGE_BRIDGE_PREFS].newValue);
  }
  if (changes.gogAutopilotStatus || changes.gogAutopilotSessionStats) {
    loadStatus();
  }
});

document.querySelectorAll("button[data-bet]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const betKey = btn.getAttribute("data-bet");
    const label = btn.getAttribute("data-label") ?? betKey;
    chrome.runtime.sendMessage({ kind: "test-bet", betKey, label }, () => loadStatus());
  });
});

document.getElementById("scan")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ kind: "scan-bets" }, () => loadStatus());
});

document.getElementById("refresh")?.addEventListener("click", loadStatus);

document.querySelectorAll("button.cal").forEach((btn) => {
  btn.addEventListener("click", () => {
    const betKey = btn.getAttribute("data-cal");
    const label = btn.getAttribute("data-cal-label") ?? betKey;
    if (calStatus) {
      calStatus.textContent = `A activar overlay na mesa: ${label}…`;
    }
    chrome.runtime.sendMessage({ kind: "arm-calibration", betKey, label }, (resp) => {
      if (chrome.runtime.lastError) {
        if (calStatus) calStatus.textContent = chrome.runtime.lastError.message;
        return;
      }
      if (calStatus) {
        calStatus.textContent = resp?.ok
          ? `${label}: ecrã azul na mesa — clique em ${label}. ESC cancela.`
          : resp?.detail || "Erro ao calibrar";
      }
      if (resp?.ok) window.close();
    });
  });
});

document.getElementById("calChip")?.addEventListener("click", () => {
  const select = document.getElementById("chipValue");
  const chipValue = select instanceof HTMLSelectElement ? Number(select.value) || 50 : 50;
  const label = `Ficha R$ ${chipValue}`;
  if (chipStatus) chipStatus.textContent = `A activar overlay na mesa: ${label}…`;
  chrome.runtime.sendMessage({ kind: "arm-calibration", betKey: "chip", label, chipValue }, (resp) => {
    if (chrome.runtime.lastError) {
      if (chipStatus) chipStatus.textContent = chrome.runtime.lastError.message;
      return;
    }
    if (chipStatus) {
      chipStatus.textContent = resp?.ok
        ? `${label}: ecrã azul na mesa — clique na ficha. ESC cancela.`
        : resp?.detail || "Erro ao calibrar ficha";
    }
    if (resp?.ok) window.close();
  });
});

document.getElementById("calClear")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ kind: "clear-calibration" }, (resp) => {
    if (calStatus) calStatus.textContent = resp?.detail || "Calibração apagada";
    if (calBackupStatus) calBackupStatus.textContent = resp?.detail || "Calibração apagada";
    loadStatus();
  });
});

document.getElementById("calExport")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ kind: "export-calibration" }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) {
      if (calBackupStatus) {
        calBackupStatus.textContent = chrome.runtime.lastError?.message || "Erro ao exportar";
      }
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(resp.payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `singlestake-calibracao-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (calBackupStatus) calBackupStatus.textContent = "Exportado — ficheiro JSON guardado no PC.";
  });
});

document.getElementById("calImportBtn")?.addEventListener("click", () => {
  document.getElementById("calImportFile")?.click();
});

document.getElementById("calImportFile")?.addEventListener("change", (ev) => {
  const input = ev.target;
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result ?? ""));
      chrome.runtime.sendMessage({ kind: "import-calibration", payload }, (resp) => {
        if (calBackupStatus) {
          calBackupStatus.textContent = resp?.ok
            ? resp.detail || "Importado com sucesso"
            : resp?.detail || "Erro ao importar";
        }
        loadStatus();
      });
    } catch {
      if (calBackupStatus) calBackupStatus.textContent = "JSON inválido";
    }
    input.value = "";
  };
  reader.readAsText(file);
});

clickChipBeforeBet?.addEventListener("change", () => {
  if (!(clickChipBeforeBet instanceof HTMLInputElement)) return;
  chrome.runtime.sendMessage(
    { kind: "set-click-chip-before-bet", enabled: clickChipBeforeBet.checked },
    () => loadStatus(),
  );
});

document.getElementById("primeFile")?.addEventListener("change", (ev) => {
  const input = ev.target;
  const status = document.getElementById("primeStatus");
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result ?? "");
    chrome.storage.local.set(
      {
        gogPrimeBackup: {
          name: file.name,
          at: new Date().toISOString(),
          raw: text.trim(),
        },
      },
      () => {
        if (status) {
          status.textContent = `Backup guardado: ${file.name} — use IMPORTAR CONFIG no painel ou aguarde decode.`;
        }
        loadStatus();
      },
    );
  };
  reader.readAsText(file);
});

loadStatusFromStorage();
loadStatus();
