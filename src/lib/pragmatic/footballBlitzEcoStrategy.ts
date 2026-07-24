import type {
  FootballBlitzRoundStored,
  FootballBlitzWinner,
} from "@/lib/pragmatic/dgaFootballBlitzHistory";

export type FootballBlitzEcoColor = Exclude<FootballBlitzWinner, "draw">;

export type FootballBlitzEcoSignal = {
  signalId: string;
  /** Última rodada (ex.: 10/7 amarelo) — o gatilho. */
  triggerGameId: string;
  triggerWinner: FootballBlitzEcoColor;
  triggerScoreDiff: number;
  triggerWinningNumber?: number;
  indication: FootballBlitzEcoColor;
  /** Ocorrência histórica do mesmo resultado. */
  referenceGameIds: string[];
  referenceIndexes: number[];
};

export type FootballBlitzEcoSettlement = {
  signalId: string;
  indication: FootballBlitzEcoColor;
  resultGameId: string;
  resultWinner: FootballBlitzWinner;
  outcome: "W" | "L";
};

export type FootballBlitzEcoStats = {
  wins: number;
  losses: number;
  outcomeHistory: Array<"W" | "L">;
};

export type FootballBlitzCardPatternStat = {
  card: number;
  label: string;
  hits: number;
  samples: number;
  rate: number;
};

export type FootballBlitzCardPatternAnalysis = {
  loserThenWins: FootballBlitzCardPatternStat[];
  winnerThenLoses: FootballBlitzCardPatternStat[];
  transitions: number;
};

/** Confronto individual: carta foco vs oponente → resultado do lado da foco na próxima. */
export type FootballBlitzCardPairPatternStat = {
  focusCard: number;
  focusLabel: string;
  opponentCard: number;
  opponentLabel: string;
  hits: number;
  samples: number;
  rate: number;
  /** `wins` = lado da foco venceu a próxima; `loses` = perdeu a próxima. */
  nextOutcome: "wins" | "loses";
};

export type FootballBlitzCardPairPatternAnalysis = {
  /** Encontros em que o lado da carta foco venceu a próxima em 100% das amostras. */
  perfectWinsNext: FootballBlitzCardPairPatternStat[];
  /** Encontros em que o lado da carta foco perdeu a próxima em 100% das amostras. */
  perfectLosesNext: FootballBlitzCardPairPatternStat[];
  transitions: number;
  pairsTracked: number;
};

export type FootballBlitzCardPairPatternOptions = {
  /** Mínimo de encontros para considerar o padrão (default 2). */
  minSamples?: number;
};

export type FootballBlitzEcoEngineResult = {
  signal: FootballBlitzEcoSignal | null;
  settlement: FootballBlitzEcoSettlement | null;
  history: FootballBlitzRoundStored[];
  stats: FootballBlitzEcoStats;
};

export type FootballBlitzEcoEngineState = {
  history: FootballBlitzRoundStored[];
  pendingSignal: FootballBlitzEcoSignal | null;
  stats: FootballBlitzEcoStats;
};

export type FootballBlitzEcoEngineOptions = {
  maxHistory?: number;
  initialStats?: Partial<FootballBlitzEcoStats> | null;
  initialHistory?: readonly FootballBlitzRoundStored[] | null;
  pendingSignal?: FootballBlitzEcoSignal | null;
};

const DEFAULT_MAX_HISTORY = 200;
const MAX_OUTCOMES = 500;

function isColoredRound(
  round: FootballBlitzRoundStored | undefined,
): round is FootballBlitzRoundStored & { winner: FootballBlitzEcoColor } {
  return (
    round != null && round.scoreDiff !== 0 && (round.winner === "home" || round.winner === "away")
  );
}

function sameExactResult(a: FootballBlitzRoundStored, b: FootballBlitzRoundStored): boolean {
  return (
    a.winner === b.winner &&
    a.scoreDiff === b.scoreDiff &&
    Number(a.winningNumber) === Number(b.winningNumber)
  );
}

