/**
 * Compara o placar Números 2,8% (dois exclusivos) entre desempates `legacy` vs `recency`.
 *
 * Entrada: JSON array newest-first (ex.: valor de localStorage `roulette.history.espelho`).
 *
 * Uso:
 *   npx tsx scripts/measure-nums28-tie-break.ts caminho/para/historico.json
 *   type historico.json | npx tsx scripts/measure-nums28-tie-break.ts
 */

import { readFileSync } from "node:fs";
import { stdin as stdinStream } from "node:process";

import {
  nums28PctPlacarOutcomes,
  nums28PctPlacarSummary,
} from "../src/lib/roulette/nums28PctStrategy.ts";

function readStdinUtf8(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stdinStream.on("data", (c) => chunks.push(Buffer.from(c)));
    stdinStream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stdinStream.on("error", reject);
  });
}

function parseHistoryJson(raw: string): number[] {
  const v = JSON.parse(raw) as unknown;
  if (!Array.isArray(v)) throw new Error("JSON tem de ser um array de números.");
  const out: number[] = [];
  for (let i = 0; i < v.length; i++) {
    const n = v[i];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 36 || !Number.isInteger(n)) {
      throw new Error(`Entrada inválida no índice ${i}: esperado inteiro 0–36.`);
    }
    out.push(n);
  }
  return out;
}

function main(): void {
  const arg = process.argv[2];

  void (async () => {
    let text: string;
    if (arg && arg !== "-") {
      text = readFileSync(arg, "utf8");
    } else if (arg === "-" || !stdinStream.isTTY) {
      text = await readStdinUtf8();
    } else {
      console.error(
        [
          "Uso: npx tsx scripts/measure-nums28-tie-break.ts <ficheiro.json>",
          "     npx tsx scripts/measure-nums28-tie-break.ts -   # stdin",
          "   ou: type ficheiro.json | npx tsx scripts/measure-nums28-tie-break.ts",
          "",
          "O ficheiro deve ser um JSON array newest-first (ex.: roulette.history.espelho).",
        ].join("\n"),
      );
      process.exit(1);
      return;
    }

    const history = parseHistoryJson(text.trim());
    const legacy = nums28PctPlacarOutcomes(history, { exclusionTieBreak: "legacy" });
    const recency = nums28PctPlacarOutcomes(history, { exclusionTieBreak: "recency" });

    if (legacy.length !== recency.length) {
      throw new Error("Inconsistência interna: comprimentos de placar diferentes.");
    }

    let divergent = 0;
    for (let i = 0; i < legacy.length; i++) {
      if (legacy[i] !== recency[i]) divergent += 1;
    }

    const sL = nums28PctPlacarSummary(legacy);
    const sR = nums28PctPlacarSummary(recency);

    console.log(JSON.stringify({
      girosNoHistorico: history.length,
      girosComPlacar: legacy.length,
      divergentWL: divergent,
      legacy: sL,
      recency: sR,
      deltaWins: sR.wins - sL.wins,
      deltaAproveitamentoPct: sR.aproveitamentoPct - sL.aproveitamentoPct,
    }, null, 2));
  })().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}

main();
