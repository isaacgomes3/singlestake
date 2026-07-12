import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ice2fDir = path.join(root, "extension-ice-cruzamento-2f");
const ktoDir = path.join(root, "extension-kto");
const outDir = path.join(root, "extension-kto-cruzamento-2f");

function readIce2f(name) {
  return fs.readFileSync(path.join(ice2fDir, name), "utf8");
}

function readKto(name) {
  return fs.readFileSync(path.join(ktoDir, name), "utf8");
}

function writeOut(name, content) {
  fs.writeFileSync(path.join(outDir, name), content);
}

fs.mkdirSync(outDir, { recursive: true });

let runner = readIce2f("ice2f-signal-runner.js");
runner = runner
  .replaceAll("/** Autopilot ICE — Cruzamento 2F (201)", "/** Autopilot KTO — Cruzamento 2F (230)")
  .replaceAll("SinglestakeIce2f", "SinglestakeKto2f")
  .replaceAll("createIce2fEngine", "createKto2fEngine")
  .replaceAll("STORAGE_ICE2F_", "STORAGE_KTO2F_")
  .replaceAll("gogIce2f", "gogKto2f")
  .replaceAll("ICE2F_DEFAULTS", "KTO2F_DEFAULTS")
  .replaceAll("readIce2f", "readKto2f")
  .replaceAll("persistIce2f", "persistKto2f")
  .replaceAll("clearIce2f", "clearKto2f")
  .replaceAll("writeIce2f", "writeKto2f")
  .replaceAll("getIce2f", "getKto2f")
  .replaceAll("setIce2f", "setKto2f")
  .replaceAll("resetIce2f", "resetKto2f")
  .replaceAll("startIce2f", "startKto2f")
  .replaceAll("stopIce2f", "stopKto2f")
  .replaceAll("initIce2f", "initKto2f")
  .replaceAll("SinglestakeIce2fSignalRunner", "SinglestakeKto2fSignalRunner")
  .replaceAll("__singlestakeIce2fBridgeHandler", "__singlestakeKto2fBridgeHandler")
  .replaceAll("ice2f-engine.js", "kto2f-engine.js")
  .replaceAll("npm run extension:ice2f:build", "npm run extension:kto2f:build")
  .replaceAll("autopilot ICE 2F", "autopilot KTO 2F")
  .replaceAll("`ice2f:", "`kto2f:")
  .replaceAll("ICE2F_TABLE_ID", "KTO2F_TABLE_ID")
  .replaceAll("ICE2F_MESA_URL", "KTO2F_MESA_URL")
  .replaceAll(
    "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal",
    "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/",
  );

runner = runner.replace(
  /const legacyWrong =[\s\S]*?roleta-ao-vivo\)\);/,
  `const legacyWrong =
    stored.tableId === 201 ||
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" && stored.mesaUrl.includes("ice.bet"));`,
);

runner = runner.replace(
  /tableId:\s*SinglestakeKto2f\?\.KTO2F_TABLE_ID \?\? 201/,
  "tableId: SinglestakeKto2f?.KTO2F_TABLE_ID ?? 230",
);

runner = runner.replaceAll("2 factores em comum", "3 falhas cruzamento");
runner = runner.replaceAll("4 falhas cruzamento", "3 falhas cruzamento");
runner = runner.replaceAll("5 falhas cruzamento", "3 falhas cruzamento");

runner = runner.replace(
  /function formatWatchCounters[\s\S]*?\n\}/,
  `function formatWatchCounters(watch) {
  if (!watch || typeof watch !== "object") return null;
  if (typeof SinglestakeKto2f?.formatIce2fWatchLabel === "function") {
    return SinglestakeKto2f.formatIce2fWatchLabel(watch);
  }
  return null;
}`,
);

writeOut("kto2f-signal-runner.js", runner);

