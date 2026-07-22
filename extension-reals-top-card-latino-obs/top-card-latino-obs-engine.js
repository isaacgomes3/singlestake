/** Helpers Top Card Latino Obs — cartas a partir de winningNumber + scoreDiff (DGA). */

function footballBlitzCardLabel(card) {
  const n = Number(card);
  if (n === 1) return "A";
  if (n === 11) return "J";
  if (n === 12) return "Q";
  if (n === 13) return "K";
  if (Number.isFinite(n) && n >= 2 && n <= 10) return String(n);
  return null;
}

function footballBlitzSideLabel(side) {
  if (side === "home") return "Amarelo";
  if (side === "away") return "Vermelho";
  if (side === "draw") return "Empate";
  return "—";
}

/** Deriva as duas cartas da rodada DGA (casa/amarelo vs visitante/vermelho). */
function expandFootballBlitzRound(round) {
  if (!round?.gameId || !round?.winner) return null;
  const winNum = Number(round.winningNumber);
  const diff = Number(round.scoreDiff) || 0;
  if (!Number.isFinite(winNum)) return null;
  const loseNum = winNum - diff;
  const winLabel = footballBlitzCardLabel(winNum);
  const loseLabel = footballBlitzCardLabel(loseNum);
  if (!winLabel || !loseLabel) return null;

  const winCard = { rank: String(winNum === 1 ? "A" : winNum === 11 ? "J" : winNum === 12 ? "Q" : winNum === 13 ? "K" : winNum), label: winLabel, score: winNum };
  const loseCard = { rank: String(loseNum === 1 ? "A" : loseNum === 11 ? "J" : loseNum === 12 ? "Q" : loseNum === 13 ? "K" : loseNum), label: loseLabel, score: loseNum };

  let home;
  let away;
  if (round.winner === "home") {
    home = winCard;
    away = loseCard;
  } else if (round.winner === "away") {
    home = loseCard;
    away = winCard;
  } else {
    home = winCard;
    away = { ...winCard };
  }

  return {
    gameId: String(round.gameId),
    winner: round.winner,
    winningNumber: winNum,
    scoreDiff: diff,
    time: round.time,
    home,
    away,
    homeScore: home.score,
    awayScore: away.score,
  };
}

function analyzeFootballBlitzSidePatterns(historyNewestFirst, options = {}) {
  const minSamples = Math.max(1, Number(options.minSamples) || 2);
  const fromTotals = new Map();
  const hitCounts = new Map();
  let coloredTransitions = 0;

  for (let i = 1; i < historyNewestFirst.length; i += 1) {
    const from = historyNewestFirst[i]?.winner;
    const to = historyNewestFirst[i - 1]?.winner;
    if (!from || !to) continue;
    if (from === "home" || from === "away") coloredTransitions += 1;
    fromTotals.set(from, (fromTotals.get(from) ?? 0) + 1);
    const key = `${from}>${to}`;
    hitCounts.set(key, (hitCounts.get(key) ?? 0) + 1);
  }

  const transitions = [];
  for (const [key, hits] of hitCounts) {
    const [from, to] = key.split(">");
    const samples = fromTotals.get(from) ?? 0;
    if (samples < 1) continue;
    transitions.push({
      from,
      to,
      fromLabel: footballBlitzSideLabel(from),
      toLabel: footballBlitzSideLabel(to),
      hits,
      samples,
      rate: (hits / samples) * 100,
    });
  }
  transitions.sort((a, b) => b.samples - a.samples || b.rate - a.rate);

  return {
    transitions,
    perfectTransitions: transitions.filter((t) => t.rate >= 100 && t.samples >= minSamples),
    perfectDigrams: [],
    coloredTransitions,
    rounds: historyNewestFirst.length,
  };
}

function isColoredRound(round) {
  return (
    round != null &&
    Number(round.scoreDiff) !== 0 &&
    (round.winner === "home" || round.winner === "away")
  );
}

