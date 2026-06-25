/**
 * Normaliza export do painel Playtech → feed JSON para npm run playtech:sim
 *
 *   npm run playtech:export
 *   npm run playtech:export -- caminho/export.json
 *   npm run playtech:export -- caminho/export.json -o playtech-test/exports/feed.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { importPlaytechFeed } from "./importFeed.ts";

function readStdinUtf8(): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c) => chunks.push(Buffer.from(c)));
    process.stdin.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

function usage(): void {
  console.log(`Uso:
  npm run playtech:export -- [ficheiro.json] [-o saida.json]

  Sem ficheiro: lê stdin (pipe ou colar JSON).
  Com ficheiro: converte export bruto do painel → feed Playtech normalizado.

Exemplos:
  npm run playtech:export -- C:\\Users\\PC\\Downloads\\playtech-config.json
  npm run playtech:export -- export.json -o playtech-test/exports/feed-real.json
  type export.json | npm run playtech:export -- -
`);
}

function parseArgs(argv: string[]): { inputPath: string | null; outputPath: string | null } {
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    if (arg === "-o" || arg === "--out") {
      outputPath = argv[i + 1] ?? null;
      i++;
      continue;
    }
    if (!arg.startsWith("-")) {
      inputPath = arg;
    }
  }

  return { inputPath, outputPath };
}

function defaultOutputPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return resolve("playtech-test/exports", `feed-${stamp}.json`);
}

async function main(): Promise<void> {
  const { inputPath, outputPath } = parseArgs(process.argv.slice(2));
  const defaultFixture = new URL("./fixtures/sample-feed.json", import.meta.url);

  let text: string;
  if (inputPath === "-") {
    text = await readStdinUtf8();
  } else if (inputPath) {
    text = readFileSync(inputPath, "utf8");
  } else if (!process.stdin.isTTY) {
    text = await readStdinUtf8();
  } else {
    text = readFileSync(defaultFixture, "utf8");
    console.log("(sem ficheiro — a usar fixture de exemplo; passe o export real como argumento)\n");
  }

  const raw = JSON.parse(text.trim()) as unknown;
  const { feed, format, warnings } = importPlaytechFeed(raw);

  const out = outputPath ?? defaultOutputPath();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(feed, null, 2)}\n`, "utf8");

  const spinsByTable = new Map<number, number>();
  for (const ev of feed.events) {
    spinsByTable.set(ev.tableId, (spinsByTable.get(ev.tableId) ?? 0) + 1);
  }

  console.log("=== Export Playtech normalizado ===");
  console.log(`Formato detectado: ${format}`);
  console.log(`Mesas: ${feed.tables.length}`);
  for (const t of feed.tables) {
    console.log(`  · ${t.label} (#${t.id}) — ${spinsByTable.get(t.id) ?? 0} giros`);
  }
  console.log(`Total eventos: ${feed.events.length}`);
  console.log(`Gravado em: ${out}`);

  if (warnings.length) {
    console.log("\nAvisos:");
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }

  console.log("\nPróximo passo:");
  console.log(`  npm run playtech:sim -- ${out}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
