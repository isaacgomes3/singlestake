/**
 * ICE · 3 Fatores (eco → cor/altura) — mesa Roulette 2 Extra Time (201).
 * Adapter sala rotativa / automação global (padrão KTO 2F).
 */

import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import { doisFatoresFactorLabel } from "@/lib/roulette/doisFatoresStrategy";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import {
  canPlaceIce3fBet,
  defaultIce3fMachineState,
  ice3fEntryUnitsOf,
  ice3fUnitScaleForCycle,
  ice3fWatchLabelForMachine,
  parseIce3fStats,
  tickIce3fPlacar,
  type Ice3fActive,
  type Ice3fFlash,
  type Ice3fMachineState,
} from "@/lib/roulette/iceTresFatoresStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";

/** Mesa Roulette 2 Extra Time — literal para evitar ciclo de init com iceTresFatores. */
export const ICE3F_TABLE_ID = 201 as const;
/** Igual a `ICE_3F_MAX_GALES`. */
export const ICE3F_MAX_RECOVERY = 5;
export const ICE3F_BASE_STAKE = 0.5;
/** Igual a `ICE_3F_BET_DELAY_MS`. */
const ICE3F_BET_DELAY_MS = 5_000;

export type Ice3fRotatingMachineState = Ice3fMachineState & {
  lastSpinAtMs: number | null;
};

export type Ice3fPlacarFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
  alertLabel?: string;
  factor1?: Ice3fActive["factors"][0];
  factor2?: Ice3fActive["factors"][1];
} | null;

export function defaultIce3fRotatingMachineState(): Ice3fRotatingMachineState {
  return { ...defaultIce3fMachineState(), lastSpinAtMs: null };
}

export function parseIce3fRotatingMachineState(raw: unknown): Ice3fRotatingMachineState {
  const o = raw && typeof raw === "object" ? (raw as Partial<Ice3fRotatingMachineState>) : {};
  const base = defaultIce3fRotatingMachineState();
  return {
    ...base,
    ...o,
    entryUnits:
      typeof o.entryUnits === "number" && Number.isFinite(o.entryUnits)
        ? o.entryUnits
        : base.entryUnits,
    stakeMode: o.stakeMode === "manual" ? "manual" : "auto",
    winsTowardEntryBump:
      typeof o.winsTowardEntryBump === "number" && Number.isFinite(o.winsTowardEntryBump)
        ? Math.max(0, Math.floor(o.winsTowardEntryBump))
        : 0,
    lastSpinAtMs:
      typeof o.lastSpinAtMs === "number" && Number.isFinite(o.lastSpinAtMs)
        ? o.lastSpinAtMs
        : null,
  };
}

export function seedIce3fMachineAfterPlacarReset(
  _histories: Record<number, readonly number[]>,
): Ice3fRotatingMachineState {
  return defaultIce3fRotatingMachineState();
}

export function emptyIce3fRotatingStats(): RotatingRoomSessionStats {
  return emptyRotatingRoomSessionStats(ICE3F_MAX_RECOVERY);
}

export function parseIce3fRotatingStats(raw: unknown): RotatingRoomSessionStats {
  return parseIce3fStats(raw);
}

export function ice3fActiveToCrossing(active: Ice3fActive): DoisFatoresActive {
  const [factor1, factor2] = active.factors;
  return {
    pairKind: "cor-altura",
    pairKindLabel: "Cor/Altura",
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: active.referenceNumber,
    factor1,
    factor2,
    triggerNumbers: [active.referenceNumber],
    armingDescription: active.armingDescription,
  };
}

export function ice3fAlertLabel(active: Ice3fActive): string {
  const [f1, f2] = active.factors;
  const eco =
    active.triggerNumber != null ? ` · eco ${active.triggerNumber}` : "";
  return `Pos ${active.criticalPosition}${eco} · ${doisFatoresFactorLabel(f1)} · ${doisFatoresFactorLabel(f2)}`;
}

export function ice3fSignalId(active: Ice3fActive, unitScale: number): string {
  return `tres3fatores:${ICE3F_TABLE_ID}:pos${active.criticalPosition}:ref${active.referenceNumber}:s${Math.max(1, Math.floor(unitScale))}`;
}

export function ice3fGlobalActive(machine: Ice3fRotatingMachineState): Ice3fActive | null {
  if (machine.cycle?.phase !== "awaiting_bet") return null;
  return machine.cycle.active;
}

export function ice3fHasOpenCycle(machine: Ice3fRotatingMachineState): boolean {
  return machine.cycle != null;
}

