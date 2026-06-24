import { detectSmartMoveConvergence, type SmartMoveHeight } from "@/lib/smartMove/pattern";

/** Uma aposta Smart Move resolvida ao reproduzir o histórico (mesmo critério que `computeSmartMoveSessionFromHistory`). */
export type SmartMoveResolvedBet = {
  won: boolean;
  /** Número que saiu no giro que resolveu a aposta. */
  resultSpin: number;
  height: SmartMoveHeight;
};

/**
 * Lista cronológica (mais antiga → mais recente) de apostas resolvidas,
 * alinhada ao placar reconstruído a partir do histórico newest-first.
 */
export function replaySmartMoveResolvedBets(
  historyNewestFirst: readonly number[],
): SmartMoveResolvedBet[] {
  const resolved: SmartMoveResolvedBet[] = [];
  let pending: { targets: number[]; height: SmartMoveHeight } | null = null;

  const L = historyNewestFirst.length;
  for (let i = L - 1; i >= 0; i--) {
    const spin = historyNewestFirst[i]!;
    if (pending) {
      const won = pending.targets.includes(spin);
      resolved.push({ won, resultSpin: spin, height: pending.height });
      pending = null;
    }
    const partial = historyNewestFirst.slice(i);
    const alert = detectSmartMoveConvergence(partial);
    pending = alert ? { targets: [...alert.targetNumbers], height: alert.height } : null;
  }

  return resolved;
}

export type SmartMoveLossDiagnostics = {
  totalResolved: number;
  wins: number;
  losses: number;
  /** Taxa observada nas apostas resolvidas (não confundir com "rodadas" totais). */
  winRatePct: number;
  byHeight: Record<SmartMoveHeight, { wins: number; losses: number; winRatePct: number }>;
  /** Derrotas em que saiu o zero. */
  lossCountZero: number;
  /** Fração das derrotas com zero (0–1). */
  lossShareZero: number;
  /** Top números que mais apareceram como resultado em derrotas (ordenado desc.). */
  topLossNumbers: { number: number; count: number }[];
};

const emptyHeight = (): { wins: number; losses: number; winRatePct: number } => ({
  wins: 0,
  losses: 0,
  winRatePct: 0,
});

/**
 * Agrega padrões descritivos nas derrotas (frequências; não implica previsibilidade futura).
 */
export function aggregateSmartMoveLossDiagnostics(
  resolved: readonly SmartMoveResolvedBet[],
): SmartMoveLossDiagnostics {
  let wins = 0;
  let losses = 0;
  const byHeight: Record<SmartMoveHeight, { wins: number; losses: number; winRatePct: number }> = {
    low: { wins: 0, losses: 0, winRatePct: 0 },
    high: { wins: 0, losses: 0, winRatePct: 0 },
  };
  const lossFreq = new Map<number, number>();
  let lossCountZero = 0;

  for (const r of resolved) {
    if (r.won) {
      wins += 1;
      byHeight[r.height].wins += 1;
    } else {
      losses += 1;
      byHeight[r.height].losses += 1;
      if (r.resultSpin === 0) lossCountZero += 1;
      lossFreq.set(r.resultSpin, (lossFreq.get(r.resultSpin) ?? 0) + 1);
    }
  }

  const totalResolved = wins + losses;
  const winRatePct = totalResolved > 0 ? (wins / totalResolved) * 100 : 0;
  const lossShareZero = losses > 0 ? lossCountZero / losses : 0;

  for (const h of ["low", "high"] as const) {
    const { wins: w, losses: l } = byHeight[h];
    const t = w + l;
    byHeight[h].winRatePct = t > 0 ? (w / t) * 100 : 0;
  }

  const topLossNumbers = [...lossFreq.entries()]
    .map(([number, count]) => ({ number, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalResolved,
    wins,
    losses,
    winRatePct,
    byHeight,
    lossCountZero,
    lossShareZero,
    topLossNumbers,
  };
}
