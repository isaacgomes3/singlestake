import {
  defaultIce3fMachineState,
  emptyIce3fStats,
  ice3fBuildActiveFromHistory,
  ice3fClassifyBetRound,
  ice3fClassifyMatch,
  ice3fIsPositionArmed,
  ice3fNextUnitScaleAfterLoss,
  ice3fPadFactorPlacementMs,
  normalizeIce3fWatchSlot,
  tickIce3fPlacar,
} from "../src/lib/roulette/iceTresFatoresStrategy.ts";

console.assert(ice3fNextUnitScaleAfterLoss(1, "total_loss") === 4, "1T → 4");
console.assert(ice3fNextUnitScaleAfterLoss(2, "total_loss") === 8, "gale1·2T → 8");
console.assert(ice3fNextUnitScaleAfterLoss(8, "total_loss") === 32, "8T → 32");
console.assert(ice3fNextUnitScaleAfterLoss(1, "partial_loss") === 2, "1P gale → 2");
console.assert(ice3fClassifyBetRound(0, 10) === "total_loss", "zero na aposta = T");
console.assert(ice3fClassifyMatch(0, 10) === null, "zero na observação = neutro");
console.assert(ice3fPadFactorPlacementMs(1) === 1050, "pad entrada = gale3");
console.assert(ice3fPadFactorPlacementMs(8) === 0, "pad gale3 = 0");

console.assert(ice3fIsPositionArmed({ total: 2, partial: 0 }), "2T arma");
console.assert(ice3fIsPositionArmed({ total: 1, partial: 3 }), "1T+3P arma");
console.assert(!ice3fIsPositionArmed({ total: 1, partial: 2 }), "1T+2P não arma");
console.assert(!ice3fIsPositionArmed({ total: 0, partial: 3 }), "0T+3P não arma");

let hist = [3, 8, 14, 22, 1, 9, 10, 5, 11, 7, 4, 18, 21];
let m = defaultIce3fMachineState();
let s = emptyIce3fStats();

for (let i = 0; i < 5; i++) {
  const r = tickIce3fPlacar(hist, m, s);
  m = r.machine;
  s = r.stats;
  const watchStr = Object.entries(m.watch)
    .map(([pos, slot]) => `${pos}:${normalizeIce3fWatchSlot(slot).total}T+${normalizeIce3fWatchSlot(slot).partial}P`)
    .join(" · ");
  console.log("watch", watchStr, "cycle", r.globalActive?.armingDescription ?? null);
  hist = [Math.floor(Math.random() * 36) + 1, ...hist].slice(0, 20);
}

const active5 = ice3fBuildActiveFromHistory(hist, 5);
const active11 = ice3fBuildActiveFromHistory(hist, 11);
console.log("active pos5", active5?.armingDescription);
console.log("active pos11", active11?.armingDescription);
console.log("classify win", ice3fClassifyMatch(10, 10));
console.log("classify partial", ice3fClassifyMatch(11, 10));
