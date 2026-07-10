import {
  canPlaceIce2fBet,
  defaultIce2fMachineState,
  emptyIce2fStats,
  formatIce2fWatchLabel,
  ice2fBuildActiveFromHistory,
  ice2fClassifyBetRound,
  ice2fIsWatchSlotArmed,
  ice2fBetDelayMs,
  ICE_2F_FIRST_BET_SETTLE_MS,
  ICE_2F_RECOVERY_BET_DELAY_MS,
  ICE_2F_REQUIRED_FAILURES,
  primeIce2fWatchFromHistory,
  tickIce2fPlacar,
} from "../src/lib/roulette/iceCruzamento2fStrategy.ts";

console.assert(ice2fClassifyBetRound(0, {
  criticalPosition: 7,
  axis: "cor-altura",
  factor1: { kind: "cor", value: "V" },
  factor2: { kind: "altura", value: "B" },
  pairKind: "cor-altura",
  referenceNumber: 10,
  armingDescription: "",
}) === "L", "zero na aposta = derrota");

console.assert(ice2fBetDelayMs(0) === ICE_2F_FIRST_BET_SETTLE_MS, "entrada 13s");
console.assert(ice2fBetDelayMs(2) === ICE_2F_RECOVERY_BET_DELAY_MS, "gale 5s");
const t0 = 1_000_000;
console.assert(!canPlaceIce2fBet(0, t0, t0 + 12_999), "entrada bloqueada antes 13s giro");
console.assert(canPlaceIce2fBet(0, t0, t0 + 13_000), "entrada libera 13s após giro");
console.assert(canPlaceIce2fBet(2, t0, t0 + 5000), "gale usa giro");

let hist = [3, 8, 14, 22, 1, 9, 10, 5, 11, 7, 4, 18];
const watch = primeIce2fWatchFromHistory(hist);
console.assert(typeof formatIce2fWatchLabel(watch) === "string", "label watch");

let armed = false;
for (const pos of [5, 6, 7, 9, 10, 11] as const) {
  for (const axis of ["cor-altura", "altura-paridade"] as const) {
    if (ice2fIsWatchSlotArmed(watch[pos][axis])) armed = true;
  }
}
console.log("watch sample:", formatIce2fWatchLabel(watch));

let m = defaultIce2fMachineState();
let s = emptyIce2fStats(5);
m.watch = watch;
m = {
  ...m,
  lastSpinHead: "12:3",
  cycle: {
    active: ice2fBuildActiveFromHistory(hist, 7, "cor-altura")!,
    armedHead: "12:3",
    recovery: 0,
    phase: "awaiting_result",
  },
};
const tieHist = [12, ...hist];
const tieTick = tickIce2fPlacar(tieHist, m, s, 5);
console.assert(tieTick.flash?.kind === "tie" || tieTick.flash?.kind === "win" || tieTick.flash?.kind === "loss", "flash ok");

let m2 = defaultIce2fMachineState();
let s2 = emptyIce2fStats(5);
const histZeroPos7 = [3, 8, 14, 22, 1, 9, 0, 5, 11, 7, 4, 18];
const headZeroPos7 = `${histZeroPos7.length}:${histZeroPos7[0]}`;
m2 = {
  ...defaultIce2fMachineState(),
  lastSpinHead: headZeroPos7,
  cycle: {
    active: {
      criticalPosition: 7,
      axis: "cor-altura",
      factor1: { kind: "cor", value: "V" },
      factor2: { kind: "altura", value: "B" },
      pairKind: "cor-altura",
      referenceNumber: 10,
      armingDescription: "",
    },
    armedHead: headZeroPos7,
    recovery: 2,
    phase: "awaiting_bet",
  },
};
const zeroPauseTick = tickIce2fPlacar(histZeroPos7, m2, s2, 5);
console.assert(
  zeroPauseTick.machine.cycle?.phase === "awaiting_reference",
  "zero na pos crítica → awaiting_reference",
);
console.assert(zeroPauseTick.globalRecovery === 2, "gale mantido na pausa");
console.assert(zeroPauseTick.globalActive == null, "sem aposta activa na pausa");

const histAfterZero = [5, 3, 8, 14, 22, 1, 9, 0, 5, 11, 7, 4, 18];
const resumeTick = tickIce2fPlacar(histAfterZero, zeroPauseTick.machine, s2, 5);
console.assert(
  resumeTick.machine.cycle?.phase === "awaiting_bet",
  "retoma awaiting_bet após zero na pos crítica",
);
console.assert(resumeTick.globalActive != null, "indicação activa na rodada seguinte");
console.assert(resumeTick.globalRecovery === 2, "gale mantido após retomar");

let m3 = defaultIce2fMachineState();
let s3 = emptyIce2fStats(5);
const activeWin = ice2fBuildActiveFromHistory(hist, 7, "cor-altura")!;
let winNum = 0;
for (let n = 1; n <= 36; n++) {
  if (ice2fClassifyBetRound(n, activeWin) === "W") {
    winNum = n;
    break;
  }
}
console.assert(winNum > 0, "número vencedor encontrado");
const prevHead = `${hist.length}:${hist[0]}`;
m3 = {
  ...defaultIce2fMachineState(),
  lastSpinHead: prevHead,
  cycle: {
    active: activeWin,
    armedHead: prevHead,
    recovery: 2,
    phase: "awaiting_result",
  },
};
const winHist = [winNum, ...hist];
const winTick = tickIce2fPlacar(winHist, m3, s3, 5);
console.assert(winTick.flash?.kind === "win", "vitória registada");
console.assert(winTick.globalRecovery === 0, "gale zera após vitória");
console.assert(winTick.machine.cycle == null, "ciclo termina após vitória");
console.assert((winTick.stats.wins ?? 0) === 1, "placar vitória +1");

console.log(`ICE 2F tests OK · required failures = ${ICE_2F_REQUIRED_FAILURES}`);
