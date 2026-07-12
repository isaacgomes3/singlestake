/**
 * Smoke: ICE 2F gatilho pos 11 vs 22.
 */
import assert from "node:assert/strict";
import {
  defaultIce2fMachineState,
  emptyIce2fStats,
  ice2fFindCriticalPosition,
  tryArmCycleFromWatch,
  ICE_2F_MIN_HISTORY,
} from "../src/lib/roulette/iceCruzamento2fStrategy.ts";

function histWithPair(n11: number, n22: number): number[] {
  const h = Array.from({ length: ICE_2F_MIN_HISTORY }, (_, i) => ((i * 7) % 36) + 1);
  h[10] = n11;
  h[21] = n22;
  return h;
}

// 14 e 32: Vermelho+Par (altura diferente) → cor/paridade
{
  const hit = ice2fFindCriticalPosition(histWithPair(14, 32));
  assert.ok(hit, "deve detectar 14×32");
  assert.equal(hit!.axis, "cor-paridade");
  assert.equal(hit!.sharedCount, 2);
  assert.equal(hit!.criticalPosition, 11);
  assert.equal(hit!.matchPosition, 22);
}

// 14 e 16: mesmos 3 factores → prioriza cor/paridade
{
  const hit = ice2fFindCriticalPosition(histWithPair(14, 16));
  assert.ok(hit, "deve detectar 14×16");
  assert.equal(hit!.sharedCount, 3);
  assert.equal(hit!.axis, "cor-paridade");
}

// Sem match (<2 factores)
{
  const hit = ice2fFindCriticalPosition(histWithPair(14, 13));
  assert.equal(hit, null);
}

// Armamento
{
  const hist = histWithPair(14, 32);
  const head = `${hist.length}:${hist[0]}`;
  const armed = tryArmCycleFromWatch(defaultIce2fMachineState(), hist, head);
  assert.ok(armed.cycle, "deve armar ciclo");
  assert.equal(armed.cycle!.active.axis, "cor-paridade");
  assert.equal(armed.cycle!.active.criticalPosition, 11);
  assert.equal(armed.cycle!.phase, "awaiting_bet");
  void emptyIce2fStats;
}

console.log("ok — ice2f pos11/22 · 2F em comum · 3F→cor/paridade");
