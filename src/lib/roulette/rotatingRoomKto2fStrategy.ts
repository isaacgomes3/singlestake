/**
 * KTO · Cruzamento 2 Fatores — mesa Roulette 3 (230).
 * Motor partilhado com ICE 2F (`iceCruzamento2fStrategy`).
 */

import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import { doisFatoresFactorLabel } from "@/lib/roulette/doisFatoresStrategy";
import {
  ICE_2F_MAX_RECOVERY,
  canPlaceIce2fBet,
  defaultIce2fMachineState,
  formatIce2fWatchLabel,
  ice2fStakeUnits,
  primeIce2fWatchFromHistory,
  tickIce2fPlacar,
  type Ice2fActive,
  type Ice2fFlash,
  type Ice2fMachineState,
} from "@/lib/roulette/iceCruzamento2fStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";

export const KTO2F_TABLE_ID = 230 as const;
export const KTO2F_MAX_RECOVERY = ICE_2F_MAX_RECOVERY;
export const KTO2F_BASE_STAKE = 0.5;

export type Kto2fMachineState = Ice2fMachineState & {
  lastSpinAtMs: number | null;
};

export type Kto2fPlacarFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
  alertLabel?: string;
  factor1?: Ice2fActive["factor1"];
  factor2?: Ice2fActive["factor2"];
} | null;

export function defaultKto2fMachineState(): Kto2fMachineState {
  return { ...defaultIce2fMachineState(), lastSpinAtMs: null };
}

export function parseKto2fMachineState(raw: unknown): Kto2fMachineState {
  const o = raw && typeof raw === "object" ? (raw as Partial<Kto2fMachineState>) : {};
  return {
    ...defaultKto2fMachineState(),
    ...o,
    lastSpinAtMs:
      typeof o.lastSpinAtMs === "number" && Number.isFinite(o.lastSpinAtMs)
        ? o.lastSpinAtMs
        : null,
  };
}

export function seedKto2fMachineAfterPlacarReset(
  histories: Record<number, readonly number[]>,
): Kto2fMachineState {
  const history = histories[KTO2F_TABLE_ID] ?? [];
  return {
    ...defaultIce2fMachineState(),
    watch: primeIce2fWatchFromHistory(history),
    lastSpinAtMs: null,
  };
}

function axisLabel(axis: Ice2fActive["axis"]): string {
  return axis === "cor-altura" ? "Cor/Altura" : "Altura/Paridade";
}

export function kto2fActiveToCrossing(active: Ice2fActive): DoisFatoresActive {
  return {
    pairKind: active.pairKind,
    pairKindLabel: axisLabel(active.axis),
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: active.referenceNumber,
    factor1: active.factor1,
    factor2: active.factor2,
    triggerNumbers: [active.referenceNumber],
    armingDescription: active.armingDescription,
  };
}

export function kto2fAlertLabel(active: Ice2fActive): string {
  return `Pos ${active.criticalPosition} · ${axisLabel(active.axis)} · ${doisFatoresFactorLabel(active.factor1)} · ${doisFatoresFactorLabel(active.factor2)}`;
}

export function kto2fSignalId(active: Ice2fActive, recovery: number): string {
  return `kto2f:${KTO2F_TABLE_ID}:pos${active.criticalPosition}:${active.axis}:ref${active.referenceNumber}:r${Math.max(0, Math.floor(recovery))}`;
}

export function kto2fGlobalActive(machine: Kto2fMachineState): Ice2fActive | null {
  if (machine.cycle?.phase !== "awaiting_bet") return null;
  return machine.cycle.active;
}

export function kto2fHasOpenCycle(machine: Kto2fMachineState): boolean {
  return machine.cycle != null;
}

export function kto2fCurrentRecovery(machine: Kto2fMachineState): number {
  return machine.cycle?.recovery ?? 0;
}

export function kto2fShowTapeteSignal(machine: Kto2fMachineState, nowMs = Date.now()): boolean {
  const active = kto2fGlobalActive(machine);
  if (!active || machine.cycle == null) return false;
  return canPlaceIce2fBet(machine.cycle.recovery, machine.lastSpinAtMs, nowMs);
}

export function kto2fWatchLabel(machine: Kto2fMachineState): string {
  return formatIce2fWatchLabel(machine.watch);
}

export function stakeForKto2fRecovery(recovery: number): number {
  return KTO2F_BASE_STAKE * ice2fStakeUnits(recovery);
}

function mapIce2fFlash(
  flash: Ice2fFlash | null,
  recoveryBefore: number,
  recoveryAfter: number,
): Kto2fPlacarFlash {
  if (!flash || flash.kind === "tie") return null;
  const alertLabel = `${axisLabel(flash.axis)} · pos ${flash.criticalPosition}`;
  if (flash.kind === "win") {
    return {
      resultNumber: flash.resultNumber,
      won: true,
      tableId: KTO2F_TABLE_ID,
      kind: "win",
      alertLabel,
      factor1: flash.factor1,
      factor2: flash.factor2,
    };
  }
  const kind = recoveryAfter > recoveryBefore ? "recovery" : "loss";
  return {
    resultNumber: flash.resultNumber,
    won: false,
    tableId: KTO2F_TABLE_ID,
    kind,
    alertLabel,
    factor1: flash.factor1,
    factor2: flash.factor2,
  };
}

export function tickKto2fPlacar(
  histories: Record<number, readonly number[]>,
  machine: Kto2fMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = KTO2F_MAX_RECOVERY,
  allowNewArming = true,
  spinTableId?: number,
): {
  nextMachine: Kto2fMachineState;
  stats: RotatingRoomSessionStats;
  flash: Kto2fPlacarFlash;
  recoveryBefore: number;
} {
  const recoveryBefore = machine.cycle?.recovery ?? 0;
  const hadCycle = machine.cycle != null;

  let lastSpinAtMs = machine.lastSpinAtMs;
  if (spinTableId === KTO2F_TABLE_ID) {
    lastSpinAtMs = Date.now();
  }

  const { lastSpinAtMs: _drop, ...iceMachine } = machine;
  const history = histories[KTO2F_TABLE_ID] ?? [];
  const result = tickIce2fPlacar(history, iceMachine, stats, maxRecovery);

  let nextMachine: Kto2fMachineState = { ...result.machine, lastSpinAtMs };
  if (!allowNewArming && !hadCycle && result.machine.cycle != null) {
    nextMachine = { ...nextMachine, cycle: null };
  }

  const recoveryAfter = nextMachine.cycle?.recovery ?? 0;
  const flash = mapIce2fFlash(result.flash, recoveryBefore, recoveryAfter);

  return {
    nextMachine,
    stats: result.stats,
    flash,
    recoveryBefore,
  };
}