let bg = readKto("background.js");
bg = bg
  .replaceAll("kto-cruzamento-engine.js", "kto2f-engine.js")
  .replaceAll("kto-signal-runner.js", "kto2f-signal-runner.js")
  .replaceAll("SinglestakeKtoSignalRunner", "SinglestakeKto2fSignalRunner")
  .replaceAll("gogKtoAutopilotEnabled", "gogKto2fAutopilotEnabled")
  .replaceAll("set-kto-autopilot", "set-kto2f-autopilot")
  .replaceAll("get-kto-autopilot", "get-kto2f-autopilot")
  .replaceAll("reset-kto-stats", "reset-kto2f-stats")
  .replaceAll("get-kto-config", "get-kto2f-config")
  .replaceAll("set-kto-config", "set-kto2f-config")
  .replaceAll("KTO_DEFAULT_TABLE_ID", "KTO2F_DEFAULT_TABLE_ID")
  .replaceAll("ensureKtoPanel", "ensureKto2fPanel")
  .replaceAll("isKtoRoulettePageUrl", "isKto2fRoulettePageUrl")
  .replaceAll("kto-panel-ping", "kto2f-panel-ping")
  .replaceAll("content-kto-panel.js", "content-kto2f-panel.js")
  .replaceAll("isKtoSignal", "isKto2fSignal")
  .replaceAll("ktoAutopilot", "kto2fAutopilot")
  .replaceAll("ktoConfig", "kto2fConfig")
  .replaceAll("setKtoAutopilotEnabled", "setKto2fAutopilotEnabled")
  .replaceAll("getKtoAutopilotStatus", "getKto2fAutopilotStatus")
  .replaceAll("resetKtoStats", "resetKto2fStats")
  .replaceAll("getKtoConfigForPopup", "getKto2fConfigForPopup")
  .replaceAll("setKtoConfigFromPopup", "setKto2fConfigFromPopup")
  .replaceAll("initKtoSignalRunner", "initKto2fSignalRunner");

const panelBlock = `/** Janela fixa do painel KTO 2F (não fecha ao clicar na mesa). */
let kto2fPanelWindowId = null;

async function openOrFocusKto2fPanel() {
  if (kto2fPanelWindowId != null) {
    try {
      const existing = await chrome.windows.get(kto2fPanelWindowId);
      if (existing?.id != null) {
        await chrome.windows.update(existing.id, { focused: true });
        return;
      }
    } catch {
      kto2fPanelWindowId = null;
    }
  }
  const url = chrome.runtime.getURL("popup.html");
  const win = await chrome.windows.create({
    url,
    type: "popup",
    width: 400,
    height: 720,
    focused: true,
  });
  kto2fPanelWindowId = win?.id ?? null;
}

chrome.action.onClicked.addListener(() => {
  void openOrFocusKto2fPanel();
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === kto2fPanelWindowId) kto2fPanelWindowId = null;
});

`;

if (!bg.includes("openOrFocusKto2fPanel")) {
  bg = bg.replace(/chrome\.runtime\.onInstalled\.addListener/, `${panelBlock}chrome.runtime.onInstalled.addListener`);
}

bg = bg.replace(
  /function isDois2FatoresBridgeContext\(context\) \{[\s\S]*?\n\}/,
  `function isDois2FatoresBridgeContext(context) {
  return (
    (context?.strategy === "dois2fatores" || context?.strategy === "kto2fcruzamento") &&
    context?.singleFactorMode !== true
  );
}`,
);

bg = bg.replace(
  /function isKtoCrossingContext\(context\) \{[\s\S]*?\n\}/,
  `function isKto2fCrossingContext(context) {
  return context?.strategy === "kto2fcruzamento";
}`,
);

bg = bg.replaceAll("isKtoCrossingContext", "isKto2fCrossingContext");

bg = bg.replace(
  /const isKto2fSignal =[\s\S]*?context\.signalId\.startsWith\("kto:"\);/,
  `const isKto2fSignal =
    isKto2fCrossingContext(context) &&
    typeof context?.signalId === "string" &&
    context.signalId.startsWith("kto2f:");`,
);

if (!bg.includes("ice2fPadFactorPlacementMs") && !bg.includes("kto2fPadFactorPlacementMs")) {
  bg = bg.replace(
    /(const recoveryNote = isZoneFibonacciFamily)/,
    `if (isKto2fCrossingContext(context ?? {})) {
      const padMs =
        typeof SinglestakeKto2f?.ice2fPadFactorPlacementMs === "function"
          ? SinglestakeKto2f.ice2fPadFactorPlacementMs(units)
          : Math.max(0, (8 - units) * (GOG.CROSSING_FACTOR_CLICK_STAGGER_MS ?? 150));
      if (padMs > 0) await sleep(padMs);
    }

    $1`,
  );
}

writeOut("background.js", bg);

let shared = readIce2f("shared.js");
shared = shared
  .replaceAll("isIce2fCrossingContext", "isKto2fCrossingContext")
  .replaceAll("ICE2F_GALE3_REFERENCE_UNITS", "KTO2F_GALE3_REFERENCE_UNITS")
  .replaceAll("ice2fUnitClickStaggerMs", "kto2fUnitClickStaggerMs")
  .replaceAll('context?.strategy === "ice2fcruzamento"', 'context?.strategy === "kto2fcruzamento"');
