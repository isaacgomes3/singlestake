/**
 * Smoke — adapter sala rotativa ICE 3F.
 */
import assert from "node:assert/strict";
import {
  defaultIce3fRotatingMachineState,
  emptyIce3fRotatingStats,
  ice3fAlertLabel,
  ice3fShowTapeteSignal,
  tickIce3fRotatingPlacar,
} from "../src/lib/roulette/rotatingRoomIce3fStrategy.ts";

const hist = { 201: [22, 5, 8, 22, 1, 2, 3] };
const r = tickIce3fRotatingPlacar(
  hist,
  defaultIce3fRotatingMachineState(),
  emptyIce3fRotatingStats(),
  5,
  true,
);
const active =
  r.nextMachine.cycle?.phase === "awaiting_bet" ? r.nextMachine.cycle.active : null;
assert.ok(active, "deve armar ciclo no eco");
assert.equal(active.referenceNumber, 8);
assert.match(ice3fAlertLabel(active), /eco 22/);
assert.equal(
  ice3fShowTapeteSignal(r.nextMachine),
  false,
  "sem lastSpinAtMs a janela permanece fechada (igual extensão)",
);

const withSpin = {
  ...r.nextMachine,
  lastSpinAtMs: Date.now() - 6_000,
};
assert.equal(ice3fShowTapeteSignal(withSpin), true, "após delay de 5s a janela abre");
console.log("ok — rotatingRoomIce3f smoke", {
  label: ice3fAlertLabel(active),
});
