import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ktoDir = path.join(root, "extension-kto");
const goldeDir = path.join(root, "extension-goldebet");

function readKto(name) {
  return fs.readFileSync(path.join(ktoDir, name), "utf8");
}

function writeGolde(name, content) {
  fs.writeFileSync(path.join(goldeDir, name), content);
}

let runner = readKto("kto-signal-runner.js");
runner = runner
  .replaceAll("/** Autopilot KTO — Roulette 3 (230)", "/** Autopilot GoldeBet — French la Partage (28401)")
  .replaceAll("SinglestakeKtoCruzamento", "SinglestakeGoldeCruzamento")
  .replaceAll("createKtoCruzamentoEngine", "createGoldeCruzamentoEngine")
  .replaceAll("STORAGE_KTO_", "STORAGE_GOLDE_")
  .replaceAll("gogKto", "gogGolde")
  .replaceAll("KTO_DEFAULTS", "GOLDE_DEFAULTS")
  .replaceAll("readKto", "readGolde")
  .replaceAll("persistKto", "persistGolde")
  .replaceAll("clearKto", "clearGolde")
  .replaceAll("writeKto", "writeGolde")
  .replaceAll("getKto", "getGolde")
  .replaceAll("setKto", "setGolde")
  .replaceAll("resetKto", "resetGolde")
  .replaceAll("startKto", "startGolde")
  .replaceAll("stopKto", "stopGolde")
  .replaceAll("initKto", "initGolde")
  .replaceAll("SinglestakeKtoSignalRunner", "SinglestakeGoldeSignalRunner")
  .replaceAll("__singlestakeKtoBridgeHandler", "__singlestakeGoldeBridgeHandler")
  .replaceAll("kto-cruzamento-engine.js", "golde-cruzamento-engine.js")
  .replaceAll("npm run extension:build", "npm run extension:golde:build")
  .replaceAll("autopilot KTO", "autopilot GoldeBet")
  .replaceAll("`kto:", "`golde:")
  .replaceAll("KTO_TABLE_ID", "GOLDE_TABLE_ID")
  .replaceAll("KTO_MESA_URL", "GOLDE_MESA_URL")
  .replaceAll("230", "28401")
  .replaceAll(
    "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/",
    "https://goldebet.bet.br/play/pragmatic/french-roulette-la-partage",
  );

runner = runner.replace(
  /const legacy237 =[\s\S]*?roleta-ao-vivo\)/,
  `const legacyWrong =
    stored.tableId === 230 ||
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" &&
      (stored.mesaUrl.includes("kto.bet") || stored.mesaUrl.includes("ice.bet")));`,
);
runner = runner.replaceAll("legacy237", "legacyWrong");

writeGolde("golde-signal-runner.js", runner);

let bg = readKto("background.js");
bg = bg
  .replaceAll("kto-cruzamento-engine.js", "golde-cruzamento-engine.js")
  .replaceAll("kto-signal-runner.js", "golde-signal-runner.js")
  .replaceAll("SinglestakeKtoSignalRunner", "SinglestakeGoldeSignalRunner")
  .replaceAll("gogKtoAutopilotEnabled", "gogGoldeAutopilotEnabled")
  .replaceAll("set-kto-autopilot", "set-golde-autopilot")
  .replaceAll("get-kto-autopilot", "get-golde-autopilot")
  .replaceAll("reset-kto-stats", "reset-golde-stats")
  .replaceAll("get-kto-config", "get-golde-config")
  .replaceAll("set-kto-config", "set-golde-config")
  .replaceAll("KTO_DEFAULT_TABLE_ID = 230", "GOLDE_DEFAULT_TABLE_ID = 28401")
  .replaceAll("KTO_DEFAULT_TABLE_ID", "GOLDE_DEFAULT_TABLE_ID")
  .replaceAll("ensureKtoPanel", "ensureGoldePanel")
  .replaceAll("isKtoRoulettePageUrl", "isGoldeRoulettePageUrl")
  .replaceAll("isKtoCrossingContext", "isGoldeCrossingContext")
  .replaceAll("kto-panel-ping", "golde-panel-ping")
  .replaceAll("content-kto-panel.js", "content-golde-panel.js")
  .replaceAll("isKtoSignal", "isGoldeSignal")
  .replaceAll("ktoAutopilot", "goldeAutopilot")
  .replaceAll("ktoConfig", "goldeConfig")
  .replaceAll("setKtoAutopilotEnabled", "setGoldeAutopilotEnabled")
  .replaceAll("getKtoAutopilotStatus", "getGoldeAutopilotStatus")
  .replaceAll("resetKtoStats", "resetGoldeStats")
  .replaceAll("getKtoConfigForPopup", "getGoldeConfigForPopup")
  .replaceAll("setKtoConfigFromPopup", "setGoldeConfigFromPopup")
  .replaceAll("initKtoSignalRunner", "initGoldeSignalRunner");

