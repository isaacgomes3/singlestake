import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ktoDir = path.join(root, "extension-kto");
const ice3fDir = path.join(root, "extension-ice-3fatores");
const iceDir = path.join(root, "extension-ice-cruzamento-2f");

function readKto(name) {
  return fs.readFileSync(path.join(ktoDir, name), "utf8");
}

function readIce3f(name) {
  return fs.readFileSync(path.join(ice3fDir, name), "utf8");
}

function writeIce(name, content) {
  fs.writeFileSync(path.join(iceDir, name), content);
}

fs.mkdirSync(iceDir, { recursive: true });

let runner = readKto("kto-signal-runner.js");
runner = runner
  .replaceAll("/** Autopilot KTO — Roulette 3 (230)", "/** Autopilot ICE — Cruzamento 2F (201)")
  .replaceAll("SinglestakeKtoCruzamento", "SinglestakeIce2f")
  .replaceAll("createKtoCruzamentoEngine", "createIce2fEngine")
  .replaceAll("STORAGE_KTO_", "STORAGE_ICE2F_")
  .replaceAll("gogKto", "gogIce2f")
  .replaceAll("KTO_DEFAULTS", "ICE2F_DEFAULTS")
  .replaceAll("readKto", "readIce2f")
  .replaceAll("persistKto", "persistIce2f")
  .replaceAll("clearKto", "clearIce2f")
  .replaceAll("writeKto", "writeIce2f")
  .replaceAll("getKto", "getIce2f")
  .replaceAll("setKto", "setIce2f")
  .replaceAll("resetKto", "resetIce2f")
  .replaceAll("startKto", "startIce2f")
  .replaceAll("stopKto", "stopIce2f")
  .replaceAll("initKto", "initIce2f")
  .replaceAll("SinglestakeKtoSignalRunner", "SinglestakeIce2fSignalRunner")
  .replaceAll("__singlestakeKtoBridgeHandler", "__singlestakeIce2fBridgeHandler")
  .replaceAll("kto-cruzamento-engine.js", "ice2f-engine.js")
  .replaceAll("npm run extension:build", "npm run extension:ice2f:build")
  .replaceAll("autopilot KTO", "autopilot ICE 2F")
  .replaceAll("`kto:", "`ice2f:")
  .replaceAll("KTO_TABLE_ID", "ICE2F_TABLE_ID")
  .replaceAll("KTO_MESA_URL", "ICE2F_MESA_URL")
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
    (typeof stored.mesaUrl === "string" && (stored.mesaUrl.includes("kto.bet") || stored.mesaUrl.includes("roleta-ao-vivo")));`,
);
runner = runner.replaceAll("legacy237", "legacyWrong");
runner = runner.replace(/const DEFAULT_MAX_GALES = 6;/, "const DEFAULT_MAX_GALES = 5;");
runner = runner.replace(
  /return Math\.min\(6, Math\.max\(0, Math\.floor\(n\)\)\);/,
  "return Math.min(5, Math.max(0, Math.floor(n)));",
);

runner = runner.replace(
  /function formatActiveLabel\(active, recovery\) \{[\s\S]*?\n\}/,
  `function formatActiveLabel(active, recovery) {
  if (!active) return null;
  const f1 = active.factor1?.value ?? "";
  const f2 = active.factor2?.value ?? "";
  const axis = active.axis === "cor-altura" ? "c/a" : active.axis === "altura-paridade" ? "p/a" : active.axis ?? "";
  const gale = recovery > 0 ? \` · gale \${recovery}\` : "";
  return \`\${f1} · \${f2}\${gale} · pos\${active.criticalPosition ?? "?"} \${axis}\`.trim();
}`,
);

runner = runner.replace(
  /: "Aguarda cruzamento sequencial \\(2 factores em comum\\)…"/,
  ': "Aguarda 4 falhas de cruzamento (pos críticas)…"',
);

runner = runner.replace(
  /function formatWatchCounters[\s\S]*?\n\}/,
  `function formatWatchCounters(watch) {
  if (!watch || typeof watch !== "object") return null;
  if (typeof SinglestakeIce2f?.formatIce2fWatchLabel === "function") {
    return SinglestakeIce2f.formatIce2fWatchLabel(watch);
  }
  return null;
}`,
);

