/**
 * Indicação do tapete: alerta **aposte** (Web Audio) + vitória no placar (Web Audio).
 * Autoplay: `AudioContext.resume()` pode exigir interacção do utilizador primeiro.
 */

import { canPlayStrategySound } from "@/lib/sound/strategySoundGate";

let sharedCtx: AudioContext | null = null;
let pointerPrimingAttached = false;

/** Cada clique/toque ajuda a desbloquear o AudioContext (política de autoplay). */
function attachPointerAudioPriming(): void {
  if (typeof window === "undefined" || pointerPrimingAttached) return;
  pointerPrimingAttached = true;
  const onPointer = () => {
    void getCtx()?.resume();
  };
  window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
  window.addEventListener("keydown", onPointer, { capture: true, passive: true });
}

if (typeof window !== "undefined") {
  queueMicrotask(() => attachPointerAudioPriming());
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedCtx) return sharedCtx;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx({ latencyHint: "interactive" });
    return sharedCtx;
  } catch {
    return null;
  }
}

async function ensureRunning(ac: AudioContext): Promise<void> {
  if (ac.state === "suspended") {
    try {
      await ac.resume();
    } catch {
      /* autoplay bloqueado até gesto do utilizador */
    }
  }
}

function beep(
  ac: AudioContext,
  t0: number,
  freq: number,
  duration: number,
  peakGain: number,
  type: OscillatorType = "sine",
): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0008, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peakGain, 0.002), t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/**
 * Alerta «posicione-se» — tom mais grave, duplo; distinto do «aposte».
 */
export async function playCrossingPreparePositionAlert(): Promise<void> {
  if (!canPlayStrategySound()) return;
  const ac = getCtx();
  if (!ac) return;
  await ensureRunning(ac);
  const t0 = ac.currentTime;
  const hits: { at: number; freq: number; peak: number; dur: number; type?: OscillatorType }[] = [
    { at: 0, freq: 294, peak: 0.1, dur: 0.09, type: "triangle" },
    { at: 0.12, freq: 349, peak: 0.11, dur: 0.095, type: "triangle" },
    { at: 0.28, freq: 294, peak: 0.1, dur: 0.09, type: "triangle" },
    { at: 0.4, freq: 392, peak: 0.12, dur: 0.11, type: "triangle" },
  ];
  for (const h of hits) {
    beep(ac, t0 + h.at, h.freq, h.dur, h.peak, h.type ?? "triangle");
  }
}

/**
 * Alerta «aposte» ao activar indicação no tapete — sequência curta e urgente (sem TTS).
 * Tom distinto do som de vitória no placar.
 */
export async function playTapeteIndicationActivated(): Promise<void> {
  if (!canPlayStrategySound()) return;
  const ac = getCtx();
  if (!ac) return;
  await ensureRunning(ac);
  const t0 = ac.currentTime;
  const hits: { at: number; freq: number; peak: number; dur: number; type?: OscillatorType }[] = [
    { at: 0, freq: 415, peak: 0.11, dur: 0.055, type: "square" },
    { at: 0.07, freq: 523, peak: 0.12, dur: 0.058, type: "square" },
    { at: 0.145, freq: 622, peak: 0.13, dur: 0.062, type: "square" },
    { at: 0.25, freq: 784, peak: 0.1, dur: 0.048, type: "triangle" },
    { at: 0.31, freq: 784, peak: 0.095, dur: 0.052, type: "triangle" },
  ];
  for (const h of hits) {
    beep(ac, t0 + h.at, h.freq, h.dur, h.peak, h.type ?? "triangle");
  }
}

/**
 * Vitória no placar (W): arpejo **ascendente** + «moedas» agudas no fim.
 * A sequência antiga descia em tom (agudos → graves) e parecia derrota.
 */
export async function playPlacarWinCoins(): Promise<void> {
  if (!canPlayStrategySound()) return;
  const ac = getCtx();
  if (!ac) return;
  await ensureRunning(ac);
  const t0 = ac.currentTime;
  /** C5 → E5 → G5 → C6 (alegre); depois pings curtos subindo. */
  const hits: { at: number; freq: number; peak: number; dur: number; type?: OscillatorType }[] = [
    { at: 0, freq: 523, peak: 0.11, dur: 0.085, type: "triangle" },
    { at: 0.08, freq: 659, peak: 0.12, dur: 0.088, type: "triangle" },
    { at: 0.165, freq: 784, peak: 0.13, dur: 0.092, type: "triangle" },
    { at: 0.26, freq: 1047, peak: 0.14, dur: 0.1, type: "triangle" },
    { at: 0.38, freq: 1319, peak: 0.1, dur: 0.055, type: "sine" },
    { at: 0.445, freq: 1568, peak: 0.095, dur: 0.055, type: "sine" },
    { at: 0.51, freq: 1760, peak: 0.09, dur: 0.05, type: "sine" },
    { at: 0.57, freq: 2093, peak: 0.085, dur: 0.048, type: "sine" },
    { at: 0.63, freq: 2349, peak: 0.08, dur: 0.045, type: "triangle" },
    { at: 0.69, freq: 2637, peak: 0.075, dur: 0.04, type: "triangle" },
  ];
  for (const h of hits) {
    beep(ac, t0 + h.at, h.freq, h.dur, h.peak, h.type ?? "triangle");
  }
}

/**
 * Derrota no placar (L): sequência **descendente** — tom grave, distinto da vitória.
 */
export async function playPlacarDefeat(): Promise<void> {
  if (!canPlayStrategySound()) return;
  const ac = getCtx();
  if (!ac) return;
  await ensureRunning(ac);
  const t0 = ac.currentTime;
  const hits: { at: number; freq: number; peak: number; dur: number; type?: OscillatorType }[] = [
    { at: 0, freq: 440, peak: 0.1, dur: 0.09, type: "triangle" },
    { at: 0.1, freq: 349, peak: 0.11, dur: 0.095, type: "triangle" },
    { at: 0.21, freq: 262, peak: 0.12, dur: 0.1, type: "triangle" },
    { at: 0.34, freq: 196, peak: 0.13, dur: 0.12, type: "square" },
    { at: 0.5, freq: 147, peak: 0.11, dur: 0.14, type: "square" },
  ];
  for (const h of hits) {
    beep(ac, t0 + h.at, h.freq, h.dur, h.peak, h.type ?? "triangle");
  }
}

