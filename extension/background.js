const BRIDGE_TYPE = "game-odds-glow/rotating-room-extension";
const CLICK_STAGGER_MS = 450;

/** @type {{ fingerprint: string; at: string; actions: unknown[] } | null} */
let lastBridge = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.kind === "bridge-from-app") {
    const payload = message.payload;
    if (!payload || payload.type !== BRIDGE_TYPE) return;

    lastBridge = {
      fingerprint: payload.fingerprint,
      at: new Date().toISOString(),
      actions: payload.actions,
    };
    chrome.storage.local.set({ gogLastBridge: lastBridge, gogLastContext: payload.context });

    void runBridgePlan(payload, sender.tab?.id ?? null).then((results) => {
      sendResponse({ ok: true, results });
    });
    return true;
  }

  if (message.kind === "test-bet") {
    void testPragmaticBet(message.tabId, message.betKey, message.label, message.dryRun !== false).then(
      sendResponse,
    );
    return true;
  }

  if (message.kind === "scan-bets") {
    void scanPragmaticBets(message.tabId).then(sendResponse);
    return true;
  }

  if (message.kind === "ping") {
    sendResponse({ ok: true, lastBridge });
    return;
  }
});

async function runBridgePlan(payload, sourceTabId) {
  const clicks = (payload.actions || []).filter((a) => a.kind === "click");
  const results = [];

  for (let i = 0; i < clicks.length; i++) {
    if (i > 0) await sleep(CLICK_STAGGER_MS);
    const action = clicks[i];
    const result = await dispatchClickAction(action, payload.context, sourceTabId);
    results.push(result);
  }

  if (clicks.length === 0 && payload.actions?.length) {
    results.push({
      target: "wait",
      ok: true,
      detail: payload.actions.map((a) => (a.kind === "wait" ? a.reason : "")).join("; "),
    });
  }

  await chrome.storage.local.set({ gogLastResults: results });
  return results;
}

async function dispatchClickAction(action, context, sourceTabId) {
  if (action.target === "prepare-open") {
    const url = typeof context.mesaEmbedUrl === "string" ? context.mesaEmbedUrl : null;
    if (!url) {
      return { target: action.target, ok: false, detail: "Sem URL da mesa configurada na app" };
    }
    const tab = await chrome.tabs.create({ url, active: true });
    return { target: action.target, ok: true, detail: `Aba aberta: ${url}`, tabId: tab.id };
  }

  const targetTabId = await resolveMesaTabId(context, sourceTabId);
  if (targetTabId == null) {
    return { target: action.target, ok: false, detail: "Nenhum separador da mesa encontrado" };
  }

  const betKey =
    action.target === "factor-1"
      ? context.factor1BetKey
      : action.target === "factor-2"
        ? context.factor2BetKey
        : null;
  const label =
    action.target === "factor-1"
      ? context.factor1Label
      : action.target === "factor-2"
        ? context.factor2Label
        : action.label;

  if (!betKey) {
    return {
      target: action.target,
      ok: false,
      detail: "Sem chave Pragmatic (factor betKey) no contexto da app",
    };
  }

  const prefs = await chrome.storage.local.get(["gogPragmaticDryRun"]);
  const dryRun = prefs.gogPragmaticDryRun === true;

  const clickResult = await executePragmaticBetOnTab(
    targetTabId,
    String(betKey),
    String(label ?? betKey),
    dryRun,
  );

  return {
    target: action.target,
    betKey,
    ...clickResult,
  };
}

async function resolveMesaTabId(context, sourceTabId) {
  const mesaUrl = typeof context.mesaEmbedUrl === "string" ? context.mesaEmbedUrl : null;
  if (mesaUrl) {
    const mesaOrigin = safeOrigin(mesaUrl);
    const tabs = await chrome.tabs.query({});
    const dedicated = tabs.find((t) => t.url && mesaOrigin && safeOrigin(t.url) === mesaOrigin);
    if (dedicated?.id != null) return dedicated.id;
  }
  return sourceTabId;
}

async function executePragmaticBetOnTab(tabId, betKey, label, dryRun) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["pragmatic-roulette-bets.js"],
    });

    const frameResults = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (key, lbl, dry) => window.__gogExecutePragmaticFactorClick?.(key, lbl, dry),
      args: [betKey, label, dryRun],
    });

    const ranked = frameResults
      .map((r) => r.result)
      .filter((r) => r && r.ok)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    if (ranked.length === 0) {
      const tried = frameResults.map((r) => r.result).filter(Boolean);
      return {
        ok: false,
        detail: `«${betKey}» não encontrado em nenhum frame (${tried.length} frames analisados)`,
        frameResults: tried.slice(0, 5),
      };
    }

    const best = ranked[0];
    return {
      ok: true,
      detail: best.detail,
      score: best.score,
      frame: best.href,
      dryRun: best.dryRun,
      framesMatched: ranked.length,
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function testPragmaticBet(tabId, betKey, label, dryRun) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const id = tabId ?? tabs[0]?.id;
  if (id == null) return { ok: false, detail: "Nenhum separador activo" };
  const result = await executePragmaticBetOnTab(id, betKey, label ?? betKey, dryRun);
  await chrome.storage.local.set({ gogLastTest: { at: new Date().toISOString(), betKey, ...result } });
  return result;
}

async function scanPragmaticBets(tabId) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const id = tabId ?? tabs[0]?.id;
  if (id == null) return { ok: false, detail: "Nenhum separador activo" };

  await chrome.scripting.executeScript({
    target: { tabId: id, allFrames: true },
    files: ["pragmatic-roulette-bets.js"],
  });

  const frameResults = await chrome.scripting.executeScript({
    target: { tabId: id, allFrames: true },
    func: () => window.__gogScanPragmaticExteriorBets?.(),
  });

  const scans = frameResults.map((r) => r.result).filter(Boolean);
  await chrome.storage.local.set({ gogLastScan: { at: new Date().toISOString(), scans } });
  return { ok: true, scans };
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
