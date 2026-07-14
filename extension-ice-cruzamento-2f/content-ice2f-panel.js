/**
 * Painel flutuante na ICE 2F — activar estratégia 2 Fatores · cruzamento sequencial (mesa 201).
 */
(function () {
  if (window !== window.top) return;

  /**
 * Painel flutuante na ICE 2F — activar estratégia 2 Fatores · cruzamento sequencial (mesa 201).
 */
function pageIsIce2fRoulette() {
    if (!/ice\.bet\.br/i.test(location.hostname)) return false;
    const path = `${location.pathname}${location.hash}${location.search}`.toLowerCase();
    return /roulette|liveroulette|pragmatic/i.test(path);
  }

  if (!pageIsIce2fRoulette()) return;
  if (document.getElementById("ss-ice2f-panel-root")) return;

  const PANEL_ID = "ss-ice2f-panel-root";
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
    if (message?.kind === "ice2f-panel-ping") {
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
      width: min(360px, calc(100vw - 24px));
      font: 13px/1.45 system-ui, -apple-system, sans-serif;
      color: #e2e8f0;
      pointer-events: none;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .ss-ice2f-card {
      pointer-events: auto;
      border-radius: 12px;
      border: 1px solid rgba(52, 211, 153, 0.45);
      background: rgba(6, 18, 14, 0.94);
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      overflow: hidden;
    }
    #${PANEL_ID} .ss-ice2f-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(4, 12, 10, 0.9);
      border-bottom: 1px solid rgba(52, 211, 153, 0.2);
      cursor: grab;
      user-select: none;
    }
    #${PANEL_ID} .ss-ice2f-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #a7f3d0;
      flex: 1;
    }
    #${PANEL_ID} .ss-ice2f-min {
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }
    #${PANEL_ID} .ss-ice2f-body { padding: 10px 12px 12px; }
    #${PANEL_ID} .ss-ice2f-sub {
      margin: 0 0 8px;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.45;
    }
    #${PANEL_ID} .ss-ice2f-signal {
      margin: 0 0 10px;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid rgba(52, 211, 153, 0.4);
      background: rgba(4, 22, 18, 0.92);
      text-align: center;
    }
    #${PANEL_ID} .ss-ice2f-signal-idle {
      font-size: 14px;
      font-weight: 600;
      color: #94a3b8;
      line-height: 1.4;
    }
    #${PANEL_ID} .ss-ice2f-watch {
      margin-top: 8px;
      font-size: 10px;
      font-weight: 500;
      color: #64748b;
      line-height: 1.55;
      word-break: break-word;
    }
    #${PANEL_ID} .ss-ice2f-pos {
      font-size: 28px;
      font-weight: 800;
      color: #6ee7b7;
      letter-spacing: 0.04em;
      line-height: 1.1;
    }
    #${PANEL_ID} .ss-ice2f-axis {
      margin: 4px 0 8px;
      font-size: 13px;
      font-weight: 700;
      color: #a7f3d0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    #${PANEL_ID} .ss-ice2f-indication {
      font-size: 20px;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1.25;
      word-break: break-word;
    }
    #${PANEL_ID} .ss-ice2f-gale {
      display: inline-block;
      margin-top: 10px;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    #${PANEL_ID} .ss-ice2f-gale.entry {
      background: #172554;
      color: #bfdbfe;
      border: 1px solid #2563eb;
    }
    #${PANEL_ID} .ss-ice2f-gale.recovery {
      background: #451a03;
      color: #fcd34d;
      border: 1px solid #b45309;
    }
    #${PANEL_ID} .ss-ice2f-gale.wait {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #475569;
    }
    #${PANEL_ID} .ss-ice2f-status {
      margin: 0 0 10px;
      font-size: 11px;
      color: #cbd5e1;
      min-height: 2.2em;
      line-height: 1.5;
    }
    #${PANEL_ID} .ss-ice2f-status.err { color: #fca5a5; }
    #${PANEL_ID} .ss-ice2f-stats {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    #${PANEL_ID} .ss-ice2f-stat {
      flex: 1;
      text-align: center;
      padding: 6px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #0b1220;
    }
    #${PANEL_ID} .ss-ice2f-stat strong {
      display: block;
      font-size: 22px;
      color: #f8fafc;
    }
    #${PANEL_ID} .ss-ice2f-stat small {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
    }
    #${PANEL_ID} .ss-ice2f-stat.win { border-color: #166534; background: #052e16; }
    #${PANEL_ID} .ss-ice2f-stat.win strong { color: #86efac; }
    #${PANEL_ID} .ss-ice2f-stat.loss { border-color: #991b1b; background: #450a0a; }
    #${PANEL_ID} .ss-ice2f-stat.loss strong { color: #fca5a5; }
    #${PANEL_ID} .ss-ice2f-pair-title {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    #${PANEL_ID} .ss-ice2f-pairs {
      display: grid;
      gap: 3px;
      margin: 0 0 10px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #1e293b;
      background: #040a08;
    }
    #${PANEL_ID} .ss-ice2f-pair-head,
    #${PANEL_ID} .ss-ice2f-pair-row {
      display: grid;
      grid-template-columns: 1fr 40px 40px;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }
    #${PANEL_ID} .ss-ice2f-pair-head {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    #${PANEL_ID} .ss-ice2f-pair-id { font-weight: 700; color: #cbd5e1; }
    #${PANEL_ID} .ss-ice2f-pair-ok,
    #${PANEL_ID} .ss-ice2f-pair-bad {
      text-align: center;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    #${PANEL_ID} .ss-ice2f-pair-ok { color: #86efac; }
    #${PANEL_ID} .ss-ice2f-pair-bad { color: #fca5a5; }
    #${PANEL_ID} .ss-ice2f-pair-head .ss-ice2f-pair-ok,
    #${PANEL_ID} .ss-ice2f-pair-head .ss-ice2f-pair-bad { color: #64748b; }
    #${PANEL_ID} .ss-ice2f-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    #${PANEL_ID} .ss-ice2f-btn {
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
    #${PANEL_ID} .ss-ice2f-btn.on-demo {
      border-color: #2563eb;
      background: #172554;
      color: #bfdbfe;
    }
    #${PANEL_ID} .ss-ice2f-btn.on-real {
      border-color: #16a34a;
      background: #14532d;
      color: #bbf7d0;
    }
    #${PANEL_ID} .ss-ice2f-btn.on-active {
      border-color: #059669;
      background: #064e3b;
      color: #a7f3d0;
    }
    #${PANEL_ID} .ss-ice2f-btn.on-warn {
      border-color: #b45309;
      background: #451a03;
      color: #fcd34d;
    }
    #${PANEL_ID} .ss-ice2f-hidden { display: none !important; }
    #${PANEL_ID}.ss-ice2f-collapsed .ss-ice2f-body { display: none; }
  `;

  const root = el("div");
  root.id = PANEL_ID;

  const card = el("div", "ss-ice2f-card");
  const head = el("div", "ss-ice2f-head");
  const title = el("div", "ss-ice2f-title", "stake37 · 2 Fatores");
  const minBtn = el("button", "ss-ice2f-min", "−");
  minBtn.type = "button";
  head.append(title, minBtn);

  const body = el("div", "ss-ice2f-body");
  const sub = el("p", "ss-ice2f-sub", "Roulette 2 Extra Time · mesa 201 · stake 2·4·8·16·32·64");

  const signalBox = el("div", "ss-ice2f-signal");
  const signalIdle = el("div", "ss-ice2f-signal-idle", "Sem sinal — aguarda pares 2F");
  const signalWatch = el("div", "ss-ice2f-watch", "");
  const signalPos = el("div", "ss-ice2f-pos", "—");
  const signalAxis = el("div", "ss-ice2f-axis", "");
  const signalIndication = el("div", "ss-ice2f-indication", "—");
  const signalGale = el("div", "ss-ice2f-gale entry", "ENTRADA");
  signalBox.append(signalIdle, signalWatch, signalPos, signalAxis, signalIndication, signalGale);
  signalIdle.classList.add("ss-ice2f-hidden");
  signalWatch.classList.add("ss-ice2f-hidden");
  signalPos.classList.add("ss-ice2f-hidden");
  signalAxis.classList.add("ss-ice2f-hidden");
  signalIndication.classList.add("ss-ice2f-hidden");
  signalGale.classList.add("ss-ice2f-hidden");

  const statusEl = el("p", "ss-ice2f-status", "A ligar à extensão…");

  const stats = el("div", "ss-ice2f-stats");
  const winStat = el("div", "ss-ice2f-stat win");
  const winNum = el("strong", null, "0");
  winStat.append(winNum, el("small", null, "Vitórias"));
  const lossStat = el("div", "ss-ice2f-stat loss");
  const lossNum = el("strong", null, "0");
  lossStat.append(lossNum, el("small", null, "Derrotas"));
  stats.append(winStat, lossStat);

  const PAIR_IDS = [["3x6", "3×6"]];
  const pairTitle = el("div", "ss-ice2f-pair-title", "Gatilhos (indicações)");
  const pairBoard = el("div", "ss-ice2f-pairs");
  const pairHead = el("div", "ss-ice2f-pair-head");
  pairHead.append(el("span"), el("span", "ss-ice2f-pair-ok", "OK"), el("span", "ss-ice2f-pair-bad", "ERR"));
  pairBoard.append(pairHead);
  const pairCells = {};
  for (const [id, label] of PAIR_IDS) {
    const row = el("div", "ss-ice2f-pair-row");
    const okEl = el("span", "ss-ice2f-pair-ok", "0");
    const badEl = el("span", "ss-ice2f-pair-bad", "0");
    row.append(el("span", "ss-ice2f-pair-id", label), okEl, badEl);
    pairBoard.append(row);
    pairCells[id] = { ok: okEl, bad: badEl };
  }

  const actions = el("div", "ss-ice2f-actions");
  const btnDemo = el("button", "ss-ice2f-btn on-demo", "Demo");
  const btnReal = el("button", "ss-ice2f-btn", "Real");
  const btnToggle = el("button", "ss-ice2f-btn", "Parado");
  const btnReload = el("button", "ss-ice2f-btn on-warn ss-ice2f-hidden", "Actualizar página");
  btnDemo.type = "button";
  btnReal.type = "button";
  btnToggle.type = "button";
  btnReload.type = "button";
  btnReload.addEventListener("click", () => location.reload());
  actions.append(btnDemo, btnReal, btnToggle, btnReload);
  body.append(sub, signalBox, statusEl, stats, pairTitle, pairBoard, actions);
  card.append(head, body);
  root.append(card);

  let collapsed = false;
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    collapsed = !collapsed;
    root.classList.toggle("ss-ice2f-collapsed", collapsed);
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
    const cur = await send("get-ice2f-autopilot");
    const on = cur?.enabled === true;
    statusEl.textContent = on ? "A parar…" : "A ligar estratégia…";
    const r = await send("set-ice2f-autopilot", { enabled: !on });
    if (r?.error) statusEl.textContent = r.error;
    btnToggle.disabled = false;
    await refresh();
  });

  function axisLabel(short) {
    const s = String(short ?? "").toLowerCase().replace(/\s+/g, "");
    if (s === "c/a" || s === "cor-altura" || s === "cor/altura") return "Cor / Altura";
    if (s === "p/a" || s === "altura-paridade" || s === "paridade/altura") return "Paridade / Altura";
    if (s === "c/p" || s === "cor-paridade" || s === "cor/paridade") return "Cor / Paridade";
    return short ? String(short) : "";
  }

  function parseSignalFromStatus(st) {
    const label = String(st.label ?? "");
    const posFromLabel = label.match(/pos(?:11\/22|\s*(\d+))/i);
    const axisFromLabel = label.match(
      /pos(?:11\/22|\s*\d+)\s*(c\/a|p\/a|c\/p|cor\/altura|paridade\/altura|cor\/paridade|cor-altura|altura-paridade|cor-paridade)/i,
    );
    const galeFromLabel = label.match(/gale\s*(\d+)/i);
    const recovery =
      typeof st.recovery === "number" && Number.isFinite(st.recovery)
        ? Math.max(0, Math.floor(st.recovery))
        : galeFromLabel
          ? Number(galeFromLabel[1])
          : 0;

    let indication = "";
    const posIdx = label.search(/\s·\s*pos\s*\d/i);
    if (posIdx > 0) {
      indication = label
        .slice(0, posIdx)
        .replace(/\s*·\s*gale\s*\d+/gi, "")
        .trim();
    } else if (label && !/aguarda refer/i.test(label)) {
      indication = label.replace(/\s*·\s*gale\s*\d+/gi, "").trim();
    }

    const pausePos = label.match(/pos(\d+)/i);
    const axisRaw = st.axis ?? axisFromLabel?.[1] ?? null;
    return {
      position: posFromLabel?.[1] ?? (/pos5\/10/i.test(label) ? "5/10" : null) ?? pausePos?.[1] ?? null,
      axis: axisRaw,
      indication,
      recovery,
      isPause: st.waitingReference === true || /aguarda refer/i.test(label),
    };
  }

  function renderSignalBlock(st) {
    const hasActive = st.active === true || st.waitingReference === true;
    const parsed = parseSignalFromStatus(st);

    signalIdle.classList.add("ss-ice2f-hidden");
    signalWatch.classList.add("ss-ice2f-hidden");
    signalPos.classList.add("ss-ice2f-hidden");
    signalAxis.classList.add("ss-ice2f-hidden");
    signalIndication.classList.add("ss-ice2f-hidden");
    signalGale.classList.add("ss-ice2f-hidden");

    if (!hasActive) {
      signalIdle.classList.remove("ss-ice2f-hidden");
      if (st.recovery > 0 && !st.active) {
        signalIdle.textContent = `Sem sinal · gale ${st.recovery} pendente`;
      } else if (st.lastFlash === "win") {
        signalIdle.textContent = "Sem sinal — vitória registada";
      } else {
        const inactive = st.inactiveSpins ?? 0;
        if (inactive >= 5) {
          signalIdle.textContent = "Sem sinal — modo 3 falhas (5+ rodadas sem aposta)";
        } else if (inactive > 0) {
          signalIdle.textContent = `Sem sinal — inactivo ${inactive}/5 rodadas`;
        } else {
          signalIdle.textContent = "Sem sinal — pares em paralelo · indica no match";
        }
      }
      if (st.watchLabel) {
        signalWatch.classList.remove("ss-ice2f-hidden");
        signalWatch.textContent = `Placar: ${st.watchLabel}`;
      }
      return;
    }

    signalPos.classList.remove("ss-ice2f-hidden");
    signalGale.classList.remove("ss-ice2f-hidden");

    signalPos.textContent = parsed.position ? `POSIÇÃO ${parsed.position}` : "POSIÇÃO —";

    if (parsed.axis) {
      signalAxis.classList.remove("ss-ice2f-hidden");
      signalAxis.textContent = axisLabel(parsed.axis);
    }

    if (parsed.isPause) {
      signalIndication.classList.remove("ss-ice2f-hidden");
      signalIndication.textContent = "ZERO — PAUSA";
      signalGale.className = "ss-ice2f-gale wait";
      signalGale.textContent = parsed.recovery > 0 ? `GALE ${parsed.recovery} MANTIDO` : "AGUARDA REF.";
    } else if (parsed.indication) {
      signalIndication.classList.remove("ss-ice2f-hidden");
      signalIndication.textContent = parsed.indication.replace(/\s*·\s*/g, " + ");
    } else if (st.label) {
      signalIndication.classList.remove("ss-ice2f-hidden");
      signalIndication.textContent = st.label;
    }

    if (st.waitingBet && !parsed.isPause) {
      signalGale.className = "ss-ice2f-gale wait";
      signalGale.textContent =
        st.waitRemainingSec != null
          ? `AGUARDA ${st.waitRemainingSec}s`
          : "AGUARDA JANELA";
    } else if (parsed.recovery > 0) {
      signalGale.className = "ss-ice2f-gale recovery";
      signalGale.textContent = `GALE ${parsed.recovery}`;
    } else {
      signalGale.className = "ss-ice2f-gale entry";
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
      btnToggle.className = "ss-ice2f-btn on-warn";
      btnToggle.textContent = "Parado";
      if (contextDead) btnReload.classList.remove("ss-ice2f-hidden");
      return;
    }

    btnReload.classList.add("ss-ice2f-hidden");

    const mode = data.mode === "real" ? "real" : "demo";
    const ice2f = data.ice2fAutopilot;
    const st = ice2f?.status ?? {};
    const on = ice2f?.enabled === true;
    const running = st.running === true;
    const engaged = on && (running || st.active === true || st.waitingBet === true);

    btnDemo.className = `ss-ice2f-btn ${mode === "demo" ? "on-demo" : ""}`;
    btnReal.className = `ss-ice2f-btn ${mode === "real" ? "on-real" : ""}`;

    if (engaged) {
      btnToggle.className = "ss-ice2f-btn on-active";
      btnToggle.textContent = running ? "Activo" : "A ligar…";
    } else if (on) {
      btnToggle.className = "ss-ice2f-btn on-warn";
      btnToggle.textContent = "A ligar…";
    } else {
      btnToggle.className = "ss-ice2f-btn";
      btnToggle.textContent = "Parado";
    }

    winNum.textContent = String(st.wins ?? 0);
    lossNum.textContent = String(st.losses ?? 0);

    const pairMap = st.pairIndication && typeof st.pairIndication === "object" ? st.pairIndication : {};
    for (const [id, cells] of Object.entries(pairCells)) {
      const slot = pairMap[id] ?? {};
      cells.ok.textContent = String(slot.wins ?? 0);
      cells.bad.textContent = String(slot.losses ?? 0);
    }

    renderSignalBlock(st);

    const parts = [];
    parts.push(mode === "real" ? "Modo REAL" : "Modo DEMO");
    if (on && running) parts.push("DGA mesa 201 ligada");
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

