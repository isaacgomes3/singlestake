/** Histórico local Football Blitz / Super Trunfo por mesa (SSE Pragmatic DGA). Mais recente = índice 0. */

import {
  DGA_FOOTBALL_BLITZ_DEFAULT_TABLE_KEY,
  FOOTBALL_BLITZ_SUPER_TRUNFO,
} from "@/lib/pragmatic/dgaFootballBlitzConstants";

export const DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT = "pragmatic:football-blitz-history-changed";

/** @deprecated Use `historyStorageKey(tableKey)`. Mantido para migração. */
export const DGA_FOOTBALL_BLITZ_HISTORY_STORAGE_KEY = "pragmatic.footballBlitz.history.v2";

export type FootballBlitzWinner = "home" | "away" | "draw";

export type FootballBlitzRoundStored = {
  gameId: string;
  winner: FootballBlitzWinner;
  winningNumber: number;
  scoreDiff: number;
  time?: string;
};

/** Rondas em `gameResult[]` na DGA Pragmatic (sonda: 21). */
export const DGA_FOOTBALL_BLITZ_SERVER_ROUNDS = 21;

/** Slot extra no `localStorage` para ronda via SSE antes do snapshot do servidor. */
export const FOOTBALL_BLITZ_LOCAL_EXTRA_ROUNDS = 1;

/** Máximo guardado por mesa: 21 do servidor + 1 acumulada localmente (grelha 11×2). */
export const FOOTBALL_BLITZ_HISTORY_MAX_ROUNDS =
  DGA_FOOTBALL_BLITZ_SERVER_ROUNDS + FOOTBALL_BLITZ_LOCAL_EXTRA_ROUNDS;

const LEGACY_STORAGE_KEY = DGA_FOOTBALL_BLITZ_HISTORY_STORAGE_KEY;

export function historyStorageKey(tableKey: number): string {
  return `pragmatic.footballBlitz.history.${tableKey}.v2`;
}

function lastGameIdKey(tableKey: number): string {
  return `pragmatic.footballBlitz.lastGameId.${tableKey}.v2`;
}

function suppressGameIdsKey(tableKey: number): string {
  return `pragmatic.footballBlitz.suppressGameIds.${tableKey}.v1`;
}

function readLastGameId(tableKey: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(lastGameIdKey(tableKey));
  } catch {
    return null;
  }
}

function writeLastGameId(tableKey: number, id: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = lastGameIdKey(tableKey);
    if (id === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, id);
  } catch {
    /* */
  }
}

function readSuppressGameIds(tableKey: number): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(suppressGameIdsKey(tableKey));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => String(id)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function writeSuppressGameIds(tableKey: number, ids: ReadonlySet<string> | readonly string[]) {
  if (typeof window === "undefined") return;
  try {
    const list = [...ids].filter(Boolean);
    const key = suppressGameIdsKey(tableKey);
    if (list.length === 0) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* */
  }
}

function isSuppressedGameId(tableKey: number, gameId: string): boolean {
  return readSuppressGameIds(tableKey).has(gameId);
}

/** Zera histórico local (ex.: mudança de baralho DGA). */
export function clearFootballBlitzHistory(
  tableKey: number,
  options?: { suppressGameIds?: readonly string[] },
) {
  if (typeof window === "undefined") return;
  const suppress = options?.suppressGameIds ?? [];
  writeSuppressGameIds(tableKey, suppress);
  persistHistory(tableKey, []);
  writeLastGameId(tableKey, null);
  dispatchFootballBlitzHistoryChanged(tableKey);
}

function parseHistoryRows(parsed: unknown): FootballBlitzRoundStored[] {
  if (!Array.isArray(parsed)) return [];
  const out: FootballBlitzRoundStored[] = [];
  for (const row of parsed) {
    if (row == null || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const gameId = o.gameId != null ? String(o.gameId) : "";
    const winner = o.winner;
    const winningNumber = Number(o.winningNumber);
    if (!gameId || (winner !== "home" && winner !== "away" && winner !== "draw")) continue;
    if (!Number.isFinite(winningNumber)) continue;
    out.push({
      gameId,
      winner,
      winningNumber,
      scoreDiff: Number(o.scoreDiff) || 0,
      time: typeof o.time === "string" ? o.time : undefined,
    });
  }
  return out;
}

function migrateLegacySuperTrunfoHistory(): FootballBlitzRoundStored[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const rows = parseHistoryRows(JSON.parse(raw));
    if (rows.length === 0) return [];
    const key = historyStorageKey(FOOTBALL_BLITZ_SUPER_TRUNFO.tableKey);
    localStorage.setItem(key, JSON.stringify(rows.slice(0, FOOTBALL_BLITZ_HISTORY_MAX_ROUNDS)));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return rows;
  } catch {
    return [];
  }
}

