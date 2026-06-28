/**
 * Prepara sandbox local: env, SQLite, migrations, seed e estado de automação limpo.
 * Uso: npm run setup:local
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

import { loadLocalEnv, localDataDir, projectRoot, resolveDbPath } from "./load-local-env";

function ensureLocalEnvFile() {
  const target = `${projectRoot}/.env.development.local`;
  const example = `${projectRoot}/.env.development.local.example`;
  if (existsSync(target)) return;
  if (!existsSync(example)) {
    console.warn("Aviso: .env.development.local.example não encontrado.");
    return;
  }
  copyFileSync(example, target);
  console.log("Criado .env.development.local a partir do exemplo (sandbox isolado).");
  loadLocalEnv();
}

function runMigrate() {
  const dbPath = resolveDbPath();
  const isFresh = !existsSync(dbPath);
  try {
    execSync("npm run db:migrate", { cwd: projectRoot, stdio: "inherit", env: process.env });
    return;
  } catch {
    if (isFresh) {
      console.warn("\nMigrations SQL incompletas — a aplicar schema com drizzle push (sandbox novo)…\n");
      execSync("npm run db:push", { cwd: projectRoot, stdio: "inherit", env: process.env });
      return;
    }
    if (existsSync(dbPath)) {
      console.warn("\nAviso: migrations falharam, mas a BD local já existe — a continuar.\n");
      return;
    }
    throw new Error("Falha ao criar a base de dados local.");
  }
}

function main() {
  console.log("=== Setup sandbox local singlestake ===\n");

  loadLocalEnv();
  ensureLocalEnvFile();
  mkdirSync(localDataDir(), { recursive: true });

  console.log(`Pasta de dados: ${localDataDir()}`);
  console.log(`Base de dados:   ${resolveDbPath()}\n`);

  console.log("Aplicar migrations…");
  runMigrate();

  console.log("\nPopular dados demo (admin, pacotes, config)…");
  execSync("npm run db:seed", { cwd: projectRoot, stdio: "inherit", env: process.env });

  console.log("\nInicializar automação global (JSON + capital R$ 50.000)…");
  execSync("npm run seed:local-automation", {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@singlestake.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "123456";

  console.log("\n=== Sandbox local pronto ===");
  console.log("  App:         http://localhost:5173");
  console.log("  Back-office: http://localhost:5173/back-office");
  console.log("  Automação:   http://localhost:5173/back-office/financeiro/automacao-global");
  console.log("  Login:       http://localhost:5173/login");
  console.log(`  Admin:       ${email}`);
  console.log(`  Senha:       ${password}`);
  console.log("\nSubir servidor:  npm run dev");
  console.log("Tudo de uma vez: npm run dev:local");
  console.log("Repor sandbox:   npm run reset:local");
  console.log("Testar build:    npm run test:local\n");
}

main();
