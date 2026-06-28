/**
 * Build de produção local — simula o que vai para a VPS antes do deploy único.
 * Uso: npm run test:local
 */
import { execSync } from "node:child_process";

import { projectRoot } from "./load-local-env";

import "./load-local-env";

console.log("=== Teste pré-deploy (local) ===\n");

console.log("1/2 Build de produção…");
execSync("npm run build", { cwd: projectRoot, stdio: "inherit", env: process.env });

console.log("\n2/2 Arranque preview (Ctrl+C para parar)…");
console.log("Abra http://localhost:4173 e valide as alterações.\n");
execSync("npm run preview", { cwd: projectRoot, stdio: "inherit", env: process.env });
