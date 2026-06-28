/**
 * Verifica se o sandbox local está configurado antes de desenvolver.
 * Uso: npm run check:local
 */
import { existsSync } from "node:fs";

import { localDataDir, projectRoot, resolveDbPath } from "./load-local-env";

import "./load-local-env";

const checks: { label: string; ok: boolean; hint?: string }[] = [
  {
    label: ".env.development.local",
    ok: existsSync(`${projectRoot}/.env.development.local`),
    hint: "Corra: npm run setup:local",
  },
  {
    label: "Pasta data/local/",
    ok: existsSync(localDataDir()),
    hint: "Corra: npm run setup:local",
  },
  {
    label: "SQLite local",
    ok: existsSync(resolveDbPath()),
    hint: "Corra: npm run setup:local",
  },
  {
    label: "roulette-automation-sim.json",
    ok: existsSync(
      process.env.ROULETTE_AUTOMATION_SIM_PATH?.trim() ||
        `${localDataDir()}/roulette-automation-sim.json`,
    ),
    hint: "Corra: npm run seed:local-automation",
  },
  {
    label: "roulette-strategy-global.json",
    ok: existsSync(
      process.env.ROULETTE_STRATEGY_GLOBAL_PATH?.trim() ||
        `${localDataDir()}/roulette-strategy-global.json`,
    ),
    hint: "Corra: npm run seed:local-automation",
  },
  {
    label: "node_modules",
    ok: existsSync(`${projectRoot}/node_modules`),
    hint: "Corra: npm install",
  },
];

let failed = false;
console.log("=== Verificação sandbox local ===\n");

for (const check of checks) {
  const icon = check.ok ? "OK" : "FALTA";
  console.log(`  [${icon}] ${check.label}`);
  if (!check.ok) {
    failed = true;
    if (check.hint) console.log(`         → ${check.hint}`);
  }
}

console.log("");
if (failed) {
  console.log("Sandbox incompleto. Execute: npm run setup:local\n");
  process.exit(1);
}

console.log("Sandbox pronto. Inicie com: npm run dev\n");
