/**
 * Cliques em apostas exteriores — Playtech, Pragmatic (DOM + canvas) e operadores similares.
 */
(function () {
  const PROFILES = {
    odd: {
      textHints: ["ímpar", "impar", "impares", "odd"],
      dataHints: ["odd", "ODD", "impar", "IMPAR", "rl_odd", "rl-odd"],
      classHints: ["rl_odd", "rl-odd", "bet-odd", "outside-odd"],
    },
    even: {
      textHints: ["par", "pares", "even"],
      dataHints: ["even", "EVEN", "par", "PAR", "rl_even", "rl-even"],
      classHints: ["rl_even", "rl-even", "bet-even", "bet-par", "outside-even"],
    },
    red: {
      textHints: ["vermelho", "red"],
      dataHints: ["red", "RED", "vermelho", "rl_red"],
      classHints: ["rl_red", "bet-red", "outside-red"],
    },
    black: {
      textHints: ["preto", "black"],
      dataHints: ["black", "BLACK", "preto", "rl_black"],
      classHints: ["rl_black", "bet-black", "outside-black"],
    },
    low: {
      textHints: ["1-12", "1–12", "baixo", "low"],
      dataHints: ["low", "LOW", "1-12", "1_12", "rl_low"],
      classHints: ["rl_low", "bet-low", "outside-low", "1-12"],
    },
    high: {
      textHints: ["13-24", "13–24", "alto", "high"],
      dataHints: ["high", "HIGH", "13-24", "13_24", "rl_high"],
      classHints: ["rl_high", "bet-high", "outside-high", "13-24"],
    },
    "doz:1": {
      textHints: ["1ª dúzia", "1a duzia", "1st 12", "1-12", "1–12", "primeira duzia"],
      dataHints: ["dozen1", "DOZEN1", "1st12", "1st_12", "doz1"],
      classHints: ["dozen1", "doz-1", "1st12"],
    },
    "doz:2": {
      textHints: ["2ª dúzia", "2a duzia", "2nd 12", "13-24", "13–24", "segunda duzia"],
      dataHints: ["dozen2", "DOZEN2", "2nd12", "2nd_12", "doz2"],
      classHints: ["dozen2", "doz-2", "2nd12"],
    },
    "doz:3": {
      textHints: ["3ª dúzia", "3a duzia", "3rd 12", "25-36", "25–36", "terceira duzia"],
      dataHints: ["dozen3", "DOZEN3", "3rd12", "3rd_12", "doz3"],
      classHints: ["dozen3", "doz-3", "3rd12"],
    },
    "col:1": {
      textHints: ["coluna 1", "column 1", "col 1"],
      dataHints: ["column1", "COLUMN1", "col1", "col_1"],
      classHints: ["column1", "col-1"],
    },
    "col:2": {
      textHints: ["coluna 2", "column 2", "col 2"],
      dataHints: ["column2", "COLUMN2", "col2", "col_2"],
      classHints: ["column2", "col-2"],
    },
    "col:3": {
      textHints: ["coluna 3", "column 3", "col 3"],
      dataHints: ["column3", "COLUMN3", "col3", "col_3"],
      classHints: ["column3", "col-3"],
    },
  };

  /** Tapete Pragmatic — faixa exterior (PARES ≈ esquerda, ÍMPARES ≈ direita). */
  const PRAGMATIC_CANVAS_COORDS = {
    low: [{ x: 0.07, y: 0.92 }, { x: 0.1, y: 0.9 }],
    even: [{ x: 0.19, y: 0.92 }, { x: 0.22, y: 0.9 }, { x: 0.25, y: 0.93 }],
    red: [{ x: 0.36, y: 0.92 }, { x: 0.4, y: 0.9 }],
    black: [{ x: 0.48, y: 0.92 }, { x: 0.52, y: 0.9 }],
    odd: [{ x: 0.61, y: 0.92 }, { x: 0.65, y: 0.9 }, { x: 0.69, y: 0.93 }],
    high: [{ x: 0.84, y: 0.92 }, { x: 0.88, y: 0.9 }],
  };

  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.pointerEvents !== "none";
  }

  function* allRoots() {
    const seen = new Set();
    const stack = [document];
    while (stack.length) {
      const root = stack.pop();
      if (!root || seen.has(root)) continue;
      seen.add(root);
      yield root;
      try {
        root.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot && !seen.has(el.shadowRoot)) stack.push(el.shadowRoot);
        });
      } catch {
        /* ignore */
      }
    }
  }

  function walkAllElements(fn) {
    for (const root of allRoots()) {
      try {
        root.querySelectorAll("*").forEach(fn);
      } catch {
        /* ignore */
      }
    }
  }

  function elementLabel(el) {
    return norm(
      (el.getAttribute("aria-label") || "") +
        " " +
        (el.getAttribute("title") || "") +
        " " +
        (el.textContent?.slice(0, 24) || ""),
    );
  }

  /** Célula 0–36 do tapete interior — não é aposta exterior. */
  function isStraightUpNumberCell(el) {
    const raw = (el.textContent || "").trim();
    if (/^\d{1,2}$/.test(raw)) {
      const n = parseInt(raw, 10);
      if (n >= 0 && n <= 36) return true;
    }
    const label = elementLabel(el);
    if (/^(numero|number|n)\s*\d{1,2}$/.test(label)) return true;
    if (/^\d{1,2}$/.test(label) && label.length <= 2) return true;
    const cls = norm(el.className?.toString?.() ?? "");
    if (/(straight|straightup|inside|number.?cell|num-\d|bet-spot-\d)/.test(cls)) return true;
    const spot =
      el.getAttribute("data-bet-spot") ||
      el.getAttribute("data-bet-code") ||
      el.getAttribute("data-spot") ||
      "";
    if (/^\d{1,2}$/.test(String(spot).trim())) return true;
    return false;
  }

  function hasExactOutsideLabel(el, profile) {
    const text = norm(el.textContent?.trim().slice(0, 16));
    const aria = norm(el.getAttribute("aria-label") || "");
    for (const h of profile.textHints) {
      const nh = norm(h);
      if (text === nh || aria === nh) return true;
      if (nh === "par" && (text === "pares" || aria === "pares")) return true;
      if ((nh === "impar" || nh === "ímpar") && (text === "impares" || aria === "impares")) return true;
    }
    return false;
  }

  function isValidOutsideTarget(el, profile) {
    if (isStraightUpNumberCell(el)) return false;

    if (hasExactOutsideLabel(el, profile)) return true;

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    const inBettingBand = r.top > vh * 0.42;
    const isWide = r.width >= 28;
    const dataBet = norm(
      el.getAttribute("data-bet-spot") ||
        el.getAttribute("data-bet-code") ||
        el.getAttribute("data-spot") ||
        el.getAttribute("data-type") ||
        "",
    );

    const explicitOutside =
      /^(odd|even|red|black|low|high|impar|par|rl_)/.test(dataBet) ||
      profile.dataHints.some((h) => {
        const nh = norm(h);
        return nh.length > 3 && dataBet === nh;
      });

    return explicitOutside && isWide && inBettingBand;
  }

  function scoreCandidate(el, profile) {
    if (!isVisible(el)) return 0;
    if (isStraightUpNumberCell(el)) return 0;

    let score = 5;
    const cls = norm(el.className?.toString?.() ?? el.className);
    const aria = norm(el.getAttribute("aria-label"));
    const title = norm(el.getAttribute("title"));
    const text = norm(el.textContent?.slice(0, 40));
    const dataBet =
      el.getAttribute("data-bet-spot") ||
      el.getAttribute("data-bet-code") ||
      el.getAttribute("data-spot") ||
      el.getAttribute("data-type") ||
      "";

    if (hasExactOutsideLabel(el, profile)) score += 80;

    for (const h of profile.dataHints) {
      const nh = norm(h);
      if (nh.length <= 3) continue;
      if (norm(dataBet) === nh || norm(dataBet).includes(nh)) score += 40;
    }
    for (const h of profile.classHints) {
      if (cls.includes(norm(h))) score += 25;
    }
    for (const h of profile.textHints) {
      const nh = norm(h);
      if (text === nh || aria === nh || title === nh) score += 35;
      else if ((text === nh + "s" || aria === nh + "s") && nh.length >= 3) score += 30;
    }

    if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") score += 8;

    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    if (r.top > vh * 0.42) score += 15;
    if (r.width >= 40) score += 12;
    score += Math.min(15, Math.floor((r.width * r.height) / 3000));

    return score;
  }

  function collectByDataAttrs(profile) {
    const out = [];
    for (const h of profile.dataHints) {
      if (norm(h).length <= 3) continue;
      for (const s of [
        `[data-bet-spot="${h}"]`,
        `[data-bet-code="${h}"]`,
        `[data-spot="${h}"]`,
        `[data-type="${h}"]`,
        `[data-bet-spot*="${h}"]`,
        `[data-bet-code*="${h}"]`,
      ]) {
        try {
          walkAllElements((el) => {
            if (el.matches?.(s)) out.push(el);
          });
        } catch {
          /* ignore */
        }
      }
    }
    return out;
  }

  function collectByClassHints(profile) {
    const out = [];
    for (const h of profile.classHints) {
      const sel = `[class*="${h}"]`;
      try {
        walkAllElements((el) => {
          if (el.matches?.(sel)) out.push(el);
        });
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  function collectByText(profile) {
    const out = [];
    walkAllElements((el) => {
      if (!(el instanceof HTMLElement)) return;
      const text = norm(el.textContent?.trim().slice(0, 16));
      const aria = norm(el.getAttribute("aria-label") || "");
      if (text.length > 14 && el.children.length > 2) return;
      for (const h of profile.textHints) {
        const nh = norm(h);
        if (
          text === nh ||
          aria === nh ||
          text === nh + "s" ||
          aria === nh + "s" ||
          (nh === "par" && (text === "pares" || aria === "pares")) ||
          ((nh === "impar" || nh === "ímpar") && (text === "impares" || aria === "impares"))
        ) {
          out.push(el);
          break;
        }
      }
    });
    return out;
  }

  function collectBySvgText(profile) {
    const out = [];
    walkAllElements((el) => {
      if (el.tagName !== "text" && el.tagName !== "tspan") return;
      const text = norm(el.textContent?.slice(0, 16));
      for (const h of profile.textHints) {
        const nh = norm(h);
        if (text === nh || text === nh + "s" || text.includes(nh)) {
          const clickable =
            el.closest?.('[role="button"], button, [class*="bet"], [class*="spot"]') ||
            el.parentElement;
          if (clickable) out.push(clickable);
          break;
        }
      }
    });
    return out;
  }

  function uniqueElements(list) {
    return [...new Set(list.filter(Boolean))];
  }

  function isPragmaticContext() {
    const h = location.href.toLowerCase();
    return (
      h.includes("pragmaticplaylive.net") ||
      h.includes("client.pragmaticplaylive.net") ||
      h.includes("/play/pragmatic/")
    );
  }

  function findLargestCanvas() {
    let best = null;
    let bestArea = 0;
    walkAllElements((el) => {
      if (el.tagName !== "CANVAS" || !isVisible(el)) return;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) {
        bestArea = area;
        best = el;
      }
    });
    return best;
  }

  function findGameSurface() {
    const canvas = findLargestCanvas();
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      if (r.width > 200 && r.height > 120) return { el: canvas, kind: "canvas" };
    }
    let best = null;
    let bestArea = 0;
    for (const sel of ['[class*="roulette"]', '[class*="betting"]', '[class*="game-container"]']) {
      try {
        walkAllElements((el) => {
          if (!el.matches?.(sel) || !isVisible(el)) return;
          const r = el.getBoundingClientRect();
          const area = r.width * r.height;
          if (area > bestArea) {
            bestArea = area;
            best = el;
          }
        });
      } catch {
        /* ignore */
      }
    }
    if (best && bestArea > 40000) return { el: best, kind: "container" };
    return null;
  }

  function dispatchPointerClick(target, clientX, clientY, dryRun) {
    if (dryRun) return;

    const hit = document.elementFromPoint(clientX, clientY) || target;
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      detail: 1,
      button: 0,
      clientX,
      clientY,
      screenX: window.screenX + clientX,
      screenY: window.screenY + clientY,
      pageX: window.scrollX + clientX,
      pageY: window.scrollY + clientY,
    };
    const pointerOpts = {
      ...base,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      pressure: 0.5,
      width: 1,
      height: 1,
    };

    try {
      hit.focus?.({ preventScroll: true });
    } catch {
      /* ignore */
    }

    hit.dispatchEvent(new PointerEvent("pointerover", pointerOpts));
    hit.dispatchEvent(new PointerEvent("pointerenter", pointerOpts));
    hit.dispatchEvent(new PointerEvent("pointerdown", { ...pointerOpts, buttons: 1 }));
    hit.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
    hit.dispatchEvent(new PointerEvent("pointerup", { ...pointerOpts, buttons: 0 }));
    hit.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
    hit.dispatchEvent(new MouseEvent("click", base));
  }

  function resolveSavedClickPixels(saved) {
    if (!saved || saved.x == null || saved.y == null) return null;
    if (saved.surface === "viewport" && window !== window.top) return null;
    if (saved.surface !== "viewport" && saved.frameHint && !frameMatchesSaved(saved)) return null;

    let x;
    let y;
    let via;

    if (saved.surface === "viewport") {
      x = saved.x * window.innerWidth;
      y = saved.y * window.innerHeight;
      via = `viewport@${Math.round(saved.x * 100)}%,${Math.round(saved.y * 100)}%`;
    } else {
      const surface = findGameSurface();
      if (!surface) return null;
      const rect = surface.el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return null;
      x = rect.left + rect.width * saved.x;
      y = rect.top + rect.height * saved.y;
      via = `${saved.surface || surface.kind}@${Math.round(saved.x * 100)}%,${Math.round(saved.y * 100)}%`;
    }

    return {
      x,
      y,
      via,
      href: location.href,
      isTop: window === window.top,
      pragmatic: isPragmaticContext(),
    };
  }

  /** Converte coordenadas do frame do jogo para a viewport do separador (CDP). */
  function resolveSavedClickTabPixels(saved) {
    const local = resolveSavedClickPixels(saved);
    if (!local) return null;

    let tabX = local.x;
    let tabY = local.y;
    let win = window;
    while (win !== win.top) {
      const frame = win.frameElement;
      if (!frame) break;
      const r = frame.getBoundingClientRect();
      tabX += r.left;
      tabY += r.top;
      win = win.parent;
    }

    return {
      ...local,
      x: tabX,
      y: tabY,
      via: `${local.via} → tab`,
    };
  }

  function showClickMarkerAt(clientX, clientY, dryRun, kind) {
    showClickMarker(clientX, clientY, dryRun, kind);
  }

  function clearVisualArtifacts() {
    for (const id of ["gog-ext-click-marker", "gog-ext-mode-banner", "gog-ext-cal-root", "gog-ext-cal-banner"]) {
      document.getElementById(id)?.remove();
    }
    document.querySelectorAll("[data-gog-marker]").forEach((el) => el.remove());
  }

  function showClickMarker(x, y, dryRun, kind) {
    document.querySelectorAll("[data-gog-marker]").forEach((el) => el.remove());
    const m = document.createElement("div");
    m.setAttribute("data-gog-marker", "1");
    m.style.cssText =
      "position:fixed;z-index:2147483646;width:28px;height:28px;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%)";
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
    if (kind === "chip") {
      m.style.background = dryRun ? "rgba(245,158,11,0.95)" : "rgba(234,179,8,0.95)";
      m.style.boxShadow = dryRun
        ? "0 0 0 5px rgba(245,158,11,0.35)"
        : "0 0 0 5px rgba(234,179,8,0.35)";
    } else {
      m.style.background = dryRun ? "rgba(59,130,246,0.9)" : "rgba(34,197,94,0.9)";
      m.style.boxShadow = dryRun
        ? "0 0 0 5px rgba(59,130,246,0.35)"
        : "0 0 0 5px rgba(34,197,94,0.35)";
    }
    (document.body || document.documentElement).appendChild(m);
    setTimeout(() => m.remove(), 2800);
  }

  function frameMatchesSaved(saved) {
    if (saved.surface === "viewport") return window === window.top;
    if (!saved?.frameHint) return true;
    return location.href.toLowerCase().includes(String(saved.frameHint).toLowerCase());
  }

  function clickAtRelativeCoord(betKey, label, dryRun, saved, method, markerKind) {
    let clientX;
    let clientY;
    let via;
    let target;

    if (saved.surface === "viewport") {
      clientX = saved.x * window.innerWidth;
      clientY = saved.y * window.innerHeight;
      target = document.elementFromPoint(clientX, clientY) || document.body;
      via = `viewport@${Math.round(saved.x * 100)}%,${Math.round(saved.y * 100)}%`;
    } else {
      const surface = findGameSurface();
      if (!surface) return null;
      const rect = surface.el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return null;
      clientX = rect.left + rect.width * saved.x;
      clientY = rect.top + rect.height * saved.y;
      target = surface.el;
      via = `${saved.surface || surface.kind}@${Math.round(saved.x * 100)}%,${Math.round(saved.y * 100)}%`;
    }

    showClickMarker(clientX, clientY, dryRun, markerKind);
    dispatchPointerClick(target, clientX, clientY, dryRun);

    const action = dryRun ? "Marca demo (gravado)" : "Clique gravado (real)";
    return {
      ok: true,
      betKey,
      score: 95,
      method,
      via,
      detail: `${action} · ${label} · ${via}`,
      href: location.href,
      isTop: window === window.top,
      dryRun,
    };
  }

  function trySavedCoordinateClick(betKey, label, dryRun, savedCoord) {
    if (!savedCoord || savedCoord.x == null || savedCoord.y == null) return null;
    if (savedCoord.surface === "viewport" && window !== window.top) return null;
    if (!frameMatchesSaved(savedCoord)) return null;
    return clickAtRelativeCoord(betKey, label, dryRun, savedCoord, "saved", "bet");
  }

  function clickSavedChip(savedChip, dryRun) {
    clearVisualArtifacts();
    if (!savedChip || savedChip.x == null || savedChip.y == null) {
      return { ok: false, target: "chip", detail: "Ficha não calibrada" };
    }
    if (savedChip.surface === "viewport" && window !== window.top) {
      return { ok: false, skipped: true, target: "chip", detail: "Ficha noutro frame" };
    }
    const value = savedChip.value ?? 0.5;
    const result = clickAtRelativeCoord(
      "chip",
      `Ficha R$ ${value}`,
      dryRun,
      savedChip,
      "chip",
      "chip",
    );
    return { ...result, target: "chip", chipValue: value };
  }

  function tryCanvasCoordinateClick(betKey, label, dryRun) {
    const surface = findGameSurface();
    if (!surface) return null;

    const coords = PRAGMATIC_CANVAS_COORDS[betKey];
    if (!coords?.length) return null;

    const rect = surface.el.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 80) return null;

    const primary = coords[0];
    const clientX = rect.left + rect.width * primary.x;
    const clientY = rect.top + rect.height * primary.y;

    showClickMarker(clientX, clientY, dryRun);
    dispatchPointerClick(surface.el, clientX, clientY, dryRun);

    const action = dryRun ? "Marca demo no PARES/ÍMPARES (canvas)" : "Clique canvas (real)";
    return {
      ok: true,
      betKey,
      score: 55,
      method: "canvas",
      via: `${surface.kind}@${Math.round(primary.x * 100)}%,${Math.round(primary.y * 100)}%`,
      detail: `${action} · ${label}`,
      href: location.href,
      isTop: window === window.top,
      dryRun,
    };
  }

  function findBestBetElement(betKey) {
    const profile = PROFILES[betKey];
    if (!profile) return { ok: false, detail: `Chave desconhecida: ${betKey}` };

    const candidates = uniqueElements([
      ...collectByText(profile),
      ...collectBySvgText(profile),
      ...collectByDataAttrs(profile),
      ...collectByClassHints(profile),
    ]);

    let best = null;
    let bestScore = 0;
    let bestVia = "";

    for (const el of candidates) {
      if (!isValidOutsideTarget(el, profile)) continue;
      const sc = scoreCandidate(el, profile);
      if (sc > bestScore) {
        bestScore = sc;
        best = el;
        bestVia =
          el.getAttribute("data-bet-spot") ||
          el.textContent?.trim().slice(0, 12) ||
          el.className?.toString?.().slice(0, 40) ||
          el.tagName;
      }
    }

    if (!best || bestScore < 40) {
      return {
        ok: false,
        detail: `«${betKey}» exterior não encontrado (score ${bestScore})`,
        betKey,
        frame: location.href,
        isTop: window === window.top,
        pragmatic: isPragmaticContext(),
        hasCanvas: !!findLargestCanvas(),
      };
    }

    return {
      ok: true,
      betKey,
      score: bestScore,
      method: "dom",
      via: bestVia,
      tag: best.tagName,
      frame: location.href,
      isTop: window === window.top,
      element: best,
    };
  }

  function flash(el, dryRun) {
    const color = dryRun ? "rgba(59,130,246,0.95)" : "rgba(34,197,94,0.95)";
    el.style.outline = `4px solid ${color}`;
    el.style.outlineOffset = "3px";
    el.style.boxShadow = `0 0 0 6px ${dryRun ? "rgba(59,130,246,0.35)" : "rgba(34,197,94,0.35)"}`;
    setTimeout(() => {
      el.style.outline = "";
      el.style.outlineOffset = "";
      el.style.boxShadow = "";
    }, 2500);
  }

  function showBanner(title, sub, dryRun) {
    const id = "gog-ext-mode-banner";
    let root = document.getElementById(id);
    if (!root) {
      root = document.createElement("div");
      root.id = id;
      root.style.cssText =
        "position:fixed;bottom:10px;right:10px;z-index:2147483647;max-width:min(340px,92vw);padding:10px 12px;border-radius:10px;border:1px solid rgba(52,211,153,0.55);background:rgba(6,24,18,0.94);color:#d1fae5;font:600 12px/1.35 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,0.45);pointer-events:none";
      (document.body || document.documentElement).appendChild(root);
    }
    const modeTag = dryRun
      ? '<span style="color:#93c5fd">DEMO</span>'
      : '<span style="color:#86efac">REAL</span>';
    root.innerHTML = `<div style="font-weight:700">${title} ${modeTag}</div><div style="margin-top:4px;font-size:10px;opacity:0.85">${sub}</div>`;
  }

  function execute(betKey, label, dryRun, savedCoord) {
    clearVisualArtifacts();

    const hasSaved = savedCoord != null && savedCoord.x != null && savedCoord.y != null;

    if (hasSaved) {
      const savedResult = trySavedCoordinateClick(betKey, label, dryRun, savedCoord);
      if (savedResult?.ok) {
        showBanner(`🎯 ${label}`, savedResult.detail, dryRun);
        return savedResult;
      }
      return {
        ok: false,
        skipped: true,
        betKey,
        detail: "Coord. gravada só no separador principal",
        href: location.href,
        isTop: window === window.top,
        dryRun,
      };
    }

    const found = findBestBetElement(betKey);
    const preferCanvas =
      isPragmaticContext() &&
      (betKey === "even" || betKey === "odd") &&
      (!found.ok || found.score < 70);

    if (!preferCanvas && found.ok && found.element) {
      const el = found.element;
      try {
        el.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
      } catch {
        el.scrollIntoView();
      }
      flash(el, dryRun);
      if (!dryRun) el.click();

      const action = dryRun ? "Destacado (demo)" : "Clique enviado (real)";
      showBanner(`🎯 ${label}`, `${action} · DOM · ${found.via}`, dryRun);
      return {
        ok: true,
        betKey,
        method: "dom",
        detail: `${action} em «${betKey}» (${found.via}) score=${found.score}`,
        href: location.href,
        isTop: window === window.top,
        score: found.score,
        dryRun,
      };
    }

    const canvasResult = tryCanvasCoordinateClick(betKey, label, dryRun);
    if (canvasResult?.ok) {
      showBanner(`🎯 ${label}`, canvasResult.detail, dryRun);
      return canvasResult;
    }

    if (found.ok && found.element) {
      const el = found.element;
      flash(el, dryRun);
      if (!dryRun) el.click();
      showBanner(`🎯 ${label}`, `DOM fallback · ${found.via}`, dryRun);
      return {
        ok: true,
        betKey,
        method: "dom-fallback",
        detail: `Fallback DOM · ${found.via}`,
        href: location.href,
        score: found.score,
        dryRun,
      };
    }

    showBanner(`⚠ ${label}`, found.detail || "Alvo não encontrado", dryRun);
    return {
      ok: false,
      betKey,
      detail: found.detail,
      href: location.href,
      isTop: window === window.top,
      dryRun,
      hasCanvas: found.hasCanvas,
    };
  }

  window.__gogExecuteExteriorBet = execute;
  window.__gogExecutePragmaticFactorClick = execute;
  window.__gogFindGameSurface = findGameSurface;
  window.__gogClearVisualArtifacts = clearVisualArtifacts;
  window.__gogClickSavedChip = clickSavedChip;
  window.__gogResolveSavedClickPixels = resolveSavedClickPixels;
  window.__gogResolveSavedClickTabPixels = resolveSavedClickTabPixels;
  window.__gogShowClickMarkerAt = showClickMarkerAt;

  window.__gogScanExteriorBets = function () {
    const report = {};
    for (const key of Object.keys(PROFILES)) {
      const found = findBestBetElement(key);
      report[key] = found.ok
        ? { ok: true, score: found.score, via: found.via, method: found.method }
        : { ok: false, detail: found.detail, hasCanvas: found.hasCanvas };
    }
    const surface = findGameSurface();
    return {
      frame: location.href,
      isTop: window === window.top,
      pragmatic: isPragmaticContext(),
      gameSurface: surface ? { kind: surface.kind } : null,
      report,
    };
  };

  window.__gogScanPragmaticExteriorBets = window.__gogScanExteriorBets;
})();
