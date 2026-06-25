/**
 * Recalcula pontuação binária a partir do histórico de compras.
 *
 * Uso:
 *   npx tsx scripts/db-backfill-binary-points.ts           # só propaga pontos
 *   npx tsx scripts/db-backfill-binary-points.ts --settle # também liquida bónus pendentes
 */
import "dotenv/config";

import {
  rebuildBinaryPointsFromHistory,
  settleAllPendingBinaryMatches,
} from "@/lib/server/network/binary-engine";

async function main() {
  const settle = process.argv.includes("--settle");

  console.log("A recalcular pontos binários a partir das compras…");
  const result = await rebuildBinaryPointsFromHistory();
  console.log(`Compras processadas: ${result.purchases}`);
  console.log(`Registos de pontos: ${result.pointsRows}`);

  if (settle) {
    console.log("\nA liquidar binários pendentes (pode gerar créditos)…");
    const settled = await settleAllPendingBinaryMatches();
    console.log(`Níveis processados: ${settled.levelsProcessed}`);
  } else {
    console.log("\nDica: use --settle para tentar liquidar bónus após o backfill.");
  }

  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
