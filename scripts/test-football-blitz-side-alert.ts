/**
 * Smoke test — alerta de encontro 100% (ambas mantêm ou ambas mudam).
 */
import assert from "node:assert/strict";

import { findFootballBlitzSidePatternAlert } from "../src/lib/pragmatic/footballBlitzEcoStrategy";
import type {
  FootballBlitzRoundStored,
  FootballBlitzWinner,
} from "../src/lib/pragmatic/dgaFootballBlitzHistory";

function round(
  id: string,
  winner: FootballBlitzWinner,
  scoreDiff: number,
  winningNumber: number,
): FootballBlitzRoundStored {
  return { gameId: id, winner, scoreDiff, winningNumber };
}

// 6 e 9 ambas 100% mantêm; última ronda = 9 vs 6 · casa → indica casa.
const maintainHistory = [
  round("trig", "home", 3, 9), // 9 vs 6 · casa
  round("h", "away", 2, 7), // 7 vs 5
  round("g", "away", 4, 9), // 9 vs 5 · visitante → seguinte mantém
  round("f", "home", 2, 7), // 7 vs 5
  round("e", "home", 4, 6), // 6 vs 2 · casa → seguinte mantém
  round("d", "away", 3, 8), // 8 vs 5
  round("c", "away", 1, 9), // 9 vs 8 · visitante → seguinte mantém
  round("b", "home", 1, 5), // 5 vs 4
  round("a", "home", 4, 6), // 6 vs 2 · casa → seguinte mantém
];

const maintainAlert = findFootballBlitzSidePatternAlert(maintainHistory, { minSamples: 2 });
assert.ok(maintainAlert);
assert.equal(maintainAlert.mode, "maintain");
assert.equal(maintainAlert.homeLabel, "9");
assert.equal(maintainAlert.awayLabel, "6");
assert.equal(maintainAlert.indication, "home");

// 8 e 3 ambas 100% mudam; última = 8 vs 3 · casa → indica visitante.
const changeHistory = [
  round("trig", "home", 5, 8), // 8 vs 3
  round("h", "away", 2, 9), // 9 vs 7 · muda após g
  round("g", "home", 5, 8), // 8 vs 3
  round("f", "away", 1, 5), // 5 vs 4 · muda após e
  round("e", "home", 1, 4), // 4 vs 3
  round("d", "away", 2, 7), // 7 vs 5 · muda após c
  round("c", "home", 5, 8), // 8 vs 3
  round("b", "away", 2, 9), // 9 vs 7 · muda após a
  round("a", "home", 1, 4), // 4 vs 3
];

const changeAlert = findFootballBlitzSidePatternAlert(changeHistory, { minSamples: 2 });
assert.ok(changeAlert);
assert.equal(changeAlert.mode, "change");
assert.equal(changeAlert.homeLabel, "8");
assert.equal(changeAlert.awayLabel, "3");
assert.equal(changeAlert.indication, "away");

// Encontro misto 100% manter × 100% mudar → já não alerta.
const mixedHistory = [
  round("trig", "home", 2, 8), // 8 vs 6
  round("h", "away", 2, 9),
  round("g", "away", 2, 6),
  round("f", "home", 2, 7),
  round("e", "home", 4, 6),
  round("d", "away", 1, 5),
  round("c", "home", 4, 8),
  round("b", "away", 2, 9),
  round("a", "home", 5, 8),
];
assert.equal(findFootballBlitzSidePatternAlert(mixedHistory, { minSamples: 2 }), null);

console.log("ok — Football Blitz side pattern alert (ambas iguais)");
