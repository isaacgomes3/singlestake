import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ktoDir = path.join(root, "extension-kto");
const iceDir = path.join(root, "extension-ice-3fatores");

function readKto(name) {
  return fs.readFileSync(path.join(ktoDir, name), "utf8");
}

function writeIce(name, content) {
  fs.writeFileSync(path.join(iceDir, name), content);
}

fs.mkdirSync(iceDir, { recursive: true });

let runner = readKto("kto-signal-runner.js");
runner = runner
  .replaceAll("/** Autopilot KTO — Roulette 3 (230)", "/** Autopilot ICE — 3 Fatores (201)")
  .replaceAll("SinglestakeKtoCruzamento", "SinglestakeIce3f")
  .replaceAll("createKtoCruzamentoEngine", "createIce3fEngine")
  .replaceAll("STORAGE_KTO_", "STORAGE_ICE3F_")
  .replaceAll("gogKto", "gogIce3f")
  .replaceAll("KTO_DEFAULTS", "ICE3F_DEFAULTS")
  .replaceAll("readKto", "readIce3f")
  .replaceAll("persistKto", "persistIce3f")
  .replaceAll("clearKto", "clearIce3f")
  .replaceAll("writeKto", "writeIce3f")
  .replaceAll("getKto", "getIce3f")
  .replaceAll("setKto", "setIce3f")
  .replaceAll("resetKto", "resetIce3f")
  .replaceAll("startKto", "startIce3f")
  .replaceAll("stopKto", "stopIce3f")
  .replaceAll("initKto", "initIce3f")
  .replaceAll("SinglestakeKtoSignalRunner", "SinglestakeIce3fSignalRunner")
  .replaceAll("__singlestakeKtoBridgeHandler", "__singlestakeIce3fBridgeHandler")
  .replaceAll("kto-cruzamento-engine.js", "ice3f-engine.js")
  .replaceAll("npm run extension:build", "npm run extension:ice3f:build")
  .replaceAll("autopilot KTO", "autopilot ICE 3F")
  .replaceAll("`kto:", "`ice3f:")
  .replaceAll("KTO_TABLE_ID", "ICE3F_TABLE_ID")
  .replaceAll("KTO_MESA_URL", "ICE3F_MESA_URL")
  .replaceAll("230", "201")
  .replaceAll(
    "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/",
    "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal",
  );

runner = runner.replace(
  /const legacy237 =[\s\S]*?roleta-ao-vivo\)/,
  `const legacyWrong =
    stored.tableId === 230 ||
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" && stored.mesaUrl.includes("kto.bet"));`,
);
runner = runner.replaceAll("legacy237", "legacyWrong");

runner = runner.replace(
  /lastBetDetail: detail \|\| "Aposta enviada \(factor-1 \+ factor-2\)"/,
  'lastBetDetail: detail || "Aposta enviada (factor-1 + factor-2 + factor-3)"',
);

runner = runner.replace(
  /const f1 = clicks\.find\(\(r\) => r\?\.target === "factor-1"\);[\s\S]*?const f2 = clicks\.find\(\(r\) => r\?\.target === "factor-2"\);/,
  `const f1 = clicks.find((r) => r?.target === "factor-1");
  const f2 = clicks.find((r) => r?.target === "factor-2");
  const f3 = clicks.find((r) => r?.target === "factor-3");`,
);

runner = runner.replace(
  /\(r\) => r\?\.target === "factor-1" \|\| r\?\.target === "factor-2"/,
  '(r) => r?.target === "factor-1" || r?.target === "factor-2" || r?.target === "factor-3"',
);

writeIce("ice3f-signal-runner.js", runner);

