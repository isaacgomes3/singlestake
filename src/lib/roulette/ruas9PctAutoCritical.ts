import type { SimulateStreetStrategyOptions } from "@/lib/roulette/streetStrategy";
import { streetStrategyPlacarOutcomesByExcludedStreets } from "@/lib/roulette/streetStrategy";

import { RUAS_9_PCT_CRITICAL_HEIGHT_SINGLE_GRID_INDEX } from "@/lib/roulette/criticalHeightGatilho";
import { RUAS_9_PCT_STREET_OPTS } from "@/lib/roulette/ruas9PctStreetOpts";

/** Janela (newest-first) usada para comparar aproveitamento entre posições críticas. */
export const RUAS_9_AUTO_CRITICAL_RECENT_SPINS = 20;

/**
 * Posições 4–12 na grelha 11×3 (1-based na UI = índice 0-based + 1 no histórico newest-first).
 * Ordem: desempate em empate de taxa — menor índice (posição mais à esquerda na grelha) ganha.
 */
export const RUAS_9_CRITICAL_POSITION_GRID_INDICES = [3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export type Ruas9AutoCriticalPick = {
  criticalHeightSingleGridIndex: number;
  /** Rótulo humano da posição na grelha (1-based). */
  label: string;
};

type ScoreVec = { wins: number; losses: number; gridIndex: number };

function minHistoryForGridIndex(i: number): number {
  return i + 1;
}

/** Comparação determinística: taxa W/(W+L) com inteiros; empate em taxa → mais decisões; empate → menor `gridIndex`. */
export function ruas9ScoreVectorDominates(a: ScoreVec, b: ScoreVec): boolean {
  const da = a.wins + a.losses;
  const db = b.wins + b.losses;
  if (da === 0 && db === 0) return a.gridIndex < b.gridIndex;
  if (da === 0) return false;
  if (db === 0) return true;
  const cross = a.wins * db - b.wins * da;
  if (cross !== 0) return cross > 0;
  if (da !== db) return da > db;
  return a.gridIndex < b.gridIndex;
}

function defaultPick(): Ruas9AutoCriticalPick {
  const i = RUAS_9_PCT_CRITICAL_HEIGHT_SINGLE_GRID_INDEX;
  return { criticalHeightSingleGridIndex: i, label: String(i + 1) };
}

function scoreForGridIndex(
  windowHist: readonly number[],
  gridIndex: number,
): ScoreVec | null {
  const need = minHistoryForGridIndex(gridIndex);
  if (windowHist.length < need) return null;
  const outcomes = streetStrategyPlacarOutcomesByExcludedStreets([...windowHist], {
    ...RUAS_9_PCT_STREET_OPTS,
  });
  let wins = 0;
  let losses = 0;
  for (const o of outcomes) {
    if (o === "W") wins += 1;
    else if (o === "L") losses += 1;
  }
  return { wins, losses, gridIndex };
}

function pickRawBestFromWindow(windowHist: readonly number[]): Ruas9AutoCriticalPick {
  let bestVec: ScoreVec | null = null;
  for (const gridIndex of RUAS_9_CRITICAL_POSITION_GRID_INDICES) {
    const vec = scoreForGridIndex(windowHist, gridIndex);
    if (!vec) continue;
    if (!bestVec || ruas9ScoreVectorDominates(vec, bestVec)) bestVec = vec;
  }
  if (!bestVec) return defaultPick();
  return { criticalHeightSingleGridIndex: bestVec.gridIndex, label: String(bestVec.gridIndex + 1) };
}

/**
 * Escolhe a posição crítica com melhor desempenho na janela dos últimos `RUAS_9_AUTO_CRITICAL_RECENT_SPINS` giros.
 * `previousPick`: em **empate exacto** de (taxa, W+L) com o melhor candidato, mantém-se o índice anterior (evita
 * oscilar entre posições com o mesmo aproveitamento e recalcular o placar inteiro sem ganho real).
 */
export function pickRuas9AutoCriticalFromHistory(
  historyNewestFirst: readonly number[],
  previousPick?: Ruas9AutoCriticalPick | null,
): Ruas9AutoCriticalPick {
  const cap = RUAS_9_AUTO_CRITICAL_RECENT_SPINS;
  const windowHist =
    historyNewestFirst.length > cap ? historyNewestFirst.slice(0, cap) : [...historyNewestFirst];

  const rawBest = pickRawBestFromWindow(windowHist);

  if (!previousPick) return rawBest;

  const prevIdx = previousPick.criticalHeightSingleGridIndex;
  const prevVec = scoreForGridIndex(windowHist, prevIdx);
  const bestVec = scoreForGridIndex(windowHist, rawBest.criticalHeightSingleGridIndex);
  if (!prevVec || !bestVec) return rawBest;

  const cross = prevVec.wins * (bestVec.wins + bestVec.losses) - bestVec.wins * (prevVec.wins + prevVec.losses);
  const decidedEq = prevVec.wins + prevVec.losses === bestVec.wins + bestVec.losses;
  if (cross === 0 && decidedEq) return previousPick;
  return rawBest;
}

const stickyLastHistLen = new Map<string, number>();
const stickyLastPick = new Map<string, Ruas9AutoCriticalPick>();

/**
 * Mantém o pick da Ruas 9% estável por `tableKey` quando a janela de 20 giros empata em taxa com o candidato
 * actual — evita que o placar (histórico completo) seja re-simulado com outro índice sem melhoria real.
 * Se o histórico **encurtar** (reset), o sticky dessa chave é limpo.
 */
export function resolveRuas9StickyPick(tableKey: string, historyNewestFirst: readonly number[]): Ruas9AutoCriticalPick {
  const len = historyNewestFirst.length;
  const prevLen = stickyLastHistLen.get(tableKey);
  if (prevLen != null && len < prevLen) {
    stickyLastPick.delete(tableKey);
  }
  stickyLastHistLen.set(tableKey, len);

  const prevPick = stickyLastPick.get(tableKey) ?? null;
  const next = pickRuas9AutoCriticalFromHistory(historyNewestFirst, prevPick);
  stickyLastPick.set(tableKey, next);
  return next;
}

export type Ruas9CriticalPositionLiveStat = {
  label: string;
  gridIndex: number;
  wins: number;
  losses: number;
  decided: number;
  /** 0–100 ou `null` se não houver W+L. */
  pct: number | null;
  /** Histórico demasiado curto para avaliar esta posição na janela. */
  insufficient: boolean;
};

/**
 * Aproveitamento por posição crítica na **mesma** janela dos últimos `RUAS_9_AUTO_CRITICAL_RECENT_SPINS` giros
 * (newest-first) usada pelo selector automático.
 */
export function ruas9CriticalPositionsLiveStats(
  historyNewestFirst: readonly number[],
): Ruas9CriticalPositionLiveStat[] {
  const cap = RUAS_9_AUTO_CRITICAL_RECENT_SPINS;
  const windowHist =
    historyNewestFirst.length > cap ? historyNewestFirst.slice(0, cap) : [...historyNewestFirst];

  return RUAS_9_CRITICAL_POSITION_GRID_INDICES.map((gridIndex) => {
    const label = String(gridIndex + 1);
    const vec = scoreForGridIndex(windowHist, gridIndex);
    if (!vec) {
      return {
        label,
        gridIndex,
        wins: 0,
        losses: 0,
        decided: 0,
        pct: null,
        insufficient: true,
      };
    }
    const decided = vec.wins + vec.losses;
    return {
      label,
      gridIndex,
      wins: vec.wins,
      losses: vec.losses,
      decided,
      pct: decided > 0 ? (100 * vec.wins) / decided : null,
      insufficient: false,
    };
  });
}

/** Dados para o painel de estatísticas; `activePick` deve ser o mesmo que `ruas9PctAutoCriticalBundle(...).pick`. */
export function getRuas9CriticalPositionsPanelData(
  historyNewestFirst: readonly number[],
  activePick: Ruas9AutoCriticalPick,
): {
  stats: Ruas9CriticalPositionLiveStat[];
  active: Ruas9AutoCriticalPick;
} {
  return {
    stats: ruas9CriticalPositionsLiveStats(historyNewestFirst),
    active: activePick,
  };
}

/** Opções Ruas 9% (espelho) com posição crítica escolhida automaticamente a partir do histórico. */
export function buildRuas9PctStreetOptsAutoCritical(
  historyNewestFirst: readonly number[],
  stickyKey?: string,
): SimulateStreetStrategyOptions {
  return ruas9PctAutoCriticalBundle(historyNewestFirst, stickyKey).opts;
}

/** Opções + rótulo + pick (use o mesmo `stickyKey` que no tapete para o painel ficar alinhado). */
export function ruas9PctAutoCriticalBundle(
  historyNewestFirst: readonly number[],
  stickyKey?: string,
): {
  opts: SimulateStreetStrategyOptions;
  criticalLabel: string;
  pick: Ruas9AutoCriticalPick;
} {
  const pick = stickyKey
    ? resolveRuas9StickyPick(stickyKey, historyNewestFirst)
    : pickRuas9AutoCriticalFromHistory(historyNewestFirst);
  return {
    opts: { ...RUAS_9_PCT_STREET_OPTS },
    criticalLabel: "pos. 1 e 12 · base pos. 11",
    pick,
  };
}
