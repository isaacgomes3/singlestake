/**
 * Colar na consola do browser (F12) com o painel Playtech aberto.
 * Procura histórico em localStorage / variáveis globais e descarrega JSON.
 *
 * Depois no terminal:
 *   npm run playtech:export -- C:\Users\PC\Downloads\playtech-capture-....json
 */
(function playtechCaptureExport() {
  const NUMBER_RE = /^(?:0|[1-9]|[12][0-9]|3[0-6])$/;

  function parseNumbers(raw) {
    if (Array.isArray(raw)) {
      return raw
        .map((n) => (typeof n === "number" ? n : Number(String(n).trim())))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 36);
    }
    if (typeof raw === "string") {
      return raw
        .split(/[\s,;|/]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 36);
    }
    return [];
  }

  function labelFrom(obj) {
    if (!obj || typeof obj !== "object") return null;
    for (const k of ["label", "nome", "name", "title", "mesa", "tableName"]) {
      if (typeof obj[k] === "string" && obj[k].trim()) return obj[k].trim();
    }
    return null;
  }

  function tryParseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function collectFromStorage() {
    const hits = [];
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (!key) continue;
        const raw = store.getItem(key);
        if (!raw || raw.length < 4) continue;
        const parsed = tryParseJson(raw);
        if (parsed != null) hits.push({ source: store === localStorage ? "localStorage" : "sessionStorage", key, data: parsed });
      }
    }
    return hits;
  }

  function extractHistoricoMap(data) {
    const map = data.historico ?? data.histories ?? data.history ?? data.sequencias;
    if (!map || typeof map !== "object" || Array.isArray(map)) return null;
    const out = {};
    for (const [label, nums] of Object.entries(map)) {
      const numbers = parseNumbers(nums);
      if (numbers.length) out[label] = numbers;
    }
    return Object.keys(out).length ? out : null;
  }

  function extractMesasArray(data) {
    const arr = data.mesas ?? data.roletas ?? data.tables;
    if (!Array.isArray(arr)) return null;
    const mesas = [];
    for (const item of arr) {
      if (typeof item === "string") {
        mesas.push({ label: item, enabled: true, numbers: [] });
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const label = labelFrom(item);
      if (!label) continue;
      const numbers = parseNumbers(
        item.numeros ?? item.numbers ?? item.history ?? item.historico ?? item.sequencia,
      );
      const enabled =
        item.enabled !== false &&
        item.active !== false &&
        item.ativa !== false &&
        item.selected !== false;
      mesas.push({ label, enabled, numbers });
    }
    return mesas.length ? mesas : null;
  }

  function scoreCandidate(data) {
    let score = 0;
    const historico = extractHistoricoMap(data);
    if (historico) score += Object.values(historico).reduce((s, arr) => s + arr.length, 0) + 10;
    const mesas = extractMesasArray(data);
    if (mesas) score += mesas.reduce((s, m) => s + m.numbers.length, 0) + 5;
    if (data.source === "playtech" && Array.isArray(data.events)) score += data.events.length + 20;
    return score;
  }

  const storageHits = collectFromStorage();
  let best = null;
  let bestScore = 0;
  let bestMeta = null;

  for (const hit of storageHits) {
    const score = scoreCandidate(hit.data);
    if (score > bestScore) {
      bestScore = score;
      best = hit.data;
      bestMeta = hit;
    }
  }

  if (!best && typeof window.__PLAYTECH_EXPORT__ === "function") {
    best = window.__PLAYTECH_EXPORT__();
    bestMeta = { source: "window.__PLAYTECH_EXPORT__" };
  }

  let payload;
  if (best && best.source === "playtech" && Array.isArray(best.tables) && Array.isArray(best.events)) {
    payload = best;
  } else if (best) {
    const historico = extractHistoricoMap(best);
    const mesas = extractMesasArray(best);
    if (historico) {
      payload = { historico, roletas: Object.keys(historico) };
    } else if (mesas) {
      payload = { mesas };
    } else {
      payload = best;
    }
  } else {
    console.warn(
      "[playtech-capture] Nada encontrado em storage. Use EXPORTAR CONFIG no painel e npm run playtech:export.",
    );
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `playtech-capture-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log("[playtech-capture] Download iniciado.", bestMeta);
  console.log("[playtech-capture] Depois: npm run playtech:export -- caminho/para/ficheiro.json");
})();
