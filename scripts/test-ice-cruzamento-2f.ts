/**
 * Smoke básico ICE 2F (stake/placar). Gatilho 11/22 → ver test-ice-cruzamento-2f-eco.ts
 */
import {
  canPlaceIce2fBet,
  defaultIce2fMachineState,
  emptyIce2fStats,
  formatIce2fWatchLabel,
  ice2fBuildActiveFromHistory,
  ice2fClassifyBetRound,
  ice2fIsWatchSlotArmed,
  ice2fBetDelayMs,
  ICE_2F_RECOVERY_BET_DELAY_MS,
  ice2fDoubleClicks,
  ice2fRecoveryAfterLoss,
  ice2fRecoveryAfterWin,
  ice2fStakeUnits,
  ice2fZeroDebtForRecovery,
  primeIce2fWatchFromHistory,
  tickIce2fPlacar,
} from "../src/lib/roulette/iceCruzamento2fStrategy.ts";

console.assert(
  ice2fClassifyBetRound(0, {
    criticalPosition: 11,
    axis: "cor-altura",
    factor1: { kind: "cor", value: "V" },
    factor2: { kind: "altura", value: "B" },
    pairKind: "cor-altura",
    referenceNumber: 10,
    armingDescription: "",
  }) === "L",
  "zero na aposta = derrota (gale)",
);

console.assert(ice2fStakeUnits(0) === 1, "entrada 1u");
console.assert(ice2fStakeUnits(1) === 2, "gale1 2u");
console.assert(ice2fStakeUnits(3) === 8, "gale3 8u");
console.assert(ice2fStakeUnits(5) === 32, "gale5 32u");
console.assert(ice2fStakeUnits(0, 1) === 2, "1 zero → entrada 2u");
console.assert(ice2fStakeUnits(1, 1) === 4, "1 zero → gale1 4u");
console.assert(ice2fStakeUnits(0, 2) === 4, "2 zeros → entrada 4u");
console.assert(ice2fDoubleClicks(0) === 0, "entrada 0× dobrar");
console.assert(ice2fDoubleClicks(1) === 1, "gale1 1× dobrar");
console.assert(ice2fDoubleClicks(3) === 3, "gale3 3× dobrar");
console.assert(ice2fDoubleClicks(0, 1) === 1, "recup 1 zero → entrada 1× dobrar");
console.assert(ice2fZeroDebtForRecovery(3) === 7, "zero no gale3 → dívida 1+2+4=7");
console.assert(ice2fRecoveryAfterLoss(0) === 1, "perda sobe 0→1");
console.assert(ice2fRecoveryAfterWin(3) === 0, "vitória zera gale");
console.assert(ice2fRecoveryAfterWin(0) === 0, "vitória em 0 fecha ciclo");

console.assert(ice2fBetDelayMs(0) === ICE_2F_RECOVERY_BET_DELAY_MS, "entrada delay");
console.assert(ice2fBetDelayMs(2) === ICE_2F_RECOVERY_BET_DELAY_MS, "gale delay");
console.assert(ice2fBetDelayMs(2, true) === 800, "reentrada imediata");
const t0 = 1_000_000;
console.assert(!canPlaceIce2fBet(0, t0, t0 + 5_999), "entrada bloqueada antes delay");
console.assert(canPlaceIce2fBet(0, t0, t0 + 6_000), "entrada libera após delay");
console.assert(canPlaceIce2fBet(2, t0, t0 + 6000), "gale usa giro");
console.assert(canPlaceIce2fBet(3, t0, t0 + 800, true), "imediato libera em 800ms");
console.assert(!canPlaceIce2fBet(3, t0, t0 + 799, true), "imediato bloqueado antes 800ms");

const hist = Array.from({ length: 18 }, (_, i) => ((i * 7) % 36) + 1);
hist[2] = 14;
hist[5] = 32;
const watch = primeIce2fWatchFromHistory(hist);
console.assert(typeof formatIce2fWatchLabel(watch) === "string", "label watch");

for (const id of ["3x6", "2x4"] as const) {
  console.assert(watch[id] != null, `watch ${id}`);
  void ice2fIsWatchSlotArmed(watch[id]!, 1);
}

const active36 = ice2fBuildActiveFromHistory(hist, 3, "cor-paridade");
console.assert(!!active36, "active 3/6");
const m = {
  ...defaultIce2fMachineState(),
  watch,
  lastSpinHead: `${hist.length}:${hist[0]}`,
  cycle: {
    active: active36!,
    armedHead: `${hist.length}:${hist[0]}`,
    recovery: 0,
    phase: "awaiting_result" as const,
  },
};
const tieTick = tickIce2fPlacar([12, ...hist], m, emptyIce2fStats(5), 5);
console.assert(
  tieTick.flash?.kind === "tie" ||
    tieTick.flash?.kind === "win" ||
    tieTick.flash?.kind === "loss",
  "flash ok",
);

console.log("ok — ice2f stake/placar basico (ver também test-ice-cruzamento-2f-eco.ts)");
