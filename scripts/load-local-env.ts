/**
 * Carrega variáveis locais na ordem correcta (último ficheiro ganha).
 * Usado pelos scripts de setup/reset/seed — não importar no código da app.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

const root = resolve(import.meta.dirname, "..");

const layers = [
  ".env",
  ".env.development",
  ".env.development.local",
  ".env.local",
] as const;

export function loadLocalEnv(): void {
  for (const file of layers) {
    const path = resolve(root, file);
    if (existsSync(path)) {
      config({ path, override: true });
    }
  }
}

loadLocalEnv();

export const projectRoot = root;

export function localDataDir(): string {
  return resolve(root, "data/local");
}

export function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL?.trim() || "./data/local/singlestake.db";
  return resolve(root, raw);
}
