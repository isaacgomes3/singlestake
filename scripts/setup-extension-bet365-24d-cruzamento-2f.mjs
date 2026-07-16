/**
 * Cria extension-bet365-24d-cruzamento-2f a partir da ICE Cruzamento 2F.
 * Estratégia: spin24dCruzamento2fStrategy (mesa 3426 · 1–24).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "extension-ice-cruzamento-2f");
const outDir = path.join(root, "extension-bet365-24d-cruzamento-2f");
const VERSION = "1.0.2";

const FILES_COPY = [
  "shared.js",
  "dga-hub.js",
  "exterior-bets.js",
  "calibrate-bets.js",
  "calibration-relay.js",
  "content-casino.js",
  "popup.html",
];

function rewriteIceTokens(s) {
  return s
    .replaceAll("SinglestakeIce2f", "SinglestakeBet36524d2f")
    .replaceAll("createIce2fEngine", "createBet36524d2fEngine")
    .replaceAll("STORAGE_ICE2F_", "STORAGE_BET36524D2F_")
    .replaceAll("gogIce2f", "gogBet36524d2f")
    .replaceAll("ICE2F_DEFAULTS", "BET36524D2F_DEFAULTS")
    .replaceAll("readIce2f", "readBet36524d2f")
    .replaceAll("persistIce2f", "persistBet36524d2f")
    .replaceAll("clearIce2f", "clearBet36524d2f")
    .replaceAll("writeIce2f", "writeBet36524d2f")
    .replaceAll("getIce2f", "getBet36524d2f")
    .replaceAll("setIce2f", "setBet36524d2f")
    .replaceAll("resetIce2f", "resetBet36524d2f")
    .replaceAll("startIce2f", "startBet36524d2f")
    .replaceAll("stopIce2f", "stopBet36524d2f")
    .replaceAll("initIce2f", "initBet36524d2f")
    .replaceAll("SinglestakeIce2fSignalRunner", "SinglestakeBet36524d2fSignalRunner")
    .replaceAll("__singlestakeIce2fBridgeHandler", "__singlestakeBet36524d2fBridgeHandler")
    .replaceAll("ice2f-engine.js", "bet36524d2f-engine.js")
    .replaceAll("ice2f-signal-runner.js", "bet36524d2f-signal-runner.js")
    .replaceAll("content-ice2f-panel.js", "content-bet36524d2f-panel.js")
    .replaceAll("npm run extension:ice2f:build", "npm run extension:bet36524d2f:build")
    .replaceAll("autopilot ICE 2F", "autopilot Bet365 24D 2F")
    .replaceAll("`ice2f:", "`bet36524d2f:")
    .replaceAll("ICE2F_TABLE_ID", "BET36524D2F_TABLE_ID")
    .replaceAll("ICE2F_MESA_URL", "BET36524D2F_MESA_URL")
    .replaceAll("ICE2F_MAX_GALES", "BET36524D2F_MAX_GALES")
    .replaceAll("ICE_CALIB_SITE_KEY", "BET36524D_CALIB_SITE_KEY")
    .replaceAll("ice.bet.br|pragmatic-roulette", "bet365.bet.br|pragmatic-24d-spin")
    .replaceAll("isIce2fRoulettePageUrl", "isBet36524d2fGameUrl")
    .replaceAll("ensureIce2fPanel", "ensureBet36524d2fPanel")
    .replaceAll("ice2f-panel-ping", "bet36524d2f-panel-ping")
    .replaceAll("isIce2fSignal", "isBet36524d2fSignal")
    .replaceAll("ice2fAutopilot", "bet36524d2fAutopilot")
    .replaceAll("ice2fConfig", "bet36524d2fConfig")
    .replaceAll("setIce2fAutopilotEnabled", "setBet36524d2fAutopilotEnabled")
    .replaceAll("getIce2fAutopilotStatus", "getBet36524d2fAutopilotStatus")
    .replaceAll("resetIce2fStats", "resetBet36524d2fStats")
    .replaceAll("getIce2fConfigForPopup", "getBet36524d2fConfigForPopup")
    .replaceAll("setIce2fConfigFromPopup", "setBet36524d2fConfigFromPopup")
    .replaceAll("initIce2fSignalRunner", "initBet36524d2fSignalRunner")
    .replaceAll("ice2fPanelWindowId", "bet36524d2fPanelWindowId")
    .replaceAll("openOrFocusIce2fPanel", "openOrFocusBet36524d2fPanel")
    .replaceAll("isIce2fCrossingContext", "isBet36524d2fCrossingContext")
    .replaceAll("ice2fcruzamento", "bet36524d2fcruzamento")
    .replaceAll("ice2fPadFactorPlacementMs", "bet36524d2fPadFactorPlacementMs")
    .replaceAll("ICE 2F", "24D 2F")
    .replaceAll("ICE Cruzamento 2F", "Bet365 24D Cruzamento 2F")
    .replaceAll("Cruzamento 2F (201)", "24D Spin Cruzamento 2F (3426)")
    .replaceAll("Roulette 2 Extra Time", "24D Spin")
    .replaceAll("mesa 201", "mesa 3426")
    .replaceAll("Autopilot ICE", "Autopilot Bet365 24D");
}

fs.mkdirSync(outDir, { recursive: true });

for (const name of FILES_COPY) {
  let content = fs.readFileSync(path.join(srcDir, name), "utf8");
  content = rewriteIceTokens(content);
  if (name === "dga-hub.js") {
    content = content
      .replaceAll("number < 0 || number > 36", "number < 1 || number > 24")
      .replaceAll("number < 0 || number > 36", "number < 1 || number > 24");
  }
  if (name === "exterior-bets.js") {
    content = content
      .replace(
        /low:\s*\{[\s\S]*?textHints:\s*\[[^\]]+\][\s\S]*?dataHints:\s*\[[^\]]+\][\s\S]*?classHints:\s*\[[^\]]+\],/,
        `low: {
      textHints: ["1-12", "1–12", "baixo", "low"],
      dataHints: ["low", "LOW", "1-12", "1_12", "rl_low"],
      classHints: ["rl_low", "bet-low", "outside-low", "1-12"],`,
      )
      .replace(
        /high:\s*\{[\s\S]*?textHints:\s*\[[^\]]+\][\s\S]*?dataHints:\s*\[[^\]]+\][\s\S]*?classHints:\s*\[[^\]]+\],/,
        `high: {
      textHints: ["13-24", "13–24", "alto", "high"],
      dataHints: ["high", "HIGH", "13-24", "13_24", "rl_high"],
      classHints: ["rl_high", "bet-high", "outside-high", "13-24"],`,
      );
  }
  if (name === "shared.js") {
    content = content
      .replaceAll("ICE2F_FACTOR_BRIDGE_STAGGER_MS", "BET36524D2F_FACTOR_BRIDGE_STAGGER_MS")
      .replaceAll("ICE2F_DOUBLE_CLICK_STAGGER_MS", "BET36524D2F_DOUBLE_CLICK_STAGGER_MS")
      .replaceAll("ICE2F_GALE4_CHIP_STAGGER_MS", "BET36524D2F_GALE4_CHIP_STAGGER_MS")
      .replaceAll("ICE2F_GALE5_CHIP_STAGGER_MS", "BET36524D2F_GALE5_CHIP_STAGGER_MS");
  }
  fs.writeFileSync(path.join(outDir, name), content);
}

let runner = fs.readFileSync(path.join(srcDir, "ice2f-signal-runner.js"), "utf8");
runner = rewriteIceTokens(runner);
runner = runner.replace(
  /\/\*\* Autopilot[^\n]*/,
  "/** Autopilot Bet365 — 24D Spin Cruzamento 2F (3426) · 2×4. */",
);
runner = runner.replace(
  /tableId: SinglestakeBet36524d2f\?\.BET36524D2F_TABLE_ID \?\? 201/,
  "tableId: SinglestakeBet36524d2f?.BET36524D2F_TABLE_ID ?? 3426",
);
runner = runner.replace(
  /mesaUrl:\s*\n\s*SinglestakeBet36524d2f\?\.BET36524D2F_MESA_URL \?\?\n\s*"[^"]*"/,
  'mesaUrl:\n    SinglestakeBet36524d2f?.BET36524D2F_MESA_URL ??\n    "https://casino.bet365.bet.br/play/24DSpin"',
);
runner = runner.replace(
  /const legacyWrong =[\s\S]*?;/,
  `const legacyWrong =
    stored.tableId === 201 ||
    stored.tableId === 230 ||
    stored.tableId === 227 ||
    (typeof stored.mesaUrl === "string" &&
      (stored.mesaUrl.includes("ice.bet") ||
        stored.mesaUrl.includes("kto.bet") ||
        stored.mesaUrl.includes("roulette")));`,
);
fs.writeFileSync(path.join(outDir, "bet36524d2f-signal-runner.js"), runner);

