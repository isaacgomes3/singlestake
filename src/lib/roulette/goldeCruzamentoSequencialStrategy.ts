/**
 * GoldeBet · French Roulette la Partage (28401) — cruzamento sequencial 2 fatores.
 *
 * Mesmo gatilho KTO (2 factores em comum nos 2 giros mais recentes, dúzias diferentes).
 *
 * **Gales alternados (factores apostados):**
 * - Entrada (0), gale 2, gale 3 → factores **normais** do gatilho
 * - Gale 1, gale 4, gale 5 → factores **opostos** (ambos invertidos)
 */

import {
  doisFatoresFactorLabel,
  evaluateDoisFatoresRound,
  type DoisFatoresActive,
  type DoisFatoresFactor,
  type DoisFatoresPairKind,
} from "@/lib/roulette/doisFatoresStrategy";
import { differentDozens } from "@/lib/roulette/streetPairTrigger";
import {
  umFatorOppositeFactor,
  umFatorSharedFactorsBetween,
  umFatorTriggerMatchCount,
} from "@/lib/roulette/umFatorStrategy";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  recordRotatingRoomSessionFinalLoss,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionWin,
  type RotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";

export const GOLDE_ROULETTE_TABLE_ID = 28401;
export const GOLDE_ROULETTE_MESA_URL =
  "https://goldebet.bet.br/play/pragmatic/french-roulette-la-partage";

export const GOLDE_CRUZAMENTO_MAX_RECOVERY = 5;
export const GOLDE_CRUZAMENTO_MIN_HISTORY = 2;
export const GOLDE_CRUZAMENTO_FIRST_BET_SETTLE_MS = 6_000;
export const GOLDE_CRUZAMENTO_RECOVERY_BET_DELAY_MS = 6_000;

/** Gales em que se apostam factores opostos ao gatilho. */
const GOLDE_OPPOSITE_RECOVERIES = new Set([1, 4, 5]);

export type GoldeCruzamentoActive = {
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  pairKind: DoisFatoresPairKind;
  triggerNumbers: readonly [number, number];
  armingDescription: string;
};

export type GoldeCruzamentoCyclePhase = "awaiting_bet" | "awaiting_result";

export type GoldeCruzamentoCycle = {
  active: GoldeCruzamentoActive;
  armedHead: string;
  recovery: number;
  phase: GoldeCruzamentoCyclePhase;
};

export type GoldeCruzamentoMachineState = {
  cycle: GoldeCruzamentoCycle | null;
  lastSpinHead: string | null;
  recovery: number;
  lastEndedTriggerPair: readonly [number, number] | null;
  lastEndedAtHead: string | null;
  /** Aposta em envio (CDP) — evita cancelar awaiting_bet antes de markBetPlaced. */
  betCommitInFlight?: boolean;
};

export type GoldeCruzamentoFlash = {
  resultNumber: number;
  won: boolean;
  tableId: number;
  kind: "win" | "loss" | "tie";
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  recovery: number;
  triggerNumbers: readonly [number, number];
  oppositeMode: boolean;
};

