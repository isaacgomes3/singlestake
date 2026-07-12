/**
 * Painel flutuante na KTO 1F — activar estratégia 1 Fator · cruzamento sequencial (mesa 230).
 */
(function () {
  if (window !== window.top) return;

  /**
 * Painel flutuante na KTO 1F — activar estratégia 1 Fator · cruzamento sequencial (mesa 230).
 */
function pageIsKto1fRoulette() {
    const path = `${location.pathname}${location.hash}${location.search}`;
    return (
      /kto\.bet\.br/i.test(location.hostname) &&
      /\/app\/cassino\/game\/(roulette-3-ppl|roleta-ao-vivo)/i.test(path)
    );
  }

  if (!pageIsKto1fRoulette()) return;
  if (document.getElementById("ss-kto1f-panel-root")) return;

  const PANEL_ID = "ss-kto1f-panel-root";
  const POLL_MS = 2000;
  let pollTimer = null;
  let contextDead = false;

  function isContextInvalidated(message) {
    return /extension context invalidated/i.test(String(message ?? ""));
  }

  function friendlyError(message) {
    if (isContextInvalidated(message)) {
      return "Extensão recarregada — prima F5 nesta página e volte a ligar a estratégia.";
    }
    return message;
  }

  function stopPolling() {
    if (pollTimer != null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function send(kind, extra = {}) {
    if (contextDead) {
      return Promise.resolve({
        ok: false,
        error: "Extensão recarregada — prima F5 nesta página.",
      });
    }
    return new Promise((resolve) => {
      try {
        if (!chrome?.runtime?.id) {
          contextDead = true;
          stopPolling();
          resolve({
            ok: false,
            error: "Extensão recarregada — prima F5 nesta página.",
          });
          return;
        }
        chrome.runtime.sendMessage({ kind, ...extra }, (resp) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message ?? "";
            if (isContextInvalidated(msg)) {
              contextDead = true;
              stopPolling();
            }
            resolve({ ok: false, error: friendlyError(msg) });
            return;
          }
          resolve(resp ?? { ok: false, error: "Sem resposta da extensão" });
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isContextInvalidated(msg)) {
          contextDead = true;
          stopPolling();
        }
        resolve({ ok: false, error: friendlyError(msg) });
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.kind === "kto1f-panel-ping") {
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  const style = document.createElement("style");
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 2147483640;
      width: min(420px, calc(100vw - 24px));
      font: 13px/1.45 system-ui, -apple-system, sans-serif;
      color: #e2e8f0;
      pointer-events: none;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .ss-kto1f-card {
      pointer-events: auto;
      border-radius: 12px;
      border: 1px solid rgba(52, 211, 153, 0.45);
      background: rgba(6, 18, 14, 0.94);
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      overflow: hidden;
    }
    #${PANEL_ID} .ss-kto1f-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(4, 12, 10, 0.9);
      border-bottom: 1px solid rgba(52, 211, 153, 0.2);
      cursor: grab;
      user-select: none;
    }
    #${PANEL_ID} .ss-kto1f-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #a7f3d0;
      flex: 1;
    }
    #${PANEL_ID} .ss-kto1f-min {
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }
    #${PANEL_ID} .ss-kto1f-body { padding: 10px 12px 12px; }
    #${PANEL_ID} .ss-kto1f-sub {
      margin: 0 0 8px;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.45;
    }
    #${PANEL_ID} .ss-kto1f-signal {
      margin: 0 0 10px;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid rgba(52, 211, 153, 0.4);
      background: rgba(4, 22, 18, 0.92);
      text-align: center;
    }
    #${PANEL_ID} .ss-kto1f-signal-idle {
      font-size: 14px;
      font-weight: 600;
      color: #94a3b8;
      line-height: 1.4;
    }
    #${PANEL_ID} .ss-kto1f-watch {
      margin-top: 8px;
      font-size: 10px;
      font-weight: 500;
      color: #64748b;
      line-height: 1.55;
      word-break: break-word;
    }
    #${PANEL_ID} .ss-kto1f-pos {
      font-size: 28px;
      font-weight: 800;
      color: #6ee7b7;
      letter-spacing: 0.04em;
      line-height: 1.1;
    }
    #${PANEL_ID} .ss-kto1f-axis {
      margin: 4px 0 8px;
      font-size: 13px;
      font-weight: 700;
      color: #a7f3d0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    #${PANEL_ID} .ss-kto1f-indication {
      font-size: 20px;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1.25;
      word-break: break-word;
    }
    #${PANEL_ID} .ss-kto1f-gale {
      display: inline-block;
      margin-top: 10px;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    #${PANEL_ID} .ss-kto1f-gale.entry {
      background: #172554;
      color: #bfdbfe;
      border: 1px solid #2563eb;
    }
    #${PANEL_ID} .ss-kto1f-gale.recovery {
      background: #451a03;
      color: #fcd34d;
      border: 1px solid #b45309;
    }
    #${PANEL_ID} .ss-kto1f-gale.wait {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #475569;
    }
    #${PANEL_ID} .ss-kto1f-status {
      margin: 0 0 10px;
      font-size: 11px;
      color: #cbd5e1;
      min-height: 2.2em;
      line-height: 1.5;
    }
    #${PANEL_ID} .ss-kto1f-status.err { color: #fca5a5; }
    #${PANEL_ID} .ss-kto1f-fgrid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin-bottom: 8px;
    }
    #${PANEL_ID} .ss-kto1f-fcard {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 8px;
      color: #111827;
    }
    #${PANEL_ID} .ss-kto1f-fcard.best {
      background: #fffbeb;
      border-color: #f59e0b;
    }
    #${PANEL_ID} .ss-kto1f-fcard h4 {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    #${PANEL_ID} .ss-kto1f-fcard.best h4::after { content: "⚡"; font-size: 10px; }
    #${PANEL_ID} .ss-kto1f-frow {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      margin: 2px 0;
      color: #374151;
    }
    #${PANEL_ID} .ss-kto1f-frow .win { color: #16a34a; font-weight: 700; }
    #${PANEL_ID} .ss-kto1f-frow .loss { color: #dc2626; font-weight: 700; }
    #${PANEL_ID} .ss-kto1f-frow .last-red { color: #dc2626; font-weight: 700; }
    #${PANEL_ID} .ss-kto1f-general {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 10px;
      color: #111827;
    }
    #${PANEL_ID} .ss-kto1f-general h4 {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 700;
    }
    #${PANEL_ID} .ss-kto1f-grow {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin: 3px 0;
      color: #374151;
    }
    #${PANEL_ID} .ss-kto1f-grow .win { color: #16a34a; font-weight: 700; }
    #${PANEL_ID} .ss-kto1f-grow .gale { color: #dc2626; font-weight: 700; }
    #${PANEL_ID} .ss-kto1f-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    #${PANEL_ID} .ss-kto1f-btn {
      flex: 1;
      min-width: 72px;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
      background: #1e293b;
      color: #e2e8f0;
    }
    #${PANEL_ID} .ss-kto1f-btn.on-demo {
      border-color: #2563eb;
      background: #172554;
      color: #bfdbfe;
    }
    #${PANEL_ID} .ss-kto1f-btn.on-real {
      border-color: #16a34a;
      background: #14532d;
      color: #bbf7d0;
    }
    #${PANEL_ID} .ss-kto1f-btn.on-active {
      border-color: #059669;
      background: #064e3b;
      color: #a7f3d0;
    }
    #${PANEL_ID} .ss-kto1f-btn.on-warn {
      border-color: #b45309;
      background: #451a03;
      color: #fcd34d;
    }
    #${PANEL_ID} .ss-kto1f-hidden { display: none !important; }
    #${PANEL_ID}.ss-kto1f-collapsed .ss-kto1f-body { display: none; }
  `;

  const root = el("div");
  root.id = PANEL_ID;

  const card = el("div", "ss-kto1f-card");
  const head = el("div", "ss-kto1f-head");
  const title = el("div", "ss-kto1f-title", "stake37 · 1 Fator");
  const minBtn = el("button", "ss-kto1f-min", "−");
  minBtn.type = "button";
  head.append(title, minBtn);

  const body = el("div", "ss-kto1f-body");
  const sub = el("p", "ss-kto1f-sub", "1F · pos 1×13 → alerta pos 12 · 5 gales");

  const signalBox = el("div", "ss-kto1f-signal");
  const signalIdle = el("div", "ss-kto1f-signal-idle", "Sem sinal — aguarda coincidência 1×13");
  const signalWatch = el("div", "ss-kto1f-watch", "");
  const signalPos = el("div", "ss-kto1f-pos", "—");
  const signalAxis = el("div", "ss-kto1f-axis", "");
  const signalIndication = el("div", "ss-kto1f-indication", "—");
  const signalGale = el("div", "ss-kto1f-gale entry", "ENTRADA");
  signalBox.append(signalIdle, signalWatch, signalPos, signalAxis, signalIndication, signalGale);
  signalIdle.classList.add("ss-kto1f-hidden");
  signalWatch.classList.add("ss-kto1f-hidden");
  signalPos.classList.add("ss-kto1f-hidden");
  signalAxis.classList.add("ss-kto1f-hidden");
  signalIndication.classList.add("ss-kto1f-hidden");
  signalGale.classList.add("ss-kto1f-hidden");

  const statusEl = el("p", "ss-kto1f-status", "A ligar à extensão…");

  function makeFactorCard(title) {
    const cardEl = el("div", "ss-kto1f-fcard");
    const h = el("h4", null, title);
    const winsRow = el("div", "ss-kto1f-frow");
    const winsVal = el("span", "win", "0");
    winsRow.append(el("span", null, "Vitórias:"), winsVal);
    const lossesRow = el("div", "ss-kto1f-frow");
    const lossesVal = el("span", "loss", "0");
    lossesRow.append(el("span", null, "Derrotas:"), lossesVal);
    const lastRow = el("div", "ss-kto1f-frow");
    const lastVal = el("span", null, "—");
    lastRow.append(el("span", null, "Último:"), lastVal);
    cardEl.append(h, winsRow, lossesRow, lastRow);
    return { cardEl, winsVal, lossesVal, lastVal };
  }

  const fgrid = el("div", "ss-kto1f-fgrid");
  const parCard = makeFactorCard("Paridade");
  const corCard = makeFactorCard("Cor");
  const altCard = makeFactorCard("Altura");
  fgrid.append(parCard.cardEl, corCard.cardEl, altCard.cardEl);

  const general = el("div", "ss-kto1f-general");
  general.append(el("h4", null, "Estatísticas Gerais"));
  const totalRow = el("div", "ss-kto1f-grow");
  const totalVal = el("span", null, "0");
  totalRow.append(el("span", null, "Rodadas Totais:"), totalVal);
  const sessWinRow = el("div", "ss-kto1f-grow");
  const sessWinVal = el("span", "win", "0");
  sessWinRow.append(el("span", null, "Vitórias:"), sessWinVal);
  const galeRow = el("div", "ss-kto1f-grow");
  const galeVal = el("span", "gale", "0");
  galeRow.append(el("span", null, "Gale Atual:"), galeVal);
  const maxGaleRow = el("div", "ss-kto1f-grow");
  const maxGaleVal = el("span", null, "5");
  maxGaleRow.append(el("span", null, "Máximo Gale:"), maxGaleVal);
  general.append(totalRow, sessWinRow, galeRow, maxGaleRow);

  const actions = el("div", "ss-kto1f-actions");
  const btnDemo = el("button", "ss-kto1f-btn on-demo", "Demo");
  const btnReal = el("button", "ss-kto1f-btn", "Real");
  const btnToggle = el("button", "ss-kto1f-btn", "Parado");
  const btnReload = el("button", "ss-kto1f-btn on-warn ss-kto1f-hidden", "Actualizar página");
  btnDemo.type = "button";
  btnReal.type = "button";
  btnToggle.type = "button";
  btnReload.type = "button";
  btnReload.addEventListener("click", () => location.reload());
  actions.append(btnDemo, btnReal, btnToggle, btnReload);
  body.append(sub, signalBox, statusEl, fgrid, general, actions);
  card.append(head, body);
  root.append(card);

  let collapsed = false;
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    collapsed = !collapsed;
    root.classList.toggle("ss-kto1f-collapsed", collapsed);
    minBtn.textContent = collapsed ? "+" : "−";
  });

  btnDemo.addEventListener("click", async () => {
    statusEl.textContent = "A mudar para Demo…";
    const r = await send("set-mode", { mode: "demo" });
    if (r?.ok === false) statusEl.textContent = r.error ?? "Erro ao mudar modo";
    await refresh();
  });

  btnReal.addEventListener("click", async () => {
    if (!window.confirm("Modo REAL — a extensão vai clicar na mesa. Confirma?")) return;
    statusEl.textContent = "A mudar para Real…";
    const r = await send("set-mode", { mode: "real" });
    if (r?.ok === false) statusEl.textContent = r.error ?? "Erro ao mudar modo";
    await refresh();
  });

  btnToggle.addEventListener("click", async () => {
    btnToggle.disabled = true;
    const cur = await send("get-kto1f-autopilot");
    const on = cur?.enabled === true;
    statusEl.textContent = on ? "A parar…" : "A ligar estratégia…";
    const r = await send("set-kto1f-autopilot", { enabled: !on });
    if (r?.error) statusEl.textContent = r.error;
    btnToggle.disabled = false;
    await refresh();
  });

  function kindLabel(kind) {
    if (kind === "paridade") return "Paridade";
    if (kind === "cor") return "Cor";
    if (kind === "altura") return "Altura";
    return kind ? String(kind) : "";
  }

  function parseSignalFromStatus(st) {
    const label = String(st.label ?? "");
    const galeFromLabel = label.match(/gale\s*(\d+)/i);
    const recovery =
      typeof st.recovery === "number" && Number.isFinite(st.recovery)
        ? Math.max(0, Math.floor(st.recovery))
        : galeFromLabel
          ? Number(galeFromLabel[1])
          : 0;
    const indication = label
      .replace(/\s*·\s*gale\s*\d+/gi, "")
      .replace(/\s*·\s*pos12/gi, "")
      .replace(/\s*·\s*score\s*\d+/gi, "")
      .trim();
    return {
      position: "12",
      axis: st.alertKind ?? null,
      indication,
      recovery,
      isPause: false,
    };
  }

  function renderSignalBlock(st) {
    const hasActive = st.active === true;
    const parsed = parseSignalFromStatus(st);
    signalIdle.classList.add("ss-kto1f-hidden");
    signalWatch.classList.add("ss-kto1f-hidden");
    signalPos.classList.add("ss-kto1f-hidden");
    signalAxis.classList.add("ss-kto1f-hidden");
    signalIndication.classList.add("ss-kto1f-hidden");
    signalGale.classList.add("ss-kto1f-hidden");
    if (!hasActive) {
      signalIdle.classList.remove("ss-kto1f-hidden");
      if (st.recovery > 0 && !st.active) {
        signalIdle.textContent = `Sem sinal · gale ${st.recovery} pendente`;
      } else {
        signalIdle.textContent = "Sem sinal — aguarda coincidência 1×13";
      }
      if (st.watchLabel) {
        signalWatch.classList.remove("ss-kto1f-hidden");
        signalWatch.textContent = `Placar: ${st.watchLabel}`;
      }
      return;
    }
    signalPos.classList.remove("ss-kto1f-hidden");
    signalGale.classList.remove("ss-kto1f-hidden");
    signalPos.textContent = "POSIÇÃO 12";
    if (parsed.axis) {
      signalAxis.classList.remove("ss-kto1f-hidden");
      signalAxis.textContent = kindLabel(parsed.axis);
    }
    if (parsed.indication) {
      signalIndication.classList.remove("ss-kto1f-hidden");
      signalIndication.textContent = parsed.indication;
    }
    if (st.waitingBet) {
      signalGale.className = "ss-kto1f-gale wait";
      signalGale.textContent =
        st.waitRemainingSec != null
          ? `AGUARDA ${st.waitRemainingSec}s`
          : "AGUARDA JANELA";
    } else if (parsed.recovery > 0) {
      signalGale.className = "ss-kto1f-gale recovery";
      signalGale.textContent = `GALE ${parsed.recovery}`;
    } else {
      signalGale.className = "ss-kto1f-gale entry";
      signalGale.textContent = "ENTRADA";
    }
  }

  function renderStatus(data) {
    statusEl.classList.remove("err");

    if (!data || data.error) {
      statusEl.classList.add("err");
      statusEl.textContent = friendlyError(
        data?.error ?? "Extensão sem resposta — recarregue em chrome://extensions",
      );
      btnToggle.className = "ss-kto1f-btn on-warn";
      btnToggle.textContent = "Parado";
      if (contextDead) btnReload.classList.remove("ss-kto1f-hidden");
      return;
    }

    btnReload.classList.add("ss-kto1f-hidden");

    const mode = data.mode === "real" ? "real" : "demo";
    const kto1f = data.kto1fAutopilot;
    const st = kto1f?.status ?? {};
    const on = kto1f?.enabled === true;
    const running = st.running === true;
    const engaged = on && (running || st.active === true || st.waitingBet === true);

    btnDemo.className = `ss-kto1f-btn ${mode === "demo" ? "on-demo" : ""}`;
    btnReal.className = `ss-kto1f-btn ${mode === "real" ? "on-real" : ""}`;

    if (engaged) {
      btnToggle.className = "ss-kto1f-btn on-active";
      btnToggle.textContent = running ? "Activo" : "A ligar…";
    } else if (on) {
      btnToggle.className = "ss-kto1f-btn on-warn";
      btnToggle.textContent = "A ligar…";
    } else {
      btnToggle.className = "ss-kto1f-btn";
      btnToggle.textContent = "Parado";
    }

    const board = st.scoreboard ?? {};
    const best = st.bestKind ?? null;
    const applyFactor = (card, kind) => {
      const s = board[kind] ?? { wins: 0, losses: 0, last: null };
      card.cardEl.classList.toggle("best", best === kind);
      card.winsVal.textContent = String(s.wins ?? 0);
      card.lossesVal.textContent = String(s.losses ?? 0);
      card.lastVal.textContent = s.last || "—";
      card.lastVal.classList.toggle("last-red", s.last === "Vermelho");
    };
    applyFactor(parCard, "paridade");
    applyFactor(corCard, "cor");
    applyFactor(altCard, "altura");
    totalVal.textContent = String(st.totalRounds ?? 0);
    sessWinVal.textContent = String(st.wins ?? 0);
    galeVal.textContent = String(st.recovery ?? 0);
    maxGaleVal.textContent = String(st.maxRecovery ?? 5);

    renderSignalBlock(st);

    const parts = [];
    parts.push(mode === "real" ? "Modo REAL" : "Modo DEMO");
    if (on && running) parts.push("DGA mesa 230 ligada");
    else if (on && st.active) parts.push("sinal activo");
    else if (on) parts.push("A iniciar motor…");
    else parts.push("estratégia parada");

    if (st.lastFlash) {
      parts.push(`último: ${st.lastFlash}${st.lastResult != null ? ` (${st.lastResult})` : ""}`);
    }
    if (st.lastBetDetail && st.active) parts.push(st.lastBetDetail);
    if (st.reason && !st.active && !running) parts.push(st.reason);
    if (st.lastError && !st.active) parts.push(`aviso: ${st.lastError}`);
    if (st.extensionVersion) parts.push(`v${st.extensionVersion}`);

    statusEl.textContent = parts.join(" · ");
    if (!data.error && !on && st.lastError) statusEl.classList.add("err");
    else if (!data.error && on && !engaged && st.reason && !st.active) statusEl.classList.add("err");
  }

  async function refresh() {
    const data = await send("get-status");
    if (data?.ok === false && data?.error) {
      renderStatus({ error: data.error });
      return;
    }
    renderStatus(data);
  }

  function mount() {
    const host = document.body || document.documentElement;
    host.appendChild(style);
    host.appendChild(root);
    void send("ping").then(() => refresh());
    pollTimer = setInterval(refresh, POLL_MS);
  }

  if (document.body) mount();
  else window.addEventListener("DOMContentLoaded", mount, { once: true });
})();

