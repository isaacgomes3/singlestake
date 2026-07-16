/**
 * Gera extensões 24D Cruzamento 2F para todos os sites (a partir da Bet365 24D).
 * Mesa DGA: 3426 · estratégia: spin24dCruzamento2fStrategy · espera clique 9,5s.
 *
 * Uso: node scripts/sync-all-24d-cruzamento-2f-from-bet365.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "extension-bet365-24d-cruzamento-2f");
const VERSION = "1.0.9";
const DESCRIPTION =
  "24D Spin · 9,5s · limpa indicação no resultado · gatilho 2×4 · mesa 3426.";
const TABLE_ID = 3426;

/**
 * @typedef {{
 *   dir: string,
 *   filePrefix: string,
 *   Pascal: string,
 *   brandTitle: string,
 *   mesaUrl: string,
 *   hosts: [string, string],
 *   hostnameRe: string,
 *   isHostBody: string,
 *   isGamePathBody: string,
 *   panelPathBody: string,
 *   gameLabel: string,
 *   npmBuild: string,
 *   strategy: string,
 *   signalPrefix: string,
 *   calibKey: string,
 *   hostPermissions?: string[],
 *   extraMatches?: string[],
 * }} Site24d
 */

/** @type {Site24d[]} */
const SITES = [
  {
    dir: "extension-ice-24d-cruzamento-2f",
    filePrefix: "ice24d2f",
    Pascal: "Ice24d2f",
    brandTitle: "ICE",
    mesaUrl: "https://ice.bet.br/games/tag/game-shows/24dspin-pragmaticexternal",
    hosts: ["www.ice.bet.br", "ice.bet.br"],
    hostnameRe: String.raw`ice\.bet\.br`,
    isHostBody: `return host === "ice.bet.br" || host.endsWith(".ice.bet.br");`,
    isGamePathBody: `return /24d[-_]?spin|24dspin|3426/i.test(path) || /\\/play\\/pragmatic\\/24d/i.test(path) || /\\/games\\/tag\\/.*24d/i.test(path);`,
    panelPathBody: `return /24d[-_]?spin|24dspin|3426/i.test(path) || /\\/play\\/pragmatic\\/24d/i.test(path) || /24d|pragmatic|games/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:ice24d2f:build",
    strategy: "ice24d2fcruzamento",
    signalPrefix: "ice24d2f:",
    calibKey: "ice.bet.br|pragmatic-24d-spin",
  },
  {
    dir: "extension-kto-24d-cruzamento-2f",
    filePrefix: "kto24d2f",
    Pascal: "Kto24d2f",
    brandTitle: "KTO",
    mesaUrl: "https://www.kto.bet.br/app/cassino/game/24d-spin/",
    hosts: ["www.kto.bet.br", "kto.bet.br"],
    hostnameRe: String.raw`kto\.bet\.br`,
    isHostBody: `return host === "kto.bet.br" || host.endsWith(".kto.bet.br");`,
    isGamePathBody: `return /\\/app\\/cassino\\/game\\/(24d[-_]?spin|24dspin)/i.test(path) || /24d[-_]?spin|24dspin|3426/i.test(path);`,
    panelPathBody: `return /24d[-_]?spin|24dspin|3426/i.test(path) || /24d|pragmatic|cassino|casino/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:kto24d2f:build",
    strategy: "kto24d2fcruzamento",
    signalPrefix: "kto24d2f:",
    calibKey: "kto.bet.br|pragmatic-24d-spin",
  },
  {
    dir: "extension-goldebet-24d-cruzamento-2f",
    filePrefix: "golde24d2f",
    Pascal: "Golde24d2f",
    brandTitle: "GoldeBet",
    mesaUrl: "https://goldebet.bet.br/play/pragmatic/24d-spin",
    hosts: ["www.goldebet.bet.br", "goldebet.bet.br"],
    hostnameRe: String.raw`goldebet\.bet\.br`,
    isHostBody: `return host === "goldebet.bet.br" || host.endsWith(".goldebet.bet.br");`,
    isGamePathBody: `return /\\/play\\/pragmatic\\/24d[-_]?spin(?:\\/|$|\\?|#)/i.test(path) || /24d[-_]?spin|24dspin|3426/i.test(path);`,
    panelPathBody: `return /\\/play\\/pragmatic\\/24d/i.test(path) || /24d|3426|pragmatic|casino/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:golde24d2f:build",
    strategy: "golde24d2fcruzamento",
    signalPrefix: "golde24d2f:",
    calibKey: "goldebet.bet.br|pragmatic-24d-spin",
  },
  {
    dir: "extension-betnacional-24d-cruzamento-2f",
    filePrefix: "bn24d2f",
    Pascal: "Bn24d2f",
    brandTitle: "Bet Nacional",
    mesaUrl: "https://betnacional.bet.br/casino/game/",
    hosts: ["www.betnacional.bet.br", "betnacional.bet.br"],
    hostnameRe: String.raw`betnacional\.bet\.br`,
    isHostBody: `return host === "betnacional.bet.br" || host.endsWith(".betnacional.bet.br");`,
    isGamePathBody: `return /\\/casino\\/game\\//i.test(path) && /24d|3426/i.test(path + url);`,
    panelPathBody: `return /\\/casino\\/game\\//i.test(path) || /24d|3426|pragmatic|casino/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:bn24d2f:build",
    strategy: "bn24d2fcruzamento",
    signalPrefix: "bn24d2f:",
    calibKey: "betnacional.bet.br|pragmatic-24d-spin",
  },
  {
    dir: "extension-lotogreen-24d-cruzamento-2f",
    filePrefix: "loto24d2f",
    Pascal: "Loto24d2f",
    brandTitle: "Lotogreen",
    mesaUrl: "https://lotogreen.bet.br/play/pragmatic/24d-spin",
    hosts: ["www.lotogreen.bet.br", "lotogreen.bet.br"],
    hostnameRe: String.raw`lotogreen\.bet\.br`,
    isHostBody: `return host === "lotogreen.bet.br" || host.endsWith(".lotogreen.bet.br");`,
    isGamePathBody: `return /\\/play\\/pragmatic\\/24d[-_]?spin/i.test(path) || /24d[-_]?spin|24dspin|3426/i.test(path);`,
    panelPathBody: `return /\\/play\\/pragmatic\\/24d/i.test(path) || /24d|3426|pragmatic|casino/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:loto24d2f:build",
    strategy: "loto24d2fcruzamento",
    signalPrefix: "loto24d2f:",
    calibKey: "lotogreen.bet.br|pragmatic-24d-spin",
  },
  {
    dir: "extension-reals-24d-cruzamento-2f",
    filePrefix: "reals24d2f",
    Pascal: "Reals24d2f",
    brandTitle: "Reals",
    mesaUrl:
      "https://reals.bet.br/play/liveCassino/3426?title=24D+Spin&provider=pragmatic&gameId=%223426%22&category=live",
    hosts: ["www.reals.bet.br", "reals.bet.br"],
    hostnameRe: String.raw`reals\.bet\.br`,
    isHostBody: `return host === "reals.bet.br" || host.endsWith(".reals.bet.br");`,
    isGamePathBody: `return /\\/play\\/liveCassino\\/3426/i.test(path) || /24d.?spin|3426/i.test(path);`,
    panelPathBody: `return /\\/play\\/liveCassino\\/3426/i.test(path) || /24d|3426|pragmatic|live|casino/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:reals24d2f:build",
    strategy: "reals24d2fcruzamento",
    signalPrefix: "reals24d2f:",
    calibKey: "reals.bet.br|pragmatic-24d-spin",
  },
  {
    dir: "extension-sportingbet-24d-cruzamento-2f",
    filePrefix: "sportingbet24d2f",
    Pascal: "Sportingbet24d2f",
    brandTitle: "Sportingbet",
    mesaUrl: "https://br4.bet.br/play/pragmatic/24d-spin",
    hosts: ["www.sportingbet.bet.br", "sportingbet.bet.br"],
    hostnameRe: String.raw`sportingbet\.bet\.br`,
    isHostBody: `return host === "sportingbet.bet.br" || host.endsWith(".sportingbet.bet.br") || host.endsWith(".br4.bet.br");`,
    isGamePathBody: `return /24d[-_]?spin|24dspin|3426/i.test(path) || /\\/play\\/pragmatic\\/24d/i.test(path);`,
    panelPathBody: `return /24d|3426|pragmatic|casino|live/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:sportingbet24d2f:build",
    strategy: "sportingbet24d2fcruzamento",
    signalPrefix: "sportingbet24d2f:",
    calibKey: "sportingbet.bet.br|pragmatic-24d-spin",
    hostPermissions: ["https://*.br4.bet.br/*"],
    extraMatches: ["https://*.br4.bet.br/*"],
  },
  {
    dir: "extension-ultra-24d-cruzamento-2f",
    filePrefix: "ultra24d2f",
    Pascal: "Ultra24d2f",
    brandTitle: "Ultra",
    mesaUrl: "https://ultra.bet.br/",
    hosts: ["www.ultra.bet.br", "ultra.bet.br"],
    hostnameRe: String.raw`ultra\.bet\.br`,
    isHostBody: `return host === "ultra.bet.br" || host.endsWith(".ultra.bet.br");`,
    isGamePathBody: `return /\\/jogo\\/\\d+\\/pragmatic-play-live\\/24d[-_]?spin/i.test(path) || /24d[-_]?spin|24dspin|3426/i.test(path);`,
    panelPathBody: `return /24d[-_]?spin|3426/i.test(path) || /24d|pragmatic|jogo|casino|live/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:ultra24d2f:build",
    strategy: "ultra24d2fcruzamento",
    signalPrefix: "ultra24d2f:",
    calibKey: "ultra.bet.br|pragmatic-24d-spin",
  },
  {
    dir: "extension-brazino777-24d-cruzamento-2f",
    filePrefix: "brazino24d2f",
    Pascal: "Brazino24d2f",
    brandTitle: "Brazino777",
    mesaUrl: "https://www.brazino777.bet.br/game/24d_spin_pr",
    hosts: ["www.brazino777.bet.br", "brazino777.bet.br"],
    hostnameRe: String.raw`brazino777\.bet\.br`,
    isHostBody: `return host === "brazino777.bet.br" || host.endsWith(".brazino777.bet.br");`,
    isGamePathBody: `return /\\/game\\/24d[_-]?spin/i.test(path) || /24d[-_]?spin|24dspin|3426/i.test(path);`,
    panelPathBody: `return /\\/game\\/24d/i.test(path) || /24d|3426|pragmatic|game|casino|live/i.test(path);`,
    gameLabel: "24D Spin",
    npmBuild: "extension:brazino24d2f:build",
    strategy: "brazino24d2fcruzamento",
    signalPrefix: "brazino24d2f:",
    calibKey: "brazino777.bet.br|pragmatic-24d-spin",
  },
];

const SKIP = new Set([
  "bet36524d2f-engine.js",
  "manifest.json",
  "README.md",
]);

const RENAME = {
  "bet36524d2f-strategy-entry.ts": (p) => `${p}-strategy-entry.ts`,
  "bet36524d2f-signal-runner.js": (p) => `${p}-signal-runner.js`,
  "content-bet36524d2f-panel.js": (p) => `content-${p}-panel.js`,
};

/** @param {string} content @param {Site24d} site */
function rewriteTokens(content, site) {
  const { Pascal, filePrefix, brandTitle, strategy, signalPrefix, npmBuild } = site;
  const UPPER = Pascal.toUpperCase();
  let c = content;

  const ordered = [
    ["SinglestakeBet36524d2fSignalRunner", `Singlestake${Pascal}SignalRunner`],
    ["__singlestakeBet36524d2fBridgeHandler", `__singlestake${Pascal}BridgeHandler`],
    ["SinglestakeBet36524d2f", `Singlestake${Pascal}`],
    ["createBet36524d2fEngine", `create${Pascal}Engine`],
    ["STORAGE_BET36524D2F_", `STORAGE_${UPPER}_`],
    ["gogBet36524d2f", `gog${Pascal}`],
    ["BET36524D2F_DEFAULTS", `${UPPER}_DEFAULTS`],
    ["readBet36524d2fAutopilotEnabled", `read${Pascal}AutopilotEnabled`],
    ["readBet36524d2fMachineState", `read${Pascal}MachineState`],
    ["readBet36524d2fConfig", `read${Pascal}Config`],
    ["readBet36524d2fStats", `read${Pascal}Stats`],
    ["persistBet36524d2fMachineState", `persist${Pascal}MachineState`],
    ["persistBet36524d2fStats", `persist${Pascal}Stats`],
    ["clearBet36524d2fMachineState", `clear${Pascal}MachineState`],
    ["writeBet36524d2fStatus", `write${Pascal}Status`],
    ["writeIndicationStatus", `write${Pascal}IndicationStatus`],
    ["idleIndicationPatch", `${filePrefix}IdleIndicationPatch`],
    ["bumpIndicationEpoch", `bump${Pascal}IndicationEpoch`],
    ["ensureBet36524d2fPanel", `ensure${Pascal}Panel`],
    ["isBet36524d2fGameUrl", `is${Pascal}GameUrl`],
    ["openOrFocusBet36524d2fPanel", `openOrFocus${Pascal}Panel`],
    ["bet36524d2fPanelWindowId", `${filePrefix}PanelWindowId`],
    ["isBet36524d2fSignal", `is${Pascal}Signal`],
    ["isBet36524d2fCrossingContext", `is${Pascal}CrossingContext`],
    ["pageIsBet36524dSpin", `pageIs${Pascal}Game`],
    ["isBet36524d2fHost", `is${Pascal}Host`],
    ["pageIsBet36524d2f", `pageIs${Pascal}`],
    ["bet36524d2fAutopilot", `${filePrefix}Autopilot`],
    ["bet36524d2fConfig", `${filePrefix}Config`],
    ["setBet36524d2fAutopilotEnabled", `set${Pascal}AutopilotEnabled`],
    ["getBet36524d2fAutopilotStatus", `get${Pascal}AutopilotStatus`],
    ["resetBet36524d2fStats", `reset${Pascal}Stats`],
    ["getBet36524d2fConfigForPopup", `get${Pascal}ConfigForPopup`],
    ["setBet36524d2fConfigFromPopup", `set${Pascal}ConfigFromPopup`],
    ["initBet36524d2fSignalRunner", `init${Pascal}SignalRunner`],
    ["startBet36524d2fAutopilot", `start${Pascal}Autopilot`],
    ["stopBet36524d2fAutopilot", `stop${Pascal}Autopilot`],
    ["bet36524d2f-panel-ping", `${filePrefix}-panel-ping`],
    ["bet36524d2f-engine.js", `${filePrefix}-engine.js`],
    ["bet36524d2f-signal-runner.js", `${filePrefix}-signal-runner.js`],
    ["content-bet36524d2f-panel.js", `content-${filePrefix}-panel.js`],
    ["bet36524d2f-strategy-entry.ts", `${filePrefix}-strategy-entry.ts`],
    ["extension:bet36524d2f:build", npmBuild],
    ["BET36524D2F_TABLE_ID", `${UPPER}_TABLE_ID`],
    ["BET36524D2F_MESA_URL", `${UPPER}_MESA_URL`],
    ["BET36524D2F_MAX_GALES", `${UPPER}_MAX_GALES`],
    ["BET36524D2F_POSITIONS", `${UPPER}_POSITIONS`],
    ["BET36524D2F_AXES", `${UPPER}_AXES`],
    ["BET36524D2F_PAIR_IDS", `${UPPER}_PAIR_IDS`],
    ["BET36524D2F_FACTOR_BRIDGE_STAGGER_MS", `${UPPER}_FACTOR_BRIDGE_STAGGER_MS`],
    ["BET36524D2F_DOUBLE_CLICK_STAGGER_MS", `${UPPER}_DOUBLE_CLICK_STAGGER_MS`],
    ["BET36524D_CALIB_SITE_KEY", `${UPPER}_CALIB_SITE_KEY`],
    ["bet36524d2fcruzamento", strategy],
    ["`bet36524d2f:", `\`${signalPrefix}`],
    ['"bet36524d2f:', `"${signalPrefix}`],
    ["ss-bet36524d2f", `ss-${filePrefix}`],
    ["Bet365 24D Cruzamento 2F", `${brandTitle} 24D Cruzamento 2F`],
    ["Bet365 24D 2F", `${brandTitle} 24D 2F`],
    ["Bet365 24D", `${brandTitle} 24D`],
    ["autopilot Bet365 24D 2F", `autopilot ${brandTitle} 24D 2F`],
    ["/** Autopilot Bet365", `/** Autopilot ${brandTitle}`],
    ["Autopilot Bet365", `Autopilot ${brandTitle}`],
    ["stake37 — Bet365", `stake37 — ${brandTitle}`],
    ["stake37 · Bet365", `stake37 · ${brandTitle}`],
    ["stake37 Bet365", `stake37 ${brandTitle}`],
    ["motor Bet365 24D", `motor ${brandTitle} 24D`],
    // prefixes genéricos no fim
    ["BET36524D2F_", `${UPPER}_`],
    ["Bet36524d2f", Pascal],
    ["bet36524d2f", filePrefix],
  ];

  for (const [from, to] of ordered) c = c.replaceAll(from, to);

  // URLs Bet365 → site
  c = c.replaceAll(
    "https://casino.bet365.bet.br/play/24DSpin",
    site.mesaUrl || `https://${site.hosts[1]}/`,
  );
  c = c.replaceAll("https://casino.bet365.bet.br/", `https://${site.hosts[1]}/`);
  c = c.replaceAll("casino.bet365.bet.br", site.hosts[1]);
  c = c.replaceAll("*.bet365.bet.br", `*.${site.hosts[1]}`);
  c = c.replaceAll("*.bet365.com", `*.${site.hosts[1]}`);
  c = c.replaceAll("bet365.bet.br|pragmatic-24d-spin", site.calibKey);
  c = c.replaceAll("bet365.bet.br", site.hosts[1]);
  c = c.replaceAll("bet365.com", site.hosts[1]);

  c = c.replace(
    new RegExp(`${UPPER}_CALIB_SITE_KEY = "[^"]+"`),
    `${UPPER}_CALIB_SITE_KEY = "${site.calibKey}"`,
  );

  // Painel: host gate (Bet365 usa casino.bet365 + bet365.com)
  c = c.replace(
    /host === "[^"]+" \|\|\s*\n\s*host\.endsWith\("\.[^"]+"\) \|\|\s*\n\s*host\.endsWith\("\.[^"]+"\)/,
    (() => {
      const body = site.isHostBody.replace(/^return /, "").replace(/;$/, "");
      // Expand into multi-line if it's or-expressions
      return body.replace(/ \|\| /g, " ||\n      ");
    })(),
  );

  // Detecção de URL do jogo
  c = c.replace(
    new RegExp(`function is${Pascal}GameUrl\\(url\\) \\{[\\s\\S]*?\\n\\}`),
    `function is${Pascal}GameUrl(url) {
  if (!url) return false;
  if (/pragmaticplaylive\\.net/i.test(url)) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname + u.search + u.hash;
    if (!(${site.isHostBody.replace(/^return /, "").replace(/;$/, "")})) return false;
    ${site.isGamePathBody}
  } catch {
    return /24d[-_]?spin|24dspin|3426/i.test(url);
  }
}`,
  );

  // Host helper no background/panel
  c = c.replace(
    new RegExp(`function is${Pascal}Host\\(url\\) \\{[\\s\\S]*?\\n\\}`),
    `function is${Pascal}Host(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    ${site.isHostBody}
  } catch {
    return false;
  }
}`,
  );

  // Panel path gate
  c = c.replace(
    /return \/24dspin\|24d\.\?spin\|3426\/i\.test\(path\)[\s\S]*?;/,
    site.panelPathBody,
  );
  c = c.replace(
    /return \/roulette\|liveroulette\|pragmatic\/i\.test\(path\);/,
    site.panelPathBody,
  );

  // Mensagem “nenhuma aba”
  c = c.replace(
    /Nenhuma aba [^"]+encontrada[^"]*"/,
    `Nenhuma aba ${brandTitle} 24D encontrada. Abra o 24D Spin (${site.hosts[1]}) num separador normal do Chrome."`,
  );

  // Strategy entry — fix MESA_URL export override
  if (c.includes(`${UPPER}_MESA_URL = ICE_2F_ROULETTE_MESA_URL`)) {
    c = c.replace(
      `${UPPER}_MESA_URL = ICE_2F_ROULETTE_MESA_URL`,
      `${UPPER}_MESA_URL = ${JSON.stringify(site.mesaUrl)}`,
    );
  }

  return c;
}

