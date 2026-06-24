/**
 * Replay cronológico 2 Fatores crossing — alimenta aprendizado observacional.
 */

import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import {
  defaultDoisFatoresCrossingMachineState,
  DOIS_FATORES_CROSSING_MAX_RECOVERY,
  tickDoisFatoresCrossingPlacar,
} from "@/lib/roulette/doisFatoresCrossingStrategy";
import type { DoisFatoresActive } from "@/lib/roulette/doisFatoresStrategy";
import {
  buildDoisFatoresLearningKey,
  readDoisFatoresPatternLearningState,
  recoveryPeriodKey,
  writeDoisFatoresPatternLearningState,
  DOIS_FATORES_LEARNING_MAX_BUCKETS,
  type DoisFatoresPatternLearningState,
} from "@/lib/roulette/doisFatoresPatternLearning";
import type { UmFatorLearningBucket } from "@/lib/roulette/umFatorPatternLearning";

export type DoisFatoresReplayEntry = {
  active: DoisFatoresActive;
  won: boolean;
  historyAtFormation: readonly number[];
  bucketGap: number;
  recoveryAtEntry: number;
};

function trimBuckets(
  buckets: Record<string, UmFatorLearningBucket>,
  maxBuckets: number,
): Record<string, UmFatorLearningBucket> {
  const entries = Object.entries(buckets);
  if (entries.length <= maxBuckets) return buckets;
  entries.sort((a, b) => {
    const sa = a[1].wins + a[1].losses;
    const sb = b[1].wins + b[1].losses;
    return sb - sa;
  });
  return Object.fromEntries(entries.slice(0, maxBuckets));
}

export function replayDoisFatoresCrossingEntriesForTable(
  tableId: number,
  historyNewestFirst: readonly number[],
): DoisFatoresReplayEntry[] {
  const entries: DoisFatoresReplayEntry[] = [];
  if (historyNewestFirst.length < 2) return entries;

  let machine = defaultDoisFatoresCrossingMachineState();
  let stats = emptyRotatingRoomSessionStats(DOIS_FATORES_CROSSING_MAX_RECOVERY);
  const chrono = [...historyNewestFirst].reverse();
  let recoveryAtEntry = 0;
  let historySnapshot: readonly number[] = [];

  for (let i = 0; i < chrono.length; i++) {
    const prefix = chrono.slice(0, i + 1).reverse();
    const hadActive = machine.cycleActive != null;
    if (!hadActive && machine.prepareActive != null) {
      recoveryAtEntry = machine.recovery;
      historySnapshot = prefix;
    }
    if (!hadActive && machine.cycleActive == null && machine.prepareActive == null) {
      const pick = machine.pendingQueueEntry;
      if (pick?.tableId === tableId) {
        recoveryAtEntry = machine.recovery;
        historySnapshot = prefix;
      }
    }
    if (machine.cycleActive && !hadActive) {
      recoveryAtEntry = machine.recovery;
      historySnapshot = prefix;
    }

    const result = tickDoisFatoresCrossingPlacar(tableId, prefix, machine, stats);
    machine = result.nextMachine;
    stats = result.stats;

    const flash = result.flash;
    if (!flash || flash.tableId !== tableId) continue;
    if (flash.kind !== "win" && flash.kind !== "loss") continue;

    const active = machine.cycleActive ?? {
      pairKind: "cor-altura" as const,
      pairKindLabel: "",
      patternMode: "convergence" as const,
      patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
      referenceNumber: flash.resultNumber,
      factor1: flash.factor1!,
      factor2: flash.factor2!,
      triggerNumbers: flash.triggerNumbers ?? [],
      armingDescription: "",
    };

    if (!flash.factor1 || !flash.factor2) continue;

    const activeResolved: DoisFatoresActive = {
      pairKind: active.pairKind,
      pairKindLabel: active.pairKindLabel,
      patternMode: active.patternMode,
      patternStats: active.patternStats,
      referenceNumber: active.referenceNumber,
      factor1: flash.factor1,
      factor2: flash.factor2,
      triggerNumbers: flash.triggerNumbers ?? active.triggerNumbers,
      armingDescription: active.armingDescription,
    };

    entries.push({
      active: activeResolved,
      won: flash.kind === "win",
      historyAtFormation: historySnapshot.length > 0 ? historySnapshot : prefix,
      bucketGap: flash.bucketGap ?? 14,
      recoveryAtEntry,
    });
  }

  return entries;
}

export function rebuildDoisFatoresPatternLearningFromHistories(
  histories: Record<number, readonly number[]>,
  prev: DoisFatoresPatternLearningState = readDoisFatoresPatternLearningState(),
): DoisFatoresPatternLearningState {
  const buckets: Record<string, UmFatorLearningBucket> = {};
  const periodBuckets: Record<string, UmFatorLearningBucket> = {};
  let totalResolved = 0;
  const prefixSpins = prev.settings.prefixSpins;

  for (const [tableIdRaw, history] of Object.entries(histories)) {
    const tableId = Number(tableIdRaw);
    if (!Number.isFinite(tableId)) continue;
    for (const entry of replayDoisFatoresCrossingEntriesForTable(tableId, history)) {
      const key = buildDoisFatoresLearningKey(
        entry.active,
        entry.historyAtFormation,
        entry.bucketGap,
        entry.recoveryAtEntry,
        prefixSpins,
      );
      const bucket = buckets[key] ?? { wins: 0, losses: 0 };
      if (entry.won) bucket.wins += 1;
      else bucket.losses += 1;
      buckets[key] = bucket;

      const periodKey = recoveryPeriodKey(entry.recoveryAtEntry);
      const periodBucket = periodBuckets[periodKey] ?? { wins: 0, losses: 0 };
      if (entry.won) periodBucket.wins += 1;
      else periodBucket.losses += 1;
      periodBuckets[periodKey] = periodBucket;

      totalResolved += 1;
    }
  }

  const next: DoisFatoresPatternLearningState = {
    ...prev,
    buckets: trimBuckets(buckets, DOIS_FATORES_LEARNING_MAX_BUCKETS),
    periodBuckets,
    lastRebuildAt: Date.now(),
    totalResolved,
  };
  writeDoisFatoresPatternLearningState(next);
  return next;
}
