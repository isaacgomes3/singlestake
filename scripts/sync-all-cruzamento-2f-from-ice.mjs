/**
 * Sincroniza extensões Cruzamento 2F a partir da ICE actual.
 * Estratégia única: iceCruzamento2fStrategy (3×6 · 2×4).
 * Mantém só hosts / mesa / tableId / branding por site.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(root, "extension-ice-cruzamento-2f");
const VERSION = "1.2.6";
const DESCRIPTION =
  "Gatilhos 3×6·2×4 — gráfico run-up/drawdown, sem gale, sem clique (observação).";

/**
 * @typedef {{
 *   dir: string,
 *   filePrefix: string,
 *   Pascal: string,
 *   brandTitle: string,
 *   tableId: number,
 *   mesaUrl: string,
 *   hosts: [string, string],
 *   hostnameRe: string,
 *   isHostBody: string,
 *   isRoulettePathBody: string,
 *   panelPathBody: string,
 *   gameLabel: string,
 *   npmBuild: string,
 *   strategy: string,
 *   signalPrefix: string,
 *   calibKey: string,
 *   hostPermissions?: string[],
 * }} SiteConfig
 */

/** @type {SiteConfig[]} */
const SITES = [
  {
    dir: "extension-kto-cruzamento-2f",
    filePrefix: "kto2f",
    Pascal: "Kto2f",
    brandTitle: "KTO",
    tableId: 230,
    mesaUrl: "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/",
    hosts: ["www.kto.bet.br", "kto.bet.br"],
    hostnameRe: String.raw`kto\.bet\.br`,
    isHostBody: `return host === "kto.bet.br" || host.endsWith(".kto.bet.br");`,
    isRoulettePathBody: `return /\\/app\\/cassino\\/game\\/(roulette-3-ppl|roleta-ao-vivo)/i.test(path);`,
    panelPathBody: `return /\\/app\\/cassino\\/game\\/(roulette-3-ppl|roleta-ao-vivo)/i.test(path) || /roulette|pragmatic|casino/i.test(path);`,
    gameLabel: "Roulette 3",
    npmBuild: "extension:kto2f:build",
    strategy: "kto2fcruzamento",
    signalPrefix: "kto2f:",
    calibKey: "kto.bet.br|pragmatic-roulette",
  },
  {
    dir: "extension-goldebet-cruzamento-2f",
    filePrefix: "golde2f",
    Pascal: "Golde2f",
    brandTitle: "GoldeBet",
    tableId: 230,
    mesaUrl: "https://goldebet.bet.br/play/pragmatic/roulette-3",
    hosts: ["www.goldebet.bet.br", "goldebet.bet.br"],
    hostnameRe: String.raw`goldebet\.bet\.br`,
    isHostBody: `return host === "goldebet.bet.br" || host.endsWith(".goldebet.bet.br");`,
    isRoulettePathBody: `return /\\/play\\/pragmatic\\/roulette-3(?:\\/|$|\\?|#)/i.test(path);`,
    panelPathBody: `return /\\/play\\/pragmatic\\/roulette-3/i.test(path) || /roulette|pragmatic|casino/i.test(path);`,
    gameLabel: "Roulette 3",
    npmBuild: "extension:golde2f:build",
    strategy: "golde2fcruzamento",
    signalPrefix: "golde2f:",
    calibKey: "goldebet.bet.br|pragmatic-roulette",
  },
  {
    dir: "extension-betnacional-cruzamento-2f",
    filePrefix: "bn2f",
    Pascal: "Bn2f",
    brandTitle: "Bet Nacional",
    tableId: 225,
    mesaUrl: "https://betnacional.bet.br/casino/game/225a54",
    hosts: ["www.betnacional.bet.br", "betnacional.bet.br"],
    hostnameRe: String.raw`betnacional\.bet\.br`,
    isHostBody: `return host === "betnacional.bet.br" || host.endsWith(".betnacional.bet.br");`,
    isRoulettePathBody: `return /\\/casino\\/game\\/225a54/i.test(path) || /225a54/i.test(url);`,
    panelPathBody: `return /\\/casino\\/game\\/225a54/i.test(path) || /roulette|pragmatic|casino|225a54/i.test(path);`,
    gameLabel: "Auto Roulette",
    npmBuild: "extension:bn2f:build",
    strategy: "bn2fcruzamento",
    signalPrefix: "bn2f:",
    calibKey: "betnacional.bet.br|pragmatic-roulette",
  },
  {
    dir: "extension-lotogreen-cruzamento-2f",
    filePrefix: "loto2f",
    Pascal: "Loto2f",
    brandTitle: "Lotogreen",
    tableId: 225,
    mesaUrl: "https://lotogreen.bet.br/play/pragmatic/auto-roulette",
    hosts: ["www.lotogreen.bet.br", "lotogreen.bet.br"],
    hostnameRe: String.raw`lotogreen\.bet\.br`,
    isHostBody: `return host === "lotogreen.bet.br" || host.endsWith(".lotogreen.bet.br");`,
    isRoulettePathBody: `return /\\/play\\/pragmatic\\/auto-roulette/i.test(path);`,
    panelPathBody: `return /\\/play\\/pragmatic\\/auto-roulette/i.test(path) || /roulette|pragmatic|casino/i.test(path);`,
    gameLabel: "Auto Roulette",
    npmBuild: "extension:loto2f:build",
    strategy: "loto2fcruzamento",
    signalPrefix: "loto2f:",
    calibKey: "lotogreen.bet.br|pragmatic-roulette",
  },
  {
    dir: "extension-reals-cruzamento-2f",
    filePrefix: "reals2f",
    Pascal: "Reals2f",
    brandTitle: "Reals",
    tableId: 237,
    mesaUrl:
      "https://reals.bet.br/play/liveCassino/237?title=Brazilian+Roulette&provider=pragmatic&gameId=%22237%22&category=live",
    hosts: ["www.reals.bet.br", "reals.bet.br"],
    hostnameRe: String.raw`reals\.bet\.br`,
    isHostBody: `return host === "reals.bet.br" || host.endsWith(".reals.bet.br");`,
    isRoulettePathBody: `return /\\/play\\/liveCassino\\/237/i.test(path) || /brazilian|roulette/i.test(path);`,
    panelPathBody: `return /\\/play\\/liveCassino\\/237/i.test(path) || /roulette|pragmatic|casino|live/i.test(path);`,
    gameLabel: "Brazilian Roulette",
    npmBuild: "extension:reals2f:build",
    strategy: "reals2fcruzamento",
    signalPrefix: "reals2f:",
    calibKey: "reals.bet.br|pragmatic-roulette",
  },
  {
    dir: "extension-sportingbet-cruzamento-2f",
    filePrefix: "sportingbet2f",
    Pascal: "Sportingbet2f",
    brandTitle: "Sportingbet",
    tableId: 227,
    mesaUrl: "",
    hosts: ["www.sportingbet.bet.br", "sportingbet.bet.br"],
    hostnameRe: String.raw`sportingbet\.bet\.br`,
    isHostBody: `return host === "sportingbet.bet.br" || host.endsWith(".sportingbet.bet.br") || host.endsWith(".br4.bet.br");`,
    isRoulettePathBody: `return /roulette|pragmatic|casino|live/i.test(path);`,
    panelPathBody: `return /roulette|pragmatic|casino|live/i.test(path);`,
    gameLabel: "Roulette 1",
    npmBuild: "extension:sportingbet2f:build",
    strategy: "sportingbet2fcruzamento",
    signalPrefix: "sportingbet2f:",
    calibKey: "sportingbet.bet.br|pragmatic-roulette",
    hostPermissions: ["https://*.br4.bet.br/*"],
  },
];

