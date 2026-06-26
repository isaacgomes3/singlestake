/**
 * Prepara SQLite, migrations e dados demo para desenvolvimento local.
 * Uso: npm run setup:local
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

import "dotenv/config";

const root = resolve(import.meta.dirname, "..");
const dbPath = resolve(root, process.env.DATABASE_URL ?? "./data/singlestake.db");

function ensureEnvFile() {
  const envPath = resolve(root, ".env");
  const examplePath = resolve(root, ".env.example");
  if (existsSync(envPath)) return;
  if (!existsSync(examplePath)) {
    console.warn("Aviso: .env não existe e .env.example não foi encontrado.");
    return;
  }
  copyFileSync(examplePath, envPath);
  console.log("Criado .env a partir de .env.example");
}

function runMigrate() {
  try {
    execSync("npm run db:migrate", { cwd: root, stdio: "inherit" });
  } catch {
    if (existsSync(dbPath)) {
      console.warn("\nAviso: migrations falharam, mas a BD local já existe — a continuar.\n");
      return;
    }
    throw new Error("Falha ao criar a base de dados local.");
  }
}

function main() {
  console.log("=== Setup ambiente local singlestake ===\n");

  ensureEnvFile();
  mkdirSync(dirname(dbPath), { recursive: true });
  mkdirSync(resolve(root, "data"), { recursive: true });

  console.log("Aplicar migrations…");
  runMigrate();

  console.log("\nPopular dados demo (admin, pacotes, config)…");
  execSync("npm run db:seed", { cwd: root, stdio: "inherit" });

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@singlestake.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "123456";

  console.log("\n=== Ambiente local pronto ===");
  console.log("  App:      http://localhost:5173");
  console.log("  Back-office: http://localhost:5173/back-office");
  console.log("  Login:    http://localhost:5173/login");
  console.log(`  Admin:    ${email}`);
  console.log(`  Senha:    ${password}`);
  console.log("\nSubir servidor: npm run dev");
  console.log("Ou tudo de uma vez: npm run dev:local\n");
}

main();
