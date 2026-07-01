/**
 * Lobby ice.bet — detecta «Jogar» e prontidão do iframe Pragmatic.
 * Injectado no frame principal da página do jogo.
 */
(function iceLobbyGate() {
  const op = typeof ICE_OPERATOR !== "undefined" ? ICE_OPERATOR : null;
  if (!op) return;

  function normText(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function playTextMatchers() {
    return op.playButtonTexts.map((t) =>
      normText(t.replace(/^▶\s*/, "")).toLowerCase(),
    );
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || st.pointerEvents === "none") {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 24 && r.height > 18;
  }

  function matchesPlayLabel(el) {
    const wants = playTextMatchers();
    const text = normText(
      el.textContent || el.value || el.getAttribute("aria-label") || el.getAttribute("title") || "",
    ).toLowerCase();
    if (!text) return false;
    return wants.some((w) => w.length > 0 && (text === w || text.includes(w)));
  }

  function findPlayButton() {
    const selectors = [
      "button",
      "a",
      '[role="button"]',
      'input[type="button"]',
      'input[type="submit"]',
      '[class*="play"]',
      '[class*="jogar"]',
    ];
    const seen = new Set();
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el) || !isVisible(el) || !matchesPlayLabel(el)) continue;
        seen.add(el);
        return el;
      }
    }
    return null;
  }

  function dispatchPlayClick(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const base = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    };
    el.dispatchEvent(new PointerEvent("pointerdown", { ...base, pointerId: 1, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mousedown", base));
    el.dispatchEvent(new PointerEvent("pointerup", { ...base, pointerId: 1, pointerType: "mouse" }));
    el.dispatchEvent(new MouseEvent("mouseup", base));
    el.dispatchEvent(new MouseEvent("click", base));
    if (typeof el.click === "function") el.click();
  }

  function hasPragmaticHost(href) {
    const h = String(href || "").toLowerCase();
    return op.pragmaticHostPatterns.some((pattern) => new RegExp(pattern, "i").test(h));
  }

  function hasPragmaticIframe() {
    for (const iframe of document.querySelectorAll("iframe")) {
      if (hasPragmaticHost(iframe.src || iframe.getAttribute("src"))) return true;
    }
    return hasPragmaticHost(location.href);
  }

  function hasGameCanvas() {
    for (const canvas of document.querySelectorAll("canvas")) {
      if (!isVisible(canvas)) continue;
      const r = canvas.getBoundingClientRect();
      if (r.width > 220 && r.height > 140) return true;
    }
    return false;
  }

  function isGameReady() {
    return hasPragmaticIframe() || hasGameCanvas();
  }

  function tryLobbyGate() {
    if (isGameReady()) {
      return { ok: true, ready: true, clicked: false, detail: "jogo já carregado" };
    }
    const btn = findPlayButton();
    if (btn) {
      dispatchPlayClick(btn);
      return { ok: true, ready: false, clicked: true, detail: "clicou em Jogar" };
    }
    return { ok: true, ready: false, clicked: false, detail: "botão Jogar não encontrado" };
  }

  globalThis.__iceTryLobbyGate = tryLobbyGate;
  globalThis.__iceIsGameReady = isGameReady;
})();