function extractRoundCards(round) {
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
 * Confrontos a partir da carta **vencedora** (ex.: K · J):
 * na próxima rodada, o lado que tinha o K venceu ou perdeu?
 * Só padrões a 100% com ≥ minSamples. Sem espelho do perdedor.
 */
function analyzeFootballBlitzCardPairPatterns(historyNewestFirst, options = {}) {
  const minSamples = Math.max(1, Math.floor(Number(options.minSamples) || 2));
  const winsNext = new Map();
  let transitions = 0;

  const add = (focus, opp, focusWonNext) => {
    const key = `${focus}:${opp}`;
    const current = winsNext.get(key) ?? { hits: 0, samples: 0, focus, opp };
    current.samples += 1;
    if (focusWonNext) current.hits += 1;
    winsNext.set(key, current);
  };

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const round = historyNewestFirst[index];
    const next = historyNewestFirst[index - 1];
    // Encontro colorido; a próxima pode ser empate (conta como não-vitória do lado do K).
    if (!round || !next || !isColoredRound(round)) continue;
    if (next.winner !== "home" && next.winner !== "away" && next.winner !== "draw") continue;
    const cards = extractRoundCards(round);
    if (!cards) continue;
    add(cards.winningCard, cards.losingCard, next.winner === round.winner);
    transitions += 1;
  }

  const perfectWinsNext = [];
  const perfectLosesNext = [];
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
      perfectWinsNext.push({ ...base, hits: stat.hits, rate: winRate, nextOutcome: "wins" });
    }
    if (loseRate === 100) {
      perfectLosesNext.push({ ...base, hits: loseHits, rate: loseRate, nextOutcome: "loses" });
    }
  }

  const bySamples = (a, b) =>
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
 * Chave exacta do chip: Amarelo·Vermelho·cor.
 * Q/A amarelo ≠ A/Q vermelho (mesmo que a carta vencedora seja igual).
 */
function footballBlitzExactPairKey(round) {
  const exp = expandFootballBlitzRound(round);
  if (!exp || (exp.winner !== "home" && exp.winner !== "away")) return null;
  const homeLabel = exp.home?.label;
  const awayLabel = exp.away?.label;
  if (!homeLabel || !awayLabel) return null;
  return `${homeLabel}|${awayLabel}|${exp.winner}`;
}

/** Cartas visíveis no chip (labels Amarelo/Vermelho). */
function footballBlitzChipLabels(round) {
  const exp = expandFootballBlitzRound(round);
  if (!exp?.home?.label || !exp?.away?.label) return [];
  return [String(exp.home.label), String(exp.away.label)];
}

/**
 * Indicação — perfeição do gatilho:
 * - Última = gatilho exacto; direita = **duas** rodadas à direita (h[1], h[2])
 * - Usa **apenas a coincidência exacta mais recente** (não procura mais atrás)
 * - As duas à direita da coincidência: **mesma cor** que as duas à direita do último
 * - Indica a cor à esquerda dessa coincidência
 */
