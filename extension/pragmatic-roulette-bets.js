/**
 * Mapeamento educativo: factor → aposta exterior Pragmatic (DOM).
 * Heurísticas PT/EN; calibrar com popup «Testar Ímpar» se o operador mudar markup.
 */
(function () {
  const PROFILES = {
    odd: {
      textHints: ["ímpar", "impar", "odd"],
      dataHints: ["odd", "ODD", "impar", "IMPAR"],
      classHints: ["odd", "impar"],
    },
    even: {
      textHints: ["par", "even"],
      dataHints: ["even", "EVEN", "par", "PAR"],
      classHints: ["even", "par"],
    },
    red: {
      textHints: ["vermelho", "red"],
      dataHints: ["red", "RED", "vermelho"],
      classHints: ["red", "vermelho"],
    },
    black: {
      textHints: ["preto", "black"],
      dataHints: ["black", "BLACK", "preto"],
      classHints: ["black", "preto"],
    },
    low: {
      textHints: ["1-18", "1–18", "baixo", "low"],
      dataHints: ["low", "LOW", "1-18", "1_18"],
      classHints: ["low", "1-18", "1_18"],
    },
    high: {
      textHints: ["19-36", "19–36", "alto", "high"],
      dataHints: ["high", "HIGH", "19-36", "19_36"],
      classHints: ["high", "19-36", "19_36"],
    },
  };

  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.pointerEvents !== "none";
  }

  function scoreCandidate(el, profile) {
    if (!isVisible(el)) return 0;
    let score = 10;
    const cls = norm(el.className);
    const aria = norm(el.getAttribute("aria-label"));
    const title = norm(el.getAttribute("title"));
    const text = norm(el.textContent?.slice(0, 40));
    const dataBet =
      el.getAttribute("data-bet-spot") ||
      el.getAttribute("data-bet-code") ||
      el.getAttribute("data-spot") ||
      el.getAttribute("data-type") ||
      "";

    for (const h of profile.dataHints) {
      if (norm(dataBet).includes(norm(h))) score += 40;
    }
    for (const h of profile.classHints) {
      if (cls.includes(norm(h))) score += 25;
    }
    for (const h of profile.textHints) {
      const nh = norm(h);
      if (text === nh || aria === nh || title === nh) score += 35;
      else if (text.includes(nh) || aria.includes(nh)) score += 20;
    }
    if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") score += 8;
    const r = el.getBoundingClientRect();
    score += Math.min(20, Math.floor(r.width * r.height / 2000));
    return score;
  }

  function collectByDataAttrs(profile) {
    const out = [];
    for (const h of profile.dataHints) {
      const sel = [
        `[data-bet-spot*="${h}"]`,
        `[data-bet-code*="${h}"]`,
        `[data-spot*="${h}"]`,
        `[data-type*="${h}"]`,
      ];
      for (const s of sel) {
        try {
          document.querySelectorAll(s).forEach((el) => out.push(el));
        } catch {
          /* invalid selector in old engines */
        }
      }
    }
    return out;
  }

  function collectByText(profile) {
    const out = [];
    const nodes = document.querySelectorAll(
      'button, [role="button"], [class*="bet"], [class*="spot"], [class*="outside"], div, span',
    );
    nodes.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const text = norm(el.textContent?.slice(0, 24));
      const aria = norm(el.getAttribute("aria-label"));
      for (const h of profile.textHints) {
        const nh = norm(h);
        if (text === nh || aria === nh || text.startsWith(nh + " ") || aria.startsWith(nh)) {
          out.push(el);
          break;
        }
      }
    });
    return out;
  }

  function findBestBetElement(betKey) {
    const profile = PROFILES[betKey];
    if (!profile) return { ok: false, detail: `Chave desconhecida: ${betKey}` };

    const candidates = [...collectByDataAttrs(profile), ...collectByText(profile)];
    let best = null;
    let bestScore = 0;
    let bestVia = "";

    for (const el of candidates) {
      const sc = scoreCandidate(el, profile);
      if (sc > bestScore) {
        bestScore = sc;
        best = el;
        bestVia = el.getAttribute("data-bet-spot") || el.className?.toString().slice(0, 60) || el.tagName;
      }
    }

    if (!best || bestScore < 30) {
      return {
        ok: false,
        detail: `«${betKey}» não encontrado neste frame (score ${bestScore})`,
        betKey,
        frame: location.href,
        isTop: window === window.top,
      };
    }

    return {
      ok: true,
      betKey,
      score: bestScore,
      via: bestVia,
      tag: best.tagName,
      frame: location.href,
      isTop: window === window.top,
      element: best,
    };
  }

  function flash(el) {
    el.style.outline = "3px solid rgba(34,211,238,0.95)";
    el.style.outlineOffset = "2px";
    setTimeout(() => {
      el.style.outline = "";
      el.style.outlineOffset = "";
    }, 1200);
  }

  function showBanner(title, sub) {
    const id = "gog-ext-learning-banner";
    let root = document.getElementById(id);
    if (!root) {
      root = document.createElement("div");
      root.id = id;
      root.style.cssText =
        "position:fixed;bottom:10px;right:10px;z-index:2147483647;max-width:min(340px,92vw);padding:10px 12px;border-radius:10px;border:1px solid rgba(52,211,153,0.55);background:rgba(6,24,18,0.94);color:#d1fae5;font:600 12px/1.35 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,0.45);pointer-events:none";
      (document.body || document.documentElement).appendChild(root);
    }
    root.innerHTML = `<div style="font-weight:700">${title}</div><div style="margin-top:4px;font-size:10px;opacity:0.85">${sub}</div>`;
  }

  /**
   * @param {string} betKey odd|even|red|black|low|high
   * @param {string} label rótulo humano
   * @param {boolean} dryRun só destaca, não clica
   */
  window.__gogExecutePragmaticFactorClick = function (betKey, label, dryRun) {
    const found = findBestBetElement(betKey);
    if (!found.ok || !found.element) {
      showBanner(`⚠ ${label}`, found.detail || "Alvo não encontrado");
      return {
        ok: false,
        betKey,
        detail: found.detail,
        href: location.href,
        isTop: window === window.top,
        dryRun,
      };
    }

    const el = found.element;
    try {
      el.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
    } catch {
      el.scrollIntoView();
    }
    flash(el);

    if (!dryRun) {
      el.click();
    }

    const action = dryRun ? "Destacado (teste)" : "Clique enviado";
    showBanner(`🎯 ${label}`, `${action} · ${betKey} · score ${found.score}`);
    return {
      ok: true,
      betKey,
      detail: `${action} em «${betKey}» (${found.via}) score=${found.score}`,
      href: location.href,
      isTop: window === window.top,
      score: found.score,
      dryRun,
    };
  };

  /** Varredura para calibração — lista candidatos por chave no frame actual. */
  window.__gogScanPragmaticExteriorBets = function () {
    const report = {};
    for (const key of Object.keys(PROFILES)) {
      const found = findBestBetElement(key);
      report[key] = found.ok
        ? { ok: true, score: found.score, via: found.via, tag: found.tag }
        : { ok: false, detail: found.detail };
    }
    return { frame: location.href, isTop: window === window.top, report };
  };
})();
