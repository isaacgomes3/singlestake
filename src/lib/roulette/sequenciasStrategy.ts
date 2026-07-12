/**
 * Estratégia **Sequências** (cor / altura / paridade).
 *
 * - Sequência limpa: ≥2 iguais **à cabeça** do histórico (newest-first).
 * - Sequência suja: cronológico A·A·B·A ≡ newest-first A·B·A·A nos 4 mais recentes.
 * - Alerta activo mantém-se enquanto ganha; perde → procura novo padrão.
 * - Zero é filtrado da análise de sequência.
 */

import { colorOf, heightOf, parityOf } from "@/lib/roulette/streetPairTrigger";

export type SequenciasAlertType = "color" | "height" | "parity";

export type SequenciasSuggestion =
  | "VERMELHO"
  | "PRETO"
  | "ALTO"
  | "BAIXO"
  | "PAR"
  | "ÍMPAR";

export type SequenciasAlert = {
  type: SequenciasAlertType;
  suggestion: SequenciasSuggestion;
  confidence: number;
  isDirty: boolean;
  winStreak: number;
};

export type SequenciasFactorCard = {
  wins: number;
  losses: number;
  last: string | null;
};

export type SequenciasAssertiveness = {
  color: number;
  height: number;
  parity: number;
};

export type SequenciasAlertSettings = {
  enableColor: boolean;
  enableHeight: boolean;
  enableParity: boolean;
};

export type SequenciasMonitorState = {
  alert: SequenciasAlert | null;
  cards: {
    color: SequenciasFactorCard;
    height: SequenciasFactorCard;
    parity: SequenciasFactorCard;
  };
  assertiveness: SequenciasAssertiveness;
  /** Históricos recentes (1=hit, 0=miss) por tipo — máx. 10. */
  recentHits: {
    color: number[];
    height: number[];
    parity: number[];
  };
  lastSpinHead: string | null;
  totalRounds: number;
  sessionWins: number;
  sessionLosses: number;
  settings: SequenciasAlertSettings;
};

const EMPTY_CARD: SequenciasFactorCard = { wins: 0, losses: 0, last: null };

export function defaultSequenciasMonitorState(
  settings?: Partial<SequenciasAlertSettings>,
): SequenciasMonitorState {
  return {
    alert: null,
    cards: {
      color: { ...EMPTY_CARD },
      height: { ...EMPTY_CARD },
      parity: { ...EMPTY_CARD },
    },
    assertiveness: { color: 50, height: 50, parity: 50 },
    recentHits: { color: [], height: [], parity: [] },
    lastSpinHead: null,
    totalRounds: 0,
    sessionWins: 0,
    sessionLosses: 0,
    settings: {
      enableColor: settings?.enableColor ?? true,
      enableHeight: settings?.enableHeight ?? true,
      enableParity: settings?.enableParity ?? true,
    },
  };
}

type NumProps = {
  number: number;
  isRed: boolean;
  isEven: boolean;
  isHigh: boolean;
};

function propsOf(n: number): NumProps | null {
  if (n === 0) return null;
  const col = colorOf(n);
  const alt = heightOf(n);
  const par = parityOf(n);
  if (col === "Zero" || alt === "Zero" || par === "Zero") return null;
  return {
    number: n,
    isRed: col === "Vermelho",
    isEven: par === "Par",
    isHigh: alt === "Alto",
  };
}

function spinHead(history: readonly number[]): string {
  if (history.length === 0) return "0";
  return `${history.length}:${history[0]}`;
}

function calculateDynamicAssertiveness(recentHits: readonly number[]): number {
  if (recentHits.length === 0) return 50;
  const recent = recentHits.slice(-5);
  const hits = recent.reduce((sum, hit) => sum + hit, 0);
  const assertiveness = (hits / recent.length) * 100;
  return Math.max(30, Math.min(95, Math.round(assertiveness)));
}

/** Corrida limpa a partir do giro mais recente (índice 0). */
function findCleanSequence(
  values: readonly boolean[],
): { found: boolean; group: boolean; count: number } {
  if (values.length === 0) return { found: false, group: false, count: 0 };

  const group = values[0]!;
  let count = 1;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== group) break;
    count++;
  }

  return {
    found: count >= 2,
    group,
    count,
  };
}

/** Padrão sujo cronológico A·A·B·A → em newest-first: A·B·A·A (só nos 4 mais recentes). */
function findDirtySequence(
  values: readonly boolean[],
): { found: boolean; group: boolean } {
  if (values.length < 4) return { found: false, group: false };

  const newest = values[0]!;
  const prev = values[1]!;
  const older = values[2]!;
  const oldest = values[3]!;
  // Chrono A,A,B,A ↔ newest-first A,B,A,A
  if (newest === older && older === oldest && prev !== newest) {
    return { found: true, group: newest };
  }
  return { found: false, group: false };
}

