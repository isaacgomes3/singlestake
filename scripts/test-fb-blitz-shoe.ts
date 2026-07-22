/**
 * Smoke — shoe 8 baralhos: contadores por lado + P(casa/visitante).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const code = readFileSync(
  path.resolve("extension-reals-football-blitz-obs/football-blitz-obs-engine.js"),
  "utf8",
);
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const Api = sandbox.SinglestakeFootballBlitzObs;

const empty = Api.buildFootballBlitzShoeStats([], { decks: 8 });
assert.equal(empty.shoeTotal, 416);
assert.equal(empty.remaining.total, 416);
assert.equal(empty.probs.home, empty.probs.away);
assert.ok(empty.probs.home > 40 && empty.probs.home < 50);

// K home + A away
const hist = [{ gameId: "1", winner: "home", winningNumber: 13, scoreDiff: 12 }];
const shoe = Api.buildFootballBlitzShoeStats(hist, { decks: 8 });
assert.equal(shoe.sideOut.home.high, 1);
assert.equal(shoe.sideOut.away.low, 1);
assert.equal(shoe.cardsSeen, 2);
assert.equal(shoe.remaining.total, 414);

console.log("ok — shoe stats", shoe.probs);
