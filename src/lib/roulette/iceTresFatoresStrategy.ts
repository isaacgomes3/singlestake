/**
 * ICE · 3 Fatores — posições críticas 5, 6, 7, 9, 10 e 11.
 *
 * **Observação (pré-entrada):** em cada posição crítica P, compara o giro mais recente
 * com os 3 factores (cor, altura, paridade) do número que estava na posição P.
 * Conta **derrotas totais** (0 factores) e **derrotas parciais** (1 factor) por posição;
 * vitória parcial (2) ou total (3) reinicia ambos os contadores.
 *
 * **Entrada:** após **2 derrotas totais**, ou **1 derrota total + 3 derrotas parciais**
 * na posição P. Aposta os 3 factores do número actual na **mesma posição P**.
 *
 * **Placar na aposta:** vitória se acertar ≥2 factores; derrota parcial (1); derrota total (0).
 * Zero com aposta activa → derrota total. Na observação o zero continua neutro.
 * Derrota parcial → +1 gale (×2); derrota total → +2 gales (×4: 1→4, gale1·2→8).
 *
 * **Falha do ciclo:** 5 gales seguidos, ou 2 triplas seguidas, ou 1 tripla + 2 gales.
 * Ciclo activo bloqueia novo armamento noutra posição.
 */

import {
  doisFatoresFactorLabel,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";
import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  recordRotatingRoomSessionFinalLoss,
  recordRotatingRoomSessionWin,
  type RotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";

export const ICE_3F_ROULETTE_TABLE_ID = 201;
export const ICE_3F_ROULETTE_MESA_URL =
  "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal";

/** Posições críticas na grelha (1 = giro mais recente). */
export const ICE_3F_CRITICAL_POSITIONS = [5, 6, 7, 9, 10, 11] as const;

export const ICE_3F_MIN_HISTORY = 12;
export const ICE_3F_REQUIRED_TOTAL_DEFEATS = 2;
export const ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL = 3;
export const ICE_3F_GALE_MULTIPLIER = 2;
/** Derrota total — avança 2 gales sobre a última entrada (×4: 1→4, 2→8, 8→32). */
export const ICE_3F_TOTAL_LOSS_MULTIPLIER = 4;
/** Gale 3 na progressão 1·2·4·8… — referência de tempo de digitação. */
export const ICE_3F_GALE3_REFERENCE_UNITS = 8;
export const ICE_3F_CHIP_CLICK_STAGGER_MS = 150;
/** Janela única para apostar após o giro (todos os estágios). */
export const ICE_3F_BET_DELAY_MS = 5_000;
export const ICE_3F_FIRST_BET_SETTLE_MS = ICE_3F_BET_DELAY_MS;
export const ICE_3F_RECOVERY_BET_DELAY_MS = ICE_3F_BET_DELAY_MS;
export const ICE_3F_MAX_GALE_STREAK = 5;
export const ICE_3F_MAX_CONSECUTIVE_TRIPLES = 2;
export const ICE_3F_GALES_AFTER_TRIPLE_LIMIT = 2;

export type Ice3fCriticalPosition = (typeof ICE_3F_CRITICAL_POSITIONS)[number];

export type Ice3fMatchOutcome =
  | "total_win"
  | "partial_win"
  | "partial_loss"
  | "total_loss";

export type Ice3fTripleFactors = readonly [
  DoisFatoresFactor,
  DoisFatoresFactor,
  DoisFatoresFactor,
];

export type Ice3fActive = {
  criticalPosition: Ice3fCriticalPosition;
  factors: Ice3fTripleFactors;
  referenceNumber: number;
  armingDescription: string;
};

export type Ice3fCyclePhase = "awaiting_bet" | "awaiting_result";

export type Ice3fCycle = {
  active: Ice3fActive;
  armedHead: string;
  unitScale: number;
  galeStreak: number;
  consecutiveTriples: number;
  galesSinceTriple: number;
  phase: Ice3fCyclePhase;
};

export type Ice3fWatchSlot = { total: number; partial: number };

export type Ice3fWatchCounters = Record<Ice3fCriticalPosition, Ice3fWatchSlot>;

export type Ice3fMachineState = {
  cycle: Ice3fCycle | null;
  watch: Ice3fWatchCounters;
  pendingCritical: Ice3fCriticalPosition | null;
  lastSpinHead: string | null;
  betCommitInFlight?: boolean;
};

export type Ice3fFlash = {
  resultNumber: number;
  won: boolean;
  kind: "win" | "loss" | "cycle_fail";
  matchOutcome: Ice3fMatchOutcome;
  criticalPosition: Ice3fCriticalPosition;
  unitScale: number;
  factors: Ice3fTripleFactors;
};

function criticalIndex(position: Ice3fCriticalPosition): number {
  return position - 1;
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

export function ice3fTripleForNumber(n: number): Ice3fTripleFactors | null {
  if (n === 0) return null;
  const col = colorOf(n);
  const alt = heightOf(n);
  const par = parityOf(n);
  if (col === "Zero" || alt === "Zero" || par === "Zero") return null;
  return [
    { kind: "cor", value: col },
    { kind: "altura", value: alt },
    { kind: "paridade", value: par },
  ] as const;
}

export function ice3fMatchCount(result: number, ref: number): number {
  if (result === 0 || ref === 0) return 0;
  const triple = ice3fTripleForNumber(ref);
  if (!triple) return 0;
  return triple.filter((f) => factorWins(result, f)).length;
}

export function ice3fClassifyMatch(result: number, ref: number): Ice3fMatchOutcome | null {
  if (result === 0 || ref === 0) return null;
  const count = ice3fMatchCount(result, ref);
  if (count === 3) return "total_win";
  if (count === 2) return "partial_win";
  if (count === 1) return "partial_loss";
  return "total_loss";
}

/** Placar da aposta — zero com referência válida conta como derrota total. */
export function ice3fClassifyBetRound(result: number, ref: number): Ice3fMatchOutcome | null {
  if (ref === 0) return null;
  if (result === 0) return "total_loss";
  return ice3fClassifyMatch(result, ref);
}

export function normalizeIce3fWatchSlot(
  raw: Ice3fWatchSlot | number | null | undefined,
): Ice3fWatchSlot {
  if (typeof raw === "number") return { total: Math.max(0, raw), partial: 0 };
  return {
    total: Math.max(0, raw?.total ?? 0),
    partial: Math.max(0, raw?.partial ?? 0),
  };
}

export function ice3fIsPositionArmed(
  raw: Ice3fWatchSlot | number | null | undefined,
): boolean {
  const slot = normalizeIce3fWatchSlot(raw);
  return (
    slot.total >= ICE_3F_REQUIRED_TOTAL_DEFEATS ||
    (slot.total >= 1 && slot.partial >= ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL)
  );
}

function emptyWatchSlot(): Ice3fWatchSlot {
  return { total: 0, partial: 0 };
}

function emptyWatch(): Ice3fWatchCounters {
  return Object.fromEntries(
    ICE_3F_CRITICAL_POSITIONS.map((pos) => [pos, emptyWatchSlot()]),
  ) as Ice3fWatchCounters;
}

function cloneWatch(watch: Ice3fWatchCounters): Ice3fWatchCounters {
  return Object.fromEntries(
    ICE_3F_CRITICAL_POSITIONS.map((pos) => [pos, { ...normalizeIce3fWatchSlot(watch[pos]) }]),
  ) as Ice3fWatchCounters;
}

export function defaultIce3fMachineState(): Ice3fMachineState {
  return {
    cycle: null,
    watch: emptyWatch(),
    pendingCritical: null,
    lastSpinHead: null,
  };
}

/** Número actual na posição P da grelha (1 = giro mais recente). */
function referenceAtGridPosition(
  historyNewestFirst: readonly number[],
  position: Ice3fCriticalPosition,
): number | null {
  const idx = criticalIndex(position);
  if (historyNewestFirst.length <= idx) return null;
  return historyNewestFirst[idx]!;
}

/** Referência na posição P **antes** do giro que acabou de entrar (índice P após shift). */
function referenceBeforeSpin(
  historyNewestFirst: readonly number[],
  position: Ice3fCriticalPosition,
): number | null {
  if (historyNewestFirst.length <= position) return null;
  return historyNewestFirst[position]!;
}

export function ice3fBuildActiveFromHistory(
  historyNewestFirst: readonly number[],
  criticalPosition: Ice3fCriticalPosition,
): Ice3fActive | null {
  const refNum = referenceAtGridPosition(historyNewestFirst, criticalPosition);
  if (refNum == null) return null;
  const factors = ice3fTripleForNumber(refNum);
  if (!factors) return null;
  const labels = factors.map(doisFatoresFactorLabel).join(" · ");
  return {
    criticalPosition,
    factors,
    referenceNumber: refNum,
    armingDescription: `ICE 3F pos${criticalPosition}: nº${refNum} → ${labels}`,
  };
}

function cycleFailed(cycle: Ice3fCycle): boolean {
  if (cycle.galeStreak >= ICE_3F_MAX_GALE_STREAK) return true;
  if (cycle.consecutiveTriples >= ICE_3F_MAX_CONSECUTIVE_TRIPLES) return true;
  if (
    cycle.consecutiveTriples >= 1 &&
    cycle.galesSinceTriple >= ICE_3F_GALES_AFTER_TRIPLE_LIMIT
  ) {
    return true;
  }
  return false;
}

function evaluateBetRound(
  result: number,
  active: Ice3fActive,
): Ice3fMatchOutcome | null {
  return ice3fClassifyBetRound(result, active.referenceNumber);
}

function updateWatchOnSpin(
  watch: Ice3fWatchCounters,
  historyNewestFirst: readonly number[],
): Ice3fWatchCounters {
  const result = historyNewestFirst[0]!;
  const next = cloneWatch(watch);
  for (const pos of ICE_3F_CRITICAL_POSITIONS) {
    const ref = referenceBeforeSpin(historyNewestFirst, pos);
    if (ref == null) continue;
    const outcome = ice3fClassifyMatch(result, ref);
    if (outcome == null) continue;
    if (outcome === "total_win" || outcome === "partial_win") {
      next[pos] = emptyWatchSlot();
    } else if (outcome === "total_loss") {
      next[pos] = {
        total: Math.min(ICE_3F_REQUIRED_TOTAL_DEFEATS, next[pos].total + 1),
        partial: next[pos].partial,
      };
    } else if (outcome === "partial_loss") {
      next[pos] = {
        total: next[pos].total,
        partial: next[pos].partial + 1,
      };
    }
  }
  return next;
}

/** Reconstrói contadores de observação a partir do histórico (snapshot DGA). */
export function primeIce3fWatchFromHistory(
  historyNewestFirst: readonly number[],
): Ice3fWatchCounters {
  if (historyNewestFirst.length < ICE_3F_MIN_HISTORY) return emptyWatch();
  let watch = emptyWatch();
  const chronological = [...historyNewestFirst].reverse();
  for (let end = ICE_3F_MIN_HISTORY; end <= chronological.length; end++) {
    const sliceNewestFirst = chronological.slice(0, end).reverse();
    watch = updateWatchOnSpin(watch, sliceNewestFirst);
  }
  return watch;
}

export function tryArmCycleFromWatch(
  machine: Ice3fMachineState,
  historyNewestFirst: readonly number[],
  head: string,
): Ice3fMachineState {
  if (machine.cycle) return machine;
  const armedPos = firstArmedPosition(machine.watch);
  if (armedPos == null) return machine;
  const active = ice3fBuildActiveFromHistory(historyNewestFirst, armedPos);
  if (!active) return machine;
  return {
    ...machine,
    cycle: {
      active,
      armedHead: head,
      unitScale: 1,
      galeStreak: 0,
      consecutiveTriples: 0,
      galesSinceTriple: 0,
      phase: "awaiting_bet",
    },
    watch: { ...machine.watch, [armedPos]: emptyWatchSlot() },
    pendingCritical: null,
  };
}

function firstArmedPosition(watch: Ice3fWatchCounters): Ice3fCriticalPosition | null {
  for (const pos of ICE_3F_CRITICAL_POSITIONS) {
    if (ice3fIsPositionArmed(watch[pos])) return pos;
  }
  return null;
}

export function ice3fUnitScaleForCycle(cycle: Ice3fCycle): number {
  return Math.max(1, Math.floor(cycle.unitScale));
}

/** Próxima escala após derrota na aposta — baseada na última entrada que falhou. */
export function ice3fNextUnitScaleAfterLoss(
  currentScale: number,
  outcome: "partial_loss" | "total_loss",
): number {
  const base = Math.max(1, Math.floor(currentScale));
  return outcome === "total_loss"
    ? base * ICE_3F_TOTAL_LOSS_MULTIPLIER
    : base * ICE_3F_GALE_MULTIPLIER;
}

/** Pausa extra após cliques de um factor — iguala entrada/gale1/gale2 ao tempo do gale 3. */
export function ice3fPadFactorPlacementMs(unitScale: number): number {
  const units = Math.max(1, Math.floor(unitScale));
  if (units >= ICE_3F_GALE3_REFERENCE_UNITS) return 0;
  return (ICE_3F_GALE3_REFERENCE_UNITS - units) * ICE_3F_CHIP_CLICK_STAGGER_MS;
}

export function ice3fBetDelayMs(_unitScale?: number): number {
  return ICE_3F_BET_DELAY_MS;
}

export function canPlaceIce3fBet(
  unitScale: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= ice3fBetDelayMs(unitScale);
}

export type Ice3fTickResult = {
  machine: Ice3fMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: Ice3fFlash | null;
  globalActive: Ice3fActive | null;
  globalUnitScale: number;
};

export function tickIce3fPlacar(
  historyNewestFirst: readonly number[],
  machine: Ice3fMachineState,
  stats: RotatingRoomSessionStats,
): Ice3fTickResult {
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: Ice3fMachineState = {
    ...machine,
    lastSpinHead: head,
    watch: cloneWatch(machine.watch),
  };
  let nextStats = stats;
  let statsChanged = false;
  let flash: Ice3fFlash | null = null;

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
    const cycle = nextMachine.cycle;
    const resultNumber = historyNewestFirst[0]!;
    const outcome = evaluateBetRound(resultNumber, cycle.active);

    if (outcome === "total_win" || outcome === "partial_win") {
      nextStats = recordRotatingRoomSessionWin(nextStats, 0, 0);
      statsChanged = true;
      nextMachine = {
        ...nextMachine,
        cycle: null,
        watch: emptyWatch(),
        pendingCritical: null,
        betCommitInFlight: false,
      };
      flash = {
        resultNumber,
        won: true,
        kind: "win",
        matchOutcome: outcome,
        criticalPosition: cycle.active.criticalPosition,
        unitScale: cycle.unitScale,
        factors: cycle.active.factors,
      };
    } else if (outcome === "partial_loss" || outcome === "total_loss") {
      const isTotal = outcome === "total_loss";
      const failedScale = ice3fUnitScaleForCycle(cycle);
      let nextCycle: Ice3fCycle = {
        ...cycle,
        unitScale: ice3fNextUnitScaleAfterLoss(failedScale, outcome),
        galeStreak: isTotal ? 0 : cycle.galeStreak + 1,
        consecutiveTriples: isTotal ? cycle.consecutiveTriples + 1 : 0,
        galesSinceTriple: isTotal ? 0 : cycle.galesSinceTriple + 1,
        phase: "awaiting_bet",
      };

      const rebuilt = ice3fBuildActiveFromHistory(
        historyNewestFirst,
        cycle.active.criticalPosition,
      );
      if (rebuilt) {
        nextCycle = { ...nextCycle, active: rebuilt };
      }

      if (cycleFailed(nextCycle)) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, 0, 0);
        statsChanged = true;
        nextMachine = {
          ...nextMachine,
          cycle: null,
          watch: emptyWatch(),
          pendingCritical: null,
          betCommitInFlight: false,
        };
        flash = {
          resultNumber,
          won: false,
          kind: "cycle_fail",
          matchOutcome: outcome,
          criticalPosition: cycle.active.criticalPosition,
          unitScale: nextCycle.unitScale,
          factors: cycle.active.factors,
        };
      } else {
        nextMachine = {
          ...nextMachine,
          cycle: { ...nextCycle, armedHead: head },
          betCommitInFlight: false,
        };
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          matchOutcome: outcome,
          criticalPosition: cycle.active.criticalPosition,
          unitScale: nextCycle.unitScale,
          factors: cycle.active.factors,
        };
      }
    }
  }

  if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= ICE_3F_MIN_HISTORY) {
    nextMachine = {
      ...nextMachine,
      watch: updateWatchOnSpin(nextMachine.watch, historyNewestFirst),
    };
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
  }

  if (nextMachine.cycle && headChanged) {
    const armedPos = firstArmedPosition(nextMachine.watch);
    if (armedPos != null && armedPos !== nextMachine.cycle.active.criticalPosition) {
      nextMachine = { ...nextMachine, pendingCritical: armedPos };
    }
  }

  if (!nextMachine.cycle && nextMachine.pendingCritical != null && headChanged) {
    const pos = nextMachine.pendingCritical;
    if (ice3fIsPositionArmed(nextMachine.watch[pos])) {
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
      if (nextMachine.cycle) {
        nextMachine = { ...nextMachine, pendingCritical: null };
      }
    }
  }

  const globalActive =
    nextMachine.cycle?.phase === "awaiting_bet" ? nextMachine.cycle.active : null;
  const globalUnitScale = nextMachine.cycle ? ice3fUnitScaleForCycle(nextMachine.cycle) : 1;

  return {
    machine: nextMachine,
    stats: nextStats,
    statsChanged,
    flash,
    globalActive,
    globalUnitScale,
  };
}

export function parseIce3fStats(raw: unknown): RotatingRoomSessionStats {
  return parseRotatingRoomSessionStats(raw, 0);
}

export function emptyIce3fStats(): RotatingRoomSessionStats {
  return emptyRotatingRoomSessionStats(0);
}
