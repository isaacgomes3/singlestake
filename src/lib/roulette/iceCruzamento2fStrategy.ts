/**
 * ICE · Cruzamento 2 Fatores — posições críticas 5, 6, 7, 9, 10 e 11.
 *
 * **Observação:** em cada posição P monitora cruzamentos **cor/altura** e **paridade/altura**.
 * Compara o giro mais recente com o número que estava na posição P.
 * - Vitória (2 factores) → zera contador
 * - Empate (1 factor) → não conta
 * - Derrota (0 factores) → +1 falha
 * - Zero → neutro (não conta na observação)
 *
 * **Entrada:** após **4 derrotas** no par (posição, eixo), aposta os 2 factores do número
 * actual na mesma posição P nesse eixo.
 *
 * **Placar:** vitória = ambos; derrota = ambos falham; zero com indicação activa = derrota;
 * empate (1 factor) na aposta → mantém gale, re-aposta.
 * Zero na **posição crítica** durante ciclo → pausa (`awaiting_reference`), mantém gale.
 * Gales até **5** (recovery 0…5).
 */

import {
  doisFatoresFactorLabel,
  evaluateDoisFatoresRound,
  type DoisFatoresActive,
  type DoisFatoresFactor,
  type DoisFatoresPairKind,
} from "@/lib/roulette/doisFatoresStrategy";
import {
  factorsForNumberOnAxis,
  pairKindFromCrossingAxis,
  type CrossingAxisKind,
} from "@/lib/roulette/doisFatoresPatternCrossing";
import {
  emptyRotatingRoomSessionStats,
  parseRotatingRoomSessionStats,
  recordRotatingRoomSessionFinalLoss,
  recordRotatingRoomSessionPartialLoss,
  recordRotatingRoomSessionWin,
  type RotatingRoomSessionStats,
} from "@/lib/roulette/entryWinBreakdown";

export const ICE_2F_ROULETTE_TABLE_ID = 201;
export const ICE_2F_ROULETTE_MESA_URL =
  "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal";

export const ICE_2F_CRITICAL_POSITIONS = [5, 6, 7, 9, 10, 11] as const;
export const ICE_2F_CROSSING_AXES = ["cor-altura", "altura-paridade"] as const;

export const ICE_2F_MIN_HISTORY = 12;
export const ICE_2F_REQUIRED_FAILURES = 4;
export const ICE_2F_MAX_RECOVERY = 5;

export const ICE_2F_FIRST_BET_SETTLE_MS = 13_000;
export const ICE_2F_RECOVERY_BET_DELAY_MS = 5_000;
export const ICE_2F_BET_DELAY_MS = ICE_2F_FIRST_BET_SETTLE_MS;

export const ICE_2F_STAKE_UNITS = [1, 2, 4, 8, 16, 32] as const;

/** Referência gale 3 (8 unidades) — alinha tempo de digitação com ICE 3F. */
export const ICE_2F_GALE3_REFERENCE_UNITS = 8;

export function ice2fPadFactorPlacementMs(units: number): number {
  const u = Math.max(1, Math.floor(units));
  if (u >= ICE_2F_GALE3_REFERENCE_UNITS) return 0;
  const base = 150;
  return (ICE_2F_GALE3_REFERENCE_UNITS - u) * base;
}

export type Ice2fCriticalPosition = (typeof ICE_2F_CRITICAL_POSITIONS)[number];
export type Ice2fCrossingAxis = (typeof ICE_2F_CROSSING_AXES)[number];

export type Ice2fWatchSlot = { failures: number };
export type Ice2fWatchAxisMap = Record<Ice2fCrossingAxis, Ice2fWatchSlot>;
export type Ice2fWatchCounters = Record<Ice2fCriticalPosition, Ice2fWatchAxisMap>;

export type Ice2fActive = {
  criticalPosition: Ice2fCriticalPosition;
  axis: Ice2fCrossingAxis;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
  pairKind: DoisFatoresPairKind;
  referenceNumber: number;
  armingDescription: string;
};

