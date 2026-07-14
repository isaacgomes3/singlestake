/**
 * Smoke: ICE 2F — gatilho 3×6; indica no match.
 */
import assert from "node:assert/strict";
import {
  configureIce2fDefaultComparePairs,
  configureIce2fComparePairs,
  defaultIce2fMachineState,
  emptyIce2fStats,
  ice2fBuildActiveFromHistory,
  ice2fBuildActiveFromHit,
  ice2fFindHitForPair,
  tickIce2fPlacar,
  tryArmCycleFromWatch,
  ICE_2F_MIN_HISTORY,
} from "../src/lib/roulette/iceCruzamento2fStrategy.ts";

configureIce2fDefaultComparePairs();

function histWithPair(n3: number, n6: number, fill = 7): number[] {
  const h = Array.from({ length: ICE_2F_MIN_HISTORY }, (_, i) => ((i * fill) % 36) + 1);
  h[2] = n3;
  h[5] = n6;
  return h;
}

{
  const hit = ice2fFindHitForPair(histWithPair(14, 32), 3, 6);
  assert.ok(hit);
  assert.equal(hit!.axis, "cor-paridade");
}

{
  const hit = ice2fFindHitForPair(histWithPair(4, 2), 3, 6);
  assert.ok(hit, "4×2 partilham 3F");
  assert.equal(hit!.sharedCount, 3);
  const active = ice2fBuildActiveFromHistory(histWithPair(4, 2));
  assert.ok(active);
  assert.equal(active!.factor1.value, "Preto");
  assert.equal(active!.factor2.value, "Par");
}

{
  assert.equal(ice2fFindHitForPair(histWithPair(35, 10), 3, 6), null);
}

// 3×6: indica no primeiro match
{
  const hist = histWithPair(14, 32);
  const m = tryArmCycleFromWatch(defaultIce2fMachineState(), hist, "18:first");
  assert.ok(m.cycle, "indica no match sem falhas prévias");
  assert.equal(m.cycle!.active.pairId, "3x6");
}

console.log("ok — 3×6 · match imediato");

// Empate fecha; gale mantido
{
  configureIce2fComparePairs([{ positions: [3, 6], requiredFailures: 0 }]);
  const base = Array.from({ length: 20 }, (_, i) => ((i * 7) % 36) + 1);
  base[2] = 4;
  base[5] = 2;
  const hit = ice2fFindHitForPair(base, 3, 6, { id: "3x6", requiredFailures: 0 });
  assert.ok(hit);
  const active = ice2fBuildActiveFromHit(hit!);
  const m = {
    ...defaultIce2fMachineState(),
    watch: { "3x6": { failures: 0 } },
    lastSpinHead: "20:x",
    cycle: {
      active: { ...active!, pairId: "3x6" },
      armedHead: "20:x",
      recovery: 1,
      phase: "awaiting_result" as const,
    },
  };
  const tick = tickIce2fPlacar([12, ...base], m, emptyIce2fStats(5), 5);
  assert.equal(tick.flash?.kind, "tie");
  const galeKept =
    tick.machine.cycle?.recovery ?? tick.machine.pendingRecovery ?? 0;
  assert.equal(galeKept, 1);

  configureIce2fDefaultComparePairs();
}

console.log("ok — empate · gale mantido");
