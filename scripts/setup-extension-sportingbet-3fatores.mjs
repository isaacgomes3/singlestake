import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const iceDir = path.join(root, "extension-ice-3fatores");
const outDir = path.join(root, "extension-sportingbet-3fatores");

function readIce(name) {
  return fs.readFileSync(path.join(iceDir, name), "utf8");
}

function writeOut(name, content) {
  fs.writeFileSync(path.join(outDir, name), content);
}

fs.mkdirSync(outDir, { recursive: true });

let runner = readIce("ice3f-signal-runner.js");
runner = runner
  .replaceAll("/** Autopilot ICE — 3 Fatores (201)", "/** Autopilot Sportingbet — 3 Fatores (201)")
  .replaceAll("SinglestakeIce3f", "SinglestakeSportingbet3f")
  .replaceAll("createIce3fEngine", "createSportingbet3fEngine")
  .replaceAll("STORAGE_ICE3F_", "STORAGE_SPORTINGBET3F_")
  .replaceAll("gogIce3f", "gogSportingbet3f")
  .replaceAll("ICE3F_DEFAULTS", "SPORTINGBET3F_DEFAULTS")
  .replaceAll("readIce3f", "readSportingbet3f")
  .replaceAll("persistIce3f", "persistSportingbet3f")
  .replaceAll("clearIce3f", "clearSportingbet3f")
  .replaceAll("writeIce3f", "writeSportingbet3f")
  .replaceAll("getIce3f", "getSportingbet3f")
  .replaceAll("setIce3f", "setSportingbet3f")
  .replaceAll("resetIce3f", "resetSportingbet3f")
  .replaceAll("startIce3f", "startSportingbet3f")
  .replaceAll("stopIce3f", "stopSportingbet3f")
  .replaceAll("initIce3f", "initSportingbet3f")
  .replaceAll("SinglestakeIce3fSignalRunner", "SinglestakeSportingbet3fSignalRunner")
  .replaceAll("__singlestakeIce3fBridgeHandler", "__singlestakeSportingbet3fBridgeHandler")
  .replaceAll("ice3f-engine.js", "sportingbet3f-engine.js")
  .replaceAll("npm run extension:ice3f:build", "npm run extension:sportingbet3f:build")
  .replaceAll("autopilot ICE 3F", "autopilot Sportingbet 3F")
  .replaceAll("`ice3f:", "`sportingbet3f:")
  .replaceAll("ICE3F_TABLE_ID", "SPORTINGBET3F_TABLE_ID")
  .replaceAll("ICE3F_MESA_URL", "SPORTINGBET3F_MESA_URL");

runner = runner.replace(
  /mesaUrl:\s*\n?\s*SinglestakeSportingbet3f\?\.SPORTINGBET3F_MESA_URL \?\?\s*\n?\s*"[^"]*"/,
  "mesaUrl: SinglestakeSportingbet3f?.SPORTINGBET3F_MESA_URL ?? \"\"",
);

runner = runner.replace(
  /const legacyWrong =[\s\S]*?;/,
  `const legacyWrong =
    stored.tableId === 230 ||
    stored.tableId === 227 ||
    stored.tableId === 237 ||
    (typeof stored.mesaUrl === "string" &&
      stored.mesaUrl.trim() !== "" &&
      (stored.mesaUrl.includes("kto.bet") ||
        stored.mesaUrl.includes("ice.bet") ||
        stored.mesaUrl.includes("goldebet") ||
        stored.mesaUrl.includes("liveroulettea-pragmaticexternal")));`,
);

writeOut("sportingbet3f-signal-runner.js", runner);