function findFootballBlitzCardPairSignal(historyNewestFirst, _options = {}) {
  const history = Array.isArray(historyNewestFirst) ? historyNewestFirst : [];
  if (history.length < 6) return null;

  const newest = history[0];
  const right1 = history[1];
  const right2 = history[2];
  if (!newest || !right1 || !right2) return null;
  if (!isColoredRound(newest)) return null;
  if (right1.winner !== "home" && right1.winner !== "away") return null;
  if (right2.winner !== "home" && right2.winner !== "away") return null;

  const newestKey = footballBlitzExactPairKey(newest);
  const newestExp = expandFootballBlitzRound(newest);
  if (!newestKey || !newestExp) return null;

  // Só a 1ª coincidência exacta no tempo (mais recente no passado)
  let coincidenceIndex = -1;
  for (let i = 3; i < history.length - 2; i += 1) {
    const candidate = history[i];
    if (!candidate || !isColoredRound(candidate)) continue;
    if (footballBlitzExactPairKey(candidate) !== newestKey) continue;
    coincidenceIndex = i;
    break;
  }
  if (coincidenceIndex < 0) return null;

  const left = history[coincidenceIndex - 1];
  const coinRight1 = history[coincidenceIndex + 1];
  const coinRight2 = history[coincidenceIndex + 2];
  if (!left || !coinRight1 || !coinRight2) return null;
  if (left.winner !== "home" && left.winner !== "away") return null;
  // Dois à direita: mesma cor posição a posição
  if (coinRight1.winner !== right1.winner) return null;
  if (coinRight2.winner !== right2.winner) return null;

  return {
    signalId: `tcl-coin:${newest.gameId}:${newestKey}:${left.winner}:${coinRight1.winner}+${coinRight2.winner}`,
    triggerGameId: String(newest.gameId),
    triggerWinner: newest.winner,
    focusCard: newestExp.home.score,
    focusLabel: newestExp.home.label,
    opponentCard: newestExp.away.score,
    opponentLabel: newestExp.away.label,
    samples: 1,
    hits: 1,
    coincidenceIndex,
    leftWinner: left.winner,
    rightWinner: coinRight1.winner,
    right2Winner: coinRight2.winner,
    penultWinner: right1.winner,
    penult2Winner: right2.winner,
    sharedLabels: [],
    pairKey: newestKey,
    nextOutcome: "color",
    indication: left.winner,
    indicationLabel: footballBlitzSideLabel(left.winner),
  };
}

function settleCardPairSignal(signal, settledRound) {
  if (!signal?.indication || !settledRound?.winner) return null;
  if (settledRound.winner === "draw") return "L";
  return settledRound.winner === signal.indication ? "W" : "L";
}

/** Alta = 10–K · Média = 6–9 · Baixa = A–5 (valor numérico DGA). */
function footballBlitzCardTier(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  if (n >= 10 && n <= 13) return "high";
  if (n >= 6 && n <= 9) return "mid";
  if (n >= 1 && n <= 5) return "low";
  return null;
}

/**
 * Contadores altas/médias por lado + probabilidade da próxima mão
 * assumindo shoe de `decks` baralhos padrão (4 naipes × 13 valores).
 * Reinicia quando o histórico é zerado (shuffle).
 */
function buildFootballBlitzShoeStats(historyNewestFirst, options = {}) {
  const decks = Math.max(1, Math.floor(Number(options.decks) || 8));
  const copiesPerRank = 4 * decks;
  const remainingByRank = {};
  for (let rank = 1; rank <= 13; rank += 1) remainingByRank[rank] = copiesPerRank;

  const emptySide = () => ({ high: 0, mid: 0, low: 0, total: 0 });
  const sideOut = { home: emptySide(), away: emptySide() };

  const bumpSide = (side, score) => {
    const tier = footballBlitzCardTier(score);
    if (!tier || (side !== "home" && side !== "away")) return;
    sideOut[side][tier] += 1;
    sideOut[side].total += 1;
  };

  const consumeRank = (score) => {
    const rank = Number(score);
    if (!Number.isFinite(rank) || rank < 1 || rank > 13) return;
    if (remainingByRank[rank] > 0) remainingByRank[rank] -= 1;
  };

  for (const round of historyNewestFirst ?? []) {
    const exp = expandFootballBlitzRound(round);
    if (!exp?.home?.score || !exp?.away?.score) continue;
    bumpSide("home", exp.home.score);
    bumpSide("away", exp.away.score);
    consumeRank(exp.home.score);
    consumeRank(exp.away.score);
  }

  const remainingHigh = [10, 11, 12, 13].reduce((s, r) => s + remainingByRank[r], 0);
  const remainingMid = [6, 7, 8, 9].reduce((s, r) => s + remainingByRank[r], 0);
  const remainingLow = [1, 2, 3, 4, 5].reduce((s, r) => s + remainingByRank[r], 0);
  const remainingTotal = remainingHigh + remainingMid + remainingLow;

  let homeWays = 0;
  let awayWays = 0;
  let drawWays = 0;
  if (remainingTotal >= 2) {
    for (let h = 1; h <= 13; h += 1) {
      const ch = remainingByRank[h];
      if (ch <= 0) continue;
      for (let a = 1; a <= 13; a += 1) {
        const ca = remainingByRank[a];
        if (ca <= 0) continue;
        const ways = h === a ? ch * (ch - 1) : ch * ca;
        if (ways <= 0) continue;
        if (h > a) homeWays += ways;
        else if (a > h) awayWays += ways;
        else drawWays += ways;
      }
    }
  }
  const totalWays = homeWays + awayWays + drawWays;
  const pct = (ways) => (totalWays > 0 ? Math.round((ways / totalWays) * 1000) / 10 : 0);

  return {
    decks,
    copiesPerRank,
    shoeTotal: copiesPerRank * 13,
    cardsSeen: sideOut.home.total + sideOut.away.total,
    sideOut,
    remaining: {
      high: remainingHigh,
      mid: remainingMid,
      low: remainingLow,
      total: remainingTotal,
      byRank: remainingByRank,
    },
    probs: {
      home: pct(homeWays),
      away: pct(awayWays),
      draw: pct(drawWays),
      homeWays,
      awayWays,
      drawWays,
      totalWays,
    },
  };
}