export function footballBlitzCardLabel(card: number): string {
  if (card === 1) return "A";
  if (card === 11) return "J";
  if (card === 12) return "Q";
  if (card === 13) return "K";
  return String(card);
}

export type FootballBlitzExpandedRound = FootballBlitzRoundStored & {
  home: { rank: string; label: string; score: number };
  away: { rank: string; label: string; score: number };
};

function rankToken(score: number): string {
  if (score === 1) return "A";
  if (score === 11) return "J";
  if (score === 12) return "Q";
  if (score === 13) return "K";
  return String(score);
}

/** Duas cartas da rodada (como no Obs) a partir de winningNumber + scoreDiff. */
export function expandFootballBlitzRound(
  round: FootballBlitzRoundStored,
): FootballBlitzExpandedRound | null {
  const winNum = Number(round.winningNumber);
  const diff = Number(round.scoreDiff) || 0;
  if (!Number.isFinite(winNum)) return null;
  const loseNum = winNum - diff;
  const winLabel = footballBlitzCardLabel(winNum);
  const loseLabel = footballBlitzCardLabel(loseNum);
  if (!winLabel || !loseLabel) return null;
  const winCard = { rank: rankToken(winNum), label: winLabel, score: winNum };
  const loseCard = { rank: rankToken(loseNum), label: loseLabel, score: loseNum };
  const home = round.winner === "away" ? loseCard : winCard;
  const away = round.winner === "away" ? winCard : loseCard;
  return { ...round, home, away };
}

/**
 * Observa todas as cartas e mede dois comportamentos:
 * - o lado perdeu com a carta X e venceu a rodada seguinte;
 * - o lado venceu com a carta X e perdeu a rodada seguinte.
 *
 * A DGA fornece a carta vencedora e a diferença; a perdedora é calculada por
 * `winningNumber - scoreDiff`. Empates e dados inválidos não entram na amostra.
 */
export function analyzeFootballBlitzCardPatterns(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
): FootballBlitzCardPatternAnalysis {
  const loserThenWins = new Map<number, { hits: number; samples: number }>();
  const winnerThenLoses = new Map<number, { hits: number; samples: number }>();
  let transitions = 0;

  const add = (map: Map<number, { hits: number; samples: number }>, card: number, hit: boolean) => {
    const current = map.get(card) ?? { hits: 0, samples: 0 };
    current.samples += 1;
    if (hit) current.hits += 1;
    map.set(card, current);
  };

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const round = historyNewestFirst[index];
    const next = historyNewestFirst[index - 1];
    if (!round || !next || !isColoredRound(round) || !isColoredRound(next)) continue;

    const winningCard = Number(round.winningNumber);
    const losingCard = winningCard - Number(round.scoreDiff);
    if (
      !Number.isInteger(winningCard) ||
      !Number.isInteger(losingCard) ||
      winningCard < 1 ||
      winningCard > 13 ||
      losingCard < 1 ||
      losingCard > 13
    )
      continue;

    const losingSide: FootballBlitzEcoColor = round.winner === "home" ? "away" : "home";
    add(loserThenWins, losingCard, next.winner === losingSide);
    add(winnerThenLoses, winningCard, next.winner === losingSide);
    transitions += 1;
  }

  const format = (
    map: Map<number, { hits: number; samples: number }>,
  ): FootballBlitzCardPatternStat[] =>
    [...map.entries()]
      .map(([card, stat]) => ({
        card,
        label: footballBlitzCardLabel(card),
        hits: stat.hits,
        samples: stat.samples,
        rate: Math.round((stat.hits / stat.samples) * 1000) / 10,
      }))
      .sort((a, b) => b.rate - a.rate || b.samples - a.samples || a.card - b.card);

  return {
    loserThenWins: format(loserThenWins),
    winnerThenLoses: format(winnerThenLoses),
    transitions,
  };
}

export type FootballBlitzSidePatternCardStat = {
  card: number;
  label: string;
  hits: number;
  samples: number;
  rate: number;
};

