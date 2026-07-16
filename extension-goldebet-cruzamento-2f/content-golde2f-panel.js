/**
 * Painel flutuante na GoldeBet 2F — activar estratégia 2 Fatores · cruzamento sequencial (mesa 230).
 */
(function () {
  if (window !== window.top) return;

  /**
 * Painel flutuante na GoldeBet 2F — activar estratégia 2 Fatores · cruzamento sequencial (mesa 230).
 */
function pageIsGolde2fRoulette() {
    if (!/goldebet\.bet\.br/i.test(location.hostname)) return false;
    const path = `${location.pathname}${location.hash}${location.search}`.toLowerCase();
    return /\/play\/pragmatic\/roulette-3/i.test(path) || /roulette|pragmatic|casino/i.test(path);
  }

  if (!pageIsGolde2fRoulette()) return;
  if (document.getElementById("ss-golde2f-panel-root")) return;

  const PANEL_ID = "ss-golde2f-panel-root";
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
    if (message?.kind === "golde2f-panel-ping") {
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
      min-width: 300px;
      min-height: 220px;
      max-width: calc(100vw - 16px);
      max-height: calc(100vh - 16px);
      font: 13px/1.45 system-ui, -apple-system, sans-serif;
      color: #e2e8f0;
      resize: both;
      overflow: auto;
      pointer-events: auto;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .ss-golde2f-card {
      pointer-events: auto;
      height: 100%;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      border: 1px solid rgba(52, 211, 153, 0.45);
      background: rgba(6, 18, 14, 0.96);
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      overflow: hidden;
    }
    #${PANEL_ID} .ss-golde2f-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(4, 12, 10, 0.9);
      border-bottom: 1px solid rgba(52, 211, 153, 0.2);
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
    }
    #${PANEL_ID} .ss-golde2f-head:active { cursor: grabbing; }
    #${PANEL_ID} .ss-golde2f-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #a7f3d0;
      flex: 1;
    }
    #${PANEL_ID} .ss-golde2f-min {
      border: none;
      background: transparent;
      color: #94a3b8;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }
    #${PANEL_ID} .ss-golde2f-body {
      padding: 10px 12px 12px;
      overflow: auto;
      flex: 1;
      min-height: 0;
    }
    #${PANEL_ID} .ss-golde2f-sub {
      margin: 0 0 8px;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.45;
    }
    #${PANEL_ID} .ss-golde2f-signal {
      margin: 0 0 10px;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid rgba(52, 211, 153, 0.4);
      background: rgba(4, 22, 18, 0.92);
      text-align: center;
    }
    #${PANEL_ID} .ss-golde2f-signal-idle {
      font-size: 14px;
      font-weight: 600;
      color: #94a3b8;
      line-height: 1.4;
    }
    #${PANEL_ID} .ss-golde2f-watch {
      margin-top: 8px;
      font-size: 10px;
      font-weight: 500;
      color: #64748b;
      line-height: 1.55;
      word-break: break-word;
    }
    #${PANEL_ID} .ss-golde2f-pos {
      font-size: 28px;
      font-weight: 800;
      color: #6ee7b7;
      letter-spacing: 0.04em;
      line-height: 1.1;
    }
    #${PANEL_ID} .ss-golde2f-axis {
      margin: 4px 0 8px;
      font-size: 13px;
      font-weight: 700;
      color: #a7f3d0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    #${PANEL_ID} .ss-golde2f-indication {
      font-size: 20px;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1.25;
      word-break: break-word;
    }
    #${PANEL_ID} .ss-golde2f-gale {
      display: inline-block;
      margin-top: 10px;
      padding: 5px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    #${PANEL_ID} .ss-golde2f-gale.entry {
      background: #172554;
      color: #bfdbfe;
      border: 1px solid #2563eb;
    }
    #${PANEL_ID} .ss-golde2f-gale.recovery {
      background: #451a03;
      color: #fcd34d;
      border: 1px solid #b45309;
    }
    #${PANEL_ID} .ss-golde2f-gale.wait {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #475569;
    }
    #${PANEL_ID} .ss-golde2f-status {
      margin: 0 0 10px;
      font-size: 11px;
      color: #cbd5e1;
      min-height: 2.2em;
      line-height: 1.5;
    }
    #${PANEL_ID} .ss-golde2f-status.err { color: #fca5a5; }
    #${PANEL_ID} .ss-golde2f-stats {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    #${PANEL_ID} .ss-golde2f-stat {
      flex: 1;
      text-align: center;
      padding: 6px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #0b1220;
    }
    #${PANEL_ID} .ss-golde2f-stat strong {
      display: block;
      font-size: 22px;
      color: #f8fafc;
    }
    #${PANEL_ID} .ss-golde2f-stat small {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
    }
    #${PANEL_ID} .ss-golde2f-stat.win { border-color: #166534; background: #052e16; }
    #${PANEL_ID} .ss-golde2f-stat.win strong { color: #86efac; }
    #${PANEL_ID} .ss-golde2f-stat.loss { border-color: #991b1b; background: #450a0a; }
    #${PANEL_ID} .ss-golde2f-stat.loss strong { color: #fca5a5; }
    #${PANEL_ID} .ss-golde2f-nogale {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin: 0 0 10px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #0b1220;
    }
    #${PANEL_ID} .ss-golde2f-nogale.on {
      border-color: #b45309;
      background: #1c1410;
    }
    #${PANEL_ID} .ss-golde2f-nogale-copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    #${PANEL_ID} .ss-golde2f-nogale-label {
      font-size: 11px;
      font-weight: 700;
      color: #e2e8f0;
    }
    #${PANEL_ID} .ss-golde2f-nogale-hint {
      font-size: 9px;
      color: #94a3b8;
      line-height: 1.35;
    }
    #${PANEL_ID} .ss-golde2f-switch {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    #${PANEL_ID} .ss-golde2f-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    #${PANEL_ID} .ss-golde2f-slider {
      position: absolute;
      inset: 0;
      cursor: pointer;
      background: #334155;
      border-radius: 999px;
      transition: 0.15s;
    }
    #${PANEL_ID} .ss-golde2f-slider::before {
      content: "";
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      top: 3px;
      background: #f8fafc;
      border-radius: 50%;
      transition: 0.15s;
    }
    #${PANEL_ID} .ss-golde2f-switch input:checked + .ss-golde2f-slider {
      background: #b45309;
    }
    #${PANEL_ID} .ss-golde2f-switch input:checked + .ss-golde2f-slider::before {
      transform: translateX(18px);
    }
    #${PANEL_ID} .ss-golde2f-chart-wrap {
      margin: 0 0 10px;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid #1e293b;
      background: #040a08;
    }
    #${PANEL_ID} .ss-golde2f-chart-title {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    #${PANEL_ID} .ss-golde2f-chart-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 8px;
    }
    #${PANEL_ID} .ss-golde2f-chart-metric {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid #1e293b;
      background: #0b1220;
      font-size: 10px;
    }
    #${PANEL_ID} .ss-golde2f-chart-metric span { color: #94a3b8; }
    #${PANEL_ID} .ss-golde2f-chart-metric strong { font-variant-numeric: tabular-nums; }
    #${PANEL_ID} .ss-golde2f-chart-metric strong.up { color: #86efac; }
    #${PANEL_ID} .ss-golde2f-chart-metric strong.down { color: #fca5a5; }
    #${PANEL_ID} .ss-golde2f-chart-row {
      display: block;
    }
    #${PANEL_ID} .ss-golde2f-chart-canvas-box {
      position: relative;
      height: 140px;
      border-radius: 8px;
      border: 1px solid #1e293b;
      background: #020617;
      overflow: hidden;
    }
    #${PANEL_ID} .ss-golde2f-chart-canvas-box canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    #${PANEL_ID} .ss-golde2f-pair-title {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    #${PANEL_ID} .ss-golde2f-pairs {
      display: grid;
      gap: 3px;
      margin: 0 0 10px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #1e293b;
      background: #040a08;
    }
    #${PANEL_ID} .ss-golde2f-pair-head,
    #${PANEL_ID} .ss-golde2f-pair-row {
      display: grid;
      grid-template-columns: 1fr auto 40px 40px;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }
    #${PANEL_ID} .ss-golde2f-pair-head {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    #${PANEL_ID} .ss-golde2f-pair-id { font-weight: 700; color: #cbd5e1; }
    #${PANEL_ID} .ss-golde2f-pair-row.off .ss-golde2f-pair-id { color: #64748b; }
    #${PANEL_ID} .ss-golde2f-pair-enable {
      position: relative;
      width: 34px;
      height: 18px;
      flex-shrink: 0;
    }
    #${PANEL_ID} .ss-golde2f-pair-enable input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    #${PANEL_ID} .ss-golde2f-pair-enable .ss-golde2f-slider {
      position: absolute;
      inset: 0;
      background: #334155;
      border-radius: 999px;
      cursor: pointer;
      transition: 0.15s;
    }
    #${PANEL_ID} .ss-golde2f-pair-enable .ss-golde2f-slider::before {
      content: "";
      position: absolute;
      width: 14px;
      height: 14px;
      left: 2px;
      top: 2px;
      background: #e2e8f0;
      border-radius: 50%;
      transition: 0.15s;
    }
    #${PANEL_ID} .ss-golde2f-pair-enable input:checked + .ss-golde2f-slider {
      background: #15803d;
    }
    #${PANEL_ID} .ss-golde2f-pair-enable input:checked + .ss-golde2f-slider::before {
      transform: translateX(16px);
    }
    #${PANEL_ID} .ss-golde2f-pair-ok,
    #${PANEL_ID} .ss-golde2f-pair-bad {
      text-align: center;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    #${PANEL_ID} .ss-golde2f-pair-ok { color: #86efac; }
    #${PANEL_ID} .ss-golde2f-pair-bad { color: #fca5a5; }
    #${PANEL_ID} .ss-golde2f-pair-head .ss-golde2f-pair-ok,
    #${PANEL_ID} .ss-golde2f-pair-head .ss-golde2f-pair-bad,
    #${PANEL_ID} .ss-golde2f-pair-head .ss-golde2f-pair-en {
      color: #64748b;
      text-align: center;
    }
    #${PANEL_ID} .ss-golde2f-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    #${PANEL_ID} .ss-golde2f-btn {
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
    #${PANEL_ID} .ss-golde2f-btn.on-demo {
      border-color: #2563eb;
      background: #172554;
      color: #bfdbfe;
    }
    #${PANEL_ID} .ss-golde2f-btn.on-real {
      border-color: #16a34a;
      background: #14532d;
      color: #bbf7d0;
    }
    #${PANEL_ID} .ss-golde2f-btn.on-active {
      border-color: #059669;
      background: #064e3b;
      color: #a7f3d0;
    }
    #${PANEL_ID} .ss-golde2f-btn.on-warn {
      border-color: #b45309;
      background: #451a03;
      color: #fcd34d;
    }
    #${PANEL_ID} .ss-golde2f-hidden { display: none !important; }
    #${PANEL_ID}.ss-golde2f-collapsed .ss-golde2f-body { display: none; }
  `;

  const root = el("div");
  root.id = PANEL_ID;

  const card = el("div", "ss-golde2f-card");
  const head = el("div", "ss-golde2f-head");
  const title = el("div", "ss-golde2f-title", "stake37 · 2 Fatores");
  const minBtn = el("button", "ss-golde2f-min", "−");
  minBtn.type = "button";
  head.append(title, minBtn);

  const body = el("div", "ss-golde2f-body");
  const sub = el("p", "ss-golde2f-sub", "Roulette 3 · mesa 230 · stake 2·4·8·16·32·64");

  const signalBox = el("div", "ss-golde2f-signal");
  const signalIdle = el("div", "ss-golde2f-signal-idle", "Sem sinal — aguarda pares 2F");
  const signalWatch = el("div", "ss-golde2f-watch", "");
  const signalPos = el("div", "ss-golde2f-pos", "—");
  const signalAxis = el("div", "ss-golde2f-axis", "");
  const signalIndication = el("div", "ss-golde2f-indication", "—");
  const signalGale = el("div", "ss-golde2f-gale entry", "ENTRADA");
  signalBox.append(signalIdle, signalWatch, signalPos, signalAxis, signalIndication, signalGale);
  signalIdle.classList.add("ss-golde2f-hidden");
  signalWatch.classList.add("ss-golde2f-hidden");
  signalPos.classList.add("ss-golde2f-hidden");
  signalAxis.classList.add("ss-golde2f-hidden");
  signalIndication.classList.add("ss-golde2f-hidden");
  signalGale.classList.add("ss-golde2f-hidden");

  const statusEl = el("p", "ss-golde2f-status", "A ligar à extensão…");

  const stats = el("div", "ss-golde2f-stats");
  const winStat = el("div", "ss-golde2f-stat win");
  const winNum = el("strong", null, "0");
  winStat.append(winNum, el("small", null, "Vitórias"));
  const lossStat = el("div", "ss-golde2f-stat loss");
  const lossNum = el("strong", null, "0");
  lossStat.append(lossNum, el("small", null, "Derrotas"));
  stats.append(winStat, lossStat);

  const noGaleRow = el("div", "ss-golde2f-nogale");
  const noGaleCopy = el("div", "ss-golde2f-nogale-copy");
  noGaleCopy.append(
    el("span", "ss-golde2f-nogale-label", "Modo sem gale"),
    el("span", "ss-golde2f-nogale-hint", "Stake única · W/L sem recuperação"),
  );
  const noGaleSwitch = el("label", "ss-golde2f-switch");
  const noGaleInput = document.createElement("input");
  noGaleInput.type = "checkbox";
  noGaleInput.setAttribute("aria-label", "Modo sem gale");
  const noGaleSlider = el("span", "ss-golde2f-slider");
  noGaleSwitch.append(noGaleInput, noGaleSlider);
  noGaleRow.append(noGaleCopy, noGaleSwitch);

  const observeRow = el("div", "ss-golde2f-nogale");
  const observeCopy = el("div", "ss-golde2f-nogale-copy");
  observeCopy.append(
    el("span", "ss-golde2f-nogale-label", "Sem clique"),
    el("span", "ss-golde2f-nogale-hint", "Só observação — sem apostar na mesa"),
  );
  const observeSwitch = el("label", "ss-golde2f-switch");
  const observeInput = document.createElement("input");
  observeInput.type = "checkbox";
  observeInput.setAttribute("aria-label", "Sem clique");
  const observeSlider = el("span", "ss-golde2f-slider");
  observeSwitch.append(observeInput, observeSlider);
  observeRow.append(observeCopy, observeSwitch);

  const chartWrap = el("div", "ss-golde2f-chart-wrap");
  chartWrap.append(el("div", "ss-golde2f-chart-title", "Run-up & Drawdown"));
  const chartMetrics = el("div", "ss-golde2f-chart-metrics");
  const mConsec = el("div", "ss-golde2f-chart-metric");
  const mConsecVal = el("strong", "up", "0");
  mConsec.append(el("span", null, "Consecutivas"), mConsecVal);
  const mMaxUp = el("div", "ss-golde2f-chart-metric");
  const mMaxUpVal = el("strong", "up", "0");
  mMaxUp.append(el("span", null, "Máx. run-up"), mMaxUpVal);
  const mDdNow = el("div", "ss-golde2f-chart-metric");
  const mDdNowVal = el("strong", "down", "0");
  mDdNow.append(el("span", null, "Drawdown atual"), mDdNowVal);
  const mDdMax = el("div", "ss-golde2f-chart-metric");
  const mDdMaxVal = el("strong", "down", "0");
  mDdMax.append(el("span", null, "Máx. drawdown"), mDdMaxVal);
  chartMetrics.append(mConsec, mMaxUp, mDdNow, mDdMax);
  const chartRow = el("div", "ss-golde2f-chart-row");
  const canvasBox = el("div", "ss-golde2f-chart-canvas-box");
  const chartCanvas = document.createElement("canvas");
  canvasBox.append(chartCanvas);
  chartRow.append(canvasBox);
  chartWrap.append(chartRow, chartMetrics);

  const FALLBACK_PAIRS = [{ id: "2x4", label: "2×4" }];
  const pairTitle = el("div", "ss-golde2f-pair-title", "Gatilho (OK/ERR · activar)");
  const pairBoard = el("div", "ss-golde2f-pairs");
  const pairHead = el("div", "ss-golde2f-pair-head");
  pairHead.append(
    el("span"),
    el("span", "ss-golde2f-pair-en", "ON"),
    el("span", "ss-golde2f-pair-ok", "OK"),
    el("span", "ss-golde2f-pair-bad", "ERR"),
  );
  pairBoard.append(pairHead);
  /** @type {Record<string, { ok: HTMLElement, bad: HTMLElement, input: HTMLInputElement, row: HTMLElement }>} */
  const pairCells = {};

  function ensurePairRow(id, label) {
    if (pairCells[id]) {
      const idEl = pairCells[id].row.querySelector(".ss-golde2f-pair-id");
      if (idEl && label) idEl.textContent = label;
      return pairCells[id];
    }
    const row = el("div", "ss-golde2f-pair-row");
    const enable = el("label", "ss-golde2f-pair-enable");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("aria-label", `Activar ${label || id}`);
    const slider = el("span", "ss-golde2f-slider");
    enable.append(input, slider);
    const okEl = el("span", "ss-golde2f-pair-ok", "0");
    const badEl = el("span", "ss-golde2f-pair-bad", "0");
    row.append(el("span", "ss-golde2f-pair-id", label || id), enable, okEl, badEl);
    pairBoard.append(row);
    pairCells[id] = { ok: okEl, bad: badEl, input, row };
    input.addEventListener("change", async () => {
      const want = input.checked === true;
      const enabled = Object.entries(pairCells)
        .filter(([, cell]) => cell.input.checked)
        .map(([pairId]) => pairId);
      if (enabled.length === 0) {
        input.checked = true;
        statusEl.textContent = "Mantém pelo menos 1 gatilho activo.";
        return;
      }
      input.disabled = true;
      const r = await send("set-golde2f-config", { config: { enabledPairIds: enabled } });
      if (r?.ok === false) {
        input.checked = !want;
        statusEl.textContent = r.error ?? "Falha ao gravar gatilhos";
      }
      input.disabled = false;
      await refresh();
    });
    return pairCells[id];
  }

  for (const p of FALLBACK_PAIRS) ensurePairRow(p.id, p.label);

  const actions = el("div", "ss-golde2f-actions");
  const btnDemo = el("button", "ss-golde2f-btn on-demo", "Demo");
  const btnReal = el("button", "ss-golde2f-btn", "Real");
  const btnToggle = el("button", "ss-golde2f-btn", "Parado");
  const btnReload = el("button", "ss-golde2f-btn on-warn ss-golde2f-hidden", "Actualizar página");
  btnDemo.type = "button";
  btnReal.type = "button";
  btnToggle.type = "button";
  btnReload.type = "button";
  btnReload.addEventListener("click", () => location.reload());
  actions.append(btnDemo, btnReal, btnToggle, btnReload);
  body.append(sub, chartWrap, signalBox, statusEl, stats, noGaleRow, observeRow, pairTitle, pairBoard, actions);
  card.append(head, body);
  root.append(card);

  let collapsed = false;
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    collapsed = !collapsed;
    root.classList.toggle("ss-golde2f-collapsed", collapsed);
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
    const cur = await send("get-golde2f-autopilot");
    const on = cur?.enabled === true;
    statusEl.textContent = on ? "A parar…" : "A ligar estratégia…";
    const r = await send("set-golde2f-autopilot", { enabled: !on });
    if (r?.error) statusEl.textContent = r.error;
    btnToggle.disabled = false;
    await refresh();
  });

  noGaleInput.addEventListener("change", async () => {
    const want = noGaleInput.checked === true;
    noGaleInput.disabled = true;
    statusEl.textContent = want ? "A activar modo sem gale…" : "A restaurar gales…";
    const cfg = await send("get-golde2f-config");
    const r = await send("set-golde2f-config", {
      config: {
        ...(cfg && typeof cfg === "object" ? cfg : {}),
        noGale: want,
        maxRecoveryPreference:
          cfg?.maxRecoveryPreference ??
          (cfg?.noGale ? 8 : cfg?.maxRecovery) ??
          8,
      },
    });
    if (r?.ok === false) {
      statusEl.textContent = r.error ?? "Erro ao mudar modo sem gale";
      noGaleInput.checked = !want;
    }
    noGaleInput.disabled = false;
    await refresh();
  });

  observeInput.addEventListener("change", async () => {
    const want = observeInput.checked === true;
    observeInput.disabled = true;
    statusEl.textContent = want ? "A activar só observação…" : "A reactivar cliques…";
    const cfg = await send("get-golde2f-config");
    const r = await send("set-golde2f-config", {
      config: {
        ...(cfg && typeof cfg === "object" ? cfg : {}),
        observeOnly: want,
      },
    });
    if (r?.ok === false) {
      statusEl.textContent = r.error ?? "Erro ao mudar modo sem clique";
      observeInput.checked = !want;
    }
    observeInput.disabled = false;
    await refresh();
  });

  function buildStreakLocal(statsLike) {
    const placar = Array.isArray(statsLike?.outcomeHistory)
      ? statsLike.outcomeHistory.filter((x) => x === "W" || x === "L")
      : [];
    const trigger = Array.isArray(statsLike?.indicationOutcomeHistory)
      ? statsLike.indicationOutcomeHistory.filter((x) => x === "W" || x === "L")
      : placar;

    const winStreakSeries = [];
    let winStreak = 0;
    let maxWinStreak = 0;
    for (const o of placar) {
      if (o === "W") {
        winStreak += 1;
        maxWinStreak = Math.max(maxWinStreak, winStreak);
      } else {
        winStreak = 0;
      }
      winStreakSeries.push(winStreak);
    }

    const lossStreakSeries = [];
    let lossStreak = 0;
    let maxLossStreak = 0;
    for (const o of trigger) {
      if (o === "L") {
        lossStreak += 1;
        maxLossStreak = Math.max(maxLossStreak, lossStreak);
      } else {
        lossStreak = 0;
      }
      lossStreakSeries.push(-lossStreak);
    }

    const pairs = statsLike?.pairIndication ?? {};
    let pairWins = 0;
    let pairLosses = 0;
    let hasPair = false;
    for (const slot of Object.values(pairs)) {
      if (!slot) continue;
      hasPair = true;
      pairWins += slot.wins ?? 0;
      pairLosses += slot.losses ?? 0;
    }
    return {
      outcomes: placar,
      winStreakSeries,
      lossStreakSeries,
      currentWinStreak: winStreak,
      currentLossStreak: lossStreak,
      maxWinStreak,
      maxLossStreak,
      totalWins: statsLike?.wins ?? placar.filter((x) => x === "W").length,
      totalLosses: statsLike?.losses ?? placar.filter((x) => x === "L").length,
      triggerWins: hasPair ? pairWins : trigger.filter((x) => x === "W").length,
      triggerLosses: hasPair ? pairLosses : trigger.filter((x) => x === "L").length,
    };
  }

  function drawStreakChart(metrics) {
    const canvas = chartCanvas;
    const box = canvasBox;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(40, box.clientWidth || 200);
    const h = Math.max(40, box.clientHeight || 140);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, w, h);

    const wins = metrics.winStreakSeries ?? [];
    const losses = metrics.lossStreakSeries ?? [];
    const n = Math.max(wins.length, losses.length, 1);
    let yMin = -1;
    let yMax = 1;
    for (let i = 0; i < n; i++) {
      yMax = Math.max(yMax, wins[i] ?? 0, 1);
      yMin = Math.min(yMin, losses[i] ?? 0, -1);
    }
    const padL = 22;
    const padR = 8;
    const padT = 8;
    const padB = 16;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const yAt = (v) => padT + ((yMax - v) / (yMax - yMin || 1)) * plotH;
    const xAt = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

    ctx.strokeStyle = "rgba(51,65,85,0.7)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const ticks = 5;
    for (let t = 0; t <= ticks; t++) {
      const v = yMin + ((yMax - yMin) * t) / ticks;
      const y = yAt(v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.font = "9px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(String(Math.round(v)), padL - 4, y + 3);
    }
    ctx.beginPath();
    ctx.moveTo(padL, yAt(0));
    ctx.lineTo(w - padR, yAt(0));
    ctx.strokeStyle = "#475569";
    ctx.stroke();
    ctx.setLineDash([]);

    function stepLine(series, color) {
      if (!series.length) return;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xAt(0), yAt(series[0] ?? 0));
      for (let i = 1; i < series.length; i++) {
        const x = xAt(i);
        const yPrev = yAt(series[i - 1] ?? 0);
        const y = yAt(series[i] ?? 0);
        ctx.lineTo(x, yPrev);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < series.length; i++) {
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(series[i] ?? 0), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    stepLine(wins, "#4ade80");
    stepLine(losses, "#f87171");
  }

  function renderStreakUi(st) {
    const metrics =
      st.streak && typeof st.streak === "object"
        ? st.streak
        : buildStreakLocal({
            outcomeHistory: st.outcomeHistory,
            indicationOutcomeHistory: st.indicationOutcomeHistory,
            pairIndication: st.pairIndication,
            wins: st.wins,
            losses: st.losses,
          });
    mConsecVal.textContent = String(metrics.currentWinStreak ?? 0);
    mMaxUpVal.textContent = String(metrics.maxWinStreak ?? 0);
    mDdNowVal.textContent = String(metrics.currentLossStreak ?? 0);
    mDdMaxVal.textContent = String(metrics.maxLossStreak ?? 0);
    drawStreakChart(metrics);
  }

  // Drag + persist size/position
  const LAYOUT_KEY = "ssGolde2fPanelLayout";
  function loadLayout() {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (typeof o.left === "number") {
        root.style.left = `${o.left}px`;
        root.style.right = "auto";
      }
      if (typeof o.top === "number") root.style.top = `${o.top}px`;
      if (typeof o.width === "number") root.style.width = `${o.width}px`;
      if (typeof o.height === "number") root.style.height = `${o.height}px`;
    } catch {
      /* ignore */
    }
  }
  function saveLayout() {
    const rect = root.getBoundingClientRect();
    try {
      localStorage.setItem(
        LAYOUT_KEY,
        JSON.stringify({
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }),
      );
    } catch {
      /* ignore */
    }
  }
  let drag = null;
  head.addEventListener("pointerdown", (e) => {
    if (e.target === minBtn || minBtn.contains(e.target)) return;
    drag = {
      dx: e.clientX - root.getBoundingClientRect().left,
      dy: e.clientY - root.getBoundingClientRect().top,
    };
    head.setPointerCapture?.(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const left = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - drag.dx));
    const top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.dy));
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.right = "auto";
  });
  head.addEventListener("pointerup", () => {
    if (!drag) return;
    drag = null;
    saveLayout();
  });
  let resizeSaveTimer = null;
  window.addEventListener("mouseup", () => {
    clearTimeout(resizeSaveTimer);
    resizeSaveTimer = setTimeout(saveLayout, 120);
  });
  loadLayout();

  function axisLabel(short) {
    const s = String(short ?? "").toLowerCase().replace(/\s+/g, "");
    if (s === "c/a" || s === "cor-altura" || s === "cor/altura") return "Cor / Altura";
    if (s === "p/a" || s === "altura-paridade" || s === "paridade/altura") return "Paridade / Altura";
    if (s === "c/p" || s === "cor-paridade" || s === "cor/paridade") return "Cor / Paridade";
    return short ? String(short) : "";
  }

  function parseSignalFromStatus(st) {
    const label = String(st.label ?? "");
    const pairFromLabel = label.match(/(\d+)\s*[x×]\s*(\d+)/i);
    const posFromLegacy = label.match(/pos\s*(\d+)\s*[\/]\s*(\d+)/i);
    const galeFromLabel = label.match(/gale\s*(\d+)/i);
    const recovery =
      typeof st.recovery === "number" && Number.isFinite(st.recovery)
        ? Math.max(0, Math.floor(st.recovery))
        : galeFromLabel
          ? Number(galeFromLabel[1])
          : 0;

    let indication = "";
    const pairIdx = label.search(/\s·\s*\d+\s*[x×]\s*\d+/i);
    const posIdx = label.search(/\s·\s*pos\s*\d/i);
    const cutIdx =
      pairIdx > 0 ? pairIdx : posIdx > 0 ? posIdx : -1;
    if (cutIdx > 0) {
      indication = label
        .slice(0, cutIdx)
        .replace(/\s*·\s*gale\s*\d+/gi, "")
        .trim();
    } else if (label && !/aguarda refer/i.test(label)) {
      indication = label.replace(/\s*·\s*gale\s*\d+/gi, "").trim();
    }

    // Só factores da aposta (ex.: Baixo · Ímpar) — remove par/eixo (2×4 p/a, etc.).
    indication = indication
      .replace(/\s*[+·]\s*\d+\s*[x×]\s*\d+\b.*$/i, "")
      .replace(/\s*[+·]\s*(c\/a|p\/a|c\/p|cor\/altura|paridade\/altura|cor\/paridade|cor-altura|altura-paridade|cor-paridade)\b.*$/i, "")
      .trim();

    const numsFromLabel = label.match(/n[ºo]\s*(\d+)\s*[·.]\s*(\d+)/i);
    const axisRaw = st.axis ?? null;
    const posA =
      st.criticalPosition ??
      (pairFromLabel ? Number(pairFromLabel[1]) : null) ??
      (posFromLegacy ? Number(posFromLegacy[1]) : null);
    const posB =
      st.matchPosition ??
      (pairFromLabel ? Number(pairFromLabel[2]) : null) ??
      (posFromLegacy ? Number(posFromLegacy[2]) : null);
    return {
      position:
        posA != null && posB != null && Number.isFinite(posA) && Number.isFinite(posB)
          ? `${posA}/${posB}`
          : null,
      nums:
        numsFromLabel != null
          ? `${numsFromLabel[1]}·${numsFromLabel[2]}`
          : st.triggerNumber != null && st.matchNumber != null
            ? `${st.triggerNumber}·${st.matchNumber}`
            : null,
      axis: axisRaw,
      indication,
      recovery,
      isPause: st.waitingReference === true || /aguarda refer/i.test(label),
    };
  }

  function factorsOnlyLabel(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return "";
    const cleaned = text
      .replace(/\s*[+·]\s*\d+\s*[x×]\s*\d+\b.*$/i, "")
      .replace(/\s*[+·]\s*(c\/a|p\/a|c\/p|cor\/altura|paridade\/altura|cor\/paridade|cor-altura|altura-paridade|cor-paridade)\b.*$/i, "")
      .replace(/\s*·\s*gale\s*\d+/gi, "")
      .trim();
    return cleaned.replace(/\s*·\s*/g, " + ").replace(/\s*\+\s*/g, " + ");
  }

  function renderSignalBlock(st) {
    const hasActive = st.active === true || st.waitingReference === true;
    const parsed = parseSignalFromStatus(st);

    signalIdle.classList.add("ss-golde2f-hidden");
    signalWatch.classList.add("ss-golde2f-hidden");
    signalPos.classList.add("ss-golde2f-hidden");
    signalAxis.classList.add("ss-golde2f-hidden");
    signalIndication.classList.add("ss-golde2f-hidden");
    signalGale.classList.add("ss-golde2f-hidden");

    if (!hasActive) {
      signalIdle.classList.remove("ss-golde2f-hidden");
      const noGale = st.noGale === true || st.maxRecovery === 0;
      if (st.recovery > 0 && !st.active && !noGale) {
        signalIdle.textContent = `Sem sinal · gale ${st.recovery} pendente`;
      } else if (st.lastFlash === "win") {
        signalIdle.textContent = "Sem sinal — vitória registada";
      } else if (st.observeOnly === true) {
        signalIdle.textContent = "Sem sinal — sem clique (observação)";
      } else if (noGale) {
        signalIdle.textContent = "Sem sinal — sem gale · stake única";
      } else {
        const enabled = Array.isArray(st.enabledPairIds) ? st.enabledPairIds : [];
        const labels = enabled.map((id) => String(id).replace(/x/gi, "×"));
        signalIdle.textContent =
          labels.length > 0
            ? `Sem sinal — ${labels.join(" · ")} · indica no match`
            : "Sem sinal — activa pelo menos 1 gatilho";
      }
      if (st.watchLabel) {
        signalWatch.classList.remove("ss-golde2f-hidden");
        signalWatch.textContent = `Placar: ${st.watchLabel}`;
      }
      return;
    }

    signalGale.classList.remove("ss-golde2f-hidden");

    if (parsed.isPause) {
      signalIndication.classList.remove("ss-golde2f-hidden");
      signalIndication.textContent = "ZERO — PAUSA";
      signalGale.className = "ss-golde2f-gale wait";
      signalGale.textContent = parsed.recovery > 0 ? `GALE ${parsed.recovery} MANTIDO` : "AGUARDA REF.";
    } else {
      if (parsed.position) {
        signalPos.classList.remove("ss-golde2f-hidden");
        signalPos.textContent = parsed.nums
          ? `${String(parsed.position).replace("/", "×")} · nº${parsed.nums}`
          : `${String(parsed.position).replace("/", "×")}`;
      }
      if (parsed.axis) {
        const ax = axisLabel(parsed.axis);
        if (ax) {
          signalAxis.classList.remove("ss-golde2f-hidden");
          signalAxis.textContent = ax;
        }
      }
      const factors =
        factorsOnlyLabel(parsed.indication) || factorsOnlyLabel(st.label);
      if (factors) {
        signalIndication.classList.remove("ss-golde2f-hidden");
        signalIndication.textContent = factors;
      }
    }

    if (st.waitingBet && !parsed.isPause) {
      signalGale.className = "ss-golde2f-gale wait";
      signalGale.textContent =
        st.waitRemainingSec != null
          ? `AGUARDA ${st.waitRemainingSec}s`
          : "AGUARDA JANELA";
    } else if (parsed.recovery > 0 && st.noGale !== true && st.maxRecovery !== 0) {
      signalGale.className = "ss-golde2f-gale recovery";
      signalGale.textContent = `GALE ${parsed.recovery}`;
    } else {
      signalGale.className = "ss-golde2f-gale entry";
      signalGale.textContent =
        st.observeOnly === true
          ? "OBSERVAÇÃO"
          : st.noGale === true || st.maxRecovery === 0
            ? "STAKE ÚNICA"
            : "ENTRADA";
    }
  }

  function renderStatus(data) {
    statusEl.classList.remove("err");

    if (!data || data.error) {
      statusEl.classList.add("err");
      statusEl.textContent = friendlyError(
        data?.error ?? "Extensão sem resposta — recarregue em chrome://extensions",
      );
      btnToggle.className = "ss-golde2f-btn on-warn";
      btnToggle.textContent = "Parado";
      if (contextDead) btnReload.classList.remove("ss-golde2f-hidden");
      return;
    }

    btnReload.classList.add("ss-golde2f-hidden");

    const mode = data.mode === "real" ? "real" : "demo";
    const ice2f = data.golde2fAutopilot;
    const st = ice2f?.status ?? {};
    const on = ice2f?.enabled === true;
    const running = st.running === true;
    const engaged = on && (running || st.active === true || st.waitingBet === true);

    btnDemo.className = `ss-golde2f-btn ${mode === "demo" ? "on-demo" : ""}`;
    btnReal.className = `ss-golde2f-btn ${mode === "real" ? "on-real" : ""}`;

    if (engaged) {
      btnToggle.className = "ss-golde2f-btn on-active";
      btnToggle.textContent = running ? "Activo" : "A ligar…";
    } else if (on) {
      btnToggle.className = "ss-golde2f-btn on-warn";
      btnToggle.textContent = "A ligar…";
    } else {
      btnToggle.className = "ss-golde2f-btn";
      btnToggle.textContent = "Parado";
    }

    winNum.textContent = String(st.wins ?? 0);
    lossNum.textContent = String(st.losses ?? 0);

    const noGale =
      st.noGale === true ||
      data.golde2fConfig?.noGale === true ||
      st.maxRecovery === 0;
    noGaleInput.checked = noGale;
    noGaleRow.classList.toggle("on", noGale);

    const observeOnly =
      st.observeOnly === true || data.golde2fConfig?.observeOnly === true;
    observeInput.checked = observeOnly;
    observeRow.classList.toggle("on", observeOnly);

    sub.textContent = observeOnly
      ? "Roulette 3 · mesa 230 · sem clique (observação)"
      : noGale
        ? "Roulette 3 · mesa 230 · sem gale · stake única"
        : "Roulette 3 · mesa 230 · stake 2·4·8·16·32·64";

    const pairMap = st.pairIndication && typeof st.pairIndication === "object" ? st.pairIndication : {};
    const known =
      Array.isArray(st.knownPairs) && st.knownPairs.length > 0
        ? st.knownPairs
        : FALLBACK_PAIRS;
    const enabledSet = new Set(
      Array.isArray(st.enabledPairIds) && st.enabledPairIds.length > 0
        ? st.enabledPairIds
        : Array.isArray(data.golde2fConfig?.enabledPairIds)
          ? data.golde2fConfig.enabledPairIds
          : ["2x4"],
    );
    for (const meta of known) {
      const id = meta.id;
      const label = meta.label || String(id).replace(/x/gi, "×");
      const cells = ensurePairRow(id, label);
      const slot = pairMap[id] ?? {};
      cells.ok.textContent = String(slot.wins ?? 0);
      cells.bad.textContent = String(slot.losses ?? 0);
      const on = enabledSet.has(id);
      cells.input.checked = on;
      cells.row.classList.toggle("off", !on);
    }

    const activeLabels = [...enabledSet].map((id) => String(id).replace(/x/gi, "×"));
    signalIdle.textContent =
      activeLabels.length > 0
        ? `Sem sinal — ${activeLabels.join(" · ")} · indica no match`
        : "Sem sinal — activa pelo menos 1 gatilho";

    renderStreakUi(st);
    renderSignalBlock({ ...st, noGale, observeOnly, enabledPairIds: [...enabledSet] });

    const parts = [];
    parts.push(mode === "real" ? "Modo REAL" : "Modo DEMO");
    if (observeOnly) parts.push("sem clique");
    if (noGale) parts.push("sem gale");
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