export type Ice2fCyclePhase = "awaiting_bet" | "awaiting_result" | "awaiting_reference";

export type Ice2fCycle = {
  active: Ice2fActive;
  armedHead: string;
  recovery: number;
  phase: Ice2fCyclePhase;
};

export type Ice2fMachineState = {
  cycle: Ice2fCycle | null;
  watch: Ice2fWatchCounters;
  pendingArm: { position: Ice2fCriticalPosition; axis: Ice2fCrossingAxis } | null;
  lastSpinHead: string | null;
  betCommitInFlight?: boolean;
};

export type Ice2fFlash = {
  resultNumber: number;
  won: boolean;
  kind: "win" | "loss" | "tie";
  criticalPosition: Ice2fCriticalPosition;
  axis: Ice2fCrossingAxis;
  recovery: number;
  factor1: DoisFatoresFactor;
  factor2: DoisFatoresFactor;
};

type ObservationOutcome = "win" | "tie" | "loss";

function criticalIndex(position: Ice2fCriticalPosition): number {
  return position - 1;
}

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function emptyWatchSlot(): Ice2fWatchSlot {
  return { failures: 0 };
}

function emptyWatchAxisMap(): Ice2fWatchAxisMap {
  return {
    "cor-altura": emptyWatchSlot(),
    "altura-paridade": emptyWatchSlot(),
  };
}

function emptyWatch(): Ice2fWatchCounters {
  return Object.fromEntries(
    ICE_2F_CRITICAL_POSITIONS.map((pos) => [pos, emptyWatchAxisMap()]),
  ) as Ice2fWatchCounters;
}

function cloneWatch(watch: Ice2fWatchCounters): Ice2fWatchCounters {
  const next = {} as Ice2fWatchCounters;
  for (const pos of ICE_2F_CRITICAL_POSITIONS) {
    next[pos] = {
      "cor-altura": { ...watch[pos]["cor-altura"] },
      "altura-paridade": { ...watch[pos]["altura-paridade"] },
    };
  }
  return next;
}

export function defaultIce2fMachineState(): Ice2fMachineState {
  return {
    cycle: null,
    watch: emptyWatch(),
    pendingArm: null,
    lastSpinHead: null,
  };
}

function referenceAtGridPosition(
  historyNewestFirst: readonly number[],
  position: Ice2fCriticalPosition,
): number | null {
  const idx = criticalIndex(position);
  if (historyNewestFirst.length <= idx) return null;
  return historyNewestFirst[idx]!;
}

function referenceBeforeSpin(
  historyNewestFirst: readonly number[],
  position: Ice2fCriticalPosition,
): number | null {
  if (historyNewestFirst.length <= position) return null;
  return historyNewestFirst[position]!;
}

function toTapeteActive(active: Ice2fActive): DoisFatoresActive {
  return {
    pairKind: active.pairKind,
    pairKindLabel: active.axis,
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: active.referenceNumber,
    factor1: active.factor1,
    factor2: active.factor2,
    triggerNumbers: [active.referenceNumber, active.referenceNumber] as const,
    armingDescription: active.armingDescription,
  };
}

function classifyObservation(
  result: number,
  ref: number,
  axis: Ice2fCrossingAxis,
): ObservationOutcome | null {
  if (result === 0 || ref === 0) return null;
  const factors = factorsForNumberOnAxis(ref, axis as CrossingAxisKind);
  if (!factors) return null;
  const round = evaluateDoisFatoresRound(result, {
    pairKind: pairKindFromCrossingAxis(axis as CrossingAxisKind),
    pairKindLabel: axis,
    patternMode: "convergence",
    patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
    referenceNumber: ref,
    factor1: factors[0],
    factor2: factors[1],
    triggerNumbers: [ref, ref],
    armingDescription: "",
  });
  if (round === "W") return "win";
  if (round === "continue") return "tie";
  return "loss";
}