export type FootballBlitzSidePatternAnalysis = {
  /** Após a carta aparecer, a próxima ronda manteve o mesmo lado vencedor. */
  maintainSide: FootballBlitzSidePatternCardStat[];
  /** Após a carta aparecer, a próxima ronda mudou de lado vencedor. */
  changeSide: FootballBlitzSidePatternCardStat[];
  transitions: number;
};

export type FootballBlitzSidePatternAlert = {
  triggerGameId: string;
  triggerWinner: FootballBlitzEcoColor;
  homeCard: number;
  homeLabel: string;
  awayCard: number;
  awayLabel: string;
  homeSamples: number;
  awaySamples: number;
  /** As duas cartas concordam: manter o lado actual ou mudar para o oposto. */
  mode: "maintain" | "change";
  /** Lado indicado para a ronda seguinte. */
  indication: FootballBlitzEcoColor;
};

function collectSidePatternMaps(historyNewestFirst: readonly FootballBlitzRoundStored[]): {
  maintain: Map<number, { hits: number; samples: number }>;
  change: Map<number, { hits: number; samples: number }>;
  transitions: number;
} {
  const maintain = new Map<number, { hits: number; samples: number }>();
  const change = new Map<number, { hits: number; samples: number }>();
  let transitions = 0;

  const bump = (
    map: Map<number, { hits: number; samples: number }>,
    card: number,
    hit: boolean,
  ) => {
    const cur = map.get(card) ?? { hits: 0, samples: 0 };
    cur.samples += 1;
    if (hit) cur.hits += 1;
    map.set(card, cur);
  };

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const round = historyNewestFirst[index];
    const next = historyNewestFirst[index - 1];
    if (!round || !next || !isColoredRound(round) || !isColoredRound(next)) continue;

    const exp = expandFootballBlitzRound(round);
    if (!exp) continue;
    const cards = [exp.home.score, exp.away.score].filter(
      (n) => Number.isInteger(n) && n >= 1 && n <= 13,
    );
    if (cards.length === 0) continue;

    const kept = next.winner === round.winner;
    transitions += 1;
    for (const card of cards) {
      bump(maintain, card, kept);
      bump(change, card, !kept);
    }
  }

  return { maintain, change, transitions };
}

function perfectSidePatternCards(
  map: Map<number, { hits: number; samples: number }>,
  minSamples: number,
): Map<number, { hits: number; samples: number }> {
  const out = new Map<number, { hits: number; samples: number }>();
  for (const [card, stat] of map) {
    if (stat.samples >= minSamples && stat.hits === stat.samples) out.set(card, stat);
  }
  return out;
}

/**
 * Por cada carta que aparece numa ronda colorida, mede se a ronda seguinte
 * manteve o mesmo lado (casa/visitante) ou mudou.
 * Empates (nesta ou na seguinte) não entram na amostra.
 */
export function analyzeFootballBlitzSidePatternByCard(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  options?: { top?: number; minSamples?: number },
): FootballBlitzSidePatternAnalysis {
  const topN = Math.max(1, Math.floor(Number(options?.top) || 6));
  const minSamples = Math.max(1, Math.floor(Number(options?.minSamples) || 1));
  const { maintain, change, transitions } = collectSidePatternMaps(historyNewestFirst);

  const format = (
    map: Map<number, { hits: number; samples: number }>,
  ): FootballBlitzSidePatternCardStat[] =>
    [...map.entries()]
      .map(([card, stat]) => ({
        card,
        label: footballBlitzCardLabel(card),
        hits: stat.hits,
        samples: stat.samples,
        rate: Math.round((stat.hits / stat.samples) * 1000) / 10,
      }))
      .filter((row) => row.samples >= minSamples)
      .sort((a, b) => b.rate - a.rate || b.samples - a.samples || a.card - b.card)
      .slice(0, topN);

  return {
    maintainSide: format(maintain),
    changeSide: format(change),
    transitions,
  };
}

/**
 * Alerta quando a última ronda colorida é um encontro de **duas** cartas
 * com o mesmo padrão a 100%:
 * - ambas 100% manter → indica o mesmo lado vencedor;
 * - ambas 100% mudar → indica o lado oposto.
 */
