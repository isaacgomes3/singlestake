const BANNER_ID = "gog-ext-learning-banner";

/** Relay de calibração a partir de iframes Pragmatic (sendMessage falha sem tabId). */
window.addEventListener("message", (ev) => {
  if (!ev.data || ev.data.gogExtCalib !== 1 || ev.data.kind !== "calibration-click") return;
  const payload = { ...ev.data };
  delete payload.gogExtCalib;
  if (typeof chrome?.runtime?.sendMessage !== "function") return;
  chrome.runtime.sendMessage(payload, (resp) => {
    const ack = {
      gogExtCalibAck: 1,
      betKey: payload.betKey,
      ok: resp?.ok === true,
      detail: resp?.detail ?? chrome.runtime.lastError?.message ?? null,
    };
    try {
      ev.source?.postMessage(ack, "*");
    } catch {
      /* ignore */
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.kind === "show-calibration-overlay") {
    const ok = mountCalibrationOverlay({
      betKey: String(message.betKey || ""),
      label: String(message.label || message.betKey || ""),
      tabId: typeof message.tabId === "number" ? message.tabId : null,
      interactive: message.interactive !== false,
    });
    sendResponse({ ok, frame: location.href, host: location.hostname, interactive: message.interactive !== false });
    return true;
  }

  if (message.kind === "hide-calibration-overlay") {
    stopCalibrationOverlay();
    sendResponse({ ok: true });
    return true;
  }

  if (message.kind === "casino-click") {
    const label = String(message.label ?? message.target ?? "clique");
    const detail = String(message.reason ?? "");
    showLearningBanner(`🎯 ${label}`, detail);
    pulseClickableHints(message.target);
    sendResponse({ ok: true, frame: location.href, isTop: window === window.top });
    return true;
  }
});

const CAL_ROOT_ID = "gog-ext-cal-root";

function stopCalibrationOverlay() {
  const stop = window.__gogStopCalibration;
  window.__gogStopCalibration = null;
  document.getElementById(CAL_ROOT_ID)?.remove();
  document.getElementById("gog-ext-cal-banner")?.remove();
  document.getElementById("gog-ext-cal-cancel")?.remove();
  window.__gogCalibrationActive = false;
  window.__gogCalibrationInteractive = false;
  if (typeof stop === "function") {
    try {
      stop();
    } catch {
      /* ignore */
    }
  }
}

function mountCalibrationOverlay({ betKey, label, tabId, interactive }) {
  if (!betKey) return false;
  stopCalibrationOverlay();

  const mount = document.body || document.documentElement;
  if (!mount) return false;

  const hasIframe = Boolean(document.querySelector("iframe"));
  const isIceShell =
    window === window.top && /ice\.bet\.br/i.test(location.hostname) && hasIframe;
  // No shell ICE com iframe: tint visível sem bloquear cliques no jogo.
  const visualOnly = isIceShell && interactive !== true;
  const canCapture = !visualOnly;

  const root = document.createElement("div");
  root.id = CAL_ROOT_ID;
  root.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483646",
    `cursor:${canCapture ? "crosshair" : "default"}`,
    "background:rgba(37,99,235,0.55)",
    "touch-action:none",
    `pointer-events:${canCapture ? "auto" : "none"}`,
  ].join(";");

  const banner = document.createElement("div");
  banner.id = "gog-ext-cal-banner";
  banner.style.cssText =
    "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:min(440px,94vw);padding:14px 18px;border-radius:12px;border:2px solid rgba(96,165,250,0.95);background:rgba(7,16,32,0.98);color:#dbeafe;font:700 14px/1.45 system-ui,sans-serif;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.55);pointer-events:none";
  banner.innerHTML = visualOnly
    ? `Tela azul activa — clique em <strong>${label}</strong> no tapete do jogo`
    : `Clique exactamente em <strong>${label}</strong><br><span style="font-size:11px;font-weight:500;opacity:0.88">ICE 2F · ESC cancela</span>`;

  const cancel = document.createElement("button");
  cancel.id = "gog-ext-cal-cancel";
  cancel.type = "button";
  cancel.textContent = "Cancelar";
  cancel.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:2147483647;padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font:600 11px system-ui;cursor:pointer;pointer-events:auto";
  cancel.addEventListener("click", (ev) => {
    ev.stopPropagation();
    stopCalibrationOverlay();
  });

  let saved = false;
  function onCapture(e) {
    if (saved || !canCapture) return;
    saved = true;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const coord = {
      x: e.clientX / Math.max(1, window.innerWidth),
      y: e.clientY / Math.max(1, window.innerHeight),
      surface: "viewport",
    };
    banner.innerHTML = `A gravar <strong>${label}</strong>…`;

    const msg = {
      kind: "calibration-click",
      tabId,
      betKey,
      label,
      coord,
      frameHref: location.href,
      isTop: window === window.top,
      clickClientX: e.clientX,
      clickClientY: e.clientY,
    };

    const finish = (resp, errText) => {
      if (errText || !resp?.ok) {
        banner.innerHTML = errText || resp?.detail || "Erro ao gravar";
        banner.style.borderColor = "rgba(251,191,36,0.85)";
        saved = false;
        setTimeout(stopCalibrationOverlay, 3500);
        return;
      }
      banner.innerHTML = `<strong>${label}</strong> gravado · ${Math.round(coord.x * 100)}%, ${Math.round(coord.y * 100)}%`;
      banner.style.borderColor = "rgba(34,197,94,0.85)";
      setTimeout(stopCalibrationOverlay, 2500);
    };

    if (typeof chrome?.runtime?.sendMessage === "function") {
      try {
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) {
            window.top?.postMessage({ gogExtCalib: 1, ...msg }, "*");
            finish(null, chrome.runtime.lastError.message);
            return;
          }
          finish(resp, null);
        });
        return;
      } catch (err) {
        finish(null, err instanceof Error ? err.message : String(err));
        return;
      }
    }
    window.top?.postMessage({ gogExtCalib: 1, ...msg }, "*");
    finish(null, "Sem runtime — use o relay");
  }

  if (canCapture) root.addEventListener("pointerdown", onCapture, true);

  function onKey(ev) {
    if (ev.key === "Escape") stopCalibrationOverlay();
  }
  document.addEventListener("keydown", onKey, true);
  window.__gogStopCalibration = () => {
    document.removeEventListener("keydown", onKey, true);
  };

  mount.appendChild(root);
  mount.appendChild(banner);
  mount.appendChild(cancel);
  window.__gogCalibrationActive = true;
  window.__gogCalibrationInteractive = canCapture;
  return true;
}

