/**
 * Smoke — ICE 3F eco → 3 factores · parcial ×2 (+1 gale) · total ×4 (+2 gales).
 */
import assert from "node:assert/strict";
import {
  defaultIce3fMachineState,
  emptyIce3fStats,
  ICE_3F_FACTORS_PER_BET,
  ICE_3F_MAX_GALES,
  ICE_3F_TOTAL_LOSS_MULTIPLIER,
  ice3fBuildActiveFromHistory,
  ice3fClassifyBetRound,
  ice3fClassifyMatch,
  ice3fDoubleClicks,
  ice3fFindEchoTrigger,
  ice3fGaleStepsAfterLoss,
  ice3fNextUnitScaleAfterLoss,
  ice3fPadFactorPlacementMs,
  ice3fTripleForNumber,
  tickIce3fPlacar,
  tryArmCycleFromWatch,
} from "../src/lib/roulette/iceTresFatoresStrategy.ts";

assert.equal(ICE_3F_MAX_GALES, 5);
assert.equal(ICE_3F_FACTORS_PER_BET, 3);
assert.equal(ICE_3F_TOTAL_LOSS_MULTIPLIER, 4);
assert.equal(ice3fNextUnitScaleAfterLoss(1, "partial_loss"), 2);
assert.equal(ice3fNextUnitScaleAfterLoss(1, "total_loss"), 4);
assert.equal(ice3fNextUnitScaleAfterLoss(2, "partial_loss"), 4);
assert.equal(ice3fNextUnitScaleAfterLoss(2, "total_loss"), 8);
assert.equal(ice3fGaleStepsAfterLoss("partial_loss"), 1);
assert.equal(ice3fGaleStepsAfterLoss("total_loss"), 2);

import {
  ICE_3F_WINS_PER_ENTRY_BUMP,
  ice3fApplyFinalLossEntryReset,
  ice3fApplyWinEntryProgress,
  ice3fEntryUnitsOf,
  ice3fNormalizeEntryUnits,
} from "../src/lib/roulette/iceTresFatoresStrategy.ts";

assert.equal(ICE_3F_WINS_PER_ENTRY_BUMP, 63);
assert.equal(ice3fNormalizeEntryUnits(3), 4);
assert.equal(ice3fNormalizeEntryUnits(2), 2);

let stakeM = {
  ...defaultIce3fMachineState(),
  stakeMode: "auto" as const,
  entryUnits: 1,
  winsTowardEntryBump: 62,
};
stakeM = ice3fApplyWinEntryProgress(stakeM);
assert.equal(ice3fEntryUnitsOf(stakeM), 2);
assert.equal(stakeM.winsTowardEntryBump, 0);

stakeM = ice3fApplyFinalLossEntryReset({
  ...stakeM,
  entryUnits: 4,
  stakeMode: "auto",
});
assert.equal(ice3fEntryUnitsOf(stakeM), 1);

const manualKeep = ice3fApplyFinalLossEntryReset({
  ...defaultIce3fMachineState(),
  stakeMode: "manual",
  entryUnits: 4,
});
assert.equal(ice3fEntryUnitsOf(manualKeep), 4);

assert.equal(ice3fClassifyBetRound(0, 10), "total_loss");
assert.equal(ice3fClassifyMatch(0, 10), null);
assert.equal(ice3fPadFactorPlacementMs(1), 1050);
assert.equal(ice3fPadFactorPlacementMs(8), 0);

assert.equal(ice3fDoubleClicks(1), 0);
assert.equal(ice3fDoubleClicks(2), 1);
assert.equal(ice3fDoubleClicks(4), 2);

// [22, 5, 8, 22, …] → recente 22, ocorrência em i=3, esquerda = 8 → 3F do 8
const hist = [22, 5, 8, 22, 3, 1, 9, 11, 7, 4];
const hit = ice3fFindEchoTrigger(hist);
assert.ok(hit);
assert.equal(hit!.signalNumber, 8);

const active = ice3fBuildActiveFromHistory(hist);
assert.ok(active);
assert.deepEqual(active!.factors, ice3fTripleForNumber(8));
assert.equal(active!.factors.length, 3);

// 8 = Preto · Baixo · Par
// 8 vs 8 → 3/3 vitória; nº com 2 factores → partial_win;
// 5 = Vermelho · Baixo · Ímpar → só altura → partial_loss (+1 gale);
// 19 = Vermelho · Alto · Ímpar → 0 → total_loss (+2 gales)
assert.equal(ice3fClassifyMatch(8, 8), "total_win");
assert.equal(ice3fClassifyMatch(11, 8), "partial_win"); // 11 preto baixo ímpar → cor+altura
assert.equal(ice3fClassifyMatch(5, 8), "partial_loss");
assert.equal(ice3fClassifyMatch(33, 8), "partial_loss");
assert.equal(ice3fClassifyMatch(19, 8), "total_loss");

import { ice3fSettlementNet, ice3fHitsForOutcome } from "../src/lib/roulette/iceTresFatoresStrategy.ts";
import { stakeForIce3fAutomation } from "../src/lib/roulette/rotatingRoomIce3fStrategy.ts";