export function findFootballBlitzSidePatternAlert(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  options?: { minSamples?: number },
): FootballBlitzSidePatternAlert | null {
  const minSamples = Math.max(1, Math.floor(Number(options?.minSamples) || 2));
  const trigger = historyNewestFirst[0];
  if (!isColoredRound(trigger)) return null;

  const exp = expandFootballBlitzRound(trigger);
  if (!exp) return null;
  const homeCard = exp.home.score;
  const awayCard = exp.away.score;
  if (
    !Number.isInteger(homeCard) ||
    !Number.isInteger(awayCard) ||
    homeCard < 1 ||
    homeCard > 13 ||
    awayCard < 1 ||
    awayCard > 13 ||
    homeCard === awayCard
  ) {
    return null;
  }

  const { maintain, change } = collectSidePatternMaps(historyNewestFirst);
  const perfectMaintain = perfectSidePatternCards(maintain, minSamples);
  const perfectChange = perfectSidePatternCards(change, minSamples);

  const homeMaintain = perfectMaintain.get(homeCard);
  const awayMaintain = perfectMaintain.get(awayCard);
  const homeChange = perfectChange.get(homeCard);
  const awayChange = perfectChange.get(awayCard);

  let mode: "maintain" | "change";
  let homeSamples: number;
  let awaySamples: number;

  if (homeMaintain && awayMaintain) {
    mode = "maintain";
    homeSamples = homeMaintain.samples;
    awaySamples = awayMaintain.samples;
  } else if (homeChange && awayChange) {
    mode = "change";
    homeSamples = homeChange.samples;
    awaySamples = awayChange.samples;
  } else {
    return null;
  }

  const opposite: FootballBlitzEcoColor = trigger.winner === "home" ? "away" : "home";
  const indication: FootballBlitzEcoColor = mode === "maintain" ? trigger.winner : opposite;

  return {
    triggerGameId: trigger.gameId,
    triggerWinner: trigger.winner,
    homeCard,
    homeLabel: footballBlitzCardLabel(homeCard),
    awayCard,
    awayLabel: footballBlitzCardLabel(awayCard),
    homeSamples,
    awaySamples,
    mode,
    indication,
  };
}

export type FootballBlitzSidePatternAlertStats = {
  wins: number;
  losses: number;
  /** Indicações já liquidadas (W+L). */
  settled: number;
  /** Alerta ainda à espera da ronda seguinte. */
  pending: FootballBlitzSidePatternAlert | null;
  outcomes: Array<"W" | "L">;
};

/**
 * Percorre o histórico (mais antigo → mais novo) e liquida cada alerta
 * «encontro 100%» na ronda colorida seguinte: W se bate a indicação, L caso contrário (inclui empate).
 */
export function scoreFootballBlitzSidePatternAlerts(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  options?: { minSamples?: number },
): FootballBlitzSidePatternAlertStats {
  const minSamples = Math.max(1, Math.floor(Number(options?.minSamples) || 2));
  let wins = 0;
  let losses = 0;
  const outcomes: Array<"W" | "L"> = [];
  let pending: FootballBlitzSidePatternAlert | null = null;

  for (let headIdx = historyNewestFirst.length - 1; headIdx >= 0; headIdx -= 1) {
    const slice = historyNewestFirst.slice(headIdx);
    const head = slice[0];
    if (!head) continue;

    if (pending && head.gameId !== pending.triggerGameId) {
      const outcome: "W" | "L" = head.winner === pending.indication ? "W" : "L";
      if (outcome === "W") wins += 1;
      else losses += 1;
      outcomes.push(outcome);
      pending = null;
    }

    pending = findFootballBlitzSidePatternAlert(slice, { minSamples });
  }

  return {
    wins,
    losses,
    settled: wins + losses,
    pending,
    outcomes,
  };
}

export type FootballBlitzEncounterNeighbor = {
  gameId: string;
  winner: FootballBlitzWinner;
  homeLabel: string;
  awayLabel: string;
  pairLabel: string;
};

