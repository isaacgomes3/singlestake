/**
 * Orquestrador observacional — 1 Fator + 2 Fatores.
 * Apenas analisa histórico; não altera regras de entrada/saída (motorInfluence off por defeito).
 */

import {
  listDoisFatoresPeriodInsights,
  listTopDoisFatoresLearnedPatterns,
  readDoisFatoresPatternLearningState,
  type DoisFatoresLearnedPattern,
  type DoisFatoresPatternLearningState,
} from "@/lib/roulette/doisFatoresPatternLearning";
import { rebuildDoisFatoresPatternLearningFromHistories } from "@/lib/roulette/doisFatoresReplay";
import {
  listTopUmFatorLearnedPatterns,
  listUmFatorPeriodInsights,
  readUmFatorPatternLearningState,
  type UmFatorLearnedPattern,
  type UmFatorPatternLearningState,
} from "@/lib/roulette/umFatorPatternLearning";
import { rebuildUmFatorPatternLearningFromHistories } from "@/lib/roulette/umFatorReplay";
import type { StrategyGlobalKind } from "@/lib/roulette/strategyGlobalTypes";

export type StrategyLearningInsightKind = "trigger" | "sequence" | "period";

export type StrategyLearningInsight = {
  kind: StrategyLearningInsightKind;
  strategy: StrategyGlobalKind;
  label: string;
  winPct: number;
  samples: number;
  confidence: "alta" | "media" | "baixa";
};

export type StrategyLearningAdvisorSnapshot = {
  um1fator: UmFatorPatternLearningState;
  dois2fatores: DoisFatoresPatternLearningState;
  insights: StrategyLearningInsight[];
  lastRebuildAt: number;
};

function confidenceFromSamples(samples: number, winPct: number): "alta" | "media" | "baixa" {
  if (samples >= 12 && winPct >= 58) return "alta";
  if (samples >= 6 && winPct >= 52) return "media";
  return "baixa";
}

function patternToInsight(
  pattern: UmFatorLearnedPattern | DoisFatoresLearnedPattern,
  strategy: StrategyGlobalKind,
  kind: StrategyLearningInsightKind,
): StrategyLearningInsight {
  return {
    kind,
    strategy,
    label: pattern.label,
    winPct: pattern.winPct,
    samples: pattern.samples,
    confidence: confidenceFromSamples(pattern.samples, pattern.winPct),
  };
}

function extractSequenceInsights(
  patterns: readonly (UmFatorLearnedPattern | DoisFatoresLearnedPattern)[],
  strategy: StrategyGlobalKind,
  limit: number,
): StrategyLearningInsight[] {
  const withSeq = patterns.filter((p) => p.key.includes("|") && p.key.split("|").pop()?.includes(">"));
  return withSeq
    .slice(0, limit)
    .map((p) => patternToInsight(p, strategy, "sequence"));
}

export function rebuildStrategyLearningFromHistories(
  histories: Record<number, readonly number[]>,
): StrategyLearningAdvisorSnapshot {
  const um1fator = rebuildUmFatorPatternLearningFromHistories(histories);
  const dois2fatores = rebuildDoisFatoresPatternLearningFromHistories(histories);
  return buildStrategyLearningAdvisorSnapshot(um1fator, dois2fatores);
}

export function buildStrategyLearningAdvisorSnapshot(
  um1fator: UmFatorPatternLearningState = readUmFatorPatternLearningState(),
  dois2fatores: DoisFatoresPatternLearningState = readDoisFatoresPatternLearningState(),
): StrategyLearningAdvisorSnapshot {
  const umTriggers = listTopUmFatorLearnedPatterns(um1fator, 5, 5);
  const doisTriggers = listTopDoisFatoresLearnedPatterns(dois2fatores, 5, 5);
  const umPeriods = listUmFatorPeriodInsights(um1fator, 3);
  const doisPeriods = listDoisFatoresPeriodInsights(dois2fatores, 3);

  const insights: StrategyLearningInsight[] = [
    ...umTriggers.map((p) => patternToInsight(p, "um1fator", "trigger")),
    ...doisTriggers.map((p) => patternToInsight(p, "dois2fatores", "trigger")),
    ...extractSequenceInsights(umTriggers, "um1fator", 3),
    ...extractSequenceInsights(doisTriggers, "dois2fatores", 3),
    ...umPeriods.map((p) => patternToInsight(p, "um1fator", "period")),
    ...doisPeriods.map((p) => patternToInsight(p, "dois2fatores", "period")),
  ];

  insights.sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.samples - a.samples;
  });

  return {
    um1fator,
    dois2fatores,
    insights: insights.slice(0, 12),
    lastRebuildAt: Math.max(um1fator.lastRebuildAt, dois2fatores.lastRebuildAt),
  };
}