let bg = readIce("background.js");
bg = bg
  .replaceAll("ice3f-engine.js", "sportingbet3f-engine.js")
  .replaceAll("ice3f-signal-runner.js", "sportingbet3f-signal-runner.js")
  .replaceAll("SinglestakeIce3fSignalRunner", "SinglestakeSportingbet3fSignalRunner")
  .replaceAll("gogIce3fAutopilotEnabled", "gogSportingbet3fAutopilotEnabled")
  .replaceAll("set-ice3f-autopilot", "set-sportingbet3f-autopilot")
  .replaceAll("get-ice3f-autopilot", "get-sportingbet3f-autopilot")
  .replaceAll("reset-ice3f-stats", "reset-sportingbet3f-stats")
  .replaceAll("get-ice3f-config", "get-sportingbet3f-config")
  .replaceAll("set-ice3f-config", "set-sportingbet3f-config")
  .replaceAll("ICE3F_DEFAULT_TABLE_ID", "SPORTINGBET3F_DEFAULT_TABLE_ID")
  .replaceAll("ensureIce3fPanel", "ensureSportingbet3fPanel")
  .replaceAll("isIce3fRoulettePageUrl", "isSportingbet3fCasinoUrl")
  .replaceAll("ice3f-panel-ping", "sportingbet3f-panel-ping")
  .replaceAll("content-ice3f-panel.js", "content-sportingbet3f-panel.js")
  .replaceAll("isIce3fSignal", "isSportingbet3fSignal")
  .replaceAll("ice3fAutopilot", "sportingbet3fAutopilot")
  .replaceAll("ice3fConfig", "sportingbet3fConfig")
  .replaceAll("setIce3fAutopilotEnabled", "setSportingbet3fAutopilotEnabled")
  .replaceAll("getIce3fAutopilotStatus", "getSportingbet3fAutopilotStatus")
  .replaceAll("resetIce3fStats", "resetSportingbet3fStats")
  .replaceAll("getIce3fConfigForPopup", "getSportingbet3fConfigForPopup")
  .replaceAll("setIce3fConfigFromPopup", "setSportingbet3fConfigFromPopup")
  .replaceAll("initIce3fSignalRunner", "initSportingbet3fSignalRunner")
  .replaceAll("ice3fPanelWindowId", "sportingbet3fPanelWindowId")
  .replaceAll("openOrFocusIce3fPanel", "openOrFocusSportingbet3fPanel")
  .replaceAll("SinglestakeIce3f", "SinglestakeSportingbet3f")
  .replaceAll("ice3f:", "sportingbet3f:")
  .replaceAll('ICE_CALIB_SITE_KEY = "ice.bet.br|pragmatic-roulette"', 'ICE_CALIB_SITE_KEY = "sportingbet.bet.br|pragmatic-roulette"')
  .replaceAll("ICE_CALIB_SITE_KEY", "SPORTINGBET3F_CALIB_SITE_KEY")
  .replaceAll("isIceHost", "isSportingbet3fHost")
  .replaceAll("lookupAnyIceCalib", "lookupAnySportingbet3fCalib");

bg = bg.replace(
  /function isSportingbet3fHost\(url\) \{[\s\S]*?\n\}/,
  `function isSportingbet3fHost(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return (
      /(^|\\.)sportingbet\\.bet\\.br$/i.test(host) ||
      /(^|\\.)br4\\.bet\\.br$/i.test(host) ||
      /pragmaticplaylive\\.net/i.test(host)
    );
  } catch {
    return /sportingbet\\.bet|br4\\.bet|pragmaticplaylive/i.test(url);
  }
}`,
);

bg = bg.replace(
  /function isSportingbet3fCasinoUrl\(url\) \{[\s\S]*?\n\}/,
  `function isSportingbet3fCasinoUrl(url) {
  if (!url) return false;
  if (/pragmaticplaylive\\.net/i.test(url)) return true;
  try {
    const u = new URL(url);
    if (/(^|\\.)sportingbet\\.bet\\.br$/i.test(u.hostname)) return true;
    if (/(^|\\.)br4\\.bet\\.br$/i.test(u.hostname) && /pragmatic|roulette|play/i.test(u.href)) {
      return true;
    }
    return false;
  } catch {
    return /sportingbet\\.bet|br4\\.bet/i.test(url);
  }
}`,
);

bg = bg.replace(
  /function isCasinoPlayUrl\(url\) \{\s*return isSportingbet3fCasinoUrl\(url\);\s*\}/,
  `function isCasinoPlayUrl(url) {
  return isSportingbet3fCasinoUrl(url);
}`,
);

