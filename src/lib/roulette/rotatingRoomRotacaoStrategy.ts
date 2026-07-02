/**
 * Sala rotativa — Rotação (altura → paridade → cor).
 * Mesa fixa Roulette 1 (227). Base: último giro não-zero.
 * Derrota: avança dimensão + recuperação (até 5 gales). Vitória: avança dimensão e zera recovery.
 */

import type { DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";
import { doisFatoresFactorLabel } from "@/lib/roulette/doisFatoresStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import {
  recordRotatingRoomSessionWin,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionFinalLoss,
} from "@/lib/roulette/entryWinBreakdown";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";

/** Roulette 1 — única mesa deste gatilho. */
export const ROTACAO_TABLE_ID = 227 as const;

export const ROTACAO_MAX_RECOVERY = 5;

export const ROTACAO_DIMENSIONS = ["altura", "paridade", "cor"] as const;

export type RotacaoDimension = (typeof ROTACAO_DIMENSIONS)[number];

export type RotacaoMachineState = {
  recovery: number;
  dimensionIndex: number;
  cycleSeq: number;
  armedAtHead: string | null;
  lastEvaluatedHead: string | null;
  /** Número base da indicação activa (último giro válido). */
  pendingBaseNumber: number | null;
  pendingDimension: RotacaoDimension | null;
};

export type RotacaoActive = {
  tableId: number;
  baseNumber: number;
  dimension: RotacaoDimension;
  alertFactor: DoisFatoresFactor;
  alertLabel: string;
};

export type RotacaoPlacarFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "recovery";
  alertLabel?: string;
} | null;

export function defaultRotacaoMachineState(): RotacaoMachineState {
  return {
    recovery: 0,
    dimensionIndex: 0,
    cycleSeq: 0,
    armedAtHead: null,
    lastEvaluatedHead: null,
    pendingBaseNumber: null,
    pendingDimension: null,
  };
}