let bg = fs.readFileSync(path.join(srcDir, "background.js"), "utf8");
bg = rewriteIceTokens(bg);
bg = bg.replace(
  /function isBet36524d2fGameUrl\(url\) \{[\s\S]*?\n\}/,
  `function isBet36524d2fGameUrl(url) {
  if (!url) return false;
  if (/pragmaticplaylive\\.net/i.test(url)) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "casino.bet365.bet.br" || host.endsWith(".bet365.bet.br") || host.endsWith(".bet365.com")) {
      return /24dspin|24d.?spin|3426/i.test(u.pathname + u.search + u.hash) || /play\\/24DSpin/i.test(url);
    }
    return false;
  } catch {
    return /bet365.*24DSpin|24d.?spin/i.test(url);
  }
}`,
);
bg = bg.replace(
  /https:\/\/ice\.bet\.br\/games\/tag\/roulette\/liveroulettea-pragmaticexternal/g,
  "https://casino.bet365.bet.br/play/24DSpin",
);
bg = bg.replace(
  /Nenhuma aba ICE encontrada[\s\S]*?"/,
  'Nenhuma aba Bet365 24D encontrada. Abra casino.bet365.bet.br/play/24DSpin num separador normal do Chrome."',
);
bg = bg.replace(
  /context\.signalId\.startsWith\("ice2f:"\)/,
  'context.signalId.startsWith("bet36524d2f:") ||\n    context.signalId.startsWith("ice2f:")',
);
bg = bg.replace(
  /host === "ice\.bet\.br" \|\| host\.endsWith\("\.ice\.bet\.br"\)/g,
  'host === "casino.bet365.bet.br" || host.endsWith(".bet365.bet.br") || host.endsWith(".bet365.com")',
);
fs.writeFileSync(path.join(outDir, "background.js"), bg);

