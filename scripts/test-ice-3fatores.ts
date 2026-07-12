/**
 * Smoke — ICE 3F eco → cor/altura · empate 1F · gale ×2 · máx. 5 gales.
 */
import assert from "node:assert/strict";
import {
  defaultIce3fMachineState,
  emptyIce3fStats,
  ICE_3F_MAX_GALES,
  ice3fBuildActiveFromHistory,
  ice3fClassifyBetRound,
  ice3fClassifyMatch,
  ice3fDoubleClicks,
  ice3fFindEchoTrigger,
  ice3fNextUnitScaleAfterLoss,
  ice3fPadFactorPlacementMs,
  ice3fPairForNumber,
  tickIce3fPlacar,
  tryArmCycleFromWatch,
} from "../src/lib/roulette/iceTresFatoresStrategy.ts";

assert.equal(ICE_3F_MAX_GALES, 5);
assert.equal(ice3fNextUnitScaleAfterLoss(1), 2);
assert.equal(ice3fNextUnitScaleAfterLoss(2), 4);
assert.equal(ice3fNextUnitScaleAfterLoss(4), 8);

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

let stakeM = { ...defaultIce3fMachineState(), stakeMode: "auto" as const, entryUnits: 1, winsTowardEntryBump: 62 };
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

// [22, 5, 8, 22, …] → recente 22, ocorrência em i=3, esquerda = 8 → cor/altura do 8
const hist = [22, 5, 8, 22, 3, 1, 9, 11, 7, 4];
const hit = ice3fFindEchoTrigger(hist);
assert.ok(hit);
assert.equal(hit!.signalNumber, 8);

const active = ice3fBuildActiveFromHistory(hist);
assert.ok(active);
assert.deepEqual(active!.factors, ice3fPairForNumber(8));
assert.equal(active!.factors.length, 2);

// 8 = Preto · Baixo — vitória 2/2; 5 = Vermelho · Baixo → empate; 19 = Vermelho · Alto → derrota
assert.equal(ice3fClassifyMatch(8, 8), "total_win");
assert.equal(ice3fClassifyMatch(5, 8), "tie");
assert.equal(ice3fClassifyMatch(19, 8), "total_loss");

assert.equal(ice3fFindEchoTrigger([22, 22, 5, 8, 22]), null);

let machine = defaultIce3fMachineState();
machine = tryArmCycleFromWatch(machine, hist, `${hist.length}:${hist[0]}`);
assert.ok(machine.cycle);
assert.equal(machine.cycle!.galeStreak, 0);

// Entrada 2u: armagem usa 2
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

// Empate (5 vs 8): mesma indicação, sem gale
const afterTie = tickIce3fPlacar([5, ...hist], afterBet, emptyIce3fStats());
assert.equal(afterTie.flash?.kind, "tie");
assert.ok(afterTie.machine.cycle);
assert.equal(afterTie.machine.cycle!.phase, "awaiting_bet");
assert.equal(afterTie.machine.cycle!.active.referenceNumber, 8);
assert.equal(afterTie.machine.cycle!.unitScale, 1);
assert.equal(afterTie.machine.cycle!.galeStreak, 0);

// Derrota total (19 vs 8): gale ×2; sem eco do 19 no histórico → só escala pendente
const afterLoss = tickIce3fPlacar([19, ...hist], afterBet, emptyIce3fStats());
assert.equal(afterLoss.flash?.kind, "loss");
assert.equal(afterLoss.machine.cycle, null);
assert.equal(afterLoss.machine.pendingUnitScale, 2);
assert.equal(afterLoss.machine.pendingGaleStreak, 1);

// Com eco do nº derrotado: [19, 7, 19, …] → sinal 7 com gale ×2
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
assert.equal(lossWithEcho.machine.cycle!.unitScale, 2);
assert.equal(lossWithEcho.machine.cycle!.galeStreak, 1);

// 5 gales → derrota final
const failMachine = {
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
const afterFail = tickIce3fPlacar([19, ...hist], failMachine, emptyIce3fStats());
assert.equal(afterFail.flash?.kind, "cycle_fail");
assert.equal(afterFail.machine.pendingUnitScale ?? 0, 0);

console.log("ok — ice3f eco cor/altura empate/gale×2", {
  signal: active!.referenceNumber,
  labels: active!.armingDescription,
  maxGales: ICE_3F_MAX_GALES,
});
