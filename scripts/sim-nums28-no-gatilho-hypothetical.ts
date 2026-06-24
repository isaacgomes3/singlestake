/**
 * Compara o placar **oficial** Números 2,8% (com gatilho, continuação, cruzamento oposto, espelho)
 * com duas hipóteses **pedagógicas** no mesmo histórico:
 *   A) Sem gatilho: dois mais frios em todo 1–36; após L substitui só o número atingido pelo mais frio fora do par.
 *   B) Sem gatilho: após cada giro recalcula sempre os dois mais frios em 1–36.
 *
 * Uso:
 *   npx tsx scripts/sim-nums28-no-gatilho-hypothetical.ts historico.json
 *   type historico.json | npx tsx scripts/sim-nums28-no-gatilho-hypothetical.ts -
 */

import { readFileSync } from "node:fs";
import { stdin as stdinStream } from "node:process";

import {
  nums28HypotheticalNoGatilhoAlwaysFreshPairPlacarOutcomes,
  nums28HypotheticalNoGatilhoSubstituteOnLossPlacarOutcomes,
} from "../src/lib/roulette/nums28NoGatilhoHypothetical.ts";
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
          "Uso: npx tsx scripts/sim-nums28-no-gatilho-hypothetical.ts <ficheiro.json>",
          "     npx tsx scripts/sim-nums28-no-gatilho-hypothetical.ts -   # stdin",
        ].join("\n"),
      );
      process.exit(1);
      return;
    }

    const history = parseHistoryJson(text.trim());
    const oficial = nums28PctPlacarOutcomes(history);
    const hypoSub = nums28HypotheticalNoGatilhoSubstituteOnLossPlacarOutcomes(history);
    const hypoFresh = nums28HypotheticalNoGatilhoAlwaysFreshPairPlacarOutcomes(history);

    const sOf = nums28PctPlacarSummary(oficial);
    const sSub = nums28PctPlacarSummary(hypoSub);
    const sFre = nums28PctPlacarSummary(hypoFresh);

    let divergentWL_AB = 0;
    const m = Math.min(hypoSub.length, hypoFresh.length);
    for (let i = 0; i < m; i++) {
      if (hypoSub[i] !== hypoFresh[i]) divergentWL_AB += 1;
    }

    console.log(
      JSON.stringify(
        {
          nota:
            "Hipóteses A/B usam pool 1–36 inteiro, sem gatilho 11–12 nem continuação; 0 conta como W. O placar oficial tem menos entradas quando o estado 2,8% está inactivo.",
          girosNoHistorico: history.length,
          oficial: { avaliacoes: sOf.total, ...sOf },
          hipoteseA_substituirSoAposL: { avaliacoes: sSub.total, ...sSub },
          hipoteseB_sempreDoisFriosNovos: { avaliacoes: sFre.total, ...sFre },
          divergencias_WL_entre_A_e_B: divergentWL_AB,
          deltaAproveitamentoVsOficial_pct: {
            A_vs_oficial: sSub.aproveitamentoPct - sOf.aproveitamentoPct,
            B_vs_oficial: sFre.aproveitamentoPct - sOf.aproveitamentoPct,
          },
        },
        null,
        2,
      ),
    );
  })().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}

main();
