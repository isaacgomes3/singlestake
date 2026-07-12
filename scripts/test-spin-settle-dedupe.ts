/**
 * Smoke — dedupe de liquidação por openedHead (números da roleta repetem).
 */
import assert from "node:assert/strict";
import {
  freshAutomationSimState,
  isSpinResultAlreadySettled,
  settleOpenBetEntry,
  spinSettleKey,
} from "../src/lib/back-office/rouletteAutomationSim.ts";

let s = freshAutomationSimState();
s = {
  ...s,
  openBet: {
    signalId: "t",
    tableId: 201,
    tableLabel: "Roulette 2 Extra Time",
    stake: 150,
    recovery: 0,
    strategy: "um1fator",
    openedAt: Date.now(),
    openedHead: "14:7",
  },
};
s = settleOpenBetEntry(
  s,
  {
    ts: Date.now(),
    tableId: 201,
    won: false,
    recovery: 0,
    kind: "recovery",
    strategy: "um1fator",
    resultNumber: 14,
    stake: 150,
  },
  "Roulette 2 Extra Time",
);

assert.equal(s.rounds[0]?.resultNumber, 14);
assert.equal(
  isSpinResultAlreadySettled(s, 201, 14),
  false,
  "mesmo numero sem head NAO bloqueia",
);
assert.equal(
  isSpinResultAlreadySettled(s, 201, 14, "14:7"),
  true,
  "mesmo head bloqueia",
);
assert.equal(
  isSpinResultAlreadySettled(s, 201, 14, "15:14"),
  false,
  "head novo libera",
);
assert.ok(s.processedKeys.includes(spinSettleKey(201, 14, "14:7")));
console.log("ok — spin settle dedupe por openedHead");
