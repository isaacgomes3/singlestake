/**
 * Calibração — overlay em ecrã completo no frame principal; 1 clique grava coordenadas.
 */
(function () {
  const root = document.documentElement;
  const betKey =
    root?.dataset?.gogCalBetKey || window.__gogCalBetKey || "";
  const label =
    root?.dataset?.gogCalLabel || window.__gogCalLabel || betKey;
  if (!betKey) return;

  const findSurface =
    typeof window.__gogFindGameSurface === "function"
      ? window.__gogFindGameSurface
      : null;
  const surface = findSurface ? findSurface() : null;
  const isTop = window === window.top;
  if (!isTop && !surface?.el) return;

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

    try {
      chrome.runtime.sendMessage(
        {
          kind: "calibration-click",
          betKey,
          label,
          coord,
          frameHref: location.href,
          isTop: window === window.top,
        },
        (resp) => {
          if (chrome.runtime.lastError) {
            showBanner(`⚠ ${chrome.runtime.lastError.message}`, false);
            saved = false;
            setTimeout(cleanup, 3000);
            return;
          }
          if (resp?.ok) {
            const pct = `${Math.round(coord.x * 100)}%, ${Math.round(coord.y * 100)}%`;
            showBanner(`✓ <strong>${label}</strong> gravado · ${pct}`, true);
            document.querySelectorAll("[data-gog-marker]").forEach((el) => el.remove());
            const dot = document.createElement("div");
            dot.setAttribute("data-gog-marker", "1");
            dot.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:22px;height:22px;border-radius:50%;transform:translate(-50%,-50%);background:rgba(34,197,94,0.95);box-shadow:0 0 0 4px rgba(34,197,94,0.4);z-index:2147483648;pointer-events:none`;
            document.body.appendChild(dot);
            setTimeout(() => dot.remove(), 2500);
          } else {
            showBanner(`⚠ ${resp?.detail || "Erro ao gravar"}`, false);
            saved = false;
          }
          setTimeout(cleanup, 2800);
        },
      );
    } catch (err) {
      showBanner(`⚠ ${err instanceof Error ? err.message : String(err)}`, false);
      saved = false;
      setTimeout(cleanup, 3000);
    }
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
    betKey === "chip"
      ? `📍 Clique exactamente na ficha <strong>${label}</strong><br><span style="font-size:11px;font-weight:500;opacity:0.88">Ficha base · ESC cancela</span>`
      : betKey.startsWith("doz:") || betKey.startsWith("col:")
        ? `📍 Clique exactamente em <strong>${label}</strong><br><span style="font-size:11px;font-weight:500;opacity:0.88">Dúzia/Coluna · Fibonacci · ESC cancela</span>`
        : `📍 Clique exactamente em <strong>${label}</strong><br><span style="font-size:11px;font-weight:500;opacity:0.88">PARES ou ÍMPARES · ESC cancela</span>`;

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancelar";
  cancel.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:2147483647;padding:8px 12px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;font:600 11px system-ui;cursor:pointer";
  cancel.addEventListener("click", (ev) => {
    ev.stopPropagation();
    cleanup();
  });

  root.addEventListener("pointerdown", onCapture, true);
  root.addEventListener("click", onCapture, true);

  function onKey(ev) {
    if (ev.key === "Escape") cleanup();
  }
  document.addEventListener("keydown", onKey, true);

  const prevCleanup = cleanup;
  window.__gogStopCalibration = () => {
    document.removeEventListener("keydown", onKey, true);
    prevCleanup();
  };

  document.body.appendChild(root);
  document.body.appendChild(banner);
  document.body.appendChild(cancel);
  window.__gogCalibrationActive = true;
})();