const COPY_AS_IS = new Set([
  "content-casino.js",
  "calibration-relay.js",
  "calibrate-bets.js",
  "exterior-bets.js",
  "dga-hub.js",
]);

const SKIP = new Set(["ice2f-engine.js", "manifest.json", "README.md"]);

/** @param {string} content @param {SiteConfig} site */
function rewriteExtensionShell(content, site) {
  const { Pascal, filePrefix, brandTitle, strategy, signalPrefix, npmBuild, tableId } =
    site;
  const UPPER = Pascal.toUpperCase();
  let c = content;

  const ordered = [
    ["SinglestakeIce2fSignalRunner", `Singlestake${Pascal}SignalRunner`],
    ["__singlestakeIce2fBridgeHandler", `__singlestake${Pascal}BridgeHandler`],
    ["SinglestakeIce2f", `Singlestake${Pascal}`],
    ["createIce2fEngine", `create${Pascal}Engine`],
    ["STORAGE_ICE2F_", `STORAGE_${UPPER}_`],
    ["gogIce2f", `gog${Pascal}`],
    ["ICE2F_DEFAULTS", `${UPPER}_DEFAULTS`],
    // Nomes completos — NÃO usar getIce2f/setIce2f (quebram getIce2fComparePairs da lib)
    ["readIce2fAutopilotEnabled", `read${Pascal}AutopilotEnabled`],
    ["readIce2fMachineState", `read${Pascal}MachineState`],
    ["readIce2fConfig", `read${Pascal}Config`],
    ["readIce2fStats", `read${Pascal}Stats`],
    ["persistIce2fMachineState", `persist${Pascal}MachineState`],
    ["persistIce2fStats", `persist${Pascal}Stats`],
    ["clearIce2fMachineState", `clear${Pascal}MachineState`],
    ["writeIce2fStatus", `write${Pascal}Status`],
    ["ensureIce2fPanel", `ensure${Pascal}Panel`],
    ["isIce2fRoulettePageUrl", `is${Pascal}RoulettePageUrl`],
    ["openOrFocusIce2fPanel", `openOrFocus${Pascal}Panel`],
    ["ice2fPanelWindowId", `${filePrefix}PanelWindowId`],
    ["isIce2fSignal", `is${Pascal}Signal`],
    ["isIce2fCrossingContext", `is${Pascal}CrossingContext`],
    ["isIceHost", `is${Pascal}Host`],
    ["pageIsIce2fRoulette", `pageIs${Pascal}Roulette`],
    ["ice2fAutopilot", `${filePrefix}Autopilot`],
    ["ice2fConfig", `${filePrefix}Config`],
    ["setIce2fAutopilotEnabled", `set${Pascal}AutopilotEnabled`],
    ["getIce2fAutopilotStatus", `get${Pascal}AutopilotStatus`],
    ["resetIce2fStats", `reset${Pascal}Stats`],
    ["getIce2fConfigForPopup", `get${Pascal}ConfigForPopup`],
    ["setIce2fConfigFromPopup", `set${Pascal}ConfigFromPopup`],
    ["initIce2fSignalRunner", `init${Pascal}SignalRunner`],
    ["startIce2fAutopilot", `start${Pascal}Autopilot`],
    ["stopIce2fAutopilot", `stop${Pascal}Autopilot`],
    ["Ice2fPersistedMachine", `${Pascal}PersistedMachine`],
    ["CreateIce2fEngineOptions", `Create${Pascal}EngineOptions`],
    ["Ice2fEngineSpinResult", `${Pascal}EngineSpinResult`],
    ["ice2f-panel-ping", `${filePrefix}-panel-ping`],
    ["ice2f-engine.js", `${filePrefix}-engine.js`],
    ["ice2f-signal-runner.js", `${filePrefix}-signal-runner.js`],
    ["content-ice2f-panel.js", `content-${filePrefix}-panel.js`],
    ["extension:ice2f:build", npmBuild],
    ["ICE2F_TABLE_ID", `${UPPER}_TABLE_ID`],
    ["ICE2F_MESA_URL", `${UPPER}_MESA_URL`],
    ["ICE2F_MAX_GALES", `${UPPER}_MAX_GALES`],
    ["ICE2F_DEFAULT_TABLE_ID", `${UPPER}_DEFAULT_TABLE_ID`],
    ["ICE2F_GALE3_REFERENCE_UNITS", `${UPPER}_GALE3_REFERENCE_UNITS`],
    ["ICE2F_POSITIONS", `${UPPER}_POSITIONS`],
    ["ICE2F_AXES", `${UPPER}_AXES`],
    ["ICE2F_PAIR_IDS", `${UPPER}_PAIR_IDS`],
    ["ICE2F_FACTOR_BRIDGE_STAGGER_MS", `${UPPER}_FACTOR_BRIDGE_STAGGER_MS`],
    ["ICE2F_DOUBLE_CLICK_STAGGER_MS", `${UPPER}_DOUBLE_CLICK_STAGGER_MS`],
    ["ICE2F_STAKE_UNITS", `${UPPER}_STAKE_UNITS`],
    ["ice2fStakeUnitsForRecovery", `${filePrefix}StakeUnitsForRecovery`],
    ["ice2fChipClickStaggerMs", `${filePrefix}ChipClickStaggerMs`],
    ["ICE_CALIB_SITE_KEY", `${UPPER}_CALIB_SITE_KEY`],
    ["set-ice2f-", `set-${filePrefix}-`],
    ["get-ice2f-", `get-${filePrefix}-`],
    ["reset-ice2f-", `reset-${filePrefix}-`],
    ["ice2fcruzamento", strategy],
    ["`ice2f:", `\`${signalPrefix}`],
    ['"ice2f:', `"${signalPrefix}`],
    ["ss-ice2f", `ss-${filePrefix}`],
    ["ssIce2fPanelLayout", `ss${Pascal}PanelLayout`],
    ["autopilot ICE 2F", `autopilot ${brandTitle} 2F`],
    ["/** Autopilot ICE", `/** Autopilot ${brandTitle}`],
    ["Autopilot ICE", `Autopilot ${brandTitle}`],
    ["Painel flutuante na ICE", `Painel flutuante na ${brandTitle}`],
    ["stake37 — ICE", `stake37 — ${brandTitle}`],
    ["stake37 · ICE", `stake37 · ${brandTitle}`],
    ["stake37 ICE 2F", `stake37 ${brandTitle} 2F`],
    ["ICE 2F", `${brandTitle} 2F`],
  ];

  for (const [from, to] of ordered) c = c.replaceAll(from, to);

  // Remover rastros de outras estratégias no bridge
  c = c.replace(
    /\(context\?\.strategy === "dois2fatores" \|\| context\?\.strategy === "([^"]+)"\)/g,
    '(context?.strategy === "$1")',
  );
  c = c.replace(
    /context\?\.strategy === "dois2fatores" \|\| context\?\.strategy === "tres3fatores" \|\| context\?\.strategy === "([^"]+)"/g,
    'context?.strategy === "$1"',
  );
  c = c.replace(
    /\(isDois2FatoresBridgeContext\(context\) \|\| is(\w+)CrossingContext\(context\)\)/g,
    "(is$1CrossingContext(context))",
  );
  c = c.replace(
    /function isDois2FatoresBridgeContext\([\s\S]*?\n\}/g,
    "/* removed: only cruzamento 2f */",
  );

  // URLs / hosts ICE → site
  c = c.replaceAll(
    "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal",
    site.mesaUrl || `https://${site.hosts[1]}/`,
  );
  c = c.replaceAll("https://www.ice.bet.br/", `https://${site.hosts[0]}/`);
  c = c.replaceAll("https://ice.bet.br/", `https://${site.hosts[1]}/`);
  c = c.replaceAll("ice.bet.br", site.hosts[1]);
  c = c.replaceAll("www.ice.bet.br", site.hosts[0]);

  c = c.replaceAll("Roulette 2 Extra Time", site.gameLabel);
  c = c.replace(new RegExp(`${UPPER}_DEFAULT_TABLE_ID = \\d+`), `${UPPER}_DEFAULT_TABLE_ID = ${tableId}`);
  c = c.replace(
    new RegExp(`${UPPER}_CALIB_SITE_KEY = "[^"]+"`),
    `${UPPER}_CALIB_SITE_KEY = "${site.calibKey}"`,
  );

  // Defaults do runner: tableId fallback
  c = c.replace(
    new RegExp(
      `(Singlestake${Pascal}\\?\\.${UPPER}_TABLE_ID \\?\\? )\\d+`,
    ),
    `$1${tableId}`,
  );
  c = c.replace(
    new RegExp(`(tableId: Singlestake${Pascal}\\?\\.${UPPER}_TABLE_ID \\?\\? )\\d+`),
    `$1${tableId}`,
  );

  // Mesa / host detection
  c = c.replace(
    new RegExp(`function is${Pascal}Host\\(url\\) \\{[\\s\\S]*?\\n\\}`),
    `function is${Pascal}Host(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    ${site.isHostBody}
  } catch {
    return /${site.hostnameRe}/i.test(url);
  }
}`,
  );

  c = c.replace(
    new RegExp(`function is${Pascal}RoulettePageUrl\\(url\\) \\{[\\s\\S]*?\\n\\}`),
    `function is${Pascal}RoulettePageUrl(url) {
  if (!is${Pascal}Host(url)) return false;
  try {
    const u = new URL(url);
    const path = \`\${u.pathname}\${u.hash}\${u.search}\`.toLowerCase();
    ${site.isRoulettePathBody}
  } catch {
    return /${site.hostnameRe}/i.test(url);
  }
}`,
  );

  c = c.replace(
    new RegExp(`function pageIs${Pascal}Roulette\\(\\) \\{[\\s\\S]*?\\n  \\}`),
    `function pageIs${Pascal}Roulette() {
    if (!/${site.hostnameRe}/i.test(location.hostname)) return false;
    const path = \`\${location.pathname}\${location.hash}\${location.search}\`.toLowerCase();
    ${site.panelPathBody}
  }`,
  );

  c = c.replace(
    new RegExp(`function is${Pascal}CrossingContext\\(context\\) \\{[\\s\\S]*?\\}`),
    `function is${Pascal}CrossingContext(context) {
  return context?.strategy === "${strategy}";
}`,
  );

  // Mensagens UX
  c = c.replace(
    /Nenhuma aba [^.]+encontrada\.[^"]*/g,
    `Nenhuma aba ${brandTitle} encontrada. Abra ${site.gameLabel} no ${brandTitle} num separador normal do Chrome (não neste painel).`,
  );
  c = c.replace(
    /Abra [^"]{10,160}"/g,
    `Abra ${site.gameLabel} no ${brandTitle} num separador e aguarde carregar."`,
  );

  // Legacy config wrong-table cleanup no runner
  c = c.replace(
    /const legacyWrong =[\s\S]*?;/,
    `const legacyWrong =
    (typeof stored.tableId === "number" && stored.tableId !== ${tableId}) ||
    (typeof stored.mesaUrl === "string" &&
      stored.mesaUrl.trim() !== "" &&
      !stored.mesaUrl.toLowerCase().includes(${JSON.stringify(site.hosts[1])}));`,
  );

  // Contagem mesa no texto UI
  c = c.replace(/mesa 201/g, `mesa ${tableId}`);
  c = c.replace(/\(201\)/g, `(${tableId})`);
  c = c.replace(/Cruzamento 2F \(201\)/g, `Cruzamento 2F (${tableId})`);

  // NÃO renomear exports da lib ice* re-exportados no global
  // (já evita-se por não substituir ice2fPad / formatIce2f / emptyIce2f / buildIce2f)

  return c;
}

/** @param {string} content @param {SiteConfig} site */
function patchStrategyEntry(content, site) {
  const UPPER = site.Pascal.toUpperCase();
  let c = content;

  // Só reescreve shell da extensão; importa da lib ICE intacta
  c = rewriteExtensionShell(c, site);

  // Restaurar API da iceCruzamento2fStrategy se o shell tiver tocado algo
  const restore = [
    [`create${site.Pascal}EngineOptions`, "CreateIce2fEngineOptions"], // tipagem local ok
  ];
  // Os imports têm configureIce2f* etc. — rewriteExtensionShell não os toca (Ice2f no meio sem prefixos)

  // TYPES locais Ice2fActive etc. vêm da lib — não renomear nos imports
  // Mas CreateIce2fEngineOptions / Ice2fPersistedMachine / Ice2fEngineSpinResult foram locais e foram renomeados — OK

  c = c.replace(
    /Bundle entry — motor [^\n]+/,
    `Bundle entry — motor ${site.brandTitle} Cruzamento 2F para extensão Chrome.`,
  );

  c = c.replace(
    /configureIce2fComparePositions\([^)]*\);/,
    "configureIce2fDefaultComparePairs();",
  );

  c = c.replace(
    new RegExp(`export const ${UPPER}_TABLE_ID =[^;]+;`),
    `export const ${UPPER}_TABLE_ID = ${site.tableId};`,
  );
  c = c.replace(
    new RegExp(`export const ${UPPER}_MESA_URL =[\\s\\S]*?;`),
    `export const ${UPPER}_MESA_URL =\n  ${JSON.stringify(site.mesaUrl)};`,
  );

  c = c.replace(
    /strategy:\s*"[^"]+"\s*as const/,
    `strategy: "${site.strategy}" as const`,
  );

  // Global name no final
  c = c.replace(
    new RegExp(`Singlestake${site.Pascal}\\?: typeof api`, "g"),
    `Singlestake${site.Pascal}?: typeof api`,
  );
  c = c.replace(
    /\.Singlestake\w+\s*=\s*api/,
    `.Singlestake${site.Pascal} = api`,
  );

  // createEngine no api
  c = c.replace(
    /create\w+Engine,/,
    `create${site.Pascal}Engine,`,
  );
  c = c.replace(
    /function create\w+Engine\(/,
    `function create${site.Pascal}Engine(`,
  );
  c = c.replace(
    /export function create\w+Engine\(/,
    `export function create${site.Pascal}Engine(`,
  );

  void restore;
  return c;
}

function writeManifest(outDir, site) {
  const hostPerms = [
    ...site.hosts.map((h) => `https://${h}/*`),
    "https://*.pragmaticplaylive.net/*",
    "https://*.pragmaticplay.net/*",
    ...(site.hostPermissions ?? []),
  ];

  const manifest = {
    manifest_version: 3,
    name: `stake37 — ${site.brandTitle} Cruzamento 2F`,
    version: VERSION,
    description: DESCRIPTION,
    permissions: ["tabs", "storage", "scripting", "debugger", "windows"],
    host_permissions: hostPerms,
    background: { service_worker: "background.js" },
    content_scripts: [
      {
        matches: site.hosts.map((h) => `https://${h}/*`),
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
      default_title: `stake37 ${site.brandTitle} 2F Cruzamento`,
    },
  };

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

function writeReadme(outDir, site) {
  fs.writeFileSync(
    path.join(outDir, "README.md"),
    `# stake37 — ${site.brandTitle} Cruzamento 2 Fatores

Extensão Chrome para **${site.brandTitle}** (mesa **${site.tableId}** · ${site.gameLabel}).

URL: ${site.mesaUrl || "(abrir mesa manualmente)"}

## Estratégia (idêntica à ICE Cruzamento 2F)

- Pares **3×6** e **2×4** em paralelo — indica no match
- Empate fecha indicação; chave **sem gale** e **sem clique** (observação)
- Gráfico run-up / drawdown; contadores OK/ERR por gatilho

## Build

\`\`\`bash
npm run extension:2f:sync
npm run ${site.npmBuild}
\`\`\`

Chrome → \`chrome://extensions\` → Carregar sem compactação → pasta \`${site.dir}/\`
`,
  );
}

function cleanOutDir(outDir, site) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    return;
  }
  for (const name of fs.readdirSync(outDir)) {
    const full = path.join(outDir, name);
    if (!fs.statSync(full).isFile()) continue;
    // Remove leftovers de outras estratégias / backups
    if (
      name.endsWith(".bak") ||
      name.endsWith(".old") ||
      (/^(kto2f|golde2f|bn2f|loto2f|reals2f|sportingbet2f|ice2f)-/.test(name) &&
        !name.startsWith(site.filePrefix))
    ) {
      fs.unlinkSync(full);
      continue;
    }
    // Painéis / runners com prefixo errado
    if (
      /^content-.*-panel\.js$/.test(name) &&
      name !== `content-${site.filePrefix}-panel.js`
    ) {
      fs.unlinkSync(full);
    }
  }
}

/** @param {SiteConfig} site */
function syncSite(site) {
  const outDir = path.join(root, site.dir);
  cleanOutDir(outDir, site);
  fs.mkdirSync(outDir, { recursive: true });

  const renameMap = {
    "ice2f-signal-runner.js": `${site.filePrefix}-signal-runner.js`,
    "ice2f-strategy-entry.ts": `${site.filePrefix}-strategy-entry.ts`,
    "content-ice2f-panel.js": `content-${site.filePrefix}-panel.js`,
  };

  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    if (!fs.statSync(src).isFile()) continue;
    if (name.endsWith(".bak")) continue;
    if (SKIP.has(name)) continue;

    const outName = renameMap[name] ?? name;
    let content = fs.readFileSync(src, "utf8");

    if (COPY_AS_IS.has(name)) {
      fs.writeFileSync(path.join(outDir, outName), content);
      continue;
    }

    if (outName === `${site.filePrefix}-strategy-entry.ts`) {
      content = patchStrategyEntry(content, site);
    } else {
      content = rewriteExtensionShell(content, site);
    }

    // Popup branding residual
    if (outName === "popup.html" || outName === "popup.js") {
      content = content.replaceAll("ice.bet.br", site.hosts[1]);
      content = content.replace(/\bICE\b/g, site.brandTitle);
    }

    fs.writeFileSync(path.join(outDir, outName), content);
  }

  writeManifest(outDir, site);
  writeReadme(outDir, site);
  console.log(`✓ synced ${site.dir}`);
}