/** Gale index 0…5 para placar / ledger. */
export function ice3fCurrentRecovery(machine: Ice3fRotatingMachineState): number {
  if (machine.cycle) return Math.max(0, Math.floor(machine.cycle.galeStreak));
  return Math.max(0, Math.floor(machine.pendingGaleStreak ?? 0));
}

export function ice3fCurrentUnitScale(machine: Ice3fRotatingMachineState): number {
  if (machine.cycle) return ice3fUnitScaleForCycle(machine.cycle);
  const pending = Math.max(0, Math.floor(machine.pendingUnitScale ?? 0));
  if (pending > 0) return pending;
  return ice3fEntryUnitsOf(machine);
}

export function ice3fShowTapeteSignal(
  machine: Ice3fRotatingMachineState,
  nowMs = Date.now(),
): boolean {
  const active = ice3fGlobalActive(machine);
  if (!active || machine.cycle == null) return false;
  const scale = ice3fUnitScaleForCycle(machine.cycle);
  return canPlaceIce3fBet(scale, machine.lastSpinAtMs, nowMs);
}

export function ice3fWatchLabel(machine: Ice3fRotatingMachineState): string {
  return ice3fWatchLabelForMachine(machine);
}

export function ice3fBetDelayUntilMs(machine: Ice3fRotatingMachineState): number | null {
  if (machine.lastSpinAtMs == null) return null;
  return machine.lastSpinAtMs + ICE3F_BET_DELAY_MS;
}

export function stakeForIce3fUnitScale(unitScale: number): number {
  return ICE3F_BASE_STAKE * Math.max(1, Math.floor(unitScale));
}

export function stakeForIce3fRecovery(recovery: number, entryUnits = 1): number {
  const gale = Math.max(0, Math.floor(recovery));
  const entry = Math.max(1, Math.floor(entryUnits));
  return stakeForIce3fUnitScale(entry * 2 ** gale);
}

function mapIce3fFlash(
  flash: Ice3fFlash | null,
  recoveryBefore: number,
  recoveryAfter: number,
): Ice3fPlacarFlash {
  if (!flash || flash.kind === "tie") return null;
  const [factor1, factor2] = flash.factors;
  const alertLabel = `Cor/Altura · pos ${flash.criticalPosition}`;
  if (flash.kind === "win") {
    return {
      resultNumber: flash.resultNumber,
      won: true,
      tableId: ICE3F_TABLE_ID,
      kind: "win",
      alertLabel,
      factor1,
      factor2,
    };
  }
  const kind =
    flash.kind === "cycle_fail"
      ? "loss"
      : recoveryAfter > recoveryBefore
        ? "recovery"
        : "loss";
  return {
    resultNumber: flash.resultNumber,
    won: false,
    tableId: ICE3F_TABLE_ID,
    kind,
    alertLabel,
    factor1,
    factor2,
  };
}

export function tickIce3fRotatingPlacar(
  histories: Record<number, readonly number[]>,
  machine: Ice3fRotatingMachineState,
  stats: RotatingRoomSessionStats,
  _maxRecovery: number = ICE3F_MAX_RECOVERY,
  allowNewArming = true,
  spinTableId?: number,
): {
  nextMachine: Ice3fRotatingMachineState;
  stats: RotatingRoomSessionStats;
  flash: Ice3fPlacarFlash;
  recoveryBefore: number;
} {
  const recoveryBefore = ice3fCurrentRecovery(machine);
  const hadCycle = machine.cycle != null;

  let lastSpinAtMs = machine.lastSpinAtMs;
  if (spinTableId === ICE3F_TABLE_ID) {
    lastSpinAtMs = Date.now();
  }

  const { lastSpinAtMs: _drop, ...coreMachine } = machine;
  const history = histories[ICE3F_TABLE_ID] ?? [];
  const result = tickIce3fPlacar(history, coreMachine, stats);

  let nextMachine: Ice3fRotatingMachineState = { ...result.machine, lastSpinAtMs };
  if (!allowNewArming && !hadCycle && result.machine.cycle != null) {
    nextMachine = {
      ...nextMachine,
      cycle: null,
      pendingUnitScale: Math.max(
        nextMachine.pendingUnitScale ?? 0,
        result.machine.cycle ? ice3fUnitScaleForCycle(result.machine.cycle) : 0,
      ),
      pendingGaleStreak: result.machine.cycle?.galeStreak ?? nextMachine.pendingGaleStreak,
    };
  }

  const recoveryAfter = ice3fCurrentRecovery(nextMachine);
  const flash = mapIce3fFlash(result.flash, recoveryBefore, recoveryAfter);

  return {
    nextMachine,
    stats: result.stats,
    flash,
    recoveryBefore,
  };
}