/** Placar da aposta — zero com indicação activa = derrota. */
export function ice2fClassifyBetRound(
  result: number,
  active: Ice2fActive,
): "W" | "L" | "continue" {
  if (result === 0) return "L";
  return evaluateDoisFatoresRound(result, toTapeteActive(active));
}

export function ice2fIsWatchSlotArmed(slot: Ice2fWatchSlot): boolean {
  return slot.failures >= ICE_2F_REQUIRED_FAILURES;
}

export function ice2fBuildActiveFromHistory(
  historyNewestFirst: readonly number[],
  position: Ice2fCriticalPosition,
  axis: Ice2fCrossingAxis,
): Ice2fActive | null {
  const refNum = referenceAtGridPosition(historyNewestFirst, position);
  if (refNum == null || refNum === 0) return null;
  const factors = factorsForNumberOnAxis(refNum, axis as CrossingAxisKind);
  if (!factors) return null;
  const labels = factors.map((f) => doisFatoresFactorLabel(f)).join(" · ");
  const axisLabel = axis === "cor-altura" ? "cor/altura" : "paridade/altura";
  return {
    criticalPosition: position,
    axis,
    factor1: factors[0],
    factor2: factors[1],
    pairKind: pairKindFromCrossingAxis(axis as CrossingAxisKind),
    referenceNumber: refNum,
    armingDescription: `ICE 2F pos${position} ${axisLabel}: nº${refNum} → ${labels}`,
  };
}

function updateWatchOnSpin(
  watch: Ice2fWatchCounters,
  historyNewestFirst: readonly number[],
): Ice2fWatchCounters {
  const result = historyNewestFirst[0]!;
  const next = cloneWatch(watch);
  for (const pos of ICE_2F_CRITICAL_POSITIONS) {
    const ref = referenceBeforeSpin(historyNewestFirst, pos);
    if (ref == null) continue;
    for (const axis of ICE_2F_CROSSING_AXES) {
      const outcome = classifyObservation(result, ref, axis);
      if (outcome == null) continue;
      if (outcome === "win") {
        next[pos][axis] = emptyWatchSlot();
      } else if (outcome === "loss") {
        next[pos][axis] = {
          failures: Math.min(ICE_2F_REQUIRED_FAILURES, next[pos][axis].failures + 1),
        };
      }
    }
  }
  return next;
}

export function primeIce2fWatchFromHistory(
  historyNewestFirst: readonly number[],
): Ice2fWatchCounters {
  if (historyNewestFirst.length < ICE_2F_MIN_HISTORY) return emptyWatch();
  let watch = emptyWatch();
  const chronological = [...historyNewestFirst].reverse();
  for (let end = ICE_2F_MIN_HISTORY; end <= chronological.length; end++) {
    const sliceNewestFirst = chronological.slice(0, end).reverse();
    watch = updateWatchOnSpin(watch, sliceNewestFirst);
  }
  return watch;
}

function firstArmedSlot(
  watch: Ice2fWatchCounters,
): { position: Ice2fCriticalPosition; axis: Ice2fCrossingAxis } | null {
  for (const pos of ICE_2F_CRITICAL_POSITIONS) {
    for (const axis of ICE_2F_CROSSING_AXES) {
      if (ice2fIsWatchSlotArmed(watch[pos][axis])) return { position: pos, axis };
    }
  }
  return null;
}

function ice2fResumeCycleAfterRebuild(
  cycle: Ice2fCycle,
  historyNewestFirst: readonly number[],
  head: string,
): Ice2fCycle {
  const rebuilt = ice2fBuildActiveFromHistory(
    historyNewestFirst,
    cycle.active.criticalPosition,
    cycle.active.axis,
  );
  if (rebuilt) {
    return {
      ...cycle,
      active: rebuilt,
      phase: "awaiting_bet",
      armedHead: head,
    };
  }
  return {
    ...cycle,
    phase: "awaiting_reference",
    armedHead: head,
  };
}

