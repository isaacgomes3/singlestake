/**
 * Gera payloads da extensão a partir de feed Playtech — só para teste manual.
 * Não passa pela app Singlestake nem pelo iframe DGA.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildExtensionBridgeFromUmFatorIndication } from "../src/lib/roulette/rotatingRoomExtensionBridge.ts";
import {
  ROTATING_ROOM_EXTENSION_MESSAGE_TYPE,
  ROTATING_ROOM_EXTENSION_VERSION,
} from "../src/lib/roulette/rotatingRoomExtensionBridge.ts";
import { replayRotatingUmFatorStrategy } from "../src/lib/roulette/rotatingUmFatorSimHarness.ts";
import { playtechFeedToReplayInput } from "./feedAdapter.ts";
import { isPlaytechLobbyFeed } from "./types.ts";

const fixture = new URL("./fixtures/sample-feed.json", import.meta.url);
const raw = readFileSync(process.argv[2] ?? fileURLToPath(fixture), "utf8");
const feed = JSON.parse(raw) as unknown;
if (!isPlaytechLobbyFeed(feed)) throw new Error("Feed Playtech inválido");

const result = replayRotatingUmFatorStrategy(playtechFeedToReplayInput(feed));
const messages: unknown[] = [];

for (const row of result.logs) {
  const bridge = buildExtensionBridgeFromUmFatorIndication({
    ...row.indication,
    tableLabel: feed.tables.find((t) => t.id === row.tableId)?.label ?? null,
  });
  if (!bridge) continue;
  messages.push({
    type: ROTATING_ROOM_EXTENSION_MESSAGE_TYPE,
    version: ROTATING_ROOM_EXTENSION_VERSION,
    ...bridge,
    _note: "Teste Playtech isolado — mesaEmbedUrl deve vir do teu mapa Playtech, não da app DGA",
  });
}

console.log(JSON.stringify({ count: messages.length, messages }, null, 2));
