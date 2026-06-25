/**
 * Analisa backup .prime do painel Playtech.
 *
 *   npm run playtech:import-prime -- C:\Users\PC\Downloads\backup_bot_24-6.prime
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { importPlaytechFeed } from "./importFeed.ts";
import { analyzePrimeBuffer, assertPrimeBackup, decodePrimePayload, readPrimeFile } from "./importPrime.ts";

function usage(): void {
  console.log(`Uso:
  npm run playtech:import-prime -- caminho/backup.prime

O ficheiro .prime é o backup encriptado do teu painel (EXPORTAR CONFIG).
Se o decode ainda não estiver disponível, importe no painel com IMPORTAR CONFIG
e exporte histórico via browser-capture.js ou JSON legível.
`);
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input || input === "-h" || input === "--help") {
    usage();
    process.exit(input ? 0 : 1);
  }

  const raw = readFileSync(input, "utf8");
  const buf = readPrimeFile(raw);
  const info = assertPrimeBackup(buf);

  console.log("=== Backup .prime ===");
  console.log(`Ficheiro: ${input}`);
  console.log(`Tamanho: ${buf.length} bytes`);
  console.log(`Versão: ${info.versionByte}.${info.subVersionByte}`);
  console.log(`Payload: ${info.payloadBytes} bytes`);
  console.log(`Entropia: ${info.entropy.toFixed(2)} (${info.isEncrypted ? "encriptado" : "texto"})`);

  const archiveDir = resolve("playtech-test/fixtures/prime-backups");
  mkdirSync(archiveDir, { recursive: true });
  const archivePath = resolve(archiveDir, basename(input));
  copyFileSync(input, archivePath);
  console.log(`Cópia: ${archivePath}`);

  try {
    const decoded = decodePrimePayload(buf);
    const { feed, format, warnings } = importPlaytechFeed(decoded);
    const out = resolve("playtech-test/exports", basename(input).replace(/\.prime$/i, "-feed.json"));
    mkdirSync(resolve("playtech-test/exports"), { recursive: true });
    writeFileSync(out, `${JSON.stringify(feed, null, 2)}\n`, "utf8");
    console.log(`\nFeed exportado: ${out} (${format})`);
    if (warnings.length) warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log(`\n  npm run playtech:sim -- ${out}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("\n" + msg);
    console.log("\nPróximo passo (teste prático):");
    console.log("  1. No painel Playtech → IMPORTAR CONFIG → escolher este .prime");
    console.log("  2. F12 → colar playtech-test/browser-capture.js");
    console.log("  3. npm run playtech:export -- playtech-capture-....json");
    console.log("  4. npm run playtech:sim -- playtech-test/exports/feed-....json");
    process.exit(2);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