let bg = readKto("background.js");
bg = bg
  .replaceAll("kto-cruzamento-engine.js", "ice3f-engine.js")
  .replaceAll("kto-signal-runner.js", "ice3f-signal-runner.js")
  .replaceAll("SinglestakeKtoSignalRunner", "SinglestakeIce3fSignalRunner")
  .replaceAll("gogKtoAutopilotEnabled", "gogIce3fAutopilotEnabled")
  .replaceAll("set-kto-autopilot", "set-ice3f-autopilot")
  .replaceAll("get-kto-autopilot", "get-ice3f-autopilot")
  .replaceAll("reset-kto-stats", "reset-ice3f-stats")
  .replaceAll("get-kto-config", "get-ice3f-config")
  .replaceAll("set-kto-config", "set-ice3f-config")
  .replaceAll("KTO_DEFAULT_TABLE_ID = 230", "ICE3F_DEFAULT_TABLE_ID = 201")
  .replaceAll("KTO_DEFAULT_TABLE_ID", "ICE3F_DEFAULT_TABLE_ID")
  .replaceAll("ensureKtoPanel", "ensureIce3fPanel")
  .replaceAll("isKtoRoulettePageUrl", "isIce3fRoulettePageUrl")
  .replaceAll("isKtoCrossingContext", "isIce3fCrossingContext")
  .replaceAll("kto-panel-ping", "ice3f-panel-ping")
  .replaceAll("content-kto-panel.js", "content-ice3f-panel.js")
  .replaceAll("isKtoSignal", "isIce3fSignal")
  .replaceAll("ktoAutopilot", "ice3fAutopilot")
  .replaceAll("ktoConfig", "ice3fConfig")
  .replaceAll("setKtoAutopilotEnabled", "setIce3fAutopilotEnabled")
  .replaceAll("getKtoAutopilotStatus", "getIce3fAutopilotStatus")
  .replaceAll("resetKtoStats", "resetIce3fStats")
  .replaceAll("getKtoConfigForPopup", "getIce3fConfigForPopup")
  .replaceAll("setKtoConfigFromPopup", "setIce3fConfigFromPopup")
  .replaceAll("initKtoSignalRunner", "initIce3fSignalRunner");

bg = bg.replace(
  /function isIce3fRoulettePageUrl\(url\) \{[\s\S]*?\n\}/,
  `function isIce3fRoulettePageUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!/(^|\\.)ice\\.bet\\.br$/i.test(u.hostname)) return false;
    const path = \`\${u.pathname}\${u.hash}\${u.search}\`.toLowerCase();
    return /roulette|liveroulette|pragmatic/i.test(path);
  } catch {
    return /ice\\.bet/i.test(url) && /roulette/i.test(url);
  }
}`,
);