// Exposto para injecção via scripting.executeScript (mesmo mundo isolado).
window.__gogMountCalibrationOverlay = mountCalibrationOverlay;
window.__gogStopCalibrationOverlay = stopCalibrationOverlay;

/**
 * Overlay fixo — visível em qualquer frame (incl. iframe Pragmatic).
 * @param {string} title
 * @param {string} subtitle
 */
function showLearningBanner(title, subtitle) {
  let root = document.getElementById(BANNER_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = BANNER_ID;
    root.style.cssText = [
      "position:fixed",
      "bottom:10px",
      "right:10px",
      "z-index:2147483647",
      "max-width:min(320px,90vw)",
      "padding:10px 12px",
      "border-radius:10px",
      "border:1px solid rgba(52,211,153,0.55)",
      "background:rgba(6,24,18,0.94)",
      "color:#d1fae5",
      "font:600 12px/1.35 system-ui,sans-serif",
      "box-shadow:0 8px 28px rgba(0,0,0,0.45)",
      "pointer-events:none",
    ].join(";");
    (document.body || document.documentElement).appendChild(root);
  }

  root.innerHTML = "";
  const t = document.createElement("div");
  t.textContent = title;
  t.style.fontWeight = "700";
  const s = document.createElement("div");
  s.textContent = subtitle;
  s.style.cssText = "margin-top:4px;font-size:10px;font-weight:500;opacity:0.8";
  const f = document.createElement("div");
  f.textContent = window === window.top ? "frame: topo" : `frame: ${location.hostname}`;
  f.style.cssText = "margin-top:6px;font-size:9px;opacity:0.55";
  root.append(t, s, f);

  root.style.animation = "none";
  void root.offsetWidth;
  root.style.animation = "gogExtPulse 0.65s ease-out";
}

/**
 * Destaque educativo em botões prováveis (heurística — operador varia).
 * @param {string} target
 */
function pulseClickableHints(target) {
  if (target !== "factor-1" && target !== "factor-2") return;

  const candidates = document.querySelectorAll(
    'button, [role="button"], [class*="bet"], [class*="chip"], [data-testid*="bet"]',
  );
  const slice = Array.from(candidates).slice(0, 3);
  slice.forEach((el, i) => {
    if (!(el instanceof HTMLElement)) return;
    el.style.outline = "2px solid rgba(34,211,238,0.85)";
    el.style.outlineOffset = "2px";
    window.setTimeout(() => {
      el.style.outline = "";
      el.style.outlineOffset = "";
    }, 800 + i * 120);
  });
}

if (!document.getElementById("gog-ext-learning-style")) {
  const style = document.createElement("style");
  style.id = "gog-ext-learning-style";
  style.textContent = `
    @keyframes gogExtPulse {
      0% { transform: scale(0.96); opacity: 0.5; }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}