bg = bg.replace(
  /Abra a roleta ICE[^"]+"/,
  'Abra Roulette 2 Extra Time (mesa 201) manualmente no Sportingbet num separador com o jogo carregado."',
);

bg = bg.replace(
  /if \(host === "ice\.bet\.br" \|\| host\.endsWith\("\.ice\.bet\.br"\)\) \{\s*return SPORTINGBET3F_CALIB_SITE_KEY;\s*\}/,
  `if (
      host === "sportingbet.bet.br" ||
      host.endsWith(".sportingbet.bet.br") ||
      host === "br4.bet.br" ||
      host.endsWith(".br4.bet.br")
    ) {
      return SPORTINGBET3F_CALIB_SITE_KEY;
    }`,
);

bg = bg.replace(
  /if \(\/ice\\.bet\\.br\/i\.test\(key\)\) return \{ siteKey: key, site \};/g,
  "if (/sportingbet\\.bet\\.br|br4\\.bet\\.br/i.test(key)) return { siteKey: key, site };",
);

writeOut("background.js", bg);

let shared = readIce("shared.js");
writeOut("shared.js", shared);

for (const f of ["popup.js", "popup.html"]) {
  let c = readIce(f);
  c = c
    .replaceAll("ice.bet.br", "sportingbet.bet.br")
    .replaceAll("ICE 3F", "Sportingbet 3F")
    .replaceAll("ice3f", "sportingbet3f")
    .replaceAll("liveroulettea-pragmaticexternal", "abrir-manual-mesa-201")
    .replaceAll("stake37 ICE 3F", "stake37 Sportingbet 3F");
  writeOut(f, c);
}

let panel = readIce("content-ice3f-panel.js");
panel = panel
  .replaceAll("ICE 3F", "Sportingbet 3F")
  .replaceAll("ice3f", "sportingbet3f")
  .replaceAll("ss-ice3f", "ss-sportingbet3f")
  .replaceAll("ice.bet.br", "sportingbet.bet.br");
panel = panel.replace(
  /function pageIsSportingbet3fRoulette\(\) \{[\s\S]*?\n  \}/,
  `function pageIsSportingbet3fRoulette() {
    return /(^|\\.)sportingbet\\.bet\\.br$/i.test(location.hostname);
  }`,
);
panel = panel.replace(
  /function pageIsIce3fRoulette\(\) \{[\s\S]*?\n  \}/,
  `function pageIsSportingbet3fRoulette() {
    return /(^|\\.)sportingbet\\.bet\\.br$/i.test(location.hostname);
  }`,
);
panel = panel.replaceAll("pageIsIce3fRoulette()", "pageIsSportingbet3fRoulette()");
panel = panel.replace(
  /const sub = el\("p", "ss-sportingbet3f-sub", "[^"]+"\);/,
  'const sub = el("p", "ss-sportingbet3f-sub", "Roulette 2 Extra Time · mesa 201 · abrir manualmente · eco 3F + Dobrar");',
);
writeOut("content-sportingbet3f-panel.js", panel);

for (const f of ["content-casino.js", "exterior-bets.js", "dga-hub.js", "calibration-relay.js"]) {
  writeOut(f, readIce(f));
}

let cal = readIce("calibrate-bets.js");
cal = cal
  .replace(
    /if \(window === window\.top && \/ice\\.bet\\.br\/i\.test\(location\.hostname\)\)/,
    "if (window === window.top && /sportingbet\\.bet\\.br/i.test(location.hostname))",
  )
  .replace(
    /iframe\[src\*="pragmatic"\], iframe\[src\*="game"\]/,
    'iframe[src*="pragmatic"], iframe[src*="game"], iframe[src*="br4.bet"], iframe[src*="roulette"]',
  );
if (!cal.includes("br4\\.bet\\.br")) {
  cal = cal.replace(
    /if \(isPragmaticGameHost\(\)\) return true;/,
    `if (isPragmaticGameHost()) return true;
    if (/br4\\.bet\\.br/i.test(location.hostname) && /pragmatic|roulette|play/i.test(location.href)) {
      return true;
    }`,
  );
}
writeOut("calibrate-bets.js", cal);

const manifest = {
  manifest_version: 3,
  name: "stake37 — Sportingbet 3 Fatores",
  version: "1.0.0",
  description:
    "Sportingbet mesa 201 · eco última ocorrência → 3F + Dobrar (abertura manual).",
  permissions: ["tabs", "storage", "scripting", "debugger", "windows"],
  host_permissions: [
    "https://www.sportingbet.bet.br/*",
    "https://sportingbet.bet.br/*",
    "https://*.pragmaticplaylive.net/*",
    "https://*.pragmaticplay.net/*",
    "https://*.br4.bet.br/*",
  ],
  background: { service_worker: "background.js" },
  content_scripts: [
    {
      matches: ["https://www.sportingbet.bet.br/*", "https://sportingbet.bet.br/*"],
      js: ["content-casino.js"],
      all_frames: true,
      run_at: "document_idle",
    },
    {
      matches: ["https://*.pragmaticplaylive.net/*", "https://*.pragmaticplay.net/*"],
      js: ["calibration-relay.js"],
      all_frames: true,
      run_at: "document_start",
    },
  ],
  action: { default_title: "stake37 Sportingbet 3F" },
};
writeOut("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

writeOut(
  "README.md",
  `# stake37 — Sportingbet 3 Fatores

Extensão Chrome para **Sportingbet** (mesa **201** · Roulette 2 Extra Time).

Mesma estratégia da ICE 3F: eco da última ocorrência → 3 factores + Dobrar.

## Abertura manual

O Sportingbet **não disponibiliza link directo** estável para a mesa. Antes de ligar o autopilot:

1. Abra [sportingbet.bet.br](https://www.sportingbet.bet.br/) e entre na conta
2. Navegue até **Roulette 2 Extra Time** (Pragmatic, mesa 201) e deixe o jogo carregar
3. Ligue o autopilot no popup — os cliques usam o separador activo

A DGA segue a mesa **201** independentemente do URL.

## Estratégia

- Eco da última ocorrência → 3 factores do nº à esquerda
- Sem eco em número consecutivo (\`22, 22\` → espera próximo)
- Gale ×2 / ×4 via **Dobrar** até vitória

## Instalação

\`\`\`bash
npm run extension:sportingbet3f:setup
npm run extension:sportingbet3f:build
\`\`\`

Chrome → \`chrome://extensions\` → Carregar \`extension-sportingbet-3fatores/\`

- **Table ID DGA:** 201
- **Site:** https://www.sportingbet.bet.br/
`,
);

console.log("extension-sportingbet-3fatores setup complete");
