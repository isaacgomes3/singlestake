/**
 * Padrões por lado para Football Studio (Evolution / BrBet Bridge).
 * A API só envia winner: Player | Banker | Tie — sem valor das cartas.
 * Mapeamento UI: Player → Casa (home), Banker → Visitante (away), Tie → Empate.
 */

export type FootballStudioSide = "home" | "away" | "draw";

export type FootballStudioRound = {
  gameId: string;
  winner: FootballStudioSide;
  time?: string;
  rawWinner?: string;
};

export type FootballStudioTransitionStat = {
  from: FootballStudioSide;
  to: FootballStudioSide;
  fromLabel: string;
  toLabel: string;
  hits: number;
  samples: number;
  rate: number;
};

export type FootballStudioDigramStat = {
  first: FootballStudioSide;
  second: FootballStudioSide;
  next: FootballStudioSide;
  firstLabel: string;
  secondLabel: string;
  nextLabel: string;
  hits: number;
  samples: number;
  rate: number;
};

export type FootballStudioPatternAnalysis = {
  /** Após lado X, o próximo foi Y (todas as taxas). */
  transitions: FootballStudioTransitionStat[];
  /** Só transições X→Y com 100% e ≥ minSamples. */
  perfectTransitions: FootballStudioTransitionStat[];
  /** Após o digrama (A,B), o próximo foi C — só 100%. */
  perfectDigrams: FootballStudioDigramStat[];
  coloredTransitions: number;
  rounds: number;
};

const SIDE_LABEL: Record<FootballStudioSide, string> = {
  home: "Casa",
  away: "Visitante",
  draw: "Empate",
};

export function footballStudioSideLabel(side: FootballStudioSide): string {
  return SIDE_LABEL[side] ?? side;
}

export function mapBridgeWinner(raw: unknown): FootballStudioSide | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value === "player" || value === "home" || value === "casa") return "home";
  if (value === "banker" || value === "away" || value === "visitante") return "away";
  if (value === "tie" || value === "draw" || value === "empate") return "draw";
  return null;
}

export function normalizeBridgeRound(row: {
  _id?: string;
  id?: string;
  createdAt?: string;
  winner?: string;
}): FootballStudioRound | null {
  const winner = mapBridgeWinner(row.winner);
  const gameId = String(row._id ?? row.id ?? "").trim();
  if (!winner || !gameId) return null;
  return {
    gameId,
    winner,
    time: typeof row.createdAt === "string" ? row.createdAt : undefined,
    rawWinner: row.winner,
  };
}

/**
 * Histórico newest-first. Conta, para cada lado colorido (ou incluindo empate),
 * o que veio a seguir.
 */
export function analyzeFootballStudioSidePatterns(
  historyNewestFirst: readonly FootballStudioRound[],
  options: { minSamples?: number; includeDrawAsFrom?: boolean } = {},
): FootballStudioPatternAnalysis {
  const minSamples = Math.max(1, Math.floor(options.minSamples ?? 2));
  const includeDrawAsFrom = options.includeDrawAsFrom === true;
  const fromTotals = new Map<FootballStudioSide, number>();
  const fromToHits = new Map<string, number>();

  let coloredTransitions = 0;

  for (let index = 1; index < historyNewestFirst.length; index += 1) {
    const round = historyNewestFirst[index];
    const next = historyNewestFirst[index - 1];
    if (!round || !next) continue;
    if (!includeDrawAsFrom && round.winner === "draw") continue;

    fromTotals.set(round.winner, (fromTotals.get(round.winner) ?? 0) + 1);
    const hitKey = `${round.winner}>${next.winner}`;
    fromToHits.set(hitKey, (fromToHits.get(hitKey) ?? 0) + 1);
    coloredTransitions += 1;
  }

  const transitions: FootballStudioTransitionStat[] = [];
  for (const [hitKey, hits] of fromToHits.entries()) {
    const [from, to] = hitKey.split(">") as [FootballStudioSide, FootballStudioSide];
    const samples = fromTotals.get(from) ?? 0;
    if (samples <= 0) continue;
    transitions.push({
      from,
      to,
      fromLabel: footballStudioSideLabel(from),
      toLabel: footballStudioSideLabel(to),
      hits,
      samples,
      rate: Math.round((hits / samples) * 1000) / 10,
    });
  }
  transitions.sort((a, b) => b.rate - a.rate || b.samples - a.samples);

  const perfectTransitions = transitions.filter(
    (item) => item.rate === 100 && item.samples >= minSamples,
  );

  // Digramas: (mais antigo do par, mais recente do par) → próximo
  // Em newest-first: index+1 = first (mais antigo), index = second, index-1 = next
  const digramTotals = new Map<string, number>();
  const digramHits = new Map<string, number>();

  for (let index = 2; index < historyNewestFirst.length; index += 1) {
    const first = historyNewestFirst[index];
    const second = historyNewestFirst[index - 1];
    const next = historyNewestFirst[index - 2];
    if (!first || !second || !next) continue;
    if (!includeDrawAsFrom && (first.winner === "draw" || second.winner === "draw")) continue;

    const pairKey = `${first.winner}|${second.winner}`;
    digramTotals.set(pairKey, (digramTotals.get(pairKey) ?? 0) + 1);
    const fullKey = `${pairKey}>${next.winner}`;
    digramHits.set(fullKey, (digramHits.get(fullKey) ?? 0) + 1);
  }

  const digrams: FootballStudioDigramStat[] = [];
  for (const [fullKey, hits] of digramHits.entries()) {
    const [pairKey, next] = fullKey.split(">") as [string, FootballStudioSide];
    const [first, second] = pairKey.split("|") as [FootballStudioSide, FootballStudioSide];
    const samples = digramTotals.get(pairKey) ?? 0;
    if (samples <= 0) continue;
    digrams.push({
      first,
      second,
      next,
      firstLabel: footballStudioSideLabel(first),
      secondLabel: footballStudioSideLabel(second),
      nextLabel: footballStudioSideLabel(next),
      hits,
      samples,
      rate: Math.round((hits / samples) * 1000) / 10,
    });
  }
  digrams.sort((a, b) => b.rate - a.rate || b.samples - a.samples);

  const perfectDigrams = digrams.filter((item) => item.rate === 100 && item.samples >= minSamples);

  return {
    transitions,
    perfectTransitions,
    perfectDigrams,
    coloredTransitions,
    rounds: historyNewestFirst.length,
  };
}
