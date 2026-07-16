/**
 * Gera src/lib/roulette/spin24dCruzamento2fStrategy.ts a partir da ICE 2F.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const srcPath = path.join(root, "src/lib/roulette/iceCruzamento2fStrategy.ts");
const outPath = path.join(root, "src/lib/roulette/spin24dCruzamento2fStrategy.ts");

let out = fs.readFileSync(srcPath, "utf8");

out = out.replace(
  /^\/\*\*[\s\S]*?\*\/\r?\n/,
  `/**
 * Cruzamento 2 Fatores — **24D Spin** (Pragmatic, 1–24).
 *
 * Mesmo conceito da ICE Cruzamento 2F (gatilho 2×4, eixos cor/altura/paridade),
 * com classificação própria: Vermelho/Preto por coluna, Baixo 1–12, Alto 13–24.
 */

`,
);

out = out.replace(
  /import \{\r?\n  factorsForNumberOnAxis,\r?\n  pairKindFromCrossingAxis,\r?\n  type CrossingAxisKind,\r?\n\} from "@\/lib\/roulette\/doisFatoresPatternCrossing";/,
  `import {
  pairKindFromCrossingAxis,
  type CrossingAxisKind,
} from "@/lib/roulette/doisFatoresPatternCrossing";
import { factorsFor24dNumberOnAxis } from "@/lib/roulette/spin24dFactors";`,
);

out = out.replace(/factorsForNumberOnAxis/g, "factorsFor24dNumberOnAxis");

out = out.replace(
  /export const ICE_2F_ROULETTE_TABLE_ID = 201;\r?\nexport const ICE_2F_ROULETTE_MESA_URL =\r?\n  "[^"]*";/,
  `export const ICE_2F_ROULETTE_TABLE_ID = 3426;
export const ICE_2F_ROULETTE_MESA_URL =
  "https://casino.bet365.bet.br/play/24DSpin";`,
);

out = out.replace(
  "/** Default ICE: só 2×4 — indica no primeiro match. */",
  "/** Default 24D: só 2×4 — indica no primeiro match. */",
);

out = out.replace(
  /export const ICE_2F_RECOVERY_BET_DELAY_MS = [68]_000;/,
  "export const ICE_2F_RECOVERY_BET_DELAY_MS = 9_000;",
);
out = out.replace(
  /Esperas de clique:[\s\S]*?todas [68]s após o giro\./,
  "Esperas de clique: entrada, gale e reentrada pós-empate — todas 9s após o giro.",
);

fs.writeFileSync(outPath, out);
console.log("ok", outPath);
