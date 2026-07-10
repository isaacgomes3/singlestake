/**
 * Calibração — overlay no frame do jogo (incl. iframe Pragmatic no ICE); 1 clique grava coordenadas.
 */
(function () {
  const betKey = window.__gogCalBetKey || "";
  const label = window.__gogCalLabel || betKey;
  const calTabId =
    typeof window.__gogCalTabId === "number" && Number.isFinite(window.__gogCalTabId)
      ? window.__gogCalTabId
      : null;
  if (!betKey) return;

  function isPragmaticGameHost() {
    return (
      /pragmaticplaylive\.net/i.test(location.hostname) ||
      /pragmaticplay\.net/i.test(location.hostname)
    );
  }

  function hasLargeCanvas() {
    const canvas = document.querySelector("canvas");
    if (!canvas) return false;
    const r = canvas.getBoundingClientRect();
    return r.width > 200 && r.height > 120;
  }

  function shouldActivateInThisFrame() {
    const findSurface = window.__gogFindGameSurface;
    if (typeof findSurface === "function") {
      const surface = findSurface();
      if (surface?.el) return true;
    }
    if (isPragmaticGameHost()) return true;
    if (hasLargeCanvas()) return true;
    if (window === window.top && /ice\.bet\.br/i.test(location.hostname)) {
      if (document.querySelector("iframe")) return false;
      return true;
    }
    return false;
  }

  if (!shouldActivateInThisFrame()) return;

  if (typeof window.__gogStopCalibration === "function") {
    try {
      window.__gogStopCalibration();
    } catch {
      /* ignore */
    }
  }

  const ROOT_ID = "gog-ext-cal-root";
  let saved = false;

  function cleanup() {
    document.getElementById(ROOT_ID)?.remove();
    document.getElementById("gog-ext-cal-banner")?.remove();
    document.getElementById("gog-ext-cal-cancel")?.remove();
    window.__gogCalibrationActive = false;
    window.__gogStopCalibration = null;
  }

  function showBanner(html, ok) {
    const b = document.getElementById("gog-ext-cal-banner");
    if (b) {
      b.innerHTML = html;
      b.style.borderColor = ok ? "rgba(34,197,94,0.85)" : "rgba(251,191,36,0.85)";
    }
  }

  function deliverCalibration(payload, onDone) {
    const msg = {
      kind: "calibration-click",
      tabId: calTabId,
      betKey: payload.betKey,
      label: payload.label,
      coord: payload.coord,
      frameHref: payload.frameHref,
      isTop: payload.isTop,
      clickClientX: payload.clickClientX,
      clickClientY: payload.clickClientY,
    };

    function finish(resp, errText) {
      if (typeof onDone === "function") onDone(resp, errText);
    }

    if (typeof chrome?.runtime?.sendMessage !== "function") {
      window.top?.postMessage({ gogExtCalib: 1, ...msg }, "*");
      const onAck = (ev) => {
        if (!ev.data || ev.data.gogExtCalibAck !== 1 || ev.data.betKey !== betKey) return;
        window.removeEventListener("message", onAck);
        finish(ev.data, null);
      };
      window.addEventListener("message", onAck);
      setTimeout(() => {
        window.removeEventListener("message", onAck);
        finish(null, "Sem ligação à extensão — recarregue a extensão ICE");
      }, 8000);
      return;
    }

    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          window.top?.postMessage({ gogExtCalib: 1, ...msg }, "*");
          const onAck = (ev) => {
            if (!ev.data || ev.data.gogExtCalibAck !== 1 || ev.data.betKey !== betKey) return;
            window.removeEventListener("message", onAck);
            finish(ev.data, null);
          };
          window.addEventListener("message", onAck);
          setTimeout(() => {
            window.removeEventListener("message", onAck);
            finish(
              null,
              chrome.runtime.lastError?.message || "Falha ao enviar clique para a extensão",
            );
          }, 8000);
          return;
        }
        finish(resp, null);
      });
    } catch (err) {
      finish(null, err instanceof Error ? err.message : String(err));
    }
  }

  function onCapture(e) {
    if (saved) return;
    saved = true;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const findSurface = window.__gogFindGameSurface;
    const surface = typeof findSurface === "function" ? findSurface() : null;

    let coord;
    if (surface?.el) {
      const rect = surface.el.getBoundingClientRect();
      if (rect.width > 80 && rect.height > 60) {
        coord = {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
          surface: surface.kind,
        };
      }
    }
    if (!coord) {
      coord = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
        surface: "viewport",
      };
    }

    showBanner(`⏳ A gravar <strong>${label}</strong>…`, true);

    deliverCalibration(
      {
        betKey,
        label,
        coord,
        frameHref: location.href,
        isTop: window === window.top,
        clickClientX: e.clientX,
        clickClientY: e.clientY,
      },
      (resp, errText) => {
        if (errText) {
          showBanner(`⚠ ${errText}`, false);
          saved = false;
          setTimeout(cleanup, 4000);
          return;
        }
        if (resp?.ok) {
          const pct = `${Math.round(coord.x * 100)}%, ${Math.round(coord.y * 100)}%`;
          showBanner(`✓ <strong>${label}</strong> gravado · ${pct}`, true);
          document.querySelectorAll("[data-gog-marker]").forEach((el) => el.remove());
          const dot = document.createElement("div");
          dot.setAttribute("data-gog-marker", "1");
          dot.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:22px;height:22px;border-radius:50%;transform:translate(-50%,-50%);background:rgba(34,197,94,0.95);box-shadow:0 0 0 4px rgba(34,197,94,0.4);z-index:2147483648;pointer-events:none`;
          (document.body || document.documentElement)?.appendChild(dot);
          setTimeout(() => dot.remove(), 2500);
        } else {
          showBanner(`⚠ ${resp?.detail || "Erro ao gravar"}`, false);
          saved = false;
        }
        setTimeout(cleanup, 2800);
      },
    );
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.cssText =
    "position:fixed;inset:0;z-index:2147483646;cursor:crosshair;background:rgba(37,99,235,0.14);touch-action:none";

  const banner = document.createElement("div");
  banner.id = "gog-ext-cal-banner";
  banner.style.cssText =
    "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:min(440px,94vw);padding:14px 18px;border-radius:12px;border:2px solid rgba(59,130,246,0.9);background:rgba(7,16,32,0.97);color:#dbeafe;font:700 14px/1.45 system-ui,sans-serif;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.55);pointer-events:none";
  banner.innerHTML =
    betKey === "repeat"
      ? `📍 Clique exactamente em <strong>${label}</strong><br><span style="font-size:11px;font-weight:500;opacity:0.88">2 Fatores · gales · ESC cancela</span>`
      : `📍 Clique exactamente em <strong>${label}</strong><br><span style="font-size:11px;font-weight:500;opacity:0.88">2 Fatores · ESC cancela</span>`;

  const cancel = document.createElement("button");
  cancel.id = "gog-ext-cal-cancel";
  cancel.type = "button";
  cancel.textContent = "Cancelar";
  cancel.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:2147483647;padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font:600 11px system-ui;cursor:pointer";
  cancel.addEventListener("click", (ev) => {
    ev.stopPropagation();
    cleanup();
  });

  root.addEventListener("pointerdown", onCapture, true);

  function onKey(ev) {
    if (ev.key === "Escape") cleanup();
  }
  document.addEventListener("keydown", onKey, true);

  const prevCleanup = cleanup;
  window.__gogStopCalibration = () => {
    document.removeEventListener("keydown", onKey, true);
    prevCleanup();
  };

  const mount = document.body || document.documentElement;
  if (!mount) return;

  mount.appendChild(root);
  mount.appendChild(banner);
  mount.appendChild(cancel);
  window.__gogCalibrationActive = true;
})();
