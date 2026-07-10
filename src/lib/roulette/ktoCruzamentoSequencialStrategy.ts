/**
 * KTO · Roulette 3 (230) — cruzamento sequencial 2 fatores.
 * Também usado pela extensão ICE (mesa 201) via o mesmo motor.
 *
 * **Gatilho:** dois números consecutivos (pos. 0 e 1) com exactamente 2 factores
 * em comum (cor, altura, paridade) — exclui 3 factores iguais — e em **dúzias
 * diferentes** (ex.: 21+31 sim; 11+6 não).
 *
 * **Entrada:** aposta nos 2 factores partilhados do par (ex.: 10,11 → Preto · Baixo).
 *
 * **Stake (unidades):** 1 · 1 · 2 · 4 · 8 · 16 · 32 (entrada + 6 gales).
 *
 * **Gales alternados (factores apostados):**
 * - Entrada (0), gale 2, gale 3, gale 6 → factores **normais** do gatilho
 * - Gale 1, gale 4, gale 5 → factores **opostos** (ambos invertidos)
 *
 * **Placar:** vitória = ambos ganham; derrota = ambos perdem ou zero;
 * empate (1 acerta) → encerra ciclo; **mantém gale pendente** para o próximo gatilho.
 *
 * **Recuperação:** sem insistir no mesmo gatilho — derrota dupla encerra o ciclo
 * actual; o próximo gatilho entra no gale seguinte (até maxRecovery).
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

export const KTO_ROULETTE_TABLE_ID = 230;
export const KTO_ROULETTE_MESA_URL =
  "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/";
/** @deprecated alias — mesa KTO actual: Roulette 3 (230). */
export const KTO_BRAZILIAN_ROULETTE_TABLE_ID = KTO_ROULETTE_TABLE_ID;
/** Entrada + 6 gales → recovery 0..6. */
export const KTO_CRUZAMENTO_MAX_RECOVERY = 6;
export const KTO_CRUZAMENTO_MIN_HISTORY = 2;

/** Unidades por nível: entrada, gale1…gale6. */
export const KTO_CRUZAMENTO_STAKE_UNITS = [1, 1, 2, 4, 8, 16, 32] as const;

/** 1.ª entrada — pausa após giro. */
export const KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS = 6_000;
/** Gales — aguardar após giro. */
export const KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS = 6_000;

/** Gales em que se apostam factores opostos ao gatilho. */
const KTO_OPPOSITE_RECOVERIES = new Set([1, 4, 5]);

/** Unidades de stake para o nível de gale (0 = entrada). */
export function ktoCruzamentoStakeUnits(recovery: number): number {
  const idx = Math.min(
    Math.max(0, Math.floor(recovery)),
    KTO_CRUZAMENTO_STAKE_UNITS.length - 1,
  );
  return KTO_CRUZAMENTO_STAKE_UNITS[idx]!;
}

export type KtoCruzamentoActive = {
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  pairKind: DoisFatoresPairKind;
  triggerNumbers: readonly [number, number];
  armingDescription: string;
};

export type KtoCruzamentoCyclePhase = "awaiting_bet" | "awaiting_result";

export type KtoCruzamentoCycle = {
  active: KtoCruzamentoActive;
  armedHead: string;
  recovery: number;
  phase: KtoCruzamentoCyclePhase;
};

export type KtoCruzamentoMachineState = {
  cycle: KtoCruzamentoCycle | null;
  lastSpinHead: string | null;
  /** Gale persistente entre gatilhos (não repete o mesmo par). */
  recovery: number;
  /** Último par encerrado — evita re-armar o mesmo gatilho no mesmo giro. */
  lastEndedTriggerPair: readonly [number, number] | null;
  lastEndedAtHead: string | null;
  /** Aposta em envio (CDP) — evita cancelar awaiting_bet antes de markBetPlaced. */
  betCommitInFlight?: boolean;
};