runner = runner.replace(
  /const signalKey = `ice2f:\$\{active\?\.triggerNumbers\?\.join\("-"\) \?\? "\?"\}:\$\{result\.recovery\}`;/,
  'const signalKey = `ice2f:pos${active?.criticalPosition ?? "?"}:${active?.axis ?? "?"}:${result.recovery}`;',
);

runner = runner.replaceAll("2 factores em comum", "4 falhas cruzamento");
runner = runner.replaceAll("3 falhas cruzamento", "4 falhas cruzamento");
runner = runner.replaceAll("2 falhas cruzamento", "4 falhas cruzamento");

writeIce("ice2f-signal-runner.js", runner);

let bg = readIce3f("background.js");
bg = bg
  .replaceAll("ice3f-engine.js", "ice2f-engine.js")
  .replaceAll("ice3f-signal-runner.js", "ice2f-signal-runner.js")
  .replaceAll("SinglestakeIce3fSignalRunner", "SinglestakeIce2fSignalRunner")
  .replaceAll("gogIce3fAutopilotEnabled", "gogIce2fAutopilotEnabled")
  .replaceAll("set-ice3f-autopilot", "set-ice2f-autopilot")
  .replaceAll("get-ice3f-autopilot", "get-ice2f-autopilot")
  .replaceAll("reset-ice3f-stats", "reset-ice2f-stats")
  .replaceAll("get-ice3f-config", "get-ice2f-config")
  .replaceAll("set-ice3f-config", "set-ice2f-config")
  .replaceAll("ICE3F_DEFAULT_TABLE_ID", "ICE2F_DEFAULT_TABLE_ID")
  .replaceAll("ensureIce3fPanel", "ensureIce2fPanel")
  .replaceAll("isIce3fRoulettePageUrl", "isIce2fRoulettePageUrl")
  .replaceAll("ice3f-panel-ping", "ice2f-panel-ping")
  .replaceAll("content-ice3f-panel.js", "content-ice2f-panel.js")
  .replaceAll("isIce3fSignal", "isIce2fSignal")
  .replaceAll("ice3fAutopilot", "ice2fAutopilot")
  .replaceAll("ice3fConfig", "ice2fConfig")
  .replaceAll("setIce3fAutopilotEnabled", "setIce2fAutopilotEnabled")
  .replaceAll("getIce3fAutopilotStatus", "getIce2fAutopilotStatus")
  .replaceAll("resetIce3fStats", "resetIce2fStats")
  .replaceAll("getIce3fConfigForPopup", "getIce2fConfigForPopup")
  .replaceAll("setIce3fConfigFromPopup", "setIce2fConfigFromPopup")
  .replaceAll("initIce3fSignalRunner", "initIce2fSignalRunner")
  .replaceAll("openOrFocusIce3fPanel", "openOrFocusIce2fPanel")
  .replaceAll("ice3fPanelWindowId", "ice2fPanelWindowId");

bg = bg.replace(
  /const isIce3fSignal =[\s\S]*?context\.signalId\.startsWith\("ice3f:"\);/,
  `const isIce2fSignal =
    isIce2fCrossingContext(context) &&
    typeof context?.signalId === "string" &&
    context.signalId.startsWith("ice2f:");`,
);

bg = bg.replace(
  /function isDois2FatoresBridgeContext\(context\) \{[\s\S]*?\}\n\nfunction isIce3fCrossingContext\(context\) \{[\s\S]*?\}/,
  `function isDois2FatoresBridgeContext(context) {
  return (
    (context?.strategy === "dois2fatores" || context?.strategy === "ice2fcruzamento") &&
    context?.singleFactorMode !== true
  );
}

function isIce2fCrossingContext(context) {
  return context?.strategy === "ice2fcruzamento";
}`,
);

bg = bg.replace(
  /const betKey =[\s\S]*?: null;/,
  `const betKey =
    action.target === "factor-1"
      ? context.factor1BetKey
      : action.target === "factor-2"
        ? context.factor2BetKey
        : null;`,
);

