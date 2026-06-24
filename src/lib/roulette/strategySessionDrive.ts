export const STRATEGY_PLACAR_DRAIN_MAX_STEPS = 48;

export function isBrowserPageVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/** Motor do placar (mesmo em segundo plano). `observeOnly` impede escrita per-mesa duplicada. */
export function canRunStrategyPlacarDriver(options: { observeOnly?: boolean } = {}): boolean {
  return !options.observeOnly;
}

/** Flash visual e efeitos sonoros de resultado só com o separador activo. */
export function shouldPresentStrategyPlacarFeedback(): boolean {
  return isBrowserPageVisible();
}

export function drainPlacarSteps<M, S, F>(
  machine: M,
  stats: S,
  tick: (machine: M, stats: S) => {
    nextMachine: M;
    stats: S;
    statsChanged: boolean;
    flash: F | null;
  },
  progressed: (before: M, after: M, step: { statsChanged: boolean; flash: F | null }) => boolean,
): {
  nextMachine: M;
  stats: S;
  statsChanged: boolean;
  flash: F | null;
} {
  let nextMachine = machine;
  let nextStats = stats;
  let statsChanged = false;
  let flash: F | null = null;

  for (let i = 0; i < STRATEGY_PLACAR_DRAIN_MAX_STEPS; i++) {
    const before = nextMachine;
    const step = tick(nextMachine, nextStats);
    nextMachine = step.nextMachine;
    nextStats = step.stats;
    if (step.statsChanged) statsChanged = true;
    if (step.flash != null) flash = step.flash;
    if (!progressed(before, nextMachine, step)) break;
  }

  return { nextMachine, stats: nextStats, statsChanged, flash };
}