bg = bg.replace(
  /function isGoldeRoulettePageUrl\(url\) \{[\s\S]*?\n\}/,
  `function isGoldeRoulettePageUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!/(^|\\.)goldebet\\.bet\\.br$/i.test(u.hostname)) return false;
    const path = \`\${u.pathname}\${u.hash}\${u.search}\`.toLowerCase();
    return /\\/play\\/pragmatic\\/french-roulette-la-partage/i.test(path);
  } catch {
    return /goldebet\\.bet/i.test(url) && /french-roulette-la-partage/i.test(url);
  }
}`,
);

bg = bg.replace(
  /Abra a Roulette 3 KTO[^"]+"/,
  'Abra French Roulette la Partage no GoldeBet (goldebet.bet.br/play/pragmatic/french-roulette-la-partage) num separador e aguarde carregar."',
);

writeGolde("background.js", bg);

let shared = readKto("shared.js");
shared = shared
  .replaceAll("isKtoCrossingContext", "isGoldeCrossingContext")
  .replaceAll("kto:", "golde:")
  .replaceAll("ktoUnitClickStaggerMs", "goldeUnitClickStaggerMs");
writeGolde("shared.js", shared);

for (const f of ["popup.js", "popup.html"]) {
  let c = readKto(f);
  c = c
    .replaceAll("kto.bet.br", "goldebet.bet.br")
    .replaceAll("KTO", "GoldeBet")
    .replaceAll("kto", "golde")
    .replaceAll("230", "28401")
    .replaceAll("roulette-3-ppl", "french-roulette-la-partage")
    .replaceAll("Roulette 3", "French Roulette la Partage");
  writeGolde(f, c);
}

let panel = readKto("content-kto-panel.js");
panel = panel
  .replaceAll("kto.bet.br", "goldebet.bet.br")
  .replaceAll("KTO", "GoldeBet")
  .replaceAll("kto", "golde")
  .replaceAll("230", "28401")
  .replaceAll("roulette-3-ppl", "french-roulette-la-partage")
  .replaceAll("Roulette 3", "French Roulette la Partage")
  .replaceAll("ss-kto", "ss-golde");

panel = panel.replace(
  /function pageIsGoldeRoulette\(\) \{[\s\S]*?\n  \}/,
  `function pageIsGoldeRoulette() {
    const path = \`\${location.pathname}\${location.hash}\${location.search}\`.toLowerCase();
    if (!/goldebet\\.bet\\.br/i.test(location.hostname)) return false;
    if (/\\/play\\/pragmatic\\/french-roulette-la-partage/i.test(path)) return true;
    return /french-roulette-la-partage/i.test(location.href);
  }`,
);
writeGolde("content-golde-panel.js", panel);

let cal = readKto("calibrate-bets.js");
cal = cal.replaceAll("kto.bet.br", "goldebet.bet.br");
writeGolde("calibrate-bets.js", cal);

const manifest = {
  manifest_version: 3,
  name: "stake37 — GoldeBet 2 Fatores",
  version: "1.0.1",
  description:
    "Cruzamento sequencial 2 fatores na French Roulette la Partage (GoldeBet mesa 28401). Gales alternados (oposto em 1,4,5).",
  permissions: ["tabs", "storage", "scripting", "debugger", "windows"],
  host_permissions: [
    "https://www.goldebet.bet.br/*",
    "https://goldebet.bet.br/*",
    "https://*.pragmaticplaylive.net/*",
  ],
  background: { service_worker: "background.js" },
  content_scripts: [
    {
      matches: ["https://www.goldebet.bet.br/*", "https://goldebet.bet.br/*"],
      js: ["content-casino.js"],
      all_frames: true,
      run_at: "document_idle",
    },
  ],
  action: { default_title: "stake37 GoldeBet", default_popup: "popup.html" },
};
writeGolde("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

writeGolde(
  "README.md",
  `# stake37 — GoldeBet 2 Fatores

Extensão Chrome independente. Estratégia **2 Fatores · cruzamento sequencial** na **French Roulette la Partage** (mesa **28401**) em [goldebet.bet.br](https://goldebet.bet.br).

## Gales alternados

| Gale | Factores |
|------|----------|
| Entrada (0), gale 2, gale 3 | **Normais** (do gatilho) |
| Gale 1, gale 4, gale 5 | **Opostos** (ambos invertidos) |

## Instalação

\`\`\`bash
npm run extension:golde:build
\`\`\`

Chrome → \`chrome://extensions\` → Carregar \`extension-goldebet/\`

- **Table ID:** 28401
- **URL:** https://goldebet.bet.br/play/pragmatic/french-roulette-la-partage
`,
);

for (const f of [
  "kto-strategy-entry.ts",
  "kto-signal-runner.js",
  "kto-cruzamento-engine.js",
  "content-kto-panel.js",
]) {
  try {
    fs.unlinkSync(path.join(goldeDir, f));
  } catch {
    /* ignore */
  }
}

console.log("extension-goldebet setup complete");