type PatternCandidate = {
  type: SequenciasAlertType;
  suggestion: SequenciasSuggestion;
  confidence: number;
  priority: number;
  isDirty: boolean;
  streakCount: number;
};

function alertWinsOnNumber(alert: SequenciasAlert, n: number): boolean | null {
  const p = propsOf(n);
  if (!p) return null;
  if (alert.type === "color") {
    const actual = p.isRed ? "VERMELHO" : "PRETO";
    return alert.suggestion === actual;
  }
  if (alert.type === "height") {
    const actual = p.isHigh ? "ALTO" : "BAIXO";
    return alert.suggestion === actual;
  }
  const actual = p.isEven ? "PAR" : "ÍMPAR";
  return alert.suggestion === actual;
}

function analyzeSequencePatterns(
  historyNewestFirst: readonly number[],
  settings: SequenciasAlertSettings,
  previousAlert: SequenciasAlert | null,
): SequenciasAlert | null {
  const valid = historyNewestFirst.map(propsOf).filter((p): p is NumProps => p != null);
  if (valid.length < 2) return null;

  const colorValues = valid.map((n) => n.isRed);
  const heightValues = valid.map((n) => n.isHigh);
  const parityValues = valid.map((n) => n.isEven);

  if (previousAlert) {
    const last = historyNewestFirst[0];
    if (last != null) {
      const win = alertWinsOnNumber(previousAlert, last);
      if (win === true) {
        return {
          ...previousAlert,
          winStreak: previousAlert.winStreak + 1,
          confidence: Math.min(95, 60 + (previousAlert.winStreak + 1) * 5),
        };
      }
      if (win === false) {
        // cai para nova análise
      } else {
        // zero — mantém alerta
        return previousAlert;
      }
    }
  }

  const patterns: PatternCandidate[] = [];

  const pushClean = (
    type: SequenciasAlertType,
    values: readonly boolean[],
    trueLabel: SequenciasSuggestion,
    falseLabel: SequenciasSuggestion,
    enabled: boolean,
  ) => {
    if (!enabled) return;
    const seq = findCleanSequence(values);
    if (!seq.found) return;
    patterns.push({
      type,
      suggestion: seq.group ? trueLabel : falseLabel,
      confidence: Math.min(95, 60 + seq.count * 10),
      priority: seq.count * 100,
      isDirty: false,
      streakCount: seq.count,
    });
  };

  pushClean("color", colorValues, "VERMELHO", "PRETO", settings.enableColor);
  pushClean("height", heightValues, "ALTO", "BAIXO", settings.enableHeight);
  pushClean("parity", parityValues, "PAR", "ÍMPAR", settings.enableParity);

  if (patterns.length === 0 && valid.length >= 4) {
    const pushDirty = (
      type: SequenciasAlertType,
      values: readonly boolean[],
      trueLabel: SequenciasSuggestion,
      falseLabel: SequenciasSuggestion,
      enabled: boolean,
    ) => {
      if (!enabled) return;
      const dirty = findDirtySequence(values);
      if (!dirty.found) return;
      patterns.push({
        type,
        suggestion: dirty.group ? trueLabel : falseLabel,
        confidence: 70,
        priority: 50,
        isDirty: true,
        streakCount: 2,
      });
    };
    pushDirty("color", colorValues, "VERMELHO", "PRETO", settings.enableColor);
    pushDirty("height", heightValues, "ALTO", "BAIXO", settings.enableHeight);
    pushDirty("parity", parityValues, "PAR", "ÍMPAR", settings.enableParity);
  }

  if (patterns.length === 0) return null;
  patterns.sort((a, b) => b.priority - a.priority);
  const best = patterns[0]!;
  return {
    type: best.type,
    suggestion: best.suggestion,
    confidence: best.confidence,
    isDirty: best.isDirty,
    winStreak: 0,
  };
}