/** @param {Site24d} site */
function writeManifest(site) {
  const matchesCasino = [
    `https://${site.hosts[0]}/*`,
    `https://${site.hosts[1]}/*`,
    ...(site.extraMatches ?? []),
  ];
  const hostPerms = [
    ...matchesCasino,
    ...(site.hostPermissions ?? []),
    "https://*.pragmaticplaylive.net/*",
    "https://*.pragmaticplay.net/*",
  ];
  const uniq = [...new Set(hostPerms)];

  return (
    JSON.stringify(
      {
        manifest_version: 3,
        name: `stake37 — ${site.brandTitle} 24D Cruzamento 2F`,
        version: VERSION,
        description: DESCRIPTION,
        permissions: ["tabs", "storage", "scripting", "debugger", "windows"],
        host_permissions: uniq,
        background: { service_worker: "background.js" },
        content_scripts: [
          {
            matches: matchesCasino,
            js: ["content-casino.js", `content-${site.filePrefix}-panel.js`],
            all_frames: false,
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
          default_title: `stake37 ${site.brandTitle} 24D 2F — clica para abrir painel`,
        },
      },
      null,
      2,
    ) + "\n"
  );
}

/** @param {Site24d} site */
function writeReadme(site) {
  return `# stake37 — ${site.brandTitle} 24D Spin Cruzamento 2F

Extensão Chrome para **${site.brandTitle}** · Pragmatic **24D Spin** (mesa DGA **${TABLE_ID}**).

URL sugerida: ${site.mesaUrl || "(abrir 24D Spin no lobby)"}

> A detecção aceita qualquer path com \`24d-spin\` / \`24DSpin\` / \`3426\` no host ${site.hosts[1]}.
> Se a URL exacta do lobby for diferente, actualiza \`mesaUrl\` no popup/config ou no sync.

## Estratégia

Idêntica à Bet365 24D:

| Item | Valor |
|------|-------|
| Gatilho | **2×4** |
| Números | **1–24** |
| Espera clique | **9,5s** |
| Gales | até **8** |
| Liquidar | não rearma no mesmo giro (anti indicação fantasma) |

## Build

\`\`\`bash
npm run extension:24d2f:sync
npm run ${site.npmBuild}
\`\`\`

Chrome → \`chrome://extensions\` → Carregar \`${site.dir}/\`
`;
}

function syncSite(site) {
  const outDir = path.join(root, site.dir);
  fs.mkdirSync(outDir, { recursive: true });

  const names = fs.readdirSync(srcDir);
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const srcPath = path.join(srcDir, name);
    if (!fs.statSync(srcPath).isFile()) continue;

    let content = fs.readFileSync(srcPath, "utf8");
    content = rewriteTokens(content, site);

    const outName = RENAME[name] ? RENAME[name](site.filePrefix) : name;
    fs.writeFileSync(path.join(outDir, outName), content);
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), writeManifest(site));
  fs.writeFileSync(path.join(outDir, "README.md"), writeReadme(site));

  const buildCmd = `npx --yes esbuild ${site.dir}/${site.filePrefix}-strategy-entry.ts --bundle --format=iife --global-name=Singlestake${site.Pascal} --outfile=${site.dir}/${site.filePrefix}-engine.js --platform=browser --target=chrome110 --alias:@=./src`;
  console.log(`→ build ${site.dir}`);
  execSync(buildCmd, { cwd: root, stdio: "inherit" });
  console.log(`✓ ${site.dir} v${VERSION}`);
}