export type FootballBlitzEncounterCoincidence = {
  index: number;
  match: FootballBlitzEncounterNeighbor;
  left: FootballBlitzEncounterNeighbor | null;
  right: FootballBlitzEncounterNeighbor | null;
};

export type FootballBlitzEncounterCoincidenceAnalysis = {
  trigger: FootballBlitzEncounterNeighbor | null;
  coincidences: FootballBlitzEncounterCoincidence[];
  totalMatches: number;
};

function blitzToNeighbor(
  round: FootballBlitzRoundStored | undefined,
): FootballBlitzEncounterNeighbor | null {
  if (!round?.gameId || !round.winner) return null;
  const exp = expandFootballBlitzRound(round);
  const homeLabel = exp?.home.label ?? (round.winner === "draw" ? "—" : "?");
  const awayLabel = exp?.away.label ?? (round.winner === "draw" ? "—" : "?");
  return {
    gameId: String(round.gameId),
    winner: round.winner,
    homeLabel,
    awayLabel,
    pairLabel: exp ? `${exp.home.label}/${exp.away.label}` : String(round.winningNumber ?? "—"),
  };
}

function sameBlitzEncounter(
  a: FootballBlitzRoundStored,
  b: FootballBlitzRoundStored,
): boolean {
  if (a.winner !== b.winner) return false;
  if (!isColoredRound(a) || !isColoredRound(b)) {
    // Empate: exige mesmas cartas se disponíveis
    if (a.winner !== "draw" || b.winner !== "draw") return false;
  }
  const ea = expandFootballBlitzRound(a);
  const eb = expandFootballBlitzRound(b);
  if (ea && eb) {
    return ea.home.score === eb.home.score && ea.away.score === eb.away.score;
  }
  return (
    Number(a.winningNumber) === Number(b.winningNumber) &&
    Number(a.scoreDiff) === Number(b.scoreDiff)
  );
}

/**
 * Para o último encontro (cartas + cor), as N coincidências anteriores mais
 * recentes com vizinhos esquerda/direita.
 */
export function findFootballBlitzEncounterCoincidences(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  options?: { limit?: number },
): FootballBlitzEncounterCoincidenceAnalysis {
  const limit = Math.max(1, Math.floor(Number(options?.limit) || 2));
  const newest = historyNewestFirst[0];
  const trigger = blitzToNeighbor(newest);
  if (!newest || !trigger) {
    return { trigger: null, coincidences: [], totalMatches: 0 };
  }

  const coincidences: FootballBlitzEncounterCoincidence[] = [];
  let totalMatches = 0;

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const matchRound = historyNewestFirst[index];
    if (!matchRound || !sameBlitzEncounter(matchRound, newest)) continue;
    totalMatches += 1;
    if (coincidences.length >= limit) continue;

    const match = blitzToNeighbor(matchRound);
    if (!match) continue;
    coincidences.push({
      index,
      match,
      left: blitzToNeighbor(historyNewestFirst[index - 1]),
      right: blitzToNeighbor(historyNewestFirst[index + 1]),
    });
  }

  return { trigger, coincidences, totalMatches };
}

function extractRoundCards(
  round: FootballBlitzRoundStored,
): { winningCard: number; losingCard: number } | null {
  const winningCard = Number(round.winningNumber);
  const losingCard = winningCard - Number(round.scoreDiff);
  if (
    !Number.isInteger(winningCard) ||
    !Number.isInteger(losingCard) ||
    winningCard < 1 ||
    winningCard > 13 ||
    losingCard < 1 ||
    losingCard > 13 ||
    winningCard === losingCard
  ) {
    return null;
  }
  return { winningCard, losingCard };
}

/**
 * Observa confrontos a partir da carta **vencedora** do encontro (ex.: K · J):
 * na rodada seguinte, o lado que tinha o K venceu ou perdeu?
 *
 * Só devolve padrões a 100% com ≥ `minSamples` (default 2).
 * Não espelha o perdedor (8 · 5) — só o par vencedor · oponente.
 */
