import { useEffect, useMemo, useState } from "react";

import {
  buildStrategyLearningAdvisorSnapshot,
  rebuildStrategyLearningFromHistories,
  type StrategyLearningAdvisorSnapshot,
} from "@/lib/roulette/strategyLearningAdvisor";
import {
  DOIS_FATORES_LEARNING_CHANGED_EVENT,
  readDoisFatoresPatternLearningState,
} from "@/lib/roulette/doisFatoresPatternLearning";
import {
  UM_FATOR_LEARNING_CHANGED_EVENT,
  readUmFatorPatternLearningState,
  updateUmFatorLearningSettings,
  type UmFatorLearningSettings,
} from "@/lib/roulette/umFatorPatternLearning";

export function useStrategyLearningAdvisor(histories: Record<number, readonly number[]>) {
  const [snapshot, setSnapshot] = useState<StrategyLearningAdvisorSnapshot>(() =>
    buildStrategyLearningAdvisorSnapshot(),
  );

  const fingerprint = useMemo(
    () =>
      Object.entries(histories)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([id, h]) => `${id}:${h.length}:${h[0] ?? ""}`)
        .join("|"),
    [histories],
  );

  useEffect(() => {
    const sync = () =>
      setSnapshot(
        buildStrategyLearningAdvisorSnapshot(
          readUmFatorPatternLearningState(),
          readDoisFatoresPatternLearningState(),
        ),
      );
    window.addEventListener(UM_FATOR_LEARNING_CHANGED_EVENT, sync);
    window.addEventListener(DOIS_FATORES_LEARNING_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(UM_FATOR_LEARNING_CHANGED_EVENT, sync);
      window.removeEventListener(DOIS_FATORES_LEARNING_CHANGED_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    const um = readUmFatorPatternLearningState();
    if (!um.settings.enabled && !readDoisFatoresPatternLearningState().settings.enabled) {
      setSnapshot(buildStrategyLearningAdvisorSnapshot());
      return;
    }
    setSnapshot(rebuildStrategyLearningFromHistories(histories));
  }, [fingerprint, histories]);

  const updateUmSettings = (patch: Partial<UmFatorLearningSettings>) => {
    updateUmFatorLearningSettings(patch);
    setSnapshot(
      buildStrategyLearningAdvisorSnapshot(
        readUmFatorPatternLearningState(),
        readDoisFatoresPatternLearningState(),
      ),
    );
  };

  return { snapshot, updateUmSettings };
}
