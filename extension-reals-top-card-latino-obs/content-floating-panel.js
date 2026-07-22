(function mountTopCardLatinoObsPanel() {
  if (window !== window.top || document.getElementById("ss-tcl-obs-reals-panel")) return;

  const root = document.createElement("aside");
  root.id = "ss-tcl-obs-reals-panel";
  root.innerHTML = `
    <style>
      #ss-tcl-obs-reals-panel{position:fixed;top:12px;right:12px;z-index:2147483600;width:480px;min-width:360px;min-height:140px;resize:both;overflow:auto;color:#cbd5e1;background:#07111ff5;border:1px solid #075985;border-radius:12px;box-shadow:0 14px 38px #0009;font:12px/1.4 system-ui,sans-serif}
      #ss-tcl-obs-reals-panel *{box-sizing:border-box}
      #ss-tcl-obs-reals-panel .head{display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid #164e63;background:#081525;cursor:grab;user-select:none}
      #ss-tcl-obs-reals-panel .title{flex:1;color:#bae6fd;font-size:11px;font-weight:800;text-transform:uppercase}
      #ss-tcl-obs-reals-panel .min{border:0;color:#94a3b8;background:none;cursor:pointer;font-size:17px}
      #ss-tcl-obs-reals-panel .body{padding:10px}
      #ss-tcl-obs-reals-panel.collapsed .body{display:none}
      #ss-tcl-obs-reals-panel .meta{color:#64748b;font-size:10px}
      #ss-tcl-obs-reals-panel .last{padding:10px;border:1px solid #164e63;border-radius:9px;text-align:center;background:#0b1729}
      #ss-tcl-obs-reals-panel .last strong{display:block;color:#f8fafc;font-size:22px}
      #ss-tcl-obs-reals-panel .signal{margin-top:8px;padding:10px;border:1px solid #854d0e;border-radius:9px;text-align:center;background:#1c1408}
      #ss-tcl-obs-reals-panel .signal.active{border-color:#16a34a;background:#052e16}
      #ss-tcl-obs-reals-panel .signal .sig-state{color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase}
      #ss-tcl-obs-reals-panel .signal.active .sig-state{color:#86efac}
      #ss-tcl-obs-reals-panel .signal .sig-color{display:block;font-size:22px;font-weight:800;color:#f8fafc;margin:4px 0}
      #ss-tcl-obs-reals-panel .signal .sig-meta{color:#94a3b8;font-size:10px}
      #ss-tcl-obs-reals-panel .chart-wrap{margin-top:8px;padding:8px;border:1px solid #1e293b;border-radius:10px;background:#040a12}
      #ss-tcl-obs-reals-panel .chart-title{margin:0 0 6px;color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
      #ss-tcl-obs-reals-panel .chart-canvas-box{position:relative;height:140px;border-radius:8px;border:1px solid #1e293b;background:#020617;overflow:hidden}
      #ss-tcl-obs-reals-panel .chart-canvas-box canvas{width:100%;height:100%;display:block}
      #ss-tcl-obs-reals-panel .chart-metrics{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
      #ss-tcl-obs-reals-panel .chart-metric{display:flex;justify-content:space-between;gap:6px;padding:6px 8px;border-radius:8px;border:1px solid #1e293b;background:#0b1220;font-size:10px}
      #ss-tcl-obs-reals-panel .chart-metric span{color:#94a3b8}
      #ss-tcl-obs-reals-panel .chart-metric strong.up{color:#86efac}
      #ss-tcl-obs-reals-panel .chart-metric strong.down{color:#fca5a5}
      #ss-tcl-obs-reals-panel .placar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}
      #ss-tcl-obs-reals-panel .placar-item{padding:8px 6px;border:1px solid #1e293b;border-radius:8px;background:#0b1220;text-align:center}
      #ss-tcl-obs-reals-panel .placar-item strong{display:block;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
      #ss-tcl-obs-reals-panel .placar-item small{color:#94a3b8;font-size:9px;text-transform:uppercase}
      #ss-tcl-obs-reals-panel .placar-item.win strong{color:#86efac}
      #ss-tcl-obs-reals-panel .placar-item.loss strong{color:#fca5a5}
      #ss-tcl-obs-reals-panel .placar-item.pct strong{color:#bae6fd}
      #ss-tcl-obs-reals-panel .history{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));grid-template-rows:repeat(8,auto);gap:3px;margin-top:8px}
      #ss-tcl-obs-reals-panel .chip{min-width:0;min-height:1.85rem;padding:4px 2px;border-radius:5px;text-align:center;font-size:10px;font-weight:800;border:2px solid transparent;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center}
      #ss-tcl-obs-reals-panel .chip.match-hl{border-color:#facc15;box-shadow:0 0 0 1px #facc15}
      #ss-tcl-obs-reals-panel .chip.empty-slot{color:#334155;background:#0b1729;border-color:#1e293b;border-style:dashed;font-weight:600}
      #ss-tcl-obs-reals-panel .home{color:#111827;background:#f59e0b}
      #ss-tcl-obs-reals-panel .away{color:#fff;background:#dc2626}
      #ss-tcl-obs-reals-panel .draw{color:#fff;background:#059669}
      #ss-tcl-obs-reals-panel .cols{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
      #ss-tcl-obs-reals-panel .col{padding:7px;border:1px solid #1e293b;border-radius:8px;background:#081221}
      #ss-tcl-obs-reals-panel .col h3{margin:0 0 6px;color:#fde68a;font-size:9px;font-weight:800;text-transform:uppercase}
      #ss-tcl-obs-reals-panel .list{display:grid;gap:4px;max-height:22vh;overflow:auto}
      #ss-tcl-obs-reals-panel .row{display:grid;grid-template-columns:1fr auto;gap:4px;padding:4px 5px;border-radius:5px;background:#0b1729}
      #ss-tcl-obs-reals-panel .row.signal-hl{border:1px solid #facc15;background:#1c1408}
      #ss-tcl-obs-reals-panel .row.ready-3{outline:1px solid #166534}
      #ss-tcl-obs-reals-panel .pair{color:#f8fafc;font-weight:800;font-size:11px}
      #ss-tcl-obs-reals-panel .count{color:#94a3b8;font-size:9px}
      #ss-tcl-obs-reals-panel .empty{color:#64748b;font-size:10px}
      #ss-tcl-obs-reals-panel .actions{display:flex;gap:5px;margin-top:8px;flex-wrap:wrap}
      #ss-tcl-obs-reals-panel .actions button{flex:1;min-width:70px;padding:6px;border:1px solid #334155;border-radius:6px;color:#cbd5e1;background:#1e293b;cursor:pointer;font:700 10px system-ui}
      #ss-tcl-obs-reals-panel .actions button.on{border-color:#0284c7;color:#e0f2fe;background:#0c4a6e}
      #ss-tcl-obs-reals-panel .error{color:#fca5a5}
      #ss-tcl-obs-reals-panel .shoe{margin-top:8px;padding:8px;border:1px solid #1e293b;border-radius:10px;background:#040a12}
      #ss-tcl-obs-reals-panel .shoe-title{margin:0 0 6px;color:#94a3b8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
      #ss-tcl-obs-reals-panel .shoe-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      #ss-tcl-obs-reals-panel .shoe-side{padding:7px 8px;border:1px solid #1e293b;border-radius:8px;background:#0b1220}
      #ss-tcl-obs-reals-panel .shoe-side strong{display:block;font-size:11px;font-weight:800;margin-bottom:4px}
      #ss-tcl-obs-reals-panel .shoe-side.home strong{color:#fbbf24}
      #ss-tcl-obs-reals-panel .shoe-side.away strong{color:#f87171}
      #ss-tcl-obs-reals-panel .shoe-side span{display:block;color:#94a3b8;font-size:10px;font-variant-numeric:tabular-nums}
      #ss-tcl-obs-reals-panel .shoe-probs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}
      #ss-tcl-obs-reals-panel .shoe-prob{padding:6px;border:1px solid #1e293b;border-radius:8px;background:#0b1220;text-align:center}
      #ss-tcl-obs-reals-panel .shoe-prob b{display:block;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
      #ss-tcl-obs-reals-panel .shoe-prob small{color:#94a3b8;font-size:9px;text-transform:uppercase}
      #ss-tcl-obs-reals-panel .shoe-prob.home b{color:#fbbf24}
      #ss-tcl-obs-reals-panel .shoe-prob.away b{color:#f87171}
      #ss-tcl-obs-reals-panel .shoe-prob.draw b{color:#86efac}
      #ss-tcl-obs-reals-panel .shoe-meta{margin-top:6px;color:#64748b;font-size:9px}
    </style>
    <div class="head">
      <span class="title">Reals · Latino · Obs · v1.0.0</span>
      <button class="min" type="button">−</button>
    </div>
    <div class="body">
      <div class="signal">
        <span class="sig-state">Sem indicação</span>
        <strong class="sig-color">—</strong>
        <span class="sig-meta"></span>
      </div>
      <div class="chart-wrap">
        <div class="chart-title">Run-up &amp; Drawdown · indicações</div>
        <div class="chart-canvas-box"><canvas class="chart-canvas"></canvas></div>
        <div class="chart-metrics">
          <div class="chart-metric"><span>Consecutivas</span><strong class="up m-consec">0</strong></div>
          <div class="chart-metric"><span>Máx. run-up</span><strong class="up m-maxup">0</strong></div>
          <div class="chart-metric"><span>Drawdown atual</span><strong class="down m-ddnow">0</strong></div>
          <div class="chart-metric"><span>Máx. drawdown</span><strong class="down m-ddmax">0</strong></div>
        </div>
        <div class="placar">
          <div class="placar-item win"><strong class="m-wins">0</strong><small>Vitórias</small></div>
          <div class="placar-item loss"><strong class="m-losses">0</strong><small>Derrotas</small></div>
          <div class="placar-item pct"><strong class="m-pct">0%</strong><small>Sessão</small></div>
        </div>
      </div>
      <div class="shoe">
        <div class="shoe-title">Shoe · 8 baralhos · altas 10–K · médias 6–9</div>
        <div class="shoe-grid">
          <div class="shoe-side home">
            <strong>Amarelo saídas</strong>
            <span class="shoe-home-high">Altas 0</span>
            <span class="shoe-home-mid">Médias 0</span>
          </div>
          <div class="shoe-side away">
            <strong>Vermelho saídas</strong>
            <span class="shoe-away-high">Altas 0</span>
            <span class="shoe-away-mid">Médias 0</span>
          </div>
        </div>
        <div class="shoe-probs">
          <div class="shoe-prob home"><b class="shoe-p-home">—</b><small>P Casa</small></div>
          <div class="shoe-prob away"><b class="shoe-p-away">—</b><small>P Visit</small></div>
          <div class="shoe-prob draw"><b class="shoe-p-draw">—</b><small>P Empate</small></div>
        </div>
        <div class="shoe-meta shoe-rest">Restam —</div>
      </div>
      <div class="history"></div>
      <div class="status meta">A ligar…</div>
      <div class="actions">
        <button class="toggle" type="button">Ligar</button>
        <button class="refresh" type="button">Atualizar</button>
        <button class="clear-history" type="button">Limpar histórico</button>
        <button class="open-game" type="button">Abrir mesa</button>
        <button class="open-fixed" type="button">Painel fixo</button>
      </div>
    </div>`;

  const query = (selector) => root.querySelector(selector);
  const send = (kind, extra = {}) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ kind, ...extra }, (response) => {
          resolve(
            chrome.runtime.lastError
              ? { ok: false, error: chrome.runtime.lastError.message }
              : response,
          );
        });
      } catch (error) {
        resolve({ ok: false, error: String(error) });
      }
    });

  const label = (side) =>
    side === "home" ? "AMARELO" : side === "away" ? "VERMELHO" : side === "draw" ? "EMPATE" : "—";

  let status = null;
  let uiPort = null;

  function connectUi() {
    try {
      uiPort = chrome.runtime.connect({ name: "tcl-obs-ui" });
      uiPort.onMessage.addListener((msg) => {
        if (msg?.kind === "status" && msg.data) render(msg.data);
      });
      uiPort.onDisconnect.addListener(() => {
        uiPort = null;
        setTimeout(connectUi, 1500);
      });
    } catch {
      setTimeout(connectUi, 2000);
    }
  }

  function drawStreakChart(metrics) {
    const canvas = query(".chart-canvas");
    const box = query(".chart-canvas-box");
    if (!canvas || !box) return;
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

    const wins = metrics?.winStreakSeries ?? [];
    const losses = metrics?.lossStreakSeries ?? [];
    const n = Math.max(wins.length, losses.length, 1);
    let yMin = -1;
    let yMax = 1;
    for (let i = 0; i < n; i += 1) {
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
    for (let t = 0; t <= ticks; t += 1) {
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
      for (let i = 1; i < series.length; i += 1) {
        const x = xAt(i);
        const yPrev = yAt(series[i - 1] ?? 0);
        const y = yAt(series[i] ?? 0);
        ctx.lineTo(x, yPrev);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < series.length; i += 1) {
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(series[i] ?? 0), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    stepLine(wins, "#4ade80");
    stepLine(losses, "#f87171");
  }

  function render(data) {
    if (!data?.ok) {
      query(".status").textContent = data?.error ?? "Extensão sem resposta.";
      query(".status").classList.add("error");
      return;
    }
    status = data;
    query(".status").classList.toggle("error", Boolean(data.lastError));
    const streak = data.streak ?? {};
    query(".status").textContent = data.lastError
      ? data.lastError
      : `${data.active ? "Ativo" : "Parado"} · DGA ${data.dgaStatus} · ${streak.totalWins ?? 0}W/${streak.totalLosses ?? 0}L · ${data.history?.length ?? 0} rodadas`;
    query(".toggle").classList.toggle("on", data.active === true);
    query(".toggle").textContent = data.active ? "Parar" : "Ligar";

    const signal = data.activeSignal;
    const sigBox = query(".signal");
    const sigState = query(".sig-state");
    const sigColor = query(".sig-color");
    const sigMeta = query(".sig-meta");
    if (signal?.indication) {
      sigBox.classList.add("active");
      sigState.textContent = "INDICAÇÃO · 1 coincidência";
      sigColor.textContent = label(signal.indication);
      sigColor.style.color =
        signal.indication === "home" ? "#fbbf24" : signal.indication === "away" ? "#f87171" : "#86efac";
      sigMeta.textContent = `${signal.focusLabel} · ${signal.opponentLabel} · esq→${label(signal.indication)} · dir ${label(signal.rightWinner)}+${label(signal.right2Winner)}`;
    } else {
      sigBox.classList.remove("active");
      sigState.textContent = "Sem indicação";
      sigColor.textContent = "—";
      sigColor.style.color = "";
      sigMeta.textContent =
        "Aguarda coincidência exacta mais recente · dir: 2× mesma cor";
    }

    query(".m-consec").textContent = String(streak.currentWinStreak ?? 0);
    query(".m-maxup").textContent = String(streak.maxWinStreak ?? 0);
    query(".m-ddnow").textContent = String(streak.currentLossStreak ?? 0);
    query(".m-ddmax").textContent = String(streak.maxLossStreak ?? 0);
    const wins = streak.totalWins ?? 0;
    const losses = streak.totalLosses ?? 0;
    const played = wins + losses;
    query(".m-wins").textContent = String(wins);
    query(".m-losses").textContent = String(losses);
    query(".m-pct").textContent = played ? `${Math.round((wins / played) * 100)}%` : "0%";
    drawStreakChart(streak);

    const shoe = data.shoe;
    const homeOut = shoe?.sideOut?.home;
    const awayOut = shoe?.sideOut?.away;
    query(".shoe-home-high").textContent = `Altas ${homeOut?.high ?? 0}`;
    query(".shoe-home-mid").textContent = `Médias ${homeOut?.mid ?? 0}`;
    query(".shoe-away-high").textContent = `Altas ${awayOut?.high ?? 0}`;
    query(".shoe-away-mid").textContent = `Médias ${awayOut?.mid ?? 0}`;
    query(".shoe-p-home").textContent =
      shoe?.probs != null ? `${shoe.probs.home}%` : "—";
    query(".shoe-p-away").textContent =
      shoe?.probs != null ? `${shoe.probs.away}%` : "—";
    query(".shoe-p-draw").textContent =
      shoe?.probs != null ? `${shoe.probs.draw}%` : "—";
    query(".shoe-rest").textContent = shoe
      ? `Restam ${shoe.remaining?.high ?? 0} altas · ${shoe.remaining?.mid ?? 0} médias · ${shoe.remaining?.total ?? 0}/${shoe.shoeTotal ?? 0} cartas · vistas ${shoe.cardsSeen ?? 0}`
      : "Restam —";

    const history = query(".history");
    history.replaceChildren();
    const grid = Array.isArray(data.historyGrid) ? data.historyGrid : null;
    if (grid?.length) {
      for (const cell of grid) {
        const chip = document.createElement("span");
        if (cell.empty || !cell.round) {
          chip.className = "chip empty-slot";
          chip.textContent = "·";
        } else {
          const round = cell.round;
          chip.className = `chip ${round.winner || ""}${cell.matchHl ? " match-hl" : ""}`;
          if (round.home?.label && round.away?.label) {
            chip.textContent = `${round.home.label}/${round.away.label}`;
            chip.title = `Amarelo ${round.home.label} · Vermelho ${round.away.label} → ${label(round.winner)}`;
          } else {
            chip.textContent =
              round.winner === "home" ? "A" : round.winner === "away" ? "V" : "E";
          }
        }
        history.appendChild(chip);
      }
    }
  }

  async function refresh() {
    render(await send("tcl-obs-get-status"));
  }

  query(".min").addEventListener("click", () => root.classList.toggle("collapsed"));
  query(".toggle").addEventListener("click", async () => {
    await send("tcl-obs-set-active", { active: !status?.active });
    await refresh();
  });
  query(".refresh").addEventListener("click", async () => {
    await send("tcl-obs-refresh");
    await refresh();
  });
  query(".clear-history").addEventListener("click", async () => {
    await send("tcl-obs-clear-history");
    await refresh();
  });
  query(".open-fixed").addEventListener("click", async () => {
    await send("tcl-obs-open-panel");
  });
  query(".open-game").addEventListener("click", async () => {
    await send("tcl-obs-open-game");
  });

  const head = query(".head");
  let drag = null;
  head.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    drag = { x: event.clientX, y: event.clientY, left: root.offsetLeft, top: root.offsetTop };
    head.setPointerCapture(event.pointerId);
  });
  head.addEventListener("pointermove", (event) => {
    if (!drag) return;
    root.style.left = `${drag.left + event.clientX - drag.x}px`;
    root.style.top = `${drag.top + event.clientY - drag.y}px`;
    root.style.right = "auto";
  });
  head.addEventListener("pointerup", () => {
    drag = null;
  });

  document.documentElement.appendChild(root);
  connectUi();
  void refresh();
  setInterval(refresh, 2000);
  window.addEventListener("resize", () => {
    if (status?.streak) drawStreakChart(status.streak);
  });
})();
