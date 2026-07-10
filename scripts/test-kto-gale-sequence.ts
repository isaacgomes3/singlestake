import {
  tickKtoCruzamentoPlacar,
  defaultKtoCruzamentoMachineState,
  emptyKtoCruzamentoStats,
} from "../src/lib/roulette/ktoCruzamentoSequencialStrategy.ts";

let hist: number[] = [];
let m = defaultKtoCruzamentoMachineState();
let s = emptyKtoCruzamentoStats();

function spin(n: number, placeBet = false) {
  hist.unshift(n);
  const r = tickKtoCruzamentoPlacar(hist, m, s, 5);
  m = r.machine;
  s = r.stats;
  if (placeBet && m.cycle?.phase === "awaiting_bet") {
    m = { ...m, cycle: { ...m.cycle, phase: "awaiting_result" } };
  }
  console.log(`n=${n} recovery=${m.recovery} cycle=${m.cycle?.recovery ?? "-"} flash=${r.flash?.kind ?? "-"}`);
}

spin(11);
spin(10, true);
spin(36); // loss -> recovery 1
spin(14);
spin(36, true); // gale 1
spin(22); // tie (black high - one factor for black+low from 14,36?)
console.log("after tie machine.recovery=", m.recovery);
spin(21);
spin(31, true); // new trigger should be gale 1
console.log("new trigger cycle.recovery=", m.cycle?.recovery);
