/**
 * Painel flutuante na KTO 2F — activar estratégia 2 Fatores · cruzamento sequencial (mesa 230).
 */
(function () {
  if (window !== window.top) return;

  function pageIsKto2fRoulette() {
    const path = `${location.pathname}${location.hash}${location.search}`;
    return (
      /kto\.bet\.br/i.test(location.hostname) &&
      /\/app\/cassino\/game\/(roulette-3-ppl|roleta-ao-vivo)/i.test(path)
    );
  }

  if (!pageIsKto2fRoulette()) return;
  if (document.getElementById("ss-kto2f-panel-root")) return;

  const PANEL_ID = "ss-kto2f-panel-root";
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
    if (message?.kind === "kto2f-panel-ping") {
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
      width: min(300px, calc(100vw - 24px));
      font: 12px/1.4 system-ui, -apple-system, sans-serif;
      color: #e2e8f0;
      pointer-events: none;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .ss-kto2f-card {
      pointer-events: auto;
      border-radius: 12px;
      border: 1px solid rgba(52, 211, 153, 0.45);
      background: rgba(6, 18, 14, 0.94);
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      overflow: hidden;
    }
    #${PANEL_ID} .ss-kto2f-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(4, 12, 10, 0.9);
      border-bottom: 1px solid rgba(52, 211, 153, 0.2);
      cursor: grab;
      user-select: none;
    }
    #${PANEL_ID} .ss-kto2f-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #a7f3d0;
      flex: 1;
    }
    #${PANEL_ID} .ss-kto2f-min {
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }
    #${PANEL_ID} .ss-kto2f-body { padding: 10px 12px 12px; }
    #${PANEL_ID} .ss-kto2f-sub {
      margin: 0 0 8px;
      font-size: 10px;
      color: #94a3b8;
      line-height: 1.45;
    }
    #${PANEL_ID} .ss-kto2f-status {
      margin: 0 0 10px;
      font-size: 10px;
      color: #cbd5e1;
      min-height: 2.8em;
      line-height: 1.45;
    }
    #${PANEL_ID} .ss-kto2f-status.err { color: #fca5a5; }
    #${PANEL_ID} .ss-kto2f-stats {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    #${PANEL_ID} .ss-kto2f-stat {
      flex: 1;
      text-align: center;
      padding: 6px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #0b1220;
    }
    #${PANEL_ID} .ss-kto2f-stat strong {
      display: block;
      font-size: 18px;
      color: #f8fafc;
    }
    #${PANEL_ID} .ss-kto2f-stat small {
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
    }
    #${PANEL_ID} .ss-kto2f-stat.win { border-color: #166534; background: #052e16; }
    #${PANEL_ID} .ss-kto2f-stat.win strong { color: #86efac; }
    #${PANEL_ID} .ss-kto2f-stat.loss { border-color: #991b1b; background: #450a0a; }
    #${PANEL_ID} .ss-kto2f-stat.loss strong { color: #fca5a5; }
    #${PANEL_ID} .ss-kto2f-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    #${PANEL_ID} .ss-kto2f-btn {
      flex: 1;
      min-width: 72px;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 7px 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
      background: #1e293b;
      color: #e2e8f0;
    }
    #${PANEL_ID} .ss-kto2f-btn.on-demo {
      border-color: #2563eb;
      background: #172554;
      color: #bfdbfe;
    }
    #${PANEL_ID} .ss-kto2f-btn.on-real {
      border-color: #16a34a;
      background: #14532d;
      color: #bbf7d0;
    }
    #${PANEL_ID} .ss-kto2f-btn.on-active {
      border-color: #059669;
      background: #064e3b;
      color: #a7f3d0;
    }
    #${PANEL_ID} .ss-kto2f-btn.on-warn {
      border-color: #b45309;
      background: #451a03;
      color: #fcd34d;
    }
    #${PANEL_ID} .ss-kto2f-hidden { display: none !important; }
    #${PANEL_ID}.ss-kto2f-collapsed .ss-kto2f-body { display: none; }
  `;

  const root = el("div");
  root.id = PANEL_ID;

  const card = el("div", "ss-kto2f-card");
  const head = el("div", "ss-kto2f-head");
  const title = el("div", "ss-kto2f-title", "stake37 · 2 Fatores");
  const minBtn = el("button", "ss-kto2f-min", "−");
  minBtn.type = "button";
  head.append(title, minBtn);

  const body = el("div", "ss-kto2f-body");
  const sub = el("p", "ss-kto2f-sub", "Roulette 3 · mesa 230 · stake 1·2·4·8·16·32");
  const statusEl = el("p", "ss-kto2f-status", "A ligar à extensão…");

  const stats = el("div", "ss-kto2f-stats");
  const winStat = el("div", "ss-kto2f-stat win");
  const winNum = el("strong", null, "0");
  winStat.append(winNum, el("small", null, "Vitórias"));
  const lossStat = el("div", "ss-kto2f-stat loss");
  const lossNum = el("strong", null, "0");
  lossStat.append(lossNum, el("small", null, "Derrotas"));
  stats.append(winStat, lossStat);

  const actions = el("div", "ss-kto2f-actions");
  const btnDemo = el("button", "ss-kto2f-btn on-demo", "Demo");
  const btnReal = el("button", "ss-kto2f-btn", "Real");
  const btnToggle = el("button", "ss-kto2f-btn", "Parado");
  const btnReload = el("button", "ss-kto2f-btn on-warn ss-kto2f-hidden", "Actualizar página");
  btnDemo.type = "button";
  btnReal.type = "button";
  btnToggle.type = "button";
  btnReload.type = "button";
  btnReload.addEventListener("click", () => location.reload());
  actions.append(btnDemo, btnReal, btnToggle, btnReload);
  body.append(sub, statusEl, stats, actions);
  card.append(head, body);
  root.append(card);

  let collapsed = false;
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    collapsed = !collapsed;
    root.classList.toggle("ss-kto2f-collapsed", collapsed);
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
    const cur = await send("get-kto2f-autopilot");
    const on = cur?.enabled === true;
    statusEl.textContent = on ? "A parar…" : "A ligar estratégia…";
    const r = await send("set-kto2f-autopilot", { enabled: !on });
    if (r?.error) statusEl.textContent = r.error;
    btnToggle.disabled = false;
    await refresh();
  });

  function renderStatus(data) {
    statusEl.classList.remove("err");

    if (!data || data.error) {
      statusEl.classList.add("err");
      statusEl.textContent = friendlyError(
        data?.error ?? "Extensão sem resposta — recarregue em chrome://extensions",
      );
      btnToggle.className = "ss-kto2f-btn on-warn";
      btnToggle.textContent = "Parado";
      if (contextDead) btnReload.classList.remove("ss-kto2f-hidden");
      return;
    }

    btnReload.classList.add("ss-kto2f-hidden");

    const mode = data.mode === "real" ? "real" : "demo";
    const kto2f = data.kto2fAutopilot;
    const st = kto2f?.status ?? {};
    const on = kto2f?.enabled === true;
    const running = st.running === true;

    btnDemo.className = `ss-kto2f-btn ${mode === "demo" ? "on-demo" : ""}`;
    btnReal.className = `ss-kto2f-btn ${mode === "real" ? "on-real" : ""}`;

    if (on && running) {
      btnToggle.className = "ss-kto2f-btn on-active";
      btnToggle.textContent = "Activo";
    } else if (on) {
      btnToggle.className = "ss-kto2f-btn on-warn";
      btnToggle.textContent = "A ligar…";
    } else {
      btnToggle.className = "ss-kto2f-btn";
      btnToggle.textContent = "Parado";
    }

    winNum.textContent = String(st.wins ?? 0);
    lossNum.textContent = String(st.losses ?? 0);

    const parts = [];
    parts.push(mode === "real" ? "Modo REAL" : "Modo DEMO");
    if (on && running) parts.push("DGA mesa 230 ligada");
    else if (on) parts.push("A iniciar motor…");
    else parts.push("estratégia parada");

    if (st.waitingBet) parts.push(`aguarda ${st.waitRemainingSec ?? "?"}s`);
    if (st.active && st.label) parts.push(`sinal: ${st.label}`);
    else if (st.active && st.lastTrigger?.length === 2) {
      parts.push(`gatilho: ${st.lastTrigger[1]}, ${st.lastTrigger[0]}`);
    }
    if (st.recovery > 0 && !st.active) {
      parts.push(`gale pendente ${st.recovery}/${st.maxRecovery ?? 6}`);
    } else if (st.recovery > 0) {
      parts.push(`gale ${st.recovery}/${st.maxRecovery ?? 6}`);
    }
    if (st.lastFlash === "tie" && !st.active) {
      parts.push(`último: empate (${st.lastResult ?? "?"})`);
    } else if (st.lastFlash) {
      parts.push(`último: ${st.lastFlash}${st.lastResult != null ? ` (${st.lastResult})` : ""}`);
    }
    if (st.lastBetDetail && st.active) parts.push(st.lastBetDetail);
    if (st.reason && !st.active) parts.push(st.reason);
    if (st.lastError) parts.push(`erro: ${st.lastError}`);
    if (st.extensionVersion) parts.push(`v${st.extensionVersion}`);

    statusEl.textContent = parts.join(" · ");
    if (st.lastError || (on && !running && st.reason)) statusEl.classList.add("err");
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