export function analyzeFootballBlitzCardPairPatterns(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
  options: FootballBlitzCardPairPatternOptions = {},
): FootballBlitzCardPairPatternAnalysis {
  const minSamples = Math.max(1, Math.floor(options.minSamples ?? 2));
  const winsNext = new Map<string, { hits: number; samples: number; focus: number; opp: number }>();
  let transitions = 0;

  const add = (focus: number, opp: number, focusWonNext: boolean) => {
    const key = `${focus}:${opp}`;
    const current = winsNext.get(key) ?? { hits: 0, samples: 0, focus, opp };
    current.samples += 1;
    if (focusWonNext) current.hits += 1;
    winsNext.set(key, current);
  };

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const round = historyNewestFirst[index];
    const next = historyNewestFirst[index - 1];
    // Encontro tem de ser colorido (há vencedor). A próxima pode ser empate.
    if (!round || !next || !isColoredRound(round)) continue;
    if (next.winner !== "home" && next.winner !== "away" && next.winner !== "draw") continue;
    const cards = extractRoundCards(round);
    if (!cards) continue;
    // Só a carta que venceu o encontro (ex. K vs J → foco K).
    // Empate na seguinte = o lado do K NÃO venceu → conta como falha no "vence".
    add(cards.winningCard, cards.losingCard, next.winner === round.winner);
    transitions += 1;
  }

  const perfectWinsNext: FootballBlitzCardPairPatternStat[] = [];
  const perfectLosesNext: FootballBlitzCardPairPatternStat[] = [];

  for (const stat of winsNext.values()) {
    if (stat.samples < minSamples) continue;
    const winRate = Math.round((stat.hits / stat.samples) * 1000) / 10;
    const loseHits = stat.samples - stat.hits;
    const loseRate = Math.round((loseHits / stat.samples) * 1000) / 10;
    const base = {
      focusCard: stat.focus,
      focusLabel: footballBlitzCardLabel(stat.focus),
      opponentCard: stat.opp,
      opponentLabel: footballBlitzCardLabel(stat.opp),
      samples: stat.samples,
    };
    if (winRate === 100) {
      perfectWinsNext.push({
        ...base,
        hits: stat.hits,
        rate: winRate,
        nextOutcome: "wins",
      });
    }
    if (loseRate === 100) {
      perfectLosesNext.push({
        ...base,
        hits: loseHits,
        rate: loseRate,
        nextOutcome: "loses",
      });
    }
  }

  const bySamples = (a: FootballBlitzCardPairPatternStat, b: FootballBlitzCardPairPatternStat) =>
    b.samples - a.samples || a.focusCard - b.focusCard || a.opponentCard - b.opponentCard;

  perfectWinsNext.sort(bySamples);
  perfectLosesNext.sort(bySamples);

  return {
    perfectWinsNext,
    perfectLosesNext,
    transitions,
    pairsTracked: winsNext.size,
  };
}

/**
 * Histórico newest-first — só padrões 100%:
 * - índice 0 = última rodada (gatilho);
 * - recolhe ocorrências anteriores exactas (cor + diff + winningNumber)
 *   com cor válida à esquerda (`index - 1`, saltando zeros);
 * - usa as duas últimas: se a cor à esquerda for a mesma, indica;
 * - se discordarem, tenta o par seguinte (próximas duas ocorrências), etc.
 */
