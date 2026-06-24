import { useEffect, useMemo, useState } from "react";

import {
  UM_FATOR_LEARNING_CHANGED_EVENT,
  listTopUmFatorLearnedPatterns,
  readUmFatorPatternLearningState,
  scoreUmFatorFormation,
  updateUmFatorLearningSettings,
  type UmFatorLearningScore,
  type UmFatorLearningSettings,
  type UmFatorLearnedPattern,
  type UmFatorPatternLearningState,
} from "@/lib/roulette/umFatorPatternLearning";
import { rebuildUmFatorPatternLearningFromHistories } from "@/lib/roulette/umFatorReplay";
import type { UmFatorActive } from "@/lib/roulette/umFatorStrategy";

export function useUmFatorPatternLearning(
  histories: Record<number, readonly number[]>,
): {
  state: UmFatorPatternLearningState;
  topPatterns: UmFatorLearnedPattern[];
  scoreFormation: (active: UmFatorActive, history: readonly number[]) => UmFatorLearningScore;
  updateSettings: (patch: Partial<UmFatorLearningSettings>) => void;
} {
  const [state, setState] = useState(() => readUmFatorPatternLearningState());

  const fingerprint = useMemo(
    () =>
      Object.entries(histories)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([id, h]) => `${id}:${h.length}:${h[0] ?? ""}`)
        .join("|"),
    [histories],
  );

  useEffect(() => {
    const sync = () => setState(readUmFatorPatternLearningState());
    window.addEventListener(UM_FATOR_LEARNING_CHANGED_EVENT, sync);
    return () => window.removeEventListener(UM_FATOR_LEARNING_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    const current = readUmFatorPatternLearningState();
    if (!current.settings.enabled) {
      setState(current);
      return;
    }
    const next = rebuildUmFatorPatternLearningFromHistories(histories, current);
    setState(next);
  }, [fingerprint, histories]);

  const topPatterns = useMemo(
    () => listTopUmFatorLearnedPatterns(state, 6, 3),
    [state],
  );

  const scoreFormation = (active: UmFatorActive, history: readonly number[]) =>
    scoreUmFatorFormation(active, history, state);

  const updateSettings = (patch: Partial<UmFatorLearningSettings>) => {
    setState(updateUmFatorLearningSettings(patch));
  };

  return { state, topPatterns, scoreFormation, updateSettings };
}
