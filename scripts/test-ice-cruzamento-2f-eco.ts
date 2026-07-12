/**
 * Smoke: ICE/KTO 2F — indicação única (sem persistir factores antigos).
 */
import assert from "node:assert/strict";
import {
  defaultIce2fMachineState,
  emptyIce2fStats,
  ice2fBuildActiveFromHistory,
  ice2fFindCriticalPosition,
  tickIce2fPlacar,
  tryArmCycleFromWatch,
  ICE_2F_MIN_HISTORY,
} from "../src/lib/roulette/iceCruzamento2fStrategy.ts";

function histWithPair(n11: number, n22: number, fill = 7): number[] {
  const h = Array.from({ length: ICE_2F_MIN_HISTORY }, (_, i) => ((i * fill) % 36) + 1);
  h[10] = n11;
  h[21] = n22;
  return h;
}

{
  const hit = ice2fFindCriticalPosition(histWithPair(14, 32));
  assert.ok(hit);
  assert.equal(hit!.axis, "cor-paridade");
}

{
  const hit = ice2fFindCriticalPosition(histWithPair(4, 2));
  assert.ok(hit, "4×2 partilham 3F");
  assert.equal(hit!.sharedCount, 3);
  assert.equal(hit!.axis, "cor-paridade"); // prioriza cor/paridade → Preto+Par
  const active = ice2fBuildActiveFromHistory(histWithPair(4, 2));
  assert.ok(active);
  assert.equal(active!.factor1.value, "Preto");
  assert.equal(active!.factor2.value, "Par");
}

{
  assert.equal(ice2fFindCriticalPosition(histWithPair(35, 10)), null);
  assert.equal(ice2fBuildActiveFromHistory(histWithPair(35, 10)), null);
}

// Janela perdida: cancela indicação antiga e arma pela leitura actual 11/22
{
  const histOld = histWithPair(14, 32); // Vermelho+Par
  const head0 = `${histOld.length}:${histOld[0]}`;
  let m = tryArmCycleFromWatch(defaultIce2fMachineState(), histOld, head0);
  assert.equal(m.cycle!.active.axis, "cor-paridade");
  assert.equal(m.cycle!.active.factor1.value, "Vermelho");
  assert.equal(m.cycle!.active.factor2.value, "Par");

  m = { ...m, lastSpinHead: head0, cycle: { ...m.cycle!, phase: "awaiting_bet" } };

  // Novo giro: pos 11/22 passam a 4 e 2 (Preto+Par)
  const histNew = [18, ...histWithPair(4, 2)];
  histNew[10] = 4;
  histNew[21] = 2;
  const tick = tickIce2fPlacar(histNew, m, emptyIce2fStats(5), 5);
  assert.equal(tick.missedBetWindow, true);
  assert.ok(tick.machine.cycle, "nova indicação no giro actual");
  assert.equal(tick.machine.cycle!.active.triggerNumber, 4);
  assert.equal(tick.machine.cycle!.active.matchNumber, 2);
  assert.equal(tick.machine.cycle!.active.factor1.value, "Preto");
  assert.equal(tick.machine.cycle!.active.factor2.value, "Par");
}

// Empate: fecha ciclo antigo; no mesmo giro rearma se 11×22 tiver match fresco
{
  const hist = histWithPair(14, 32);
  const head0 = `${hist.length}:${hist[0]}`;
  let m = tryArmCycleFromWatch(defaultIce2fMachineState(), hist, head0);
  m = {
    ...m,
    lastSpinHead: head0,
    cycle: { ...m.cycle!, phase: "awaiting_result", armedHead: head0 },
  };
  // Resultado que acerta 1 factor → tie; board passa a 4×2 → cor/paridade
  const histAfter = [1, ...hist];
  histAfter[10] = 4;
  histAfter[21] = 2;
  const tick = tickIce2fPlacar(histAfter, m, emptyIce2fStats(5), 5);
  assert.equal(tick.flash?.kind, "tie");
  assert.ok(tick.machine.cycle, "deve rearmar cor/paridade no mesmo giro após empate");
  assert.equal(tick.machine.cycle!.active.axis, "cor-paridade");
  assert.equal(tick.machine.cycle!.active.triggerNumber, 4);
}

console.log("ok — indicação única · sem persistir factores antigos");
