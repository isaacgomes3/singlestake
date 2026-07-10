import {
  tickKtoCruzamentoPlacar,
  defaultKtoCruzamentoMachineState,
  emptyKtoCruzamentoStats,
} from "../src/lib/roulette/ktoCruzamentoSequencialStrategy.ts";

let s = emptyKtoCruzamentoStats();

// Gale 3 win zera recovery
let m = defaultKtoCruzamentoMachineState();
m.recovery = 3;
m.lastSpinHead = "1:14";
let r1 = tickKtoCruzamentoPlacar([36, 14], m, s, 5);
m = { ...r1.machine, cycle: r1.machine.cycle ? { ...r1.machine.cycle, phase: "awaiting_result" as const } : null };
s = r1.stats;
const rWin = tickKtoCruzamentoPlacar([12, 36, 14], m, s, 5);
console.log(
  "gale3 win ok:",
  rWin.flash?.kind === "win" && rWin.machine.recovery === 0,
);

// betCommitInFlight: giro durante CDP ainda avalia vitória
m = defaultKtoCruzamentoMachineState();
m.recovery = 3;
m.lastSpinHead = "1:14";
s = emptyKtoCruzamentoStats();
const rArm = tickKtoCruzamentoPlacar([36, 14], m, s, 5);
m = { ...rArm.machine, betCommitInFlight: true };
const rFly = tickKtoCruzamentoPlacar([12, 36, 14], m, s, 5);
console.log(
  "in-flight win ok:",
  rFly.flash?.kind === "win" && rFly.machine.recovery === 0,
);
