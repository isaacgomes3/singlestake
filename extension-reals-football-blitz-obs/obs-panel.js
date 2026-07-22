let lastStatus = null;

function $(id) {
  return document.getElementById(id);
}

function send(kind, extra = {}) {
  return new Promise((resolve) => {
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
}

const label = (side) =>
  side === "home" ? "AMARELO" : side === "away" ? "AZUL" : side === "draw" ? "EMPATE" : "—";

function drawStreakChart(metrics) {
  const canvas = $("chartCanvas");
  const box = canvas?.parentElement;
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
  lastStatus = data;
  const statusEl = $("status");
  if (!data?.ok) {
    statusEl.textContent = data?.error ?? "Sem resposta.";
    statusEl.classList.add("error");
    return;
  }
  statusEl.classList.toggle("error", Boolean(data.lastError));

  const displayRounds = Array.isArray(data.displayRounds) ? data.displayRounds : [];
  const streak = data.streak ?? {};

  $("sub").textContent = data.note
    ? data.note
    : `Mesa ${data.tableKey ?? 4001} · DGA ${data.dgaStatus}`;

  const updated = data.updatedAt ? String(data.updatedAt).slice(11, 19) : "—";
  statusEl.textContent = data.lastError
    ? data.lastError
    : `${data.active ? "Ativo" : "Parado"} · DGA ${data.dgaStatus} · ${streak.totalWins ?? 0}W/${streak.totalLosses ?? 0}L · ${data.history?.length ?? 0} rodadas · upd ${updated}`;

  $("toggle").classList.toggle("on", data.active === true);
  $("toggle").textContent = data.active ? "Parar" : "Ligar";

  const signal = data.activeSignal;
  const sigBox = $("signalBox");
  if (signal?.indication) {
    sigBox.classList.add("active");
    $("sigState").textContent = "INDICAÇÃO · 1 coincidência";
    $("sigColor").textContent = label(signal.indication);
    $("sigColor").style.color =
      signal.indication === "home" ? "#fbbf24" : signal.indication === "away" ? "#60a5fa" : "#86efac";
    $("sigMeta").textContent = `${signal.focusLabel} · ${signal.opponentLabel} · esq→${label(signal.indication)} · dir ${label(signal.rightWinner)}+${label(signal.right2Winner)}`;
  } else {
    sigBox.classList.remove("active");
    $("sigState").textContent = "Sem indicação";
    $("sigColor").textContent = "—";
    $("sigColor").style.color = "";
    $("sigMeta").textContent =
      "Aguarda coincidência exacta mais recente · dir: 2× mesma cor";
  }

  $("mConsec").textContent = String(streak.currentWinStreak ?? 0);
  $("mMaxUp").textContent = String(streak.maxWinStreak ?? 0);
  $("mDdNow").textContent = String(streak.currentLossStreak ?? 0);
  $("mDdMax").textContent = String(streak.maxLossStreak ?? 0);
  const wins = streak.totalWins ?? 0;
  const losses = streak.totalLosses ?? 0;
  const played = wins + losses;
  $("mWins").textContent = String(wins);
  $("mLosses").textContent = String(losses);
  $("mPct").textContent = played ? `${Math.round((wins / played) * 100)}%` : "0%";
  drawStreakChart(streak);

  const shoe = data.shoe;
  const homeOut = shoe?.sideOut?.home;
  const awayOut = shoe?.sideOut?.away;
  $("shoeHomeHigh").textContent = `Altas ${homeOut?.high ?? 0}`;
  $("shoeHomeMid").textContent = `Médias ${homeOut?.mid ?? 0}`;
  $("shoeAwayHigh").textContent = `Altas ${awayOut?.high ?? 0}`;
  $("shoeAwayMid").textContent = `Médias ${awayOut?.mid ?? 0}`;
  $("shoePHome").textContent = shoe?.probs != null ? `${shoe.probs.home}%` : "—";
  $("shoePAway").textContent = shoe?.probs != null ? `${shoe.probs.away}%` : "—";
  $("shoePDraw").textContent = shoe?.probs != null ? `${shoe.probs.draw}%` : "—";
  $("shoeRest").textContent = shoe
    ? `Restam ${shoe.remaining?.high ?? 0} altas · ${shoe.remaining?.mid ?? 0} médias · ${shoe.remaining?.total ?? 0}/${shoe.shoeTotal ?? 0} cartas · vistas ${shoe.cardsSeen ?? 0}`
    : "Restam —";

  const history = $("history");
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
          chip.title = `Amarelo ${round.home.label} · Azul ${round.away.label} → ${label(round.winner)}`;
        } else {
          chip.textContent =
            round.winner === "home" ? "A" : round.winner === "away" ? "Z" : "E";
          chip.title = label(round.winner);
        }
      }
      history.appendChild(chip);
    }
  } else if (!displayRounds.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Aguardando DGA…";
    history.appendChild(empty);
  }
}

async function refresh() {
  render(await send("fb-blitz-obs-get-status"));
}

$("toggle").addEventListener("click", async () => {
  await send("fb-blitz-obs-set-active", { active: !lastStatus?.active });
  await refresh();
});
$("refresh").addEventListener("click", async () => {
  await send("fb-blitz-obs-refresh");
  await refresh();
});
$("clearHistory").addEventListener("click", async () => {
  await send("fb-blitz-obs-clear-history");
  await refresh();
});
$("openGame").addEventListener("click", async () => {
  await send("fb-blitz-obs-open-game");
});

try {
  const port = chrome.runtime.connect({ name: "fb-blitz-obs-ui" });
  port.onMessage.addListener((msg) => {
    if (msg?.kind === "status" && msg.data) render(msg.data);
  });
} catch {
  /* */
}

void refresh();
setInterval(refresh, 2000);
window.addEventListener("resize", () => {
  if (lastStatus?.streak) drawStreakChart(lastStatus.streak);
});