bg = bg.replace(
  /Abra a Roulette 3 KTO[^"]+"/,
  'Abra a roleta ICE (ice.bet.br) num separador e aguarde carregar."',
);

bg = bg.replace(
  /const betKey =[\s\S]*?: null;/,
  `const betKey =
    action.target === "factor-1"
      ? context.factor1BetKey
      : action.target === "factor-2"
        ? context.factor2BetKey
        : action.target === "factor-3"
          ? context.factor3BetKey
          : null;`,
);

bg = bg.replace(
  /const label =[\s\S]*?: action\.label;/,
  `const label =
    action.target === "factor-1"
      ? context.factor1Label
      : action.target === "factor-2"
        ? context.factor2Label
        : action.target === "factor-3"
          ? context.factor3Label
          : action.label;`,
);

bg = bg.replace(
  /signalId && \(action\.target === "factor-1" \|\| action\.target === "factor-2"\)/,
  'signalId && (action.target === "factor-1" || action.target === "factor-2" || action.target === "factor-3")',
);

bg = bg.replace(
  /const isKtoSignal =[\s\S]*?context\.signalId\.startsWith\("kto:"\);/,
  `const isIce3fSignal =
    isIce3fCrossingContext(context) &&
    typeof context?.signalId === "string" &&
    context.signalId.startsWith("ice3f:");`,
);

bg = bg.replaceAll("isKtoSignal", "isIce3fSignal");

bg = bg.replace(
  /function isDois2FatoresBridgeContext\(context\) \{[\s\S]*?\}/,
  `function isDois2FatoresBridgeContext(context) {
  return (
    (context?.strategy === "dois2fatores" || context?.strategy === "tres3fatores") &&
    context?.singleFactorMode !== true
  );
}

function isIce3fCrossingContext(context) {
  return context?.strategy === "tres3fatores";
}`,
);

bg = bg.replace(
  /skipBarSettle:\s*action\.target === "factor-2" && isDois2FatoresBridgeContext\(context\)/,
  'skipBarSettle: (action.target === "factor-2" || action.target === "factor-3") && isDois2FatoresBridgeContext(context)',
);

bg = bg
  .replaceAll('importScripts("shared.js", "kto-cruzamento-engine.js"', 'importScripts("shared.js", "ice3f-engine.js"')

bg = bg.replace(
  /prevAction\?\.target === "factor-1" &&\s*action\?\.target === "factor-2"/,
  `prevAction?.target === "factor-1" && action?.target === "factor-2" ||
    prevAction?.target === "factor-2" && action?.target === "factor-3"`,
);

writeIce("background.js", bg);

let shared = readKto("shared.js");
shared = shared
  .replaceAll("isKtoCrossingContext", "isIce3fCrossingContext")
  .replaceAll("kto:", "ice3f:")
  .replaceAll("ktoUnitClickStaggerMs", "ice3fUnitClickStaggerMs")
  .replaceAll('strategy === "dois2fatores"', 'strategy === "dois2fatores" || strategy === "tres3fatores"');
writeIce("shared.js", shared);

for (const f of ["popup.js", "popup.html"]) {
  let c = readKto(f);
  c = c
    .replaceAll("kto.bet.br", "ice.bet.br")
    .replaceAll("KTO", "ICE 3F")
    .replaceAll("kto", "ice3f")
    .replaceAll("230", "201")
    .replaceAll("roulette-3-ppl", "liveroulettea-pragmaticexternal")
    .replaceAll("Roulette 3", "Roulette 2 Extra Time")
    .replaceAll("2 Fatores", "3 Fatores")
    .replaceAll("2 fatores", "3 fatores")
    .replaceAll("Cruzamento sequencial", "Posições críticas 5·7·12");
  writeIce(f, c);
}

let panel = readKto("content-kto-panel.js");
panel = panel
  .replaceAll("kto.bet.br", "ice.bet.br")
  .replaceAll("KTO", "ICE 3F")
  .replaceAll("kto", "ice3f")
  .replaceAll("230", "201")
  .replaceAll("roulette-3-ppl", "liveroulettea-pragmaticexternal")
  .replaceAll("Roulette 3", "Roulette 2 Extra Time")
  .replaceAll("ss-kto", "ss-ice3f");

panel = panel.replace(
  /function pageIsIce3fRoulette\(\) \{[\s\S]*?\n  \}/,
  `function pageIsIce3fRoulette() {
    if (!/ice\\.bet\\.br/i.test(location.hostname)) return false;
    const path = \`\${location.pathname}\${location.hash}\${location.search}\`.toLowerCase();
    return /roulette|liveroulette|pragmatic/i.test(path);
  }`,
);
writeIce("content-ice3f-panel.js", panel);

let casino = readKto("content-casino.js");
casino = casino.replace(
  /if \(target !== "factor-1" && target !== "factor-2"\) return;/,
  'if (target !== "factor-1" && target !== "factor-2" && target !== "factor-3") return;',
);
writeIce("content-casino.js", casino);

for (const f of ["calibrate-bets.js", "exterior-bets.js", "dga-hub.js"]) {
  writeIce(f, readKto(f));
}

const manifest = {
  manifest_version: 3,
  name: "stake37 — ICE 3 Fatores",
  version: "1.0.0",
  description:
    "Posições críticas 5·7·12 na Roulette 2 Extra Time (ICE mesa 201). Aposta cor+altura+paridade da posição 7.",
  permissions: ["tabs", "storage", "scripting", "debugger", "windows"],
  host_permissions: [
    "https://www.ice.bet.br/*",
    "https://ice.bet.br/*",
    "https://*.pragmaticplaylive.net/*",
  ],
  background: { service_worker: "background.js" },
  content_scripts: [
    {
      matches: ["https://www.ice.bet.br/*", "https://ice.bet.br/*"],
      js: ["content-casino.js"],
      all_frames: true,
      run_at: "document_idle",
    },
  ],
  action: { default_title: "stake37 ICE 3F" },
};
writeIce("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

writeIce(
  "README.md",
  `# stake37 — ICE 3 Fatores

Extensão Chrome para **ICE** (mesa **201** · Roulette 2 Extra Time).

## Estratégia

- Posições críticas **5, 7 e 12** — conta derrotas totais (0 factores) até **3**
- Vitória parcial/total reinicia; derrota parcial não conta
- Entrada: **3 factores** do número na **posição 7**
- Gale parcial (×2) · tripla derrota total (×3)
- Falha: 5 gales, 2 triplas, ou 1 tripla + 2 gales

## Instalação

\`\`\`bash
npm run extension:ice3f:build
\`\`\`

Chrome → \`chrome://extensions\` → Carregar \`extension-ice-3fatores/\`
`,
);

console.log("extension-ice-3fatores setup complete");