export function readFootballBlitzHistory(
  tableKey: number = DGA_FOOTBALL_BLITZ_DEFAULT_TABLE_KEY,
): FootballBlitzRoundStored[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(historyStorageKey(tableKey));
    if (raw) return parseHistoryRows(JSON.parse(raw));
    if (tableKey === FOOTBALL_BLITZ_SUPER_TRUNFO.tableKey) {
      return migrateLegacySuperTrunfoHistory();
    }
    return [];
  } catch {
    return [];
  }
}

function persistHistory(tableKey: number, rounds: FootballBlitzRoundStored[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      historyStorageKey(tableKey),
      JSON.stringify(rounds.slice(0, FOOTBALL_BLITZ_HISTORY_MAX_ROUNDS)),
    );
  } catch {
    /* */
  }
}

export function dispatchFootballBlitzHistoryChanged(tableKey: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT, { detail: { tableKey } }),
  );
}

function mergeServerBatchWithLocalHistory(
  serverNewestFirst: readonly FootballBlitzRoundStored[],
  localNewestFirst: readonly FootballBlitzRoundStored[],
): FootballBlitzRoundStored[] {
  const server = serverNewestFirst.slice(0, DGA_FOOTBALL_BLITZ_SERVER_ROUNDS);
  const serverIds = new Set(server.map((r) => r.gameId));
  const seen = new Set<string>();
  const merged: FootballBlitzRoundStored[] = [];

  // Rondas locais mais recentes que o snapshot (SSE antes da DGA actualizar).
  for (const r of localNewestFirst) {
    if (serverIds.has(r.gameId)) break;
    if (seen.has(r.gameId)) continue;
    seen.add(r.gameId);
    merged.push(r);
  }

  for (const r of server) {
    if (seen.has(r.gameId)) continue;
    seen.add(r.gameId);
    merged.push(r);
  }

  // Até 1 ronda local fora da janela de 21 do servidor (cauda).
  let localTail = 0;
  for (const r of localNewestFirst) {
    if (seen.has(r.gameId)) continue;
    if (localTail >= FOOTBALL_BLITZ_LOCAL_EXTRA_ROUNDS) break;
    seen.add(r.gameId);
    merged.push(r);
    localTail += 1;
  }

  return merged.slice(0, FOOTBALL_BLITZ_HISTORY_MAX_ROUNDS);
}

export function replaceFootballBlitzHistoryFromBatch(
  tableKey: number,
  rounds: readonly {
    gameId?: string;
    winner?: string;
    winningNumber?: number;
    scoreDiff?: number;
    time?: string;
  }[],
) {
  const mapped: FootballBlitzRoundStored[] = [];
  for (const r of rounds) {
    if (!r.gameId) continue;
    const w = r.winner;
    if (w !== "home" && w !== "away" && w !== "draw") continue;
    const n = Number(r.winningNumber);
    if (!Number.isFinite(n)) continue;
    mapped.push({
      gameId: String(r.gameId),
      winner: w,
      winningNumber: n,
      scoreDiff: Number(r.scoreDiff) || 0,
      time: r.time,
    });
  }
  if (mapped.length === 0) return;

  const suppress = readSuppressGameIds(tableKey);
  const fresh = mapped.filter((r) => !suppress.has(r.gameId));
  // Snapshot só com rondas do baralho antigo — não repor o histórico limpo.
  if (fresh.length === 0) return;

  // Nova mão após shuffle: deixa de suprimir IDs do baralho anterior.
  if (suppress.size > 0) writeSuppressGameIds(tableKey, []);

  const cur = readFootballBlitzHistory(tableKey);
  const merged = mergeServerBatchWithLocalHistory(fresh, cur);

  persistHistory(tableKey, merged);
  writeLastGameId(tableKey, merged[0]!.gameId);
  dispatchFootballBlitzHistoryChanged(tableKey);
}

export function appendFootballBlitzFromSse(
  tableKey: number,
  round: {
    gameId: string;
    winner: FootballBlitzWinner;
    winningNumber: number;
    scoreDiff?: number;
    time?: string;
  },
) {
  if (isSuppressedGameId(tableKey, round.gameId)) return;

  const last = readLastGameId(tableKey);
  if (last === round.gameId) return;
  writeLastGameId(tableKey, round.gameId);

  // Primeira ronda nova após shuffle — limpa suppress do baralho antigo.
  if (readSuppressGameIds(tableKey).size > 0) writeSuppressGameIds(tableKey, []);

  const cur = readFootballBlitzHistory(tableKey);
  const next = [
    {
      gameId: round.gameId,
      winner: round.winner,
      winningNumber: round.winningNumber,
      scoreDiff: round.scoreDiff ?? 0,
      time: round.time,
    },
    ...cur.filter((x) => x.gameId !== round.gameId),
  ].slice(0, FOOTBALL_BLITZ_HISTORY_MAX_ROUNDS);
  persistHistory(tableKey, next);
  dispatchFootballBlitzHistoryChanged(tableKey);
}