function buildStreakFromOutcomes(outcomeHistory) {
  const placar = (outcomeHistory ?? []).filter((x) => x === "W" || x === "L");
  const winStreakSeries = [];
  let winStreak = 0;
  let maxWinStreak = 0;
  for (const o of placar) {
    if (o === "W") {
      winStreak += 1;
      maxWinStreak = Math.max(maxWinStreak, winStreak);
    } else {
      winStreak = 0;
    }
    winStreakSeries.push(winStreak);
  }
  const lossStreakSeries = [];
  let lossStreak = 0;
  let maxLossStreak = 0;
  for (const o of placar) {
    if (o === "L") {
      lossStreak += 1;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    } else {
      lossStreak = 0;
    }
    lossStreakSeries.push(-lossStreak);
  }
  return {
    outcomes: placar,
    winStreakSeries,
    lossStreakSeries,
    currentWinStreak: winStreak,
    currentLossStreak: lossStreak,
    maxWinStreak,
    maxLossStreak,
    totalWins: placar.filter((x) => x === "W").length,
    totalLosses: placar.filter((x) => x === "L").length,
  };
}

/**
 * Reconstrói indicações (coincidência + filtro direita) ao longo do histórico
 * e o placar W/L. `activeSignal` = indicação pendente à espera da próxima rodada.
 */
function buildFootballBlitzCardPairTrack(historyNewestFirst, options = {}) {
  const signalMinSamples = Math.max(1, Math.floor(Number(options.signalMinSamples) || 1));
  const chronological = [...(historyNewestFirst ?? [])].reverse();
  const outcomeHistory = [];
  let pending = null;

  for (let i = 0; i < chronological.length; i += 1) {
    const round = chronological[i];
    const prefixNewestFirst = chronological.slice(0, i + 1).reverse();

    if (pending) {
      const result = settleCardPairSignal(pending, round);
      if (result) outcomeHistory.push(result);
      pending = null;
    }

    const signal = findFootballBlitzCardPairSignal(prefixNewestFirst, { signalMinSamples });
    if (signal) pending = signal;
  }

  return {
    activeSignal: pending,
    outcomeHistory,
    streak: buildStreakFromOutcomes(outcomeHistory),
    signalMinSamples,
  };
}

globalThis.SinglestakeTopCardLatinoObs = {
  footballBlitzCardLabel,
  footballBlitzSideLabel,
  expandFootballBlitzRound,
  footballBlitzExactPairKey,
  footballBlitzChipLabels,
  analyzeFootballBlitzSidePatterns,
  analyzeFootballBlitzCardPairPatterns,
  findFootballBlitzCardPairSignal,
  buildFootballBlitzCardPairTrack,
  buildStreakFromOutcomes,
  footballBlitzCardTier,
  buildFootballBlitzShoeStats,
};