let panel = fs.readFileSync(path.join(srcDir, "content-ice2f-panel.js"), "utf8");
panel = rewriteIceTokens(panel);
panel = panel.replaceAll("ss-ice2f", "ss-bet36524d2f");
panel = panel.replaceAll("ICE Cruzamento 2F", "Bet365 24D Cruzamento 2F");
panel = panel.replaceAll("ICE 2F", "24D 2F");
fs.writeFileSync(path.join(outDir, "content-bet36524d2f-panel.js"), panel);

popupHtml = popupHtml
  .replaceAll("ICE Cruzamento 2F", "Bet365 24D Cruzamento 2F")
  .replaceAll("ICE 2F", "24D 2F")
  .replaceAll("ice2f", "bet36524d2f")
  .replaceAll("mesa 201", "mesa 3426")
  .replace(
    /Painel flutuante[\s\S]*?<\/p>/,
    "Painel externo: clique no ícone da extensão na barra do Chrome (janela que fica aberta).\n    </p>",
  );
fs.writeFileSync(path.join(outDir, "popup.html"), popupHtml);

let popup = fs.readFileSync(path.join(srcDir, "popup.js"), "utf8");
popup = rewriteIceTokens(popup);
popup = popup
  .replaceAll("ICE Cruzamento 2F", "Bet365 24D 2F")
  .replaceAll("ICE 2F", "24D 2F")
  .replaceAll('getElementById("ice2f', 'getElementById("bet36524d2f')
  .replaceAll("ice2fConfigStatus", "bet36524d2fConfigStatus")
  .replaceAll("status?.ice2fAutopilot", "status?.bet36524d2fAutopilot")
  .replaceAll("status?.ice2fConfig", "status?.bet36524d2fConfig")
  .replaceAll("ice2fConfig ??", "bet36524d2fConfig ??");
fs.writeFileSync(path.join(outDir, "popup.js"), popup);

