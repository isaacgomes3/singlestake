/**
 * Smoke: 24D Spin Cruzamento 2F — classificação 1–24 + gatilho 2×4.
 */
import assert from "node:assert/strict";
import {
  spin24dColorOf,
  spin24dHeightOf,
  spin24dParityOf,
  spin24dTriggerMatchCount,
  spin24dEvaluateRound,
  factorsFor24dNumberOnAxis,
} from "../src/lib/roulette/spin24dFactors.ts";
import {
  configureIce2fDefaultComparePairs,
  defaultIce2fMachineState,
  emptyIce2fStats,
  ice2fFindHitForPair,
  tickIce2fPlacar,
  tryArmCycleFromWatch,
  ICE_2F_ROULETTE_TABLE_ID,
  ICE_2F_MIN_HISTORY,
} from "../src/lib/roulette/spin24dCruzamento2fStrategy.ts";

assert.equal(ICE_2F_ROULETTE_TABLE_ID, 3426);

// Cores por coluna
assert.equal(spin24dColorOf(1), "Vermelho");
assert.equal(spin24dColorOf(5), "Preto");
assert.equal(spin24dColorOf(9), "Vermelho");
assert.equal(spin24dColorOf(13), "Preto");
assert.equal(spin24dColorOf(20), "Vermelho");
assert.equal(spin24dColorOf(24), "Preto");

// Altura 1–12 / 13–24
assert.equal(spin24dHeightOf(12), "Baixo");
assert.equal(spin24dHeightOf(13), "Alto");

assert.equal(spin24dParityOf(2), "Par");
assert.equal(spin24dParityOf(3), "Impar");

// 1 e 2: ambos vermelho + baixo; paridades diferentes → 2 factores
assert.equal(spin24dTriggerMatchCount(1, 2), 2);
const factors = factorsFor24dNumberOnAxis(1, "cor-altura");
assert.ok(factors);
assert.equal(factors![0].value, "Vermelho");
assert.equal(factors![1].value, "Baixo");

// Avaliação: Vermelho+Baixo → nº5 (Preto+Baixo) = empate (1 factor)
assert.equal(
  spin24dEvaluateRound(5, { kind: "cor", value: "Vermelho" }, { kind: "altura", value: "Baixo" }),
  "continue",
);
assert.equal(
  spin24dEvaluateRound(1, { kind: "cor", value: "Vermelho" }, { kind: "altura", value: "Baixo" }),
  "W",
);
assert.equal(
  spin24dEvaluateRound(24, { kind: "cor", value: "Vermelho" }, { kind: "altura", value: "Baixo" }),
  "L",
);

configureIce2fDefaultComparePairs();

function histWithPair24(n2: number, n4: number): number[] {
  const h = Array.from({ length: Math.max(ICE_2F_MIN_HISTORY, 8) }, (_, i) => ((i * 5) % 24) + 1);
  h[1] = n2;
  h[3] = n4;
  return h;
}

{
  const hist = histWithPair24(1, 2);
  const hit = ice2fFindHitForPair(hist, 2, 4);
  assert.ok(hit, "1×2 partilham 2F em 24D");
  assert.equal(hit!.axis, "cor-altura");
  const m = tryArmCycleFromWatch(defaultIce2fMachineState(), hist, "18:24d");
  assert.ok(m.cycle);
  assert.equal(m.cycle!.active.pairId, "2x4");
}

// Após liquidar: não rearma no mesmo giro (evita indicação fantasma sem clique).
{
  const base = histWithPair24(1, 2);
  let m = tryArmCycleFromWatch(defaultIce2fMachineState(), base, "h0");
  assert.ok(m.cycle);
  m = {
    ...m,
    lastSpinHead: "h0",
    cycle: { ...m.cycle!, phase: "awaiting_result" as const },
  };
  // nº1 = Vermelho+Baixo → W nos factores típicos do match 1×2
  const tick = tickIce2fPlacar([1, ...base], m, emptyIce2fStats(5), 5);
  assert.equal(tick.flash?.kind, "win");
  assert.equal(tick.machine.cycle, null, "não rearma no giro do liquidar");
  assert.equal(tick.globalActive, null);
}

console.log("ok — spin24d factors + cruzamento 2×4");
console.log("ok — sem rearm no liquidar (anti fantasma)");