export type KtoCruzamentoFlash = {
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
  active: KtoCruzamentoActive,
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

export function ktoCruzamentoUseOppositeFactors(recovery: number): boolean {
  return KTO_OPPOSITE_RECOVERIES.has(recovery);
}

/** Factores efectivos na aposta conforme o gale. */
export function ktoCruzamentoBetFactors(
  active: KtoCruzamentoActive,
  recovery: number,
): { factor1: DoisFatoresFactor; factor2: DoisFatoresFactor; oppositeMode: boolean } {
  if (!ktoCruzamentoUseOppositeFactors(recovery)) {
    return { factor1: active.factor1, factor2: active.factor2, oppositeMode: false };
  }
  return {
    factor1: umFatorOppositeFactor(active.factor1),
    factor2: umFatorOppositeFactor(active.factor2),
    oppositeMode: true,
  };
}

/** Detecta gatilho nos dois giros mais recentes (exactamente 2 factores em comum). */
export function detectKtoCruzamentoTrigger(
  historyNewestFirst: readonly number[],
): KtoCruzamentoActive | null {
  if (historyNewestFirst.length < KTO_CRUZAMENTO_MIN_HISTORY) return null;

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
    armingDescription: `KTO 2F: cruzamento ${label} (${n1}, ${n0}) → entrada nos 2 factores`,
  };
}

export function evaluateKtoCruzamentoRound(
  num: number,
  active: KtoCruzamentoActive,
  recovery: number,
): "W" | "L" | "continue" {
  const { factor1, factor2 } = ktoCruzamentoBetFactors(active, recovery);
  return evaluateDoisFatoresRound(num, toTapeteActive(active, factor1, factor2));
}

export function defaultKtoCruzamentoMachineState(): KtoCruzamentoMachineState {
  return {
    cycle: null,
    lastSpinHead: null,
    recovery: 0,
    lastEndedTriggerPair: null,
    lastEndedAtHead: null,
  };
}

export function ktoCruzamentoBetDelayMs(recovery: number): number {
  return recovery > 0 ? KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS : KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS;
}

export function canPlaceKtoCruzamentoBet(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= ktoCruzamentoBetDelayMs(recovery);
}

export type KtoCruzamentoTickResult = {
  machine: KtoCruzamentoMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: KtoCruzamentoFlash | null;
  globalActive: KtoCruzamentoActive | null;
  globalRecovery: number;
};

export function tickKtoCruzamentoPlacar(
  historyNewestFirst: readonly number[],
  machine: KtoCruzamentoMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = KTO_CRUZAMENTO_MAX_RECOVERY,
): KtoCruzamentoTickResult {
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: KtoCruzamentoMachineState = {
    ...machine,
    lastSpinHead: head,
    recovery: machine.recovery ?? 0,
  };
  let nextStats = stats;
  let statsChanged = false;
  let flash: KtoCruzamentoFlash | null = null;

  /** Nova roleta com aposta ainda pendente — janela fechou sem entrar (não repete o gatilho). */
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
    const outcome = evaluateKtoCruzamentoRound(resultNumber, active, recovery);
    const bet = ktoCruzamentoBetFactors(active, recovery);

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
        tableId: KTO_ROULETTE_TABLE_ID,
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
        tableId: KTO_ROULETTE_TABLE_ID,
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
          tableId: KTO_ROULETTE_TABLE_ID,
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
          tableId: KTO_ROULETTE_TABLE_ID,
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

  /** Giro novo sem ciclo — após vitória/empate/derrota aguarda par válido diferente. */
  if (!nextMachine.cycle && headChanged) {
    const trigger = detectKtoCruzamentoTrigger(historyNewestFirst);
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

export function parseKtoCruzamentoStats(
  raw: unknown,
  maxRecovery = KTO_CRUZAMENTO_MAX_RECOVERY,
): RotatingRoomSessionStats {
  return parseRotatingRoomSessionStats(raw, maxRecovery);
}

export function emptyKtoCruzamentoStats(
  maxRecovery = KTO_CRUZAMENTO_MAX_RECOVERY,
): RotatingRoomSessionStats {
  return emptyRotatingRoomSessionStats(maxRecovery);
}