export function tryArmCycleFromWatch(
  machine: Ice2fMachineState,
  historyNewestFirst: readonly number[],
  head: string,
): Ice2fMachineState {
  if (machine.cycle) return machine;
  const armed = firstArmedSlot(machine.watch);
  if (armed == null) return machine;
  const active = ice2fBuildActiveFromHistory(
    historyNewestFirst,
    armed.position,
    armed.axis,
  );
  if (!active) return machine;
  return {
    ...machine,
    cycle: {
      active,
      armedHead: head,
      recovery: 0,
      phase: "awaiting_bet",
    },
    watch: {
      ...machine.watch,
      [armed.position]: {
        ...machine.watch[armed.position],
        [armed.axis]: emptyWatchSlot(),
      },
    },
    pendingArm: null,
  };
}

export function ice2fStakeUnits(recovery: number): number {
  const idx = Math.min(
    Math.max(0, Math.floor(recovery)),
    ICE_2F_STAKE_UNITS.length - 1,
  );
  return ICE_2F_STAKE_UNITS[idx]!;
}

export function ice2fBetDelayMs(recovery?: number): number {
  return (recovery ?? 0) > 0 ? ICE_2F_RECOVERY_BET_DELAY_MS : ICE_2F_FIRST_BET_SETTLE_MS;
}

export function ice2fBetDelayUntilMs(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
): number | null {
  const delayMs = ice2fBetDelayMs(recovery);
  return lastSpinAtMs != null && Number.isFinite(lastSpinAtMs)
    ? lastSpinAtMs + delayMs
    : null;
}

export function canPlaceIce2fBet(
  recovery: number,
  lastSpinAtMs: number | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
  return nowMs - lastSpinAtMs >= ice2fBetDelayMs(recovery);
}

export type Ice2fTickResult = {
  machine: Ice2fMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: Ice2fFlash | null;
  globalActive: Ice2fActive | null;
  globalRecovery: number;
};