function ensurePackageScripts() {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const defs = {
    "extension:2f:sync": "node scripts/sync-all-cruzamento-2f-from-ice.mjs",
    "extension:golde2f:build":
      "npx --yes esbuild extension-goldebet-cruzamento-2f/golde2f-strategy-entry.ts --bundle --format=iife --global-name=SinglestakeGolde2f --outfile=extension-goldebet-cruzamento-2f/golde2f-engine.js --platform=browser --target=chrome110 --alias:@=./src",
    "extension:loto2f:build":
      "npx --yes esbuild extension-lotogreen-cruzamento-2f/loto2f-strategy-entry.ts --bundle --format=iife --global-name=SinglestakeLoto2f --outfile=extension-lotogreen-cruzamento-2f/loto2f-engine.js --platform=browser --target=chrome110 --alias:@=./src",
    "extension:reals2f:build":
      "npx --yes esbuild extension-reals-cruzamento-2f/reals2f-strategy-entry.ts --bundle --format=iife --global-name=SinglestakeReals2f --outfile=extension-reals-cruzamento-2f/reals2f-engine.js --platform=browser --target=chrome110 --alias:@=./src",
    "extension:sportingbet2f:build":
      "npx --yes esbuild extension-sportingbet-cruzamento-2f/sportingbet2f-strategy-entry.ts --bundle --format=iife --global-name=SinglestakeSportingbet2f --outfile=extension-sportingbet-cruzamento-2f/sportingbet2f-engine.js --platform=browser --target=chrome110 --alias:@=./src",
  };
  let changed = false;
  for (const [k, v] of Object.entries(defs)) {
    if (pkg.scripts[k] !== v) {
      pkg.scripts[k] = v;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log("✓ package.json scripts atualizados");
  }
}

for (const site of SITES) syncSite(site);
ensurePackageScripts();

const builds = [
  "extension:ice2f:build",
  "extension:kto2f:build",
  "extension:golde2f:build",
  "extension:bn2f:build",
  "extension:loto2f:build",
  "extension:reals2f:build",
  "extension:sportingbet2f:build",
];

for (const b of builds) {
  console.log(`→ npm run ${b}`);
  execSync(`npm run ${b}`, { cwd: root, stdio: "inherit" });
}

console.log("Todas as extensões Cruzamento 2F sincronizadas a partir da ICE.");
