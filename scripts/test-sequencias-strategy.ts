/**
 * Smoke — Sequências (cor/altura/paridade).
 */
import assert from "node:assert/strict";
import {
  defaultSequenciasMonitorState,
  tickSequenciasMonitor,
} from "../src/lib/roulette/sequenciasStrategy.ts";

// Sequência limpa de vermelho (altura mista para não preferir ALTO/BAIXO)
{
  const hist = [1, 3, 19, 21, 5]; // newest-first: todos vermelhos, altura L/L/H/H/L
  const s = tickSequenciasMonitor(hist, defaultSequenciasMonitorState());
  assert.ok(s.alert, "deve alertar sequência limpa");
  assert.equal(s.alert!.type, "color");
  assert.equal(s.alert!.suggestion, "VERMELHO");
  assert.equal(s.alert!.isDirty, false);
}

// Vitória mantém alerta
{
  let s = tickSequenciasMonitor([1, 3, 19, 21, 5], defaultSequenciasMonitorState());
  assert.equal(s.alert?.suggestion, "VERMELHO");
  s = tickSequenciasMonitor([14, 1, 3, 19, 21, 5], s); // 14 vermelho
  assert.ok(s.alert);
  assert.equal(s.alert!.suggestion, "VERMELHO");
  assert.ok(s.alert!.winStreak >= 1);
  assert.equal(s.sessionWins, 1);
}

// Derrota abre nova análise
{
  let s = tickSequenciasMonitor([1, 3, 19, 21, 5], defaultSequenciasMonitorState());
  s = tickSequenciasMonitor([2, 1, 3, 19, 21, 5], s); // 2 preto — perde cor
  assert.equal(s.sessionLosses, 1);
}

console.log("ok — sequencias strategy");