bg = bg.replace(
  /const label =[\s\S]*?: action\.label;/,
  `const label =
    action.target === "factor-1"
      ? context.factor1Label
      : action.target === "factor-2"
        ? context.factor2Label
        : action.label;`,
);

bg = bg.replace(
  /signalId && \(action\.target === "factor-1" \|\| action\.target === "factor-2" \|\| action\.target === "factor-3"\)/,
  'signalId && (action.target === "factor-1" || action.target === "factor-2")',
);

bg = bg.replace(
  /skipBarSettle: \(action\.target === "factor-2" \|\| action\.target === "factor-3"\) && isDois2FatoresBridgeContext\(context\)/,
  'skipBarSettle: action.target === "factor-2" && isDois2FatoresBridgeContext(context)',
);

bg = bg.replace(
  /prevAction\?\.target === "factor-1" && action\?\.target === "factor-2" \|\|[\s\S]*?action\?\.target === "factor-3"/,
  'prevAction?.target === "factor-1" && action?.target === "factor-2"',
);

bg = bg.replace(
  /r\.target === "factor-3" \|\|[\s\S]*?target === "factor-3"/g,
  (m) => m.replace(/\s*\|\|\s*r\.target === "factor-3"/g, "").replace(/target === "factor-3" \|\|\s*/g, ""),
);

bg = bg.replaceAll("isIce3fCrossingContext", "isIce2fCrossingContext");
bg = bg.replaceAll('context.signalId.startsWith("ice3f:")', 'context.signalId.startsWith("ice2f:")');
bg = bg.replaceAll("SinglestakeIce3f", "SinglestakeIce2f");
bg = bg.replaceAll("ice3fPadFactorPlacementMs", "ice2fPadFactorPlacementMs");
bg = bg.replaceAll("ICE3F_GALE3_REFERENCE_UNITS", "ICE2F_GALE3_REFERENCE_UNITS");
bg = bg.replace(
  /\(prevAction\?\.target === "factor-1" && action\?\.target === "factor-2"\) \|\|\s*\(prevAction\?\.target === "factor-2" && action\?\.target === "factor-3"\)/,
  '(prevAction?.target === "factor-1" && action?.target === "factor-2")',
);
bg = bg.replace(/\|\|\s*target === "factor-3"/g, "");
bg = bg.replace(/\|\|\s*action\.target === "factor-3"/g, "");
bg = bg.replace(
  /skipBarSettle: \(action\.target === "factor-2" \|\| action\.target === "factor-3"\)/,
  "skipBarSettle: action.target === \"factor-2\"",
);

bg = bg.replaceAll("gogIce3fAutopilotEnabled", "gogIce2fAutopilotEnabled");

writeIce("background.js", bg);

let shared = readIce3f("shared.js");
shared = shared
  .replaceAll("isIce3fCrossingContext", "isIce2fCrossingContext")
  .replaceAll("ICE3F_GALE3_REFERENCE_UNITS", "ICE2F_GALE3_REFERENCE_UNITS")
  .replaceAll("ice3fUnitClickStaggerMs", "ice2fUnitClickStaggerMs")
  .replaceAll('context?.strategy === "tres3fatores"', 'context?.strategy === "ice2fcruzamento"');
shared = shared.replace(
  /function isIce2fCrossingContext\(context\) \{[\s\S]*?\}/,
  `function isIce2fCrossingContext(context) {
  return context?.strategy === "ice2fcruzamento";
}`,
);
writeIce("shared.js", shared);

for (const f of ["popup.js", "popup.html"]) {
  let c = readKto(f);
  c = c
    .replaceAll("kto.bet.br", "ice.bet.br")
    .replaceAll("KTO", "ICE 2F")
    .replaceAll("kto", "ice2f")
    .replaceAll("230", "201")
    .replaceAll("roulette-3-ppl", "liveroulettea-pragmaticexternal")
    .replaceAll("Roulette 3", "Roulette 2 Extra Time")
    .replaceAll("Cruzamento 2F · posições críticas", "Cruzamento 2F · posições críticas")
    .replaceAll("1·1·2·4·8·16·32", "1·2·4·8·16·32");
  writeIce(f, c);
}

