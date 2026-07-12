/**
 * Smoke — Sequências (cor/altura/paridade).
 */
import assert from "node:assert/strict";
import {
  defaultSequenciasMonitorState,
  tickSequenciasMonitor,
} from "../src/lib/roulette/sequenciasStrategy.ts";

// Sequência limpa de vermelho à cabeça (altura mista)
{
  const hist = [1, 3, 19, 21, 5];
  const s = tickSequenciasMonitor(hist, defaultSequenciasMonitorState());
  assert.ok(s.alert, "deve alertar sequência limpa");
  assert.equal(s.alert!.type, "color");
  assert.equal(s.alert!.suggestion, "VERMELHO");
  assert.equal(s.alert!.isDirty, false);
}

// Caso da imagem: 12,15,16 baixos recentes → BAIXO (não ALTO de corrida antiga)
{
  const hist = [12, 15, 16, 32, 29, 1, 11, 32, 24, 17, 25, 18, 11, 0, 20, 0];
  const s = tickSequenciasMonitor(hist, defaultSequenciasMonitorState());
  assert.ok(s.alert, "deve alertar sequência à cabeça");
  assert.equal(s.alert!.type, "height");
  assert.equal(s.alert!.suggestion, "BAIXO");
  assert.equal(s.alert!.isDirty, false);
}

// Vitória mantém alerta
{
  let s = tickSequenciasMonitor([1, 3, 19, 21, 5], defaultSequenciasMonitorState());
  assert.equal(s.alert?.suggestion, "VERMELHO");
  s = tickSequenciasMonitor([14, 1, 3, 19, 21, 5], s);
  assert.ok(s.alert);
  assert.equal(s.alert!.suggestion, "VERMELHO");
  assert.ok(s.alert!.winStreak >= 1);
  assert.equal(s.sessionWins, 1);
}

// Derrota abre nova análise
{
  let s = tickSequenciasMonitor([1, 3, 19, 21, 5], defaultSequenciasMonitorState());
  s = tickSequenciasMonitor([2, 1, 3, 19, 21, 5], s);
  assert.equal(s.sessionLosses, 1);
}

// Suja: chrono R·R·B·R ≡ newest-first R·B·R·R → VERMELHO
{
  const hist = [19, 4, 21, 23, 2, 6, 8]; // R B R R
  const s = tickSequenciasMonitor(hist, defaultSequenciasMonitorState());
  assert.ok(s.alert);
  assert.equal(s.alert!.type, "color");
  assert.equal(s.alert!.suggestion, "VERMELHO");
  assert.equal(s.alert!.isDirty, true);
}

console.log("ok — sequencias strategy");
