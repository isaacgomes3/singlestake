/**
 * Smoke: ICE 2F — gatilho 2×4; indica no match.
 */
import assert from "node:assert/strict";
import {
  configureIce2fDefaultComparePairs,
  configureIce2fComparePairs,
  defaultIce2fMachineState,
  emptyIce2fStats,
  ice2fBuildActiveFromHit,
  ice2fFindHitForPair,
  tickIce2fPlacar,
  tryArmCycleFromWatch,
  ICE_2F_MIN_HISTORY,
} from "../src/lib/roulette/iceCruzamento2fStrategy.ts";

configureIce2fDefaultComparePairs();

function histWithPair24(n2: number, n4: number, fill = 7): number[] {
  const h = Array.from({ length: ICE_2F_MIN_HISTORY }, (_, i) => ((i * fill) % 36) + 1);
  h[1] = n2;
  h[3] = n4;
  return h;
}

{
  const hit = ice2fFindHitForPair(histWithPair24(14, 32), 2, 4);
  assert.ok(hit);
  assert.equal(hit!.axis, "cor-paridade");
}

{
  const hit = ice2fFindHitForPair(histWithPair24(4, 2), 2, 4);
  assert.ok(hit, "4×2 partilham 3F");
  assert.equal(hit!.sharedCount, 3);
}

{
  assert.equal(ice2fFindHitForPair(histWithPair24(35, 10), 2, 4), null);
}

// 2×4: indica no primeiro match
{
  const hist = histWithPair24(14, 32);
  const m = tryArmCycleFromWatch(defaultIce2fMachineState(), hist, "18:first");
  assert.ok(m.cycle, "indica no match sem falhas prévias");
  assert.equal(m.cycle!.active.pairId, "2x4");
}

console.log("ok — 2×4 · match imediato");

// Empate fecha; gale mantido
{
  configureIce2fComparePairs([{ positions: [2, 4], requiredFailures: 0 }]);
  const base = Array.from({ length: 20 }, (_, i) => ((i * 7) % 36) + 1);
  base[1] = 4;
  base[3] = 2;
  const hit = ice2fFindHitForPair(base, 2, 4, { id: "2x4", requiredFailures: 0 });
  assert.ok(hit);
  const active = ice2fBuildActiveFromHit(hit!);
  const m = {
    ...defaultIce2fMachineState(),
    watch: { "2x4": { failures: 0 } },
    lastSpinHead: "20:x",
    cycle: {
      active: { ...active!, pairId: "2x4" },
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
  // Se o histórico pós-resultado formar match, rearma com o gale (não “pula”).
  if (tick.machine.cycle) {
    assert.equal(tick.machine.cycle.recovery, 1);
    assert.equal(tick.machine.cycle.phase, "awaiting_bet");
  }
  configureIce2fDefaultComparePairs();
}

console.log("ok — empate mantém gale");

// Vitória: se o resultado formar novo match 2×4, arma no mesmo tick (não pula)
{
  configureIce2fComparePairs([{ positions: [2, 4], requiredFailures: 0 }]);
  const base = Array.from({ length: 20 }, (_, i) => ((i * 7) % 36) + 1);
  base[1] = 14;
  base[3] = 32;
  const hit = ice2fFindHitForPair(base, 2, 4, { id: "2x4", requiredFailures: 0 });
  assert.ok(hit);
  const active = ice2fBuildActiveFromHit(hit!);
  let winNum: number | null = null;
  for (let n = 1; n <= 36; n++) {
    const r = tickIce2fPlacar(
      [n, ...base],
      {
        ...defaultIce2fMachineState(),
        lastSpinHead: "20:x",
        cycle: {
          active: { ...active!, pairId: "2x4" },
          armedHead: "20:x",
          recovery: 0,
          phase: "awaiting_result" as const,
        },
      },
      emptyIce2fStats(5),
      5,
    );
    if (r.flash?.kind === "win") {
      winNum = n;
      break;
    }
  }
  assert.ok(winNum != null, "precisa de nº vencedor");
  const histAfter = [winNum!, ...base];
  const tick = tickIce2fPlacar(
    histAfter,
    {
      ...defaultIce2fMachineState(),
      lastSpinHead: "20:x",
      cycle: {
        active: { ...active!, pairId: "2x4" },
        armedHead: "20:x",
        recovery: 0,
        phase: "awaiting_result" as const,
      },
    },
    emptyIce2fStats(5),
    5,
  );
  assert.equal(tick.flash?.kind, "win");
  // Indicação única: após liquidar NÃO rearma no mesmo giro (anti-fantasma).
  assert.equal(tick.machine.cycle, null, "não rearma no giro do liquidar");
  assert.equal(tick.globalActive, null);
  configureIce2fDefaultComparePairs();
}

console.log("ok — vitória sem rearm no mesmo giro");
console.log("ok — iceCruzamento2fStrategy (2×4)");
