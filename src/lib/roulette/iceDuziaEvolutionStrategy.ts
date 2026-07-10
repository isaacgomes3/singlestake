/**
 * ICE · Roulette 2 Extra Time (201) — gatilho 2 fatores (dúzias diferentes),
 * cobertura: **2 dúzias do gatilho** + **zero** + **10 números** da dúzia em falta
 * (exclui 2 opostos), recuperação Fibonacci.
 *
 * **Gatilho:** 2 factores em comum, dúzias diferentes (ex.: 36+22 → Par/Alto, dz 2+3).
 * **Entrada:**
 * - 12 un. em cada dúzia do gatilho
 * - 11 números: zero + 10 da dúzia em falta
 * - Exclui 2 números da dúzia em falta com factores **opostos** ao gatilho;
 *   **bloqueio absoluto:** nunca elimina números da mesma coluna dos gatilhos
 *   nem os que saíram nos últimos 12 giros (se não houver 2 livres, não arma).
 * **Recuperação:** Fibonacci 1·1·2·3·5·8·13·21·34 (escala as unidades).
 */

import type { DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";
import { detectKtoCruzamentoTrigger } from "@/lib/roulette/ktoCruzamentoSequencialStrategy";
import {
  colorOf,
  columnOf,
  dozenOf,
  heightOf,
  parityOf,
  type Dozen,
} from "@/lib/roulette/streetPairTrigger";
import {
  umFatorOppositeFactor,
  umFatorSharedFactorsBetween,
} from "@/lib/roulette/umFatorStrategy";

export const ICE_ROULETTE_TABLE_ID = 201;
export const ICE_ROULETTE_MESA_URL =
  "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal";

export const ICE_DUZIA_FIBONACCI_UNITS = [1, 1, 2, 3, 5, 8, 13, 21, 34] as const;
export const ICE_DUZIA_MAX_RECOVERY = ICE_DUZIA_FIBONACCI_UNITS.length - 1;
export const ICE_DUZIA_INITIAL_UNITS = ICE_DUZIA_FIBONACCI_UNITS[0]!;
export const ICE_DUZIA_MIN_HISTORY = 2;
export const ICE_DUZIA_FIRST_BET_SETTLE_MS = 5_000;
export const ICE_DUZIA_BET_DELAY_MS = 5_000;

/** Unidades base por dúzia (antes do escalão Fibonacci). */
export const ICE_DOZEN_BASE_UNITS = 12;
/** Números cobertos além das dúzias: zero + 10 da dúzia em falta. */
export const ICE_COVERED_NUMBER_COUNT = 11;
export const ICE_EXCLUDE_COUNT = 2;
/** Janela de bloqueio absoluto: números saídos recentemente. */
export const ICE_HISTORY_PROTECT_WINDOW = 12;

export type IceDuziaActive = {
  /** Dúzias do gatilho (apostadas). */
  dozen1: Dozen;
  dozen2: Dozen;
  /** Dúzia em falta (números individuais). */
  missingDozen: Dozen;
  /** Números cobertos (inclui 0). */
  coveredNumbers: readonly number[];
  /** Dois números excluídos da dúzia em falta. */
  excludedNumbers: readonly [number, number];
  oppositeFactors: readonly [DoisFatoresFactor, DoisFatoresFactor];
  triggerNumbers: readonly [number, number];
  armingDescription: string;
};

export type IceDuziaCyclePhase = "awaiting_bet" | "awaiting_result";

export type IceDuziaCycle = {
  active: IceDuziaActive;
  armedHead: string;
  recovery: number;
  /** Escala Fibonacci (1,1,2,3…). */
  unitScale: number;
  /** Cliques por dúzia = 12 × unitScale. */
  dozenUnits: number;
  /** Cliques por número = 1 × unitScale. */
  numberUnits: number;
  phase: IceDuziaCyclePhase;
};

export type IceDuziaMachineState = {
  cycle: IceDuziaCycle | null;
  lastSpinHead: string | null;
  recovery: number;
  lastBetUnits: number | null;
  lastEndedTriggerPair: readonly [number, number] | null;
  lastEndedAtHead: string | null;
  betCommitInFlight?: boolean;
};

export type IceDuziaSessionStats = {
  wins: number;
  losses: number;
};

export type IceDuziaFlash = {
  resultNumber: number;
  won: boolean;
  kind: "win" | "loss";
  betUnits: number;
  recovery: number;
  nextRecovery: number;
  nextUnits: number;
  triggerNumbers: readonly [number, number];
  dozen1: Dozen;
  dozen2: Dozen;
  coveredNumbers: readonly number[];
};

function sameTriggerPair(
  a: readonly [number, number] | null | undefined,
  b: readonly [number, number] | null | undefined,
): boolean {
  if (!a || !b) return false;
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function factorWins(num: number, factor: DoisFatoresFactor): boolean {
  if (num === 0) return false;
  switch (factor.kind) {
    case "cor":
      return colorOf(num) === factor.value;
    case "paridade":
      return parityOf(num) === factor.value;
    case "altura":
      return heightOf(num) === factor.value;
  }
}

export function iceDuziaLabel(d: Dozen): string {
  return `${d}ª dúzia`;
}

export function iceDuziaBetKey(d: Dozen): string {
  return `doz:${d}`;
}

export function iceNumberBetKey(n: number): string {
  return `num:${n}`;
}

export function iceDuziaClampRecovery(recovery: number): number {
  const n = Math.floor(recovery);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(ICE_DUZIA_MAX_RECOVERY, n);
}

export function iceDuziaUnitsForRecovery(recovery: number): number {
  const idx = iceDuziaClampRecovery(recovery);
  return ICE_DUZIA_FIBONACCI_UNITS[idx]!;
}

export function iceDuziaRecoveryAfterResult(recovery: number, won: boolean): number {
  if (won) return 0;
  return iceDuziaClampRecovery(iceDuziaClampRecovery(recovery) + 1);
}

export function iceMissingDozen(a: number, b: number): Dozen | null {
  const d0 = dozenOf(a);
  const d1 = dozenOf(b);
  if (d0 == null || d1 == null || d0 === d1) return null;
  for (const d of [1, 2, 3] as const) {
    if (d !== d0 && d !== d1) return d;
  }
  return null;
}

export function iceNumbersInDozen(dozen: Dozen): number[] {
  const start = (dozen - 1) * 12 + 1;
  return Array.from({ length: 12 }, (_, i) => start + i);
}

function matchesBothFactors(n: number, f1: DoisFatoresFactor, f2: DoisFatoresFactor): boolean {
  return factorWins(n, f1) && factorWins(n, f2);
}

function shuffleInPlace<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Escolhe 2 números a excluir na dúzia em falta.
 * Candidatos preferenciais = opostos ao gatilho.
 * **Bloqueio absoluto** (nunca exclui):
 * - mesma coluna de qualquer número do gatilho;
 * - números saídos nos últimos {@link ICE_HISTORY_PROTECT_WINDOW} giros.
 * Se não houver 2 elegíveis na dúzia em falta, devolve `null` (não arma).
 */
export function icePickExcludedNumbers(
  missingDozen: Dozen,
  opposite1: DoisFatoresFactor,
  opposite2: DoisFatoresFactor,
  historyNewestFirst: readonly number[],
  triggerNumbers: readonly [number, number],
  random: () => number = Math.random,
): [number, number] | null {
  const inDozen = iceNumbersInDozen(missingDozen);
  const recent = new Set(
    historyNewestFirst.slice(0, ICE_HISTORY_PROTECT_WINDOW).filter((n) => n > 0),
  );
  const triggerColumns = new Set(
    [columnOf(triggerNumbers[0]), columnOf(triggerNumbers[1])].filter(
      (c): c is 1 | 2 | 3 => c != null,
    ),
  );
  const isBlocked = (n: number) => {
    if (recent.has(n)) return true;
    const col = columnOf(n);
    return col != null && triggerColumns.has(col);
  };

  const oppositeEligible = inDozen.filter(
    (n) => matchesBothFactors(n, opposite1, opposite2) && !isBlocked(n),
  );
  const dozenEligible = inDozen.filter((n) => !isBlocked(n));
  const pool =
    oppositeEligible.length >= ICE_EXCLUDE_COUNT ? oppositeEligible : dozenEligible;

  if (pool.length < ICE_EXCLUDE_COUNT) return null;

  const shuffled = shuffleInPlace([...pool], random);
  const a = shuffled[0]!;
  const b = shuffled[1]!;
  return a < b ? [a, b] : [b, a];
}

export function iceBuildCoveredNumbers(
  missingDozen: Dozen,
  excluded: readonly [number, number],
): number[] {
  const exclude = new Set(excluded);
  const fromMissing = iceNumbersInDozen(missingDozen).filter((n) => !exclude.has(n));
  return [0, ...fromMissing];
}

export function detectIceDuziaTrigger(
  historyNewestFirst: readonly number[],
  random: () => number = Math.random,
): IceDuziaActive | null {
  const trigger = detectKtoCruzamentoTrigger(historyNewestFirst);
  if (!trigger) return null;

  const n0 = historyNewestFirst[0]!;
  const n1 = historyNewestFirst[1]!;
  const d0 = dozenOf(n0);
  const d1 = dozenOf(n1);
  const missing = iceMissingDozen(n0, n1);
  if (d0 == null || d1 == null || missing == null) return null;

  const shared = umFatorSharedFactorsBetween(n0, n1);
  if (shared.length !== 2) return null;
  const opposite1 = umFatorOppositeFactor(shared[0]!);
  const opposite2 = umFatorOppositeFactor(shared[1]!);

  const excluded = icePickExcludedNumbers(
    missing,
    opposite1,
    opposite2,
    historyNewestFirst,
    [n1, n0],
    random,
  );
  if (!excluded) return null;
  const coveredNumbers = iceBuildCoveredNumbers(missing, excluded);
  const dozen1 = Math.min(d0, d1) as Dozen;
  const dozen2 = Math.max(d0, d1) as Dozen;

  return {
    dozen1,
    dozen2,
    missingDozen: missing,
    coveredNumbers,
    excludedNumbers: excluded,
    oppositeFactors: [opposite1, opposite2],
    triggerNumbers: [n1, n0] as const,
    armingDescription: `ICE cobertura ${iceDuziaLabel(dozen1)}+${iceDuziaLabel(dozen2)} · ${coveredNumbers.length} núms · excl ${excluded.join(",")}`,
  };
}

export function evaluateIceDuziaRound(num: number, active: IceDuziaActive): "W" | "L" {
  if (num === 0) return "W";
  const d = dozenOf(num);
  if (d === active.dozen1 || d === active.dozen2) return "W";
  if (active.coveredNumbers.includes(num)) return "W";
  return "L";
}

export function defaultIceDuziaMachineState(): IceDuziaMachineState {
  return {
    cycle: null,
    lastSpinHead: null,
    recovery: 0,
    lastBetUnits: null,
    lastEndedTriggerPair: null,
    lastEndedAtHead: null,
  };
}

export function emptyIceDuziaStats(): IceDuziaSessionStats {
  return { wins: 0, losses: 0 };
}

export function parseIceDuziaStats(raw: unknown): IceDuziaSessionStats {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    wins: Math.max(0, Number(o.wins) || 0),
    losses: Math.max(0, Number(o.losses) || 0),
  };
}

export function iceDuziaBetDelayMs(recovery: number): number {
  return iceDuziaClampRecovery(recovery) > 0
    ? ICE_DUZIA_BET_DELAY_MS
    : ICE_DUZIA_FIRST_BET_SETTLE_MS;
}

export function canPlaceIceDuziaBet(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= iceDuziaBetDelayMs(recovery);
}

export function iceStakePlanForRecovery(recovery: number): {
  unitScale: number;
  dozenUnits: number;
  numberUnits: number;
  totalUnits: number;
} {
  const unitScale = iceDuziaUnitsForRecovery(recovery);
  const dozenUnits = ICE_DOZEN_BASE_UNITS * unitScale;
  const numberUnits = unitScale;
  return {
    unitScale,
    dozenUnits,
    numberUnits,
    totalUnits: dozenUnits * 2 + numberUnits * ICE_COVERED_NUMBER_COUNT,
  };
}

export type IceDuziaTickResult = {
  machine: IceDuziaMachineState;
  stats: IceDuziaSessionStats;
  statsChanged: boolean;
  flash: IceDuziaFlash | null;
  globalActive: IceDuziaActive | null;
  globalUnits: number;
  globalRecovery: number;
};

export function tickIceDuziaPlacar(
  historyNewestFirst: readonly number[],
  machine: IceDuziaMachineState,
  stats: IceDuziaSessionStats,
): IceDuziaTickResult {
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: IceDuziaMachineState = {
    ...machine,
    lastSpinHead: head,
    recovery: iceDuziaClampRecovery(machine.recovery ?? 0),
  };
  let nextStats = stats;
  let statsChanged = false;
  let flash: IceDuziaFlash | null = null;

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
    const { active, dozenUnits, recovery } = nextMachine.cycle;
    const resultNumber = historyNewestFirst[0]!;
    const won = evaluateIceDuziaRound(resultNumber, active) === "W";
    const nextRecovery = iceDuziaRecoveryAfterResult(recovery, won);
    const nextUnits = iceDuziaUnitsForRecovery(nextRecovery);
    const betUnits = dozenUnits;

    if (won) {
      nextStats = { ...nextStats, wins: nextStats.wins + 1 };
      statsChanged = true;
    } else {
      nextStats = { ...nextStats, losses: nextStats.losses + 1 };
      statsChanged = true;
    }

    nextMachine = {
      ...nextMachine,
      cycle: null,
      recovery: nextRecovery,
      lastBetUnits: betUnits,
      betCommitInFlight: false,
      lastEndedTriggerPair: active.triggerNumbers,
      lastEndedAtHead: head,
    };
    flash = {
      resultNumber,
      won,
      kind: won ? "win" : "loss",
      betUnits,
      recovery,
      nextRecovery,
      nextUnits,
      triggerNumbers: active.triggerNumbers,
      dozen1: active.dozen1,
      dozen2: active.dozen2,
      coveredNumbers: active.coveredNumbers,
    };
  }

  if (!nextMachine.cycle && headChanged) {
    const trigger = detectIceDuziaTrigger(historyNewestFirst);
    const suppressPair =
      nextMachine.lastEndedAtHead === head ? nextMachine.lastEndedTriggerPair : null;
    const blocked =
      trigger != null &&
      suppressPair != null &&
      sameTriggerPair(trigger.triggerNumbers, suppressPair);
    if (trigger && !blocked) {
      const recovery = nextMachine.recovery;
      const plan = iceStakePlanForRecovery(recovery);
      nextMachine = {
        ...nextMachine,
        cycle: {
          active: trigger,
          armedHead: head,
          recovery,
          unitScale: plan.unitScale,
          dozenUnits: plan.dozenUnits,
          numberUnits: plan.numberUnits,
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
  const globalRecovery = nextMachine.cycle?.recovery ?? nextMachine.recovery;
  const globalUnits =
    nextMachine.cycle?.dozenUnits ?? iceStakePlanForRecovery(globalRecovery).dozenUnits;

  return {
    machine: nextMachine,
    stats: nextStats,
    statsChanged,
    flash,
    globalActive,
    globalUnits,
    globalRecovery,
  };
}