let panel = readKto("content-kto-panel.js");
panel = panel
  .replaceAll("kto.bet.br", "ice.bet.br")
  .replaceAll("KTO", "ICE 2F")
  .replaceAll("kto", "ice2f")
  .replaceAll("230", "201")
  .replaceAll("roulette-3-ppl", "liveroulettea-pragmaticexternal")
  .replaceAll("Roulette 3", "Roulette 2 Extra Time")
  .replaceAll("ss-kto", "ss-ice2f")
  .replaceAll("Cruzamento sequencial", "Cruzamento 2F")
  .replaceAll("1·1·2·4·8·16·32", "1·2·4·8·16·32");
panel = panel.replace(
  /function pageIsKtoRoulette\(\) \{[\s\S]*?\n  \}/,
  `function pageIsIce2fRoulette() {
    if (!/ice\\.bet\\.br/i.test(location.hostname)) return false;
    const path = \`\${location.pathname}\${location.hash}\${location.search}\`.toLowerCase();
    return /roulette|liveroulette|pragmatic/i.test(path);
  }`,
);
panel = panel.replaceAll("pageIsKtoRoulette()", "pageIsIce2fRoulette()");
writeIce("content-ice2f-panel.js", panel);

writeIce("content-casino.js", readIce3f("content-casino.js").replace(
  /if \(target !== "factor-1" && target !== "factor-2" && target !== "factor-3"\) return;/,
  'if (target !== "factor-1" && target !== "factor-2") return;',
));
writeIce("calibration-relay.js", readIce3f("calibration-relay.js"));
writeIce("exterior-bets.js", readIce3f("exterior-bets.js"));
writeIce("dga-hub.js", readIce3f("dga-hub.js"));
writeIce(
  "calibrate-bets.js",
  readIce3f("calibrate-bets.js").replaceAll("3 Fatores", "2F Cruzamento"),
);

const manifest = {
  manifest_version: 3,
  name: "stake37 — ICE Cruzamento 2F",
  version: "1.0.0",
  description:
    "Posições críticas 5·6·7·9·10·11 — falha cruzamento cor/altura ou paridade/altura (4×) → entrada 2 fatores. Gales até 5.",
  permissions: ["tabs", "storage", "scripting", "debugger", "windows"],
  host_permissions: [
    "https://www.ice.bet.br/*",
    "https://ice.bet.br/*",
    "https://*.pragmaticplaylive.net/*",
    "https://*.pragmaticplay.net/*",
  ],
  background: { service_worker: "background.js" },
  content_scripts: [
    {
      matches: ["https://www.ice.bet.br/*", "https://ice.bet.br/*"],
      js: ["content-casino.js"],
      all_frames: true,
      run_at: "document_idle",
    },
    {
      matches: [
        "https://*.pragmaticplaylive.net/*",
        "https://*.pragmaticplay.net/*",
      ],
      js: ["calibration-relay.js"],
      all_frames: true,
      run_at: "document_start",
    },
  ],
  action: { default_title: "stake37 ICE 2F Cruzamento" },
};
writeIce("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

writeIce(
  "README.md",
  `# stake37 — ICE Cruzamento 2 Fatores

Extensão Chrome para **ICE** (mesa **201** · Roulette 2 Extra Time).

## Estratégia

- Posições críticas **5, 6, 7, 9, 10, 11**
- Monitoriza falha de cruzamento **cor/altura** e **paridade/altura**
- Após **4 derrotas** (empate não conta; zero neutro na observação) → entrada nos 2 factores do número na posição
- Gales até **5** (unidades 1·2·4·8·16·32)
- Zero com indicação activa = derrota na aposta

## Instalação

\`\`\`bash
npm run extension:ice2f:setup
npm run extension:ice2f:build
\`\`\`

Chrome → \`chrome://extensions\` → Carregar \`extension-ice-cruzamento-2f/\`

Popup fixo (ícone da extensão) — não fecha ao clicar na mesa.
`,
);

console.log("extension-ice-cruzamento-2f setup complete");
