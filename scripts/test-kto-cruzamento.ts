import {
  detectKtoCruzamentoTrigger,
  tickKtoCruzamentoPlacar,
  defaultKtoCruzamentoMachineState,
  emptyKtoCruzamentoStats,
} from "../src/lib/roulette/ktoCruzamentoSequencialStrategy.ts";

const cases = [
  [11, 10], // mesma dúzia — não indica
  [31, 21], // dúzias diferentes — indica
  [36, 14], // dúzias diferentes — indica
  [12, 11], // mesma dúzia — não indica
  [10, 12], // mesma dúzia, 2 factores — não indica
];
for (const h of cases) {
  const t = detectKtoCruzamentoTrigger(h);
  console.log(h.join(","), "->", t ? t.armingDescription : "null");
}

let m = defaultKtoCruzamentoMachineState();
let s = emptyKtoCruzamentoStats();
const spins = [10, 11, 5, 22];
let hist: number[] = [];
for (const n of spins) {
  hist = [n, ...hist];
  const r = tickKtoCruzamentoPlacar(hist, m, s);
  m = r.machine;
  s = r.stats;
  console.log(
    "spin",
    n,
    "phase",
    m.cycle?.phase ?? "idle",
    "recovery",
    r.globalRecovery,
    "flash",
    r.flash?.kind ?? "-",
  );
}