assert.equal(stakeForIce3fAutomation(1, 50), 150);
assert.equal(stakeForIce3fAutomation(2, 50), 300);
assert.equal(ice3fHitsForOutcome("total_win"), 3);
assert.equal(ice3fHitsForOutcome("partial_win"), 2);
assert.equal(ice3fHitsForOutcome("partial_loss"), 1);
assert.equal(ice3fHitsForOutcome("total_loss"), 0);
assert.equal(ice3fSettlementNet(150, 3), 150);
assert.equal(ice3fSettlementNet(150, 2), 50);
assert.equal(ice3fSettlementNet(150, 1), -50);
assert.equal(ice3fSettlementNet(150, 0), -150);

assert.equal(ice3fFindEchoTrigger([22, 22, 5, 8, 22]), null);

let machine = defaultIce3fMachineState();
machine = tryArmCycleFromWatch(machine, hist, `${hist.length}:${hist[0]}`);
assert.ok(machine.cycle);
assert.equal(machine.cycle!.galeStreak, 0);

let m2 = {
  ...defaultIce3fMachineState(),
  entryUnits: 2,
  stakeMode: "manual" as const,
};
m2 = tryArmCycleFromWatch(m2, hist, `${hist.length}:${hist[0]}`);
assert.ok(m2.cycle);
assert.equal(m2.cycle!.unitScale, 2);

const afterBet = {
  ...machine,
  lastSpinHead: `${hist.length}:${hist[0]}`,
  cycle: { ...machine.cycle!, phase: "awaiting_result" as const },
};

// Stuck recovery: lastSpinHead já no head novo sem liquidar
const stuckHead = "11:33";
const stuckMachine = {
  ...afterBet,
  lastSpinHead: stuckHead,
  cycle: { ...afterBet.cycle, armedHead: `${hist.length}:${hist[0]}` },
};
const unstuck = tickIce3fPlacar([33, ...hist], stuckMachine, emptyIce3fStats());
assert.equal(unstuck.flash?.kind, "loss");
assert.equal(unstuck.flash?.matchOutcome, "partial_loss");
assert.equal(unstuck.machine.pendingUnitScale, 2);

// Parcial (33 vs 8: só cor): ×2 / +1 gale; 33 sem eco no hist → só escala pendente
const afterPartial = tickIce3fPlacar([33, ...hist], afterBet, emptyIce3fStats());
assert.equal(afterPartial.flash?.kind, "loss");
assert.equal(afterPartial.flash?.matchOutcome, "partial_loss");
assert.equal(afterPartial.machine.cycle, null);
assert.equal(afterPartial.machine.pendingUnitScale, 2);
assert.equal(afterPartial.machine.pendingGaleStreak, 1);

// Total (19 vs 8): ×4 / +2 gales
const afterTotal = tickIce3fPlacar([19, ...hist], afterBet, emptyIce3fStats());
assert.equal(afterTotal.flash?.kind, "loss");
assert.equal(afterTotal.flash?.matchOutcome, "total_loss");
assert.equal(afterTotal.machine.cycle, null);
assert.equal(afterTotal.machine.pendingUnitScale, 4);
assert.equal(afterTotal.machine.pendingGaleStreak, 2);

// Com eco do nº derrotado: [19, 7, 19, …] → sinal 7 com gale ×4 (total)
const lossWithEcho = tickIce3fPlacar(
  [19, 7, 19, 3, 1],
  {
    ...afterBet,
    lastSpinHead: "5:7",
  },
  emptyIce3fStats(),
);
assert.equal(lossWithEcho.flash?.kind, "loss");
assert.ok(lossWithEcho.machine.cycle);
assert.equal(lossWithEcho.machine.cycle!.active.referenceNumber, 7);
assert.equal(lossWithEcho.machine.cycle!.unitScale, 4);
assert.equal(lossWithEcho.machine.cycle!.galeStreak, 2);

// Após gale 5, continua (persiste até vitória) — parcial +1 → gale 6 ×32
const continueMachine = {
  ...defaultIce3fMachineState(),
  lastSpinHead: "10:22",
  cycle: {
    active: active!,
    armedHead: "10:22",
    unitScale: 16,
    galeStreak: 5,
    consecutiveTriples: 0,
    galesSinceTriple: 0,
    phase: "awaiting_result" as const,
  },
};
const afterGale5 = tickIce3fPlacar([5, ...hist], continueMachine, emptyIce3fStats());
assert.equal(afterGale5.flash?.kind, "loss");
assert.equal(afterGale5.machine.cycle?.unitScale ?? afterGale5.machine.pendingUnitScale, 32);
assert.equal(afterGale5.machine.cycle?.galeStreak ?? afterGale5.machine.pendingGaleStreak, 6);

// Em gale 4, total (+2) também continua (gale 6), sem derrota final
const afterTotalJump = tickIce3fPlacar(
  [19, ...hist],
  {
    ...continueMachine,
    cycle: { ...continueMachine.cycle, galeStreak: 4, unitScale: 8 },
  },
  emptyIce3fStats(),
);
assert.equal(afterTotalJump.flash?.kind, "loss");
assert.equal(afterTotalJump.machine.cycle?.galeStreak ?? afterTotalJump.machine.pendingGaleStreak, 6);
assert.equal(afterTotalJump.machine.cycle?.unitScale ?? afterTotalJump.machine.pendingUnitScale, 32);

console.log("ok — ice3f eco 3F parcial×2 / total×4 · gale até vitória", {
  signal: active!.referenceNumber,
  labels: active!.armingDescription,
  placarBuckets: ICE_3F_MAX_GALES,
});
