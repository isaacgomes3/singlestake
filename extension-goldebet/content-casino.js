const BANNER_ID = "gog-ext-learning-banner";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.kind !== "casino-click") return;

  const label = String(message.label ?? message.target ?? "clique");
  const detail = String(message.reason ?? "");
  showLearningBanner(`🎯 ${label}`, detail);
  pulseClickableHints(message.target);

  sendResponse({ ok: true, frame: location.href, isTop: window === window.top });
  return true;
});

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