function spinHeadFromHistory(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function dimensionAt(index: number): RotacaoDimension {
  const i = ((Math.floor(index) % ROTACAO_DIMENSIONS.length) + ROTACAO_DIMENSIONS.length) % ROTACAO_DIMENSIONS.length;
  return ROTACAO_DIMENSIONS[i]!;
}

function factorFromBaseNumber(baseNumber: number, dimension: RotacaoDimension): DoisFatoresFactor | null {
  if (baseNumber === 0) return null;
  if (dimension === "altura") {
    const v = heightOf(baseNumber);
    if (v === "Zero") return null;
    return { kind: "altura", value: v };
  }
  if (dimension === "paridade") {
    const v = parityOf(baseNumber);
    if (v === "Zero") return null;
    return { kind: "paridade", value: v };
  }
  const v = colorOf(baseNumber);
  if (v === "Zero") return null;
  return { kind: "cor", value: v };
}

function factorWinsOnSpin(spin: number, factor: DoisFatoresFactor): boolean {
  if (spin === 0) return false;
  switch (factor.kind) {
    case "cor":
      return colorOf(spin) === factor.value;
    case "paridade":
      return parityOf(spin) === factor.value;
    case "altura":
      return heightOf(spin) === factor.value;
  }
}

export function rotacaoDimensionLabel(dimension: RotacaoDimension): string {
  if (dimension === "altura") return "Altura";
  if (dimension === "paridade") return "Paridade";
  return "Cor";
}

export function buildRotacaoActive(
  baseNumber: number,
  dimension: RotacaoDimension,
): RotacaoActive | null {
  const factor = factorFromBaseNumber(baseNumber, dimension);
  if (!factor) return null;
  return {
    tableId: ROTACAO_TABLE_ID,
    baseNumber,
    dimension,
    alertFactor: factor,
    alertLabel: doisFatoresFactorLabel(factor),
  };
}

export function rotacaoActiveToCrossing(active: RotacaoActive): DoisFatoresActive {
  return {
    pairKind: "altura-paridade",
    pairKindLabel: rotacaoDimensionLabel(active.dimension),
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: active.baseNumber,
    factor1: active.alertFactor,
    factor2: active.alertFactor,
    triggerNumbers: [active.baseNumber, active.baseNumber],
    armingDescription: `${rotacaoDimensionLabel(active.dimension)} · ${active.alertLabel}`,
  };
}

export function rotacaoSignalId(
  baseNumber: number,
  dimension: RotacaoDimension,
  recovery: number,
  cycleSeq: number,
): string {
  return `${ROTACAO_TABLE_ID}:${baseNumber}:${dimension}:${Math.max(0, Math.floor(recovery))}:c${Math.max(0, Math.floor(cycleSeq))}`;
}

export function parseRotacaoSignalId(signalId: string): {
  tableId: number;
  baseNumber: number;
  dimension: RotacaoDimension;
  recovery: number;
  cycleSeq: number;
} | null {
  const parts = signalId.trim().split(":");
  if (parts.length < 4) return null;
  const tableId = Number(parts[0]);
  const baseNumber = Number(parts[1]);
  const dimension = parts[2];
  if (
    !Number.isFinite(tableId) ||
    !Number.isFinite(baseNumber) ||
    !ROTACAO_DIMENSIONS.includes(dimension as RotacaoDimension)
  ) {
    return null;
  }
  const recovery = Math.max(0, Math.floor(Number(parts[3]) || 0));
  const cyclePart = parts[4];
  const cycleSeq =
    typeof cyclePart === "string" && cyclePart.startsWith("c")
      ? Math.max(0, Math.floor(Number(cyclePart.slice(1))))
      : 0;
  return {
    tableId,
    baseNumber,
    dimension: dimension as RotacaoDimension,
    recovery,
    cycleSeq,
  };
}

export function rotacaoActiveFromSignalId(signalId: string): RotacaoActive | null {
  const parsed = parseRotacaoSignalId(signalId);
  if (!parsed) return null;
  return buildRotacaoActive(parsed.baseNumber, parsed.dimension);
}

function armPending(
  machine: RotacaoMachineState,
  baseNumber: number,
  head: string,
): RotacaoMachineState {
  const dimension = dimensionAt(machine.dimensionIndex);
  const active = buildRotacaoActive(baseNumber, dimension);
  if (!active) return machine;
  return {
    ...machine,
    armedAtHead: head,
    pendingBaseNumber: baseNumber,
    pendingDimension: dimension,
  };
}

function clearPending(machine: RotacaoMachineState): RotacaoMachineState {
  return {
    ...machine,
    armedAtHead: null,
    pendingBaseNumber: null,
    pendingDimension: null,
  };
}

export function tickRotacaoPlacar(
  histories: Record<number, readonly number[]>,
  machine: RotacaoMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = ROTACAO_MAX_RECOVERY,
  allowNewArming = true,
): {
  nextMachine: RotacaoMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: RotacaoPlacarFlash;
} {
  let nextMachine = { ...machine };
  let nextStats = stats;
  let statsChanged = false;
  let flash: RotacaoPlacarFlash = null;

  const history = histories[ROTACAO_TABLE_ID] ?? [];
  if (history.length === 0) {
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  const head = spinHeadFromHistory(history);
  if (head === nextMachine.lastEvaluatedHead) {
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  const resultNumber = history[0]!;
  const recoveryBefore = nextMachine.recovery;

  if (
    nextMachine.pendingBaseNumber != null &&
    nextMachine.pendingDimension != null &&
    nextMachine.armedAtHead != null &&
    head !== nextMachine.armedAtHead
  ) {
    const factor = factorFromBaseNumber(nextMachine.pendingBaseNumber, nextMachine.pendingDimension);
    const won = factor != null && factorWinsOnSpin(resultNumber, factor);
    const active = buildRotacaoActive(nextMachine.pendingBaseNumber, nextMachine.pendingDimension);

    if (won) {
      nextStats = recordRotatingRoomSessionWin(nextStats, recoveryBefore, maxRecovery);
      statsChanged = true;
      nextMachine = clearPending({
        ...nextMachine,
        recovery: 0,
        dimensionIndex: nextMachine.dimensionIndex + 1,
        cycleSeq: nextMachine.cycleSeq + 1,
        lastEvaluatedHead: head,
      });
      flash = {
        resultNumber,
        won: true,
        tableId: ROTACAO_TABLE_ID,
        kind: "win",
        alertLabel: active?.alertLabel,
      };
    } else {
      const nextRecovery = recoveryBefore + 1;
      if (nextRecovery > maxRecovery) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);
        statsChanged = true;
        nextMachine = clearPending({
          ...nextMachine,
          recovery: 0,
          dimensionIndex: nextMachine.dimensionIndex + 1,
          cycleSeq: nextMachine.cycleSeq + 1,
          lastEvaluatedHead: head,
        });
        flash = {
          resultNumber,
          won: false,
          tableId: ROTACAO_TABLE_ID,
          kind: "loss",
          alertLabel: active?.alertLabel,
        };
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recoveryBefore, maxRecovery);
        statsChanged = true;
        nextMachine = clearPending({
          ...nextMachine,
          recovery: nextRecovery,
          dimensionIndex: nextMachine.dimensionIndex + 1,
          lastEvaluatedHead: head,
        });
        flash = {
          resultNumber,
          won: false,
          tableId: ROTACAO_TABLE_ID,
          kind: "recovery",
          alertLabel: active?.alertLabel,
        };
      }
    }
  } else {
    nextMachine = { ...nextMachine, lastEvaluatedHead: head };
  }

  if (!allowNewArming) {
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  if (nextMachine.pendingBaseNumber != null) {
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  if (resultNumber === 0) {
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  nextMachine = armPending(nextMachine, resultNumber, head);
  return { nextMachine, stats: nextStats, statsChanged, flash };
}

export function rotacaoShowTapeteSignal(machine: RotacaoMachineState): boolean {
  return machine.pendingBaseNumber != null && machine.pendingDimension != null;
}

export function rotacaoGlobalActive(machine: RotacaoMachineState): RotacaoActive | null {
  if (machine.pendingBaseNumber == null || machine.pendingDimension == null) return null;
  return buildRotacaoActive(machine.pendingBaseNumber, machine.pendingDimension);
}
