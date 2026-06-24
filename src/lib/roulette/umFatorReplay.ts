/**
 * Replay cronológico 1 Fator — alimenta o aprendizado de padrões.
 */

import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import {
  defaultUmFatorMachineState,
  tickUmFatorPlacar,
  UM_FATOR_MAX_RECOVERY,
} from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import { UM_FATOR_MIN_HISTORY, type UmFatorActive } from "@/lib/roulette/umFatorStrategy";
import {
  buildUmFatorLearningKey,
  readUmFatorPatternLearningState,
  writeUmFatorPatternLearningState,
  UM_FATOR_LEARNING_MAX_BUCKETS,
  type UmFatorLearningBucket,
  type UmFatorPatternLearningState,
} from "@/lib/roulette/umFatorPatternLearning";
import { recoveryPeriodKey } from "@/lib/roulette/doisFatoresPatternLearning";

type ResolvedReplayEntry = {
  active: UmFatorActive;
  won: boolean;
  historyAtFormation: readonly number[];
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

export function replayUmFatorEntriesForTable(
  historyNewestFirst: readonly number[],
): ResolvedReplayEntry[] {
  const entries: ResolvedReplayEntry[] = [];
  if (historyNewestFirst.length < UM_FATOR_MIN_HISTORY + 1) return entries;

  let machine = defaultUmFatorMachineState();
  let stats = emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
  const chrono = [...historyNewestFirst].reverse();

  for (let len = UM_FATOR_MIN_HISTORY; len <= chrono.length; len++) {
    const prefix = chrono.slice(0, len).reverse();
    const recoveryAtEntry = machine.recovery;
    const result = tickUmFatorPlacar([0], { [0]: prefix }, machine, stats, UM_FATOR_MAX_RECOVERY);
    machine = result.nextMachine;
    if (result.statsChanged) stats = result.stats;

    const flash = result.flash;
    if (!flash || (flash.kind !== "win" && flash.kind !== "loss")) continue;
    const formation = machine.lastActive;
    if (!formation) continue;
    const historyAtFormation = prefix.slice(1);
    if (historyAtFormation.length < UM_FATOR_MIN_HISTORY) continue;
    entries.push({
      active: formation,
      won: flash.kind === "win",
      historyAtFormation,
      recoveryAtEntry,
    });
  }
  return entries;
}

export function rebuildUmFatorPatternLearningFromHistories(
  histories: Record<number, readonly number[]>,
  prev: UmFatorPatternLearningState = readUmFatorPatternLearningState(),
): UmFatorPatternLearningState {
  const buckets: Record<string, UmFatorLearningBucket> = {};
  const periodBuckets: Record<string, UmFatorLearningBucket> = {};
  let totalResolved = 0;
  const prefixSpins = prev.settings.prefixSpins;

  for (const history of Object.values(histories)) {
    for (const entry of replayUmFatorEntriesForTable(history)) {
      const key = buildUmFatorLearningKey(entry.active, entry.historyAtFormation, prefixSpins);
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

  const next: UmFatorPatternLearningState = {
    ...prev,
    buckets: trimBuckets(buckets, UM_FATOR_LEARNING_MAX_BUCKETS),
    periodBuckets,
    lastRebuildAt: Date.now(),
    totalResolved,
  };
  writeUmFatorPatternLearningState(next);
  return next;
}