function updatePackageJson() {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts["extension:24d2f:sync"] =
    "node scripts/sync-all-24d-cruzamento-2f-from-bet365.mjs";
  const buildAll = [];
  for (const site of SITES) {
    pkg.scripts[site.npmBuild] =
      `npx --yes esbuild ${site.dir}/${site.filePrefix}-strategy-entry.ts --bundle --format=iife --global-name=Singlestake${site.Pascal} --outfile=${site.dir}/${site.filePrefix}-engine.js --platform=browser --target=chrome110 --alias:@=./src`;
    buildAll.push(`npm run ${site.npmBuild}`);
  }
  buildAll.unshift("npm run extension:bet36524d2f:build");
  pkg.scripts["extension:24d2f:build:all"] = buildAll.join(" && ");
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

if (!fs.existsSync(srcDir)) {
  console.error("Falta extension-bet365-24d-cruzamento-2f — corre setup/build da Bet365 primeiro.");
  process.exit(1);
}

console.log(`Sync 24D 2F a partir de Bet365 → ${SITES.length} sites (v${VERSION})`);
for (const site of SITES) {
  syncSite(site);
}
updatePackageJson();
console.log("✓ package.json actualizado (extension:24d2f:sync / extension:24d2f:build:all)");
console.log("Pronto. Bet365 mantém-se em extension-bet365-24d-cruzamento-2f/");
