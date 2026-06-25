/**
 * Simulação isolada: feed Playtech + lógica Um Fator (sem app, sem DGA, sem iframe).
 *
 *   npm run playtech:sim
 *   npx tsx playtech-test/run-sim.ts playtech-test/fixtures/sample-feed.json
 */

import { readFileSync } from "node:fs";
import { stdin as stdinStream } from "node:process";
import { fileURLToPath } from "node:url";

import {
  formatRotatingUmFatorReplayLine,
  replayRotatingUmFatorStrategy,
} from "../src/lib/roulette/rotatingUmFatorSimHarness.ts";
import { lobbyTableDisplayName } from "../src/lib/roulette/lobbyTables.ts";
import { playtechFeedToReplayInput, playtechTableLabelMap } from "./feedAdapter.ts";
import { isPlaytechLobbyFeed } from "./types.ts";

function readStdinUtf8(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stdinStream.on("data", (c) => chunks.push(Buffer.from(c)));
    stdinStream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stdinStream.on("error", reject);
  });
}

function parseFeed(raw: string) {
  const v = JSON.parse(raw) as unknown;
  if (!isPlaytechLobbyFeed(v)) {
    throw new Error('JSON inválido: esperado { "source": "playtech", "tables": [], "events": [] }');
  }
  return v;
}

function labelFor(tableLabels: Map<number, string>, tableId: number): string {
  return tableLabels.get(tableId) ?? `Mesa ${tableId}`;
}

function formatPlaytechReplayLine(
  row: Parameters<typeof formatRotatingUmFatorReplayLine>[0],
  tableLabels: Map<number, string>,
): string {
  const line = formatRotatingUmFatorReplayLine(row);
  return line.replace(lobbyTableDisplayName(row.tableId), labelFor(tableLabels, row.tableId));
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const defaultFixture = new URL("./fixtures/sample-feed.json", import.meta.url);

  let text: string;
  if (arg === "-") {
    text = await readStdinUtf8();
  } else if (arg) {
    text = readFileSync(arg, "utf8");
  } else {
    text = readFileSync(defaultFixture, "utf8");
  }

  const feed = parseFeed(text.trim());
  const tableLabels = playtechTableLabelMap(feed);
  const result = replayRotatingUmFatorStrategy(playtechFeedToReplayInput(feed));

  console.log("=== Playtech (isolado) · Um Fator · rodízio ===");
  console.log(`Mesas teste: ${feed.tables.map((t) => `${t.label} (#${t.id})`).join(", ")}`);
  console.log(`Giros: ${result.logs.length}`);
  console.log(`Placar: ${result.finalStats.wins}V / ${result.finalStats.losses}D`);
  console.log(`Recuperação: ${result.finalMachine.recovery}`);
  console.log("(IDs acima são do ficheiro Playtech — não são IDs DGA da app)\n");

  for (const row of result.logs) {
    console.log(formatPlaytechReplayLine(row, tableLabels));
  }

  console.log("");
  const fin = result.finalIndication;
  if (fin.action === "bet" && fin.tableId != null) {
    console.log(
      `Estado final: APOSTAR · ${labelFor(tableLabels, fin.tableId)} · ${fin.alertLabel} · gale ${fin.recovery}`,
    );
  } else {
    console.log(`Estado final: aguardar · gale ${fin.recovery}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
