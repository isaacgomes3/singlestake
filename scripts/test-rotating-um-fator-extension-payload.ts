/**
 * Teste externo: mostra o JSON que a app enviaria à extensão Chrome (game-odds-glow bridge).
 * Não abre o browser — valida estratégia + payload antes de integrar na automação.
 *
 * Uso:
 *   npm run test:rotating-um-fator-extension
 *   npx tsx scripts/test-rotating-um-fator-extension-payload.ts scripts/fixtures/rotating-um-fator-sample.json
 */

import { readFileSync } from "node:fs";
import { stdin as stdinStream } from "node:process";

import {
  ROTATING_ROOM_EXTENSION_MESSAGE_TYPE,
  ROTATING_ROOM_EXTENSION_VERSION,
  buildExtensionBridgeFromUmFatorIndication,
} from "../src/lib/roulette/rotatingRoomExtensionBridge.ts";
import {
  replayRotatingUmFatorStrategy,
  type RotatingUmFatorReplayInput,
  type RotatingUmFatorSpinEvent,
} from "../src/lib/roulette/rotatingUmFatorSimHarness.ts";

function readStdinUtf8(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stdinStream.on("data", (c) => chunks.push(Buffer.from(c)));
    stdinStream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stdinStream.on("error", reject);
  });
}

function parseEvent(raw: unknown, index: number): RotatingUmFatorSpinEvent {
  if (raw === null || typeof raw !== "object") throw new Error(`events[${index}]: objecto esperado.`);
  const o = raw as Record<string, unknown>;
  const tableId = o.tableId;
  const number = o.number;
  if (typeof tableId !== "number" || !Number.isInteger(tableId) || tableId <= 0) {
    throw new Error(`events[${index}].tableId inválido.`);
  }
  if (typeof number !== "number" || !Number.isInteger(number) || number < 0 || number > 36) {
    throw new Error(`events[${index}].number inválido.`);
  }
  return { tableId, number, at: o.at as string | number | undefined };
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
  return { tableIds, events: o.events.map(parseEvent) };
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

    const result = replayRotatingUmFatorStrategy(parseInput(text.trim()));
    const extensionMessages: unknown[] = [];

    for (const row of result.logs) {
      const bridge = buildExtensionBridgeFromUmFatorIndication(row.indication);
      if (!bridge) continue;
      extensionMessages.push({
        type: ROTATING_ROOM_EXTENSION_MESSAGE_TYPE,
        version: ROTATING_ROOM_EXTENSION_VERSION,
        ...bridge,
        _meta: { step: row.step, spin: `${row.tableId}:${row.number}` },
      });
    }

    console.log("=== Payloads para extensão Chrome (game-odds-glow) ===");
    console.log(`Mensagens com SINAL (bet): ${extensionMessages.length}`);
    console.log("");

    if (extensionMessages.length === 0) {
      console.log("Nenhum sinal de aposta no replay — ajuste o fixture.");
      return;
    }

    for (const msg of extensionMessages) {
      console.log(JSON.stringify(msg, null, 2));
      console.log("---");
    }

    const finalBridge = buildExtensionBridgeFromUmFatorIndication(result.finalIndication);
    console.log("");
    console.log(
      finalBridge
        ? "Estado final: ainda há sinal activo para a extensão."
        : "Estado final: aguardar (sem payload para extensão).",
    );
    console.log("");
    console.log(
      "Na app: postMessage com window.location.origin → content-app.js → background.js → mesa Playtech/Pragmatic",
    );
  })().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

main();
