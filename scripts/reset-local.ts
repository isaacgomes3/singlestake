/**
 * Apaga sandbox local (BD + JSON de automação) e recria do zero.
 * Uso: npm run reset:local
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

import { loadLocalEnv, localDataDir, projectRoot, resolveDbPath } from "./load-local-env";

loadLocalEnv();

const dbPath = resolveDbPath();

for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (existsSync(file)) rmSync(file);
}

const dataDir = localDataDir();
if (existsSync(dataDir)) {
  rmSync(dataDir, { recursive: true, force: true });
}

mkdirSync(dataDir, { recursive: true });

console.log("Sandbox local removido. A recriar…\n");
execSync("npm run setup:local", { cwd: projectRoot, stdio: "inherit", env: process.env });
