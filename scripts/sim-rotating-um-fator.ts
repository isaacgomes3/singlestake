/**
 * Simula a estratégia Um Fator em rodízio (mesas + recuperações).
 * Independente do provedor — não aposta no casino; só reproduz a lógica da app.
 *
 * Uso:
 *   npm run sim:rotating-um-fator
 *   npm run sim:rotating-um-fator -- scripts/fixtures/rotating-um-fator-sample.json
 *   type historico.json | npm run sim:rotating-um-fator -- -
 *
 * Formato JSON:
 *   { "tableIds": [227, 203], "events": [{ "tableId": 227, "number": 14, "at": "..." }] }
 */

import { readFileSync } from "node:fs";
import { stdin as stdinStream } from "node:process";

import {
  formatRotatingUmFatorReplayLine,
  replayRotatingUmFatorStrategy,
  ROTATING_UM_FATOR_SIM_FIXTURE_HELP,
  type RotatingUmFatorReplayInput,
  type RotatingUmFatorSpinEvent,
} from "../src/lib/roulette/rotatingUmFatorSimHarness.ts";
import { ROULETTE_AUTOMATION_BASE_STAKE } from "../src/lib/back-office/rouletteAutomationSim.ts";

function readStdinUtf8(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stdinStream.on("data", (c) => chunks.push(Buffer.from(c)));
    stdinStream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stdinStream.on("error", reject);
  });
}

function parseEvent(raw: unknown, index: number): RotatingUmFatorSpinEvent {
  if (raw === null || typeof raw !== "object") {
    throw new Error(`events[${index}]: objecto esperado.`);
  }
  const o = raw as Record<string, unknown>;
  const tableId = o.tableId;
  const number = o.number;
  if (typeof tableId !== "number" || !Number.isInteger(tableId) || tableId <= 0) {
    throw new Error(`events[${index}].tableId inválido.`);
  }
  if (typeof number !== "number" || !Number.isInteger(number) || number < 0 || number > 36) {
    throw new Error(`events[${index}].number inválido (0–36).`);
  }
  const at = o.at;
  if (at !== undefined && typeof at !== "string" && typeof at !== "number") {
    throw new Error(`events[${index}].at inválido.`);
  }
  return { tableId, number, at: at as string | number | undefined };
}

function parseInput(raw: string): RotatingUmFatorReplayInput {
  const v = JSON.parse(raw) as unknown;
  if (v === null || typeof v !== "object") throw new Error("JSON raiz tem de ser um objecto.");
  const o = v as Record<string, unknown>;

  let tableIds: number[] | undefined;
  if (o.tableIds !== undefined) {
    if (!Array.isArray(o.tableIds)) throw new Error("tableIds tem de ser um array.");
    tableIds = o.tableIds.map((id, i) => {
      if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
        throw new Error(`tableIds[${i}] inválido.`);
      }
      return id;
    });
  }

  if (!Array.isArray(o.events) || o.events.length === 0) {
    throw new Error("events tem de ser um array não vazio.");
  }

  return {
    tableIds,
    events: o.events.map(parseEvent),
  };
}

function main(): void {
  const arg = process.argv[2];
  const defaultFixture = new URL("./fixtures/rotating-um-fator-sample.json", import.meta.url);

  void (async () => {
    let text: string;
    if (arg && arg !== "-") {
      text = readFileSync(arg, "utf8");
    } else if (arg === "-" || !stdinStream.isTTY) {
      text = await readStdinUtf8();
    } else {
      text = readFileSync(defaultFixture, "utf8");
    }

    const input = parseInput(text.trim());
    const result = replayRotatingUmFatorStrategy(input);

    console.log("=== Simulação Um Fator · sala rotativa ===");
    console.log(`Mesas: ${result.tableIds.join(", ")}`);
    console.log(`Giros: ${result.logs.length}`);
    console.log(`Placar: ${result.finalStats.wins}V / ${result.finalStats.losses}D`);
    console.log(`Recuperação actual: ${result.finalMachine.recovery}`);
    console.log(`Banca base por entrada: R$ ${ROULETTE_AUTOMATION_BASE_STAKE} (×2^recuperação)`);
    console.log("");

    for (const row of result.logs) {
      console.log(formatRotatingUmFatorReplayLine(row));
    }

    console.log("");
    const fin = result.finalIndication;
    if (fin.action === "bet" && fin.tableId != null) {
      console.log(
        `Estado final: APOSTAR em ${fin.tableLabel} · ${fin.alertLabel} · R$ ${fin.stake} · gale ${fin.recovery}`,
      );
      console.log(`signalId: ${fin.signalId}`);
    } else {
      console.log(
        `Estado final: aguardar${fin.tableLabel ? ` (foco ${fin.tableLabel})` : ""} · gale ${fin.recovery}`,
      );
    }

    console.log("");
    console.log("— A app troca de mesa e recuperação; o URL Playtech/Pragmatic vem de VITE_CASINO_TABLE_EMBED_URLS —");
  })().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    console.error("");
    console.error("Formato de exemplo:", JSON.stringify(ROTATING_UM_FATOR_SIM_FIXTURE_HELP, null, 2));
    process.exit(1);
  });
}

main();
