/**
 * Copia extension/ para o Ambiente de Trabalho (instalação rápida no Chrome).
 * Uso: npm run extension:copy-desktop
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "extension");
const dest = join(homedir(), "Desktop", "singlestake-extension");

if (!existsSync(root)) {
  console.error("Pasta extension/ não encontrada:", root);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(root, dest, { recursive: true, force: true });

console.log("Extensão copiada para:");
console.log(" ", dest);
console.log("");
console.log("No Chrome: chrome://extensions → Carregar sem compactação → escolha essa pasta.");
