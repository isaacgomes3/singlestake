/**
 * Coincidência exacta mais recente; direita = 2 rodadas com mesma cor posição a posição.
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

function round(gameId, winner, winningNumber, scoreDiff) {
  return { gameId, winner, winningNumber, scoreDiff };
}

const threeJAway = (id) => round(id, "away", 11, 8);
const twoTenAway = (id) => round(id, "away", 10, 8);
const fiveHome = (id) => round(id, "home", 5, 2);
const fiveJAway = (id) => round(id, "away", 11, 6);
const fourTenAway = (id) => round(id, "away", 10, 6);
const sixHome = (id) => round(id, "home", 6, 1);

// Ideal: dir do último = azul+amarelo; coincidência com dir azul+amarelo
const ideal = [
  threeJAway("g0"),
  twoTenAway("g1"),
  fiveHome("g2"),
  fiveJAway("g3"),
  threeJAway("g4"),
  fourTenAway("g5"),
  sixHome("g6"),
];
const sig = Api.findFootballBlitzCardPairSignal(ideal);
assert.ok(sig);
assert.equal(sig.indication, "away");
assert.equal(sig.rightWinner, "away");
assert.equal(sig.right2Winner, "home");

// Só 1ª da direita bate, 2ª falha → null
const failSecond = [
  threeJAway("f0"),
  twoTenAway("f1"),
  fiveHome("f2"),
  fiveJAway("f3"),
  threeJAway("f4"),
  fourTenAway("f5"),
  twoTenAway("f6"), // away ≠ home
];
assert.equal(Api.findFootballBlitzCardPairSignal(failSecond), null);

// Regra antiga (só 1 à direita) passaria; com 2× cor a 2ª falha
console.log("ok — dir ×2 mesma cor");