export function findFootballBlitzEcoSignal(
  historyNewestFirst: readonly FootballBlitzRoundStored[],
): FootballBlitzEcoSignal | null {
  const newest = historyNewestFirst[0];
  if (!isColoredRound(newest)) return null;

  const occurrences: Array<{
    match: FootballBlitzRoundStored & { winner: FootballBlitzEcoColor };
    index: number;
    left: FootballBlitzEcoColor;
  }> = [];

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const match = historyNewestFirst[index];
    if (!match || !sameExactResult(match, newest) || !isColoredRound(match)) continue;

    let leftIndex = index - 1;
    while (leftIndex >= 1) {
      const left = historyNewestFirst[leftIndex];
      if (!left) break;
      if (isColoredRound(left)) {
        occurrences.push({ match, index, left: left.winner });
        break;
      }
      leftIndex -= 1;
    }
  }

  for (let i = 0; i < occurrences.length - 1; i += 1) {
    const first = occurrences[i];
    const second = occurrences[i + 1];
    if (!first || !second) continue;
    if (first.left !== second.left) continue;
    return {
      signalId: `football-blitz-eco:${newest.gameId}`,
      triggerGameId: newest.gameId,
      triggerWinner: newest.winner,
      triggerScoreDiff: newest.scoreDiff,
      triggerWinningNumber: Number(newest.winningNumber) || undefined,
      indication: first.left,
      referenceGameIds: [first.match.gameId, second.match.gameId],
      referenceIndexes: [first.index, second.index],
    };
  }

  return null;
}

function normalizeStats(
  raw: Partial<FootballBlitzEcoStats> | null | undefined,
): FootballBlitzEcoStats {
  const outcomes = Array.isArray(raw?.outcomeHistory)
    ? raw.outcomeHistory.filter((item): item is "W" | "L" => item === "W" || item === "L")
    : [];
  return {
    wins: Math.max(0, Number(raw?.wins) || 0),
    losses: Math.max(0, Number(raw?.losses) || 0),
    outcomeHistory: outcomes.slice(-MAX_OUTCOMES),
  };
}

export function createFootballBlitzEcoEngine(options: FootballBlitzEcoEngineOptions = {}) {
  const maxHistory = Math.max(20, Math.floor(options.maxHistory ?? DEFAULT_MAX_HISTORY));
  let history = (options.initialHistory ?? []).slice(0, maxHistory);
  let pendingSignal = options.pendingSignal ?? null;
  let stats = normalizeStats(options.initialStats);
  let lastGameId = history[0]?.gameId ?? null;

  function settle(round: FootballBlitzRoundStored): FootballBlitzEcoSettlement | null {
    if (!pendingSignal || round.gameId === pendingSignal.triggerGameId) return null;
    const settlement: FootballBlitzEcoSettlement = {
      signalId: pendingSignal.signalId,
      indication: pendingSignal.indication,
      resultGameId: round.gameId,
      resultWinner: round.winner,
      outcome: round.winner === pendingSignal.indication ? "W" : "L",
    };
    if (settlement.outcome === "W") stats.wins += 1;
    else stats.losses += 1;
    stats.outcomeHistory = [...stats.outcomeHistory, settlement.outcome].slice(-MAX_OUTCOMES);
    pendingSignal = null;
    return settlement;
  }

  function ingestHistorySnapshot(rounds: readonly FootballBlitzRoundStored[]) {
    if (history.length > 0) return getState();
    history = rounds.slice(0, maxHistory);
    lastGameId = history[0]?.gameId ?? null;
    return getState();
  }

  function ingestRound(round: FootballBlitzRoundStored): FootballBlitzEcoEngineResult | null {
    if (!round.gameId || round.gameId === lastGameId) return null;
    const settlement = settle(round);
    lastGameId = round.gameId;
    history = [round, ...history.filter((item) => item.gameId !== round.gameId)].slice(
      0,
      maxHistory,
    );
    const signal = findFootballBlitzEcoSignal(history);
    pendingSignal = signal;
    return { signal, settlement, history: [...history], stats: { ...stats } };
  }

  function getState(): FootballBlitzEcoEngineState {
    return {
      history: [...history],
      pendingSignal,
      stats: { ...stats, outcomeHistory: [...stats.outcomeHistory] },
    };
  }

  return {
    ingestHistorySnapshot,
    ingestRound,
    getState,
    resetStats() {
      stats = normalizeStats(null);
    },
    clearPendingSignal() {
      pendingSignal = null;
    },
  };
}

export function footballBlitzEcoColorLabel(color: FootballBlitzWinner): string {
  if (color === "home") return "AMARELO";
  if (color === "away") return "AZUL";
  return "NEUTRO";
}