let entry = fs.readFileSync(path.join(srcDir, "ice2f-strategy-entry.ts"), "utf8");
entry = entry
  .replace(
    'from "../src/lib/roulette/iceCruzamento2fStrategy"',
    'from "../src/lib/roulette/spin24dCruzamento2fStrategy"',
  )
  .replace(
    'import { doisFatoresFactorLabel } from "../src/lib/roulette/doisFatoresStrategy";',
    'import { spin24dFactorLabel } from "../src/lib/roulette/spin24dFactors";',
  )
  .replaceAll("doisFatoresFactorLabel", "spin24dFactorLabel")
  .replaceAll("createIce2fEngine", "createBet36524d2fEngine")
  .replaceAll("ICE2F_", "BET36524D2F_")
  .replaceAll("SinglestakeIce2f", "SinglestakeBet36524d2f")
  .replaceAll("ice2fcruzamento", "bet36524d2fcruzamento")
  .replaceAll("`ice2f:", "`bet36524d2f:")
  .replaceAll("ICE 2F", "24D 2F")
  .replace(
    "Bundle entry — motor ICE Cruzamento 2F para extensão Chrome.",
    "Bundle entry — motor Bet365 24D Spin Cruzamento 2F (mesa 3426).",
  );
fs.writeFileSync(path.join(outDir, "bet36524d2f-strategy-entry.ts"), entry);

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(
    {
      manifest_version: 3,
      name: "stake37 — Bet365 24D Cruzamento 2F",
      version: VERSION,
      description:
        "24D Spin · gatilho 2×4 · painel externo · mesa não fecha sozinha.",
      permissions: ["tabs", "storage", "scripting", "debugger", "windows"],
      host_permissions: [
        "https://casino.bet365.bet.br/*",
        "https://*.bet365.bet.br/*",
        "https://*.bet365.com/*",
        "https://*.pragmaticplaylive.net/*",
        "https://*.pragmaticplay.net/*",
      ],
      background: { service_worker: "background.js" },
      content_scripts: [
        {
          matches: [
            "https://casino.bet365.bet.br/*",
            "https://*.bet365.bet.br/*",
            "https://*.bet365.com/*",
          ],
          js: ["content-casino.js"],
          all_frames: true,
          run_at: "document_idle",
        },
        {
          matches: [
            "https://*.pragmaticplaylive.net/*",
            "https://*.pragmaticplay.net/*",
          ],
          js: ["content-casino.js", "calibration-relay.js"],
          all_frames: true,
          run_at: "document_idle",
        },
      ],
      action: {
        default_title: "stake37 Bet365 24D 2F Cruzamento",
      },
    },
    null,
    2,
  ) + "\n",
);

fs.writeFileSync(
  path.join(outDir, "README.md"),
  `# stake37 — Bet365 24D Spin Cruzamento 2F

Extensão Chrome para **bet365** · jogo Pragmatic **24D Spin** (mesa DGA **3426**).

URL: https://casino.bet365.bet.br/play/24DSpin

## Estratégia

Mesmo conceito da Cruzamento 2F (roleta), adaptado a **1–24**:

| Item | 24D Spin |
|------|----------|
| Gatilho | **2×4** (posições newest-first) |
| Vermelho | 1–4, 9–12, 17–20 |
| Preto | 5–8, 13–16, 21–24 |
| Baixo | **1–12** |
| Alto | **13–24** |
| Espera clique | **6s** (entrada / gale / pós-empate) |
| Gales | até **8** |

## Build

\`\`\`bash
npm run extension:bet36524d2f:setup
npm run extension:bet36524d2f:build
\`\`\`

Chrome → \`chrome://extensions\` → Carregar \`extension-bet365-24d-cruzamento-2f/\`
`,
);

const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.scripts = pkg.scripts || {};
pkg.scripts["extension:bet36524d2f:setup"] =
  "node scripts/setup-extension-bet365-24d-cruzamento-2f.mjs";
pkg.scripts["extension:bet36524d2f:build"] =
  "npx --yes esbuild extension-bet365-24d-cruzamento-2f/bet36524d2f-strategy-entry.ts --bundle --format=iife --global-name=SinglestakeBet36524d2f --outfile=extension-bet365-24d-cruzamento-2f/bet36524d2f-engine.js --platform=browser --target=chrome110 --alias:@=./src";
pkg.scripts["test:spin24d-cruzamento-2f"] =
  "npx --yes tsx scripts/test-spin24d-cruzamento-2f.ts";
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log("→ npm run extension:bet36524d2f:build");
execSync("npm run extension:bet36524d2f:build", { cwd: root, stdio: "inherit" });
console.log("✓ extension-bet365-24d-cruzamento-2f pronta (v" + VERSION + ")");