function sameTriggerPair(
  a: readonly [number, number] | null | undefined,
  b: readonly [number, number] | null | undefined,
): boolean {
  if (!a || !b) return false;
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

function pairKindFromFactors(f1: DoisFatoresFactor, f2: DoisFatoresFactor): DoisFatoresPairKind {
  const kinds = new Set([f1.kind, f2.kind]);
  if (kinds.has("cor") && kinds.has("altura")) return "cor-altura";
  if (kinds.has("cor") && kinds.has("paridade")) return "cor-paridade";
  return "altura-paridade";
}

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function toTapeteActive(
  active: GoldeCruzamentoActive,
  factor1: DoisFatoresFactor,
  factor2: DoisFatoresFactor,
): DoisFatoresActive {
  return {
    pairKind: active.pairKind,
    pairKindLabel: "Cruzamento sequencial",
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: active.triggerNumbers[0],
    factor1,
    factor2,
    triggerNumbers: active.triggerNumbers,
    armingDescription: active.armingDescription,
  };
}

export function goldeCruzamentoUseOppositeFactors(recovery: number): boolean {
  return GOLDE_OPPOSITE_RECOVERIES.has(recovery);
}

/** Factores efectivos na aposta conforme o gale. */
export function goldeCruzamentoBetFactors(
  active: GoldeCruzamentoActive,
  recovery: number,
): { factor1: DoisFatoresFactor; factor2: DoisFatoresFactor; oppositeMode: boolean } {
  if (!goldeCruzamentoUseOppositeFactors(recovery)) {
    return { factor1: active.factor1, factor2: active.factor2, oppositeMode: false };
  }
  return {
    factor1: umFatorOppositeFactor(active.factor1),
    factor2: umFatorOppositeFactor(active.factor2),
    oppositeMode: true,
  };
}

export function detectGoldeCruzamentoTrigger(
  historyNewestFirst: readonly number[],
): GoldeCruzamentoActive | null {
  if (historyNewestFirst.length < GOLDE_CRUZAMENTO_MIN_HISTORY) return null;

  const n0 = historyNewestFirst[0]!;
  const n1 = historyNewestFirst[1]!;
  if (n0 === 0 || n1 === 0) return null;
  if (!differentDozens(n0, n1)) return null;
  if (umFatorTriggerMatchCount(n0, n1) !== 2) return null;

  const shared = umFatorSharedFactorsBetween(n0, n1);
  if (shared.length !== 2) return null;

  const factor1 = shared[0]!;
  const factor2 = shared[1]!;
  const label = shared.map(doisFatoresFactorLabel).join(" · ");

  return {
    factor1,
    factor2,
    pairKind: pairKindFromFactors(factor1, factor2),
    triggerNumbers: [n1, n0] as const,
    armingDescription: `Golde 2F: cruzamento ${label} (${n1}, ${n0}) → entrada nos 2 factores`,
  };
}

export function evaluateGoldeCruzamentoRound(
  num: number,
  active: GoldeCruzamentoActive,
  recovery: number,
): "W" | "L" | "continue" {
  const { factor1, factor2 } = goldeCruzamentoBetFactors(active, recovery);
  return evaluateDoisFatoresRound(num, toTapeteActive(active, factor1, factor2));
}

export function defaultGoldeCruzamentoMachineState(): GoldeCruzamentoMachineState {
  return {
    cycle: null,
    lastSpinHead: null,
    recovery: 0,
    lastEndedTriggerPair: null,
    lastEndedAtHead: null,
  };
}

export function goldeCruzamentoBetDelayMs(recovery: number): number {
  return recovery > 0 ? GOLDE_CRUZAMENTO_RECOVERY_BET_DELAY_MS : GOLDE_CRUZAMENTO_FIRST_BET_SETTLE_MS;
}

export function canPlaceGoldeCruzamentoBet(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= goldeCruzamentoBetDelayMs(recovery);
}

export type GoldeCruzamentoTickResult = {
  machine: GoldeCruzamentoMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: GoldeCruzamentoFlash | null;
  globalActive: GoldeCruzamentoActive | null;
  globalRecovery: number;
};

export function tickGoldeCruzamentoPlacar(
  historyNewestFirst: readonly number[],
  machine: GoldeCruzamentoMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = GOLDE_CRUZAMENTO_MAX_RECOVERY,
): GoldeCruzamentoTickResult {
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: GoldeCruzamentoMachineState = {
    ...machine,
    lastSpinHead: head,
    recovery: machine.recovery ?? 0,
  };
  let nextStats = stats;
  let statsChanged = false;
  let flash: GoldeCruzamentoFlash | null = null;

  if (
    nextMachine.cycle?.phase === "awaiting_bet" &&
    headChanged &&
    nextMachine.cycle.armedHead !== head
  ) {
    if (nextMachine.betCommitInFlight) {
      nextMachine = {
        ...nextMachine,
        betCommitInFlight: false,
        cycle: { ...nextMachine.cycle, phase: "awaiting_result" },
      };
    } else {
      nextMachine = { ...nextMachine, cycle: null };
    }
  }

  if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
    const { active, recovery } = nextMachine.cycle;
    const resultNumber = historyNewestFirst[0]!;
    const outcome = evaluateGoldeCruzamentoRound(resultNumber, active, recovery);
    const bet = goldeCruzamentoBetFactors(active, recovery);

    if (outcome === "W") {
      nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
      statsChanged = true;
      nextMachine = {
        ...nextMachine,
        cycle: null,
        recovery: 0,
        betCommitInFlight: false,
        lastEndedTriggerPair: active.triggerNumbers,
        lastEndedAtHead: head,
      };
      flash = {
        resultNumber,
        won: true,
        tableId: GOLDE_ROULETTE_TABLE_ID,
        kind: "win",
        factor1: bet.factor1,
        factor2: bet.factor2,
        recovery,
        triggerNumbers: active.triggerNumbers,
        oppositeMode: bet.oppositeMode,
      };
    } else if (outcome === "continue") {
      nextMachine = {
        ...nextMachine,
        cycle: null,
        recovery,
        lastEndedTriggerPair: active.triggerNumbers,
        lastEndedAtHead: head,
      };
      flash = {
        resultNumber,
        won: false,
        tableId: GOLDE_ROULETTE_TABLE_ID,
        kind: "tie",
        factor1: bet.factor1,
        factor2: bet.factor2,
        recovery,
        triggerNumbers: active.triggerNumbers,
        oppositeMode: bet.oppositeMode,
      };
    } else {
      const recoveryBefore = recovery;
      const nextRecovery = recoveryBefore + 1;
      if (nextRecovery > maxRecovery) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);
        statsChanged = true;
        nextMachine = {
          ...nextMachine,
          cycle: null,
          recovery: 0,
          lastEndedTriggerPair: active.triggerNumbers,
          lastEndedAtHead: head,
        };
        flash = {
          resultNumber,
          won: false,
          tableId: GOLDE_ROULETTE_TABLE_ID,
          kind: "loss",
          factor1: bet.factor1,
          factor2: bet.factor2,
          recovery: recoveryBefore,
          triggerNumbers: active.triggerNumbers,
          oppositeMode: bet.oppositeMode,
        };
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recoveryBefore, maxRecovery);
        statsChanged = true;
        nextMachine = {
          ...nextMachine,
          cycle: null,
          recovery: nextRecovery,
          lastEndedTriggerPair: active.triggerNumbers,
          lastEndedAtHead: head,
        };
        flash = {
          resultNumber,
          won: false,
          tableId: GOLDE_ROULETTE_TABLE_ID,
          kind: "loss",
          factor1: bet.factor1,
          factor2: bet.factor2,
          recovery: recoveryBefore,
          triggerNumbers: active.triggerNumbers,
          oppositeMode: bet.oppositeMode,
        };
      }
    }
  }

  if (!nextMachine.cycle && headChanged) {
    const trigger = detectGoldeCruzamentoTrigger(historyNewestFirst);
    const suppressPair =
      nextMachine.lastEndedAtHead === head ? nextMachine.lastEndedTriggerPair : null;
    const blocked =
      trigger != null &&
      suppressPair != null &&
      sameTriggerPair(trigger.triggerNumbers, suppressPair);
    if (trigger && !blocked) {
      const armedRecovery = nextMachine.recovery ?? 0;
      nextMachine = {
        ...nextMachine,
        cycle: {
          active: trigger,
          armedHead: head,
          recovery: armedRecovery,
          phase: "awaiting_bet",
        },
      };
    } else if (head !== nextMachine.lastEndedAtHead) {
      nextMachine = {
        ...nextMachine,
        lastEndedTriggerPair: null,
        lastEndedAtHead: null,
      };
    }
  }

  const globalActive =
    nextMachine.cycle?.phase === "awaiting_bet" ? nextMachine.cycle.active : null;
  const globalRecovery = nextMachine.cycle?.recovery ?? nextMachine.recovery ?? 0;

  return {
    machine: nextMachine,
    stats: nextStats,
    statsChanged,
    flash,
    globalActive,
    globalRecovery,
  };
}

export function parseGoldeCruzamentoStats(
  raw: unknown,
  maxRecovery = GOLDE_CRUZAMENTO_MAX_RECOVERY,
): RotatingRoomSessionStats {
  return parseRotatingRoomSessionStats(raw, maxRecovery);
}

export function emptyGoldeCruzamentoStats(
  maxRecovery = GOLDE_CRUZAMENTO_MAX_RECOVERY,
): RotatingRoomSessionStats {
  return emptyRotatingRoomSessionStats(maxRecovery);
}
