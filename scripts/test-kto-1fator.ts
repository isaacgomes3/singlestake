/**
 * Smoke — KTO 1F score 1×13 → alerta pos 12.
 */
import assert from "node:assert/strict";
import {
  defaultKto1fMachineState,
  emptyKto1fStats,
  kto1fBestKind,
  kto1fBuildActiveFromBoard,
  kto1fPrimeScoreboardFromHistory,
  kto1fUpdateScoreboard,
  tickKto1fPlacar,
  tryArmKto1fCycle,
  KTO_1F_MIN_HISTORY,
} from "../src/lib/roulette/kto1fScoreStrategy.ts";
import { heightOf } from "../src/lib/roulette/streetPairTrigger.ts";

function histFill(len: number, fill = 7): number[] {
  return Array.from({ length: len }, (_, i) => ((i * fill) % 36) + 1);
}

// Altura coincide 1×13: ambos altos
{
  const h = histFill(KTO_1F_MIN_HISTORY);
  h[0] = 20; // Alto
  h[12] = 32; // Alto
  h[11] = 28; // pos12 Alto → alerta Alto
  let board = kto1fUpdateScoreboard(defaultKto1fMachineState().scoreboard, h);
  assert.equal(board.altura.wins, 1);
  assert.equal(board.altura.losses, 0);
  for (let i = 0; i < 4; i++) {
    const next = [22 + (i % 3) * 2, ...h]; // keep high numbers at front-ish
    next[0] = 24;
    next[12] = 30;
    next[11] = 28;
    board = kto1fUpdateScoreboard(board, next);
    h.unshift(next[0]!);
  }
  assert.ok(board.altura.wins >= 5, `altura wins=${board.altura.wins}`);
  assert.equal(kto1fBestKind(board), "altura");
  const active = kto1fBuildActiveFromBoard(
    (() => {
      const x = histFill(20);
      x[0] = 24;
      x[11] = 28;
      x[12] = 30;
      return x;
    })(),
    board,
  );
  assert.ok(active);
  assert.equal(active!.alertKind, "altura");
  assert.equal(active!.alertFactor.value, heightOf(28));
}

// Arm + settle win
{
  const h = histFill(KTO_1F_MIN_HISTORY);
  h[0] = 20;
  h[12] = 32;
  h[11] = 28;
  const board = kto1fPrimeScoreboardFromHistory(h);
  let m = { ...defaultKto1fMachineState(), scoreboard: board };
  const head = `${h.length}:${h[0]}`;
  m = tryArmKto1fCycle(m, h, head);
  assert.ok(m.cycle);
  assert.equal(m.cycle!.active.alertKind, kto1fBestKind(board));
  m = {
    ...m,
    lastSpinHead: head,
    cycle: { ...m.cycle!, phase: "awaiting_result", armedHead: head },
  };
  const result = m.cycle!.active.alertFactor.value === "Alto" ? 30 : 5;
  const tick = tickKto1fPlacar([result, ...h], m, emptyKto1fStats(5), 5);
  assert.equal(tick.flash?.kind, "win");
  assert.equal(tick.machine.pendingRecovery, 0);
}

console.log("ok — kto1f score 1×13 / alerta pos 12");