export function tickIce2fPlacar(
  historyNewestFirst: readonly number[],
  machine: Ice2fMachineState,
  stats: RotatingRoomSessionStats,
  maxRecovery: number = ICE_2F_MAX_RECOVERY,
): Ice2fTickResult {
  const head = spinHead(historyNewestFirst);
  const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
  let nextMachine: Ice2fMachineState = {
    ...machine,
    lastSpinHead: head,
    watch: cloneWatch(machine.watch),
  };
  let nextStats = stats;
  let statsChanged = false;
  let flash: Ice2fFlash | null = null;

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
      const rebuilt = ice2fBuildActiveFromHistory(
        historyNewestFirst,
        nextMachine.cycle.active.criticalPosition,
        nextMachine.cycle.active.axis,
      );
      if (!rebuilt) {
        nextMachine = {
          ...nextMachine,
          cycle: {
            ...nextMachine.cycle,
            phase: "awaiting_reference",
            armedHead: head,
          },
        };
      } else {
        nextMachine = {
          ...nextMachine,
          cycle: {
            ...nextMachine.cycle,
            active: rebuilt,
            armedHead: head,
            phase: "awaiting_bet",
          },
        };
      }
    }
  }

  if (
    nextMachine.cycle?.phase === "awaiting_reference" &&
    headChanged &&
    nextMachine.cycle.armedHead !== head
  ) {
    nextMachine = {
      ...nextMachine,
      cycle: ice2fResumeCycleAfterRebuild(
        nextMachine.cycle,
        historyNewestFirst,
        head,
      ),
    };
  }

  if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
    const cycle = nextMachine.cycle;
    const resultNumber = historyNewestFirst[0]!;
    const outcome = ice2fClassifyBetRound(resultNumber, cycle.active);
    const { active, recovery } = cycle;

    if (outcome === "W") {
      nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
      statsChanged = true;
      nextMachine = {
        ...nextMachine,
        cycle: null,
        betCommitInFlight: false,
      };
      flash = {
        resultNumber,
        won: true,
        kind: "win",
        criticalPosition: active.criticalPosition,
        axis: active.axis,
        recovery,
        factor1: active.factor1,
        factor2: active.factor2,
      };
    } else if (outcome === "continue") {
      nextMachine = {
        ...nextMachine,
        betCommitInFlight: false,
        cycle: ice2fResumeCycleAfterRebuild(cycle, historyNewestFirst, head),
      };
      flash = {
        resultNumber,
        won: false,
        kind: "tie",
        criticalPosition: active.criticalPosition,
        axis: active.axis,
        recovery,
        factor1: active.factor1,
        factor2: active.factor2,
      };
    } else {
      const nextRecovery = recovery + 1;
      if (nextRecovery > maxRecovery) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recovery, maxRecovery);
        statsChanged = true;
        nextMachine = {
          ...nextMachine,
          cycle: null,
          betCommitInFlight: false,
        };
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2,
        };
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recovery, maxRecovery);
        statsChanged = true;
        nextMachine = {
          ...nextMachine,
          betCommitInFlight: false,
          cycle: ice2fResumeCycleAfterRebuild(
            { ...cycle, recovery: nextRecovery },
            historyNewestFirst,
            head,
          ),
        };
        flash = {
          resultNumber,
          won: false,
          kind: "loss",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2,
        };
      }
    }
  }

  if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= ICE_2F_MIN_HISTORY) {
    nextMachine = {
      ...nextMachine,
      watch: updateWatchOnSpin(nextMachine.watch, historyNewestFirst),
    };
    nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
  }

  if (nextMachine.cycle && headChanged) {
    const armed = firstArmedSlot(nextMachine.watch);
    if (
      armed != null &&
      (armed.position !== nextMachine.cycle.active.criticalPosition ||
        armed.axis !== nextMachine.cycle.active.axis)
    ) {
      nextMachine = { ...nextMachine, pendingArm: armed };
    }
  }

  if (!nextMachine.cycle && nextMachine.pendingArm != null && headChanged) {
    const { position, axis } = nextMachine.pendingArm;
    if (ice2fIsWatchSlotArmed(nextMachine.watch[position][axis])) {
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
      if (nextMachine.cycle) {
        nextMachine = { ...nextMachine, pendingArm: null };
      }
    }
  }

  if (nextMachine.cycle?.phase === "awaiting_bet") {
    const rebuilt = ice2fBuildActiveFromHistory(
      historyNewestFirst,
      nextMachine.cycle.active.criticalPosition,
      nextMachine.cycle.active.axis,
    );
    if (!rebuilt) {
      nextMachine = {
        ...nextMachine,
        cycle: {
          ...nextMachine.cycle,
          phase: "awaiting_reference",
          armedHead: head,
        },
      };
    }
  }

  const globalActive =
    nextMachine.cycle?.phase === "awaiting_bet" ? nextMachine.cycle.active : null;
  const globalRecovery = nextMachine.cycle?.recovery ?? 0;

  return {
    machine: nextMachine,
    stats: nextStats,
    statsChanged,
    flash,
    globalActive,
    globalRecovery,
  };
}

export function parseIce2fStats(
  raw: unknown,
  maxRecovery = ICE_2F_MAX_RECOVERY,
): RotatingRoomSessionStats {
  return parseRotatingRoomSessionStats(raw, maxRecovery);
}

export function emptyIce2fStats(maxRecovery = ICE_2F_MAX_RECOVERY): RotatingRoomSessionStats {
  return emptyRotatingRoomSessionStats(maxRecovery);
}

export function formatIce2fWatchLabel(watch: Ice2fWatchCounters): string {
  const parts: string[] = [];
  for (const pos of ICE_2F_CRITICAL_POSITIONS) {
    for (const axis of ICE_2F_CROSSING_AXES) {
      const f = watch[pos][axis].failures;
      const short = axis === "cor-altura" ? "c/a" : "p/a";
      parts.push(`${pos}${short}:${f}/${ICE_2F_REQUIRED_FAILURES}`);
    }
  }
  return parts.join(" · ");
}