function cardFromPattern(
  type: SequenciasAlertType,
  alert: SequenciasAlert | null,
  historyNewestFirst: readonly number[],
): SequenciasFactorCard {
  const valid = historyNewestFirst.map(propsOf).filter((p): p is NumProps => p != null);
  if (valid.length === 0) return { ...EMPTY_CARD };

  let values: boolean[];
  let trueLabel: string;
  let falseLabel: string;
  if (type === "color") {
    values = valid.map((n) => n.isRed);
    trueLabel = "Vermelho";
    falseLabel = "Preto";
  } else if (type === "height") {
    values = valid.map((n) => n.isHigh);
    trueLabel = "Alto";
    falseLabel = "Baixo";
  } else {
    values = valid.map((n) => n.isEven);
    trueLabel = "Par";
    falseLabel = "Ímpar";
  }

  const clean = findCleanSequence(values);
  const dirty = !clean.found && valid.length >= 4 ? findDirtySequence(values) : null;
  const lastVal = values[0]!;
  const last = lastVal ? trueLabel : falseLabel;

  if (alert?.type === type) {
    const wins = alert.isDirty ? 2 : Math.max(2, Math.round(alert.confidence / 20));
    return {
      wins,
      losses: alert.isDirty ? 1 : 0,
      last: alert.suggestion === "VERMELHO"
        ? "Vermelho"
        : alert.suggestion === "PRETO"
          ? "Preto"
          : alert.suggestion === "ALTO"
            ? "Alto"
            : alert.suggestion === "BAIXO"
              ? "Baixo"
              : alert.suggestion === "PAR"
                ? "Par"
                : "Ímpar",
    };
  }

  if (clean.found) {
    return { wins: clean.count, losses: 0, last };
  }
  if (dirty?.found) {
    return { wins: 0, losses: 1, last };
  }
  return { wins: 0, losses: 0, last };
}

function pushHit(
  recent: number[],
  hit: boolean,
): number[] {
  const next = [...recent, hit ? 1 : 0];
  return next.length > 10 ? next.slice(-10) : next;
}

/**
 * Avança o monitor quando chega um novo giro (ou no 1.º snapshot).
 */
export function tickSequenciasMonitor(
  historyNewestFirst: readonly number[],
  prev: SequenciasMonitorState,
): SequenciasMonitorState {
  const head = spinHead(historyNewestFirst);
  if (historyNewestFirst.length < 2) {
    return { ...prev, lastSpinHead: head };
  }

  const headChanged = prev.lastSpinHead != null && prev.lastSpinHead !== head;
  const firstLoad = prev.lastSpinHead == null;

  if (!headChanged && !firstLoad) {
    return prev;
  }

  const previousAlert = headChanged ? prev.alert : null;
  let sessionWins = prev.sessionWins;
  let sessionLosses = prev.sessionLosses;
  let recentHits = {
    color: [...prev.recentHits.color],
    height: [...prev.recentHits.height],
    parity: [...prev.recentHits.parity],
  };
  let totalRounds = prev.totalRounds;

  if (headChanged && previousAlert) {
    const result = historyNewestFirst[0]!;
    const win = alertWinsOnNumber(previousAlert, result);
    if (win === true) {
      sessionWins += 1;
      recentHits[previousAlert.type] = pushHit(recentHits[previousAlert.type], true);
    } else if (win === false) {
      sessionLosses += 1;
      recentHits[previousAlert.type] = pushHit(recentHits[previousAlert.type], false);
    }
    totalRounds += 1;
  }

  const alertForAnalysis =
    headChanged && previousAlert
      ? alertWinsOnNumber(previousAlert, historyNewestFirst[0]!) === false
        ? null
        : previousAlert
      : previousAlert;

  const alert = analyzeSequencePatterns(
    historyNewestFirst,
    prev.settings,
    alertForAnalysis,
  );

  const cards = {
    color: cardFromPattern("color", alert, historyNewestFirst),
    height: cardFromPattern("height", alert, historyNewestFirst),
    parity: cardFromPattern("parity", alert, historyNewestFirst),
  };

  const assertiveness: SequenciasAssertiveness = {
    color: calculateDynamicAssertiveness(recentHits.color),
    height: calculateDynamicAssertiveness(recentHits.height),
    parity: calculateDynamicAssertiveness(recentHits.parity),
  };

  return {
    ...prev,
    alert,
    cards,
    assertiveness,
    recentHits,
    lastSpinHead: head,
    totalRounds,
    sessionWins,
    sessionLosses,
  };
}

export function sequenciasAlertTypeLabel(type: SequenciasAlertType): string {
  if (type === "color") return "Cor";
  if (type === "height") return "Altura";
  return "Paridade";
}

export function sequenciasBestCardKind(
  state: SequenciasMonitorState,
): SequenciasAlertType | null {
  if (state.alert) return state.alert.type;
  const entries: Array<[SequenciasAlertType, SequenciasFactorCard]> = [
    ["parity", state.cards.parity],
    ["color", state.cards.color],
    ["height", state.cards.height],
  ];
  let best: SequenciasAlertType | null = null;
  let bestWins = 0;
  for (const [kind, card] of entries) {
    if (card.wins > bestWins) {
      bestWins = card.wins;
      best = kind;
    }
  }
  return bestWins > 0 ? best : null;
}
