/**
 * CORRER DEPOIS de IMPORTAR CONFIG no painel Playtech.
 * Lê localStorage/sessionStorage e descarrega JSON para npm run playtech:export
 *
 * F12 → Consola → colar este ficheiro inteiro
 */
(function captureAfterPrimeImport() {
  const NUMBER_RE = /^(?:0|[1-9]|[12][0-9]|3[0-6])$/;

  function parseNumbers(raw) {
    if (Array.isArray(raw)) {
      return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 36);
    }
    if (typeof raw === "string") {
      return raw.split(/[\s,;|/]+/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0 && n <= 36);
    }
    return [];
  }

  function tryJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function scoreData(data) {
    if (!data || typeof data !== "object") return 0;
    let s = 0;
    const h = data.historico ?? data.histories ?? data.history ?? data.sequencias;
    if (h && typeof h === "object" && !Array.isArray(h)) {
      s += Object.values(h).reduce((a, v) => a + parseNumbers(v).length, 0) + 20;
    }
    const mesas = data.mesas ?? data.roletas ?? data.tables;
    if (Array.isArray(mesas)) s += mesas.length * 5;
    if (data.source === "playtech" && Array.isArray(data.events)) s += data.events.length + 30;
    return s;
  }

  function extractPayload(data) {
    if (data?.source === "playtech") return data;
    const h = data?.historico ?? data?.histories ?? data?.history;
    if (h && typeof h === "object" && !Array.isArray(h)) {
      return { historico: h, roletas: Object.keys(h) };
    }
    const mesas = data?.mesas ?? data?.roletas ?? data?.tables;
    if (Array.isArray(mesas)) return { mesas };
    return data;
  }

  const hits = [];
  for (const store of [localStorage, sessionStorage]) {
    const name = store === localStorage ? "localStorage" : "sessionStorage";
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key) continue;
      const raw = store.getItem(key);
      if (!raw || raw.length < 8) continue;
      const parsed = tryJson(raw);
      if (parsed) hits.push({ name, key, data: parsed, score: scoreData(parsed) });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const best = hits[0];

  if (!best || best.score < 3) {
    console.warn(
      "[capture-after-import] Nada útil no storage.\n" +
        "1) IMPORTAR CONFIG → escolhe o .prime\n" +
        "2) Espera o painel carregar roletas/placar\n" +
        "3) Corre este script outra vez",
    );
    return;
  }

  const payload = extractPayload(best.data);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `playtech-after-import-${stamp}.json`;
  a.click();

  console.log("[capture-after-import] OK — origem:", best.name, best.key, "score:", best.score);
  console.log("Terminal:\n  npm run playtech:export -- Downloads\\playtech-after-import-....json");
  console.log("  npm run playtech:sim -- playtech-test\\exports\\feed-....json");
})();