shared = shared.replace(
  /function isKto2fCrossingContext\(context\) \{[\s\S]*?\}/,
  `function isKto2fCrossingContext(context) {
  return context?.strategy === "kto2fcruzamento";
}`,
);
writeOut("shared.js", shared);

for (const f of ["popup.js", "popup.html"]) {
  let c = readIce2f(f);
  c = c
    .replaceAll("ice.bet.br", "kto.bet.br")
    .replaceAll("ICE 2F", "KTO 2F")
    .replaceAll("ice2f", "kto2f")
    .replaceAll("201", "230")
    .replaceAll("liveroulettea-pragmaticexternal", "roulette-3-ppl")
    .replaceAll("Roulette 2 Extra Time", "Roulette 3")
    .replaceAll("stake37 ICE 2F", "stake37 KTO 2F")
    .replaceAll("1·2·4·8·16·32·64", "2·4·8·16·32·64");
  writeOut(f, c);
}

let panel = readIce2f("content-ice2f-panel.js");
panel = panel
  .replaceAll("ice.bet.br", "kto.bet.br")
  .replaceAll("ICE 2F", "KTO 2F")
  .replaceAll("ice2f", "kto2f")
  .replaceAll("201", "230")
  .replaceAll("liveroulettea-pragmaticexternal", "roulette-3-ppl")
  .replaceAll("Roulette 2 Extra Time", "Roulette 3")
  .replaceAll("ss-ice2f", "ss-kto2f")
  .replaceAll("Cruzamento 2F", "Cruzamento 2F · KTO")
  .replaceAll("1·2·4·8·16·32·64", "2·4·8·16·32·64");
panel = panel.replace(
  /function pageIsIce2fRoulette\(\) \{[\s\S]*?\n  \}/,
  `function pageIsKto2fRoulette() {
    const path = \`\${location.pathname}\${location.hash}\${location.search}\`;
    return (
      /kto\\.bet\\.br/i.test(location.hostname) &&
      /\\/app\\/cassino\\/game\\/(roulette-3-ppl|roleta-ao-vivo)/i.test(path)
    );
  }`,
);
panel = panel.replaceAll("pageIsIce2fRoulette()", "pageIsKto2fRoulette()");
writeOut("content-kto2f-panel.js", panel);

for (const f of ["content-casino.js", "calibrate-bets.js", "exterior-bets.js", "dga-hub.js"]) {
  writeOut(f, readKto(f));
}

const manifest = {
  manifest_version: 3,
  name: "stake37 — KTO Cruzamento 2F",
  version: "1.0.0",
  description:
    "Posições críticas 5·7·9·11 — falha cruzamento cor/altura ou paridade/altura (5×) → entrada 2 fatores. Gales até 5.",
  permissions: ["tabs", "storage", "scripting", "debugger", "windows"],
  host_permissions: [
    "https://www.kto.bet.br/*",
    "https://kto.bet.br/*",
    "https://*.pragmaticplaylive.net/*",
  ],
  background: { service_worker: "background.js" },
  content_scripts: [
    {
      matches: ["https://www.kto.bet.br/*", "https://kto.bet.br/*"],
      js: ["content-casino.js"],
      all_frames: true,
      run_at: "document_idle",
    },
  ],
  action: { default_title: "stake37 KTO 2F Cruzamento" },
};
writeOut("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

writeOut(
  "README.md",
  `# stake37 — KTO Cruzamento 2 Fatores

Extensão Chrome para **KTO** (mesa **230** · Roulette 3).

## Estratégia

- Posições críticas **5, 7, 9, 11**
- Monitoriza falha de cruzamento **cor/altura** e **paridade/altura**
- Após **5 derrotas** (empate não conta; zero neutro na observação) → entrada nos 2 factores do número na posição
- Gales até **5** (unidades 2·4·8·16·32·64)
- Zero com indicação activa = derrota na aposta

## Instalação

\`\`\`bash
npm run extension:kto2f:setup
npm run extension:kto2f:build
\`\`\`

Chrome → \`chrome://extensions\` → Carregar \`extension-kto-cruzamento-2f/\`

Popup fixo (ícone da extensão) — não fecha ao clicar na mesa.
`,
);

console.log("extension-kto-cruzamento-2f setup complete");
