import {
  ALL_ROULETTE_HISTORY_SCOPES,
  clearLastProcessedLiveGameId,
  notifyLiveTableHistoryChanged,
  notifyRouletteHistoryChangedAllScopes,
  persistLiveTableHistory,
  persistRouletteHistory,
  readLastProcessedLiveGameId,
  readLiveTableHistory,
  readRouletteHistory,
  writeLastProcessedLiveGameId,
} from "@/lib/roulette/historyStorage";
import {
  getLiveRouletteTableIds,
  getPrimaryLiveTableId,
  parseLiveTableIdFromCompositeGameId,
} from "@/lib/roulette/liveTableConfig";

/** Dedupe entre reconexões SSE (alinhado com sessionStorage quando possível). */
let lastProcessedGameId: string | null = null;

export function initLiveSpinDedupeFromStorage(): void {
  lastProcessedGameId = readLastProcessedLiveGameId();
}

export function resetLiveSpinDedupe(): void {
  lastProcessedGameId = null;
  clearLastProcessedLiveGameId();
}

export type LiveSsePayload = {
  type?: string;
  number?: number;
  gameId?: string | number;
  replay?: boolean;
  spins?: { number?: number; gameId?: string | number }[];
  state?: string;
  message?: string;
  ok?: boolean;
  /** Enviado em `ready` — mesma ordem que `ROULETTE_TABLE_IDS` no servidor; o 1.º ID alimenta espelho/estratégias. */
  tableIds?: number[];
};

export type LiveSseApplyResult = "replay-seeded" | "appended" | "ignored";

export function normalizeGameId(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

function appendLiveTableOnly(tableId: number, number: number): void {
  const prevLt = readLiveTableHistory(tableId);
  persistLiveTableHistory(tableId, [number, ...prevLt], { suppressDispatch: true });
  notifyLiveTableHistoryChanged(tableId);
}

function appendPrimaryScopes(number: number): void {
  for (const s of ALL_ROULETTE_HISTORY_SCOPES) {
    const prev = readRouletteHistory(s);
    persistRouletteHistory([number, ...prev], s, { suppressDispatch: true });
  }
  notifyRouletteHistoryChangedAllScopes();
}

/**
 * Aplica mensagem SSE `type: "spin"` ao histórico.
 * Com `gameId` no formato `{mesa}::{gameId upstream}`: cada mesa tem `roulette.liveTableHistory.{mesa}`;
 * a **primeira** mesa da lista no servidor (`ready`) continua a alimentar espelho / escopos (estratégias).
 * Sem prefixo `::`: comportamento legado (uma mesa) — escreve só nos escopos.
 */
export function applyLiveSpinFromSse(o: LiveSsePayload): LiveSseApplyResult {
  if (o.type !== "spin" || o.number === undefined) return "ignored";

  const number = Number(o.number);
  if (!Number.isInteger(number) || number < 0 || number > 36) return "ignored";

  const gameId = normalizeGameId(o.gameId);
  const tableId = parseLiveTableIdFromCompositeGameId(gameId);

  if (lastProcessedGameId === null) {
    lastProcessedGameId = readLastProcessedLiveGameId();
  }

  const isReplay = o.replay === true;

  if (isReplay) {
    if (tableId !== null) {
      if (readLiveTableHistory(tableId).length > 0) return "ignored";
      if (gameId !== undefined) {
        lastProcessedGameId = gameId;
        writeLastProcessedLiveGameId(gameId);
      }
      persistLiveTableHistory(tableId, [number], { suppressDispatch: true });
      notifyLiveTableHistoryChanged(tableId);
      const primary = getPrimaryLiveTableId();
      const configured = getLiveRouletteTableIds().length > 0;
      const updateScopes = !configured || (primary !== null && tableId === primary);
      if (updateScopes) {
        const allEmpty = ALL_ROULETTE_HISTORY_SCOPES.every(
          (s) => readRouletteHistory(s).length === 0,
        );
        if (allEmpty) {
          for (const s of ALL_ROULETTE_HISTORY_SCOPES) {
            persistRouletteHistory([number], s, { suppressDispatch: true });
          }
          notifyRouletteHistoryChangedAllScopes();
        }
      }
      return "replay-seeded";
    }
    if (gameId !== undefined) {
      lastProcessedGameId = gameId;
      writeLastProcessedLiveGameId(gameId);
    }
    const allEmpty = ALL_ROULETTE_HISTORY_SCOPES.every((s) => readRouletteHistory(s).length === 0);
    if (!allEmpty) return "ignored";
    for (const s of ALL_ROULETTE_HISTORY_SCOPES) {
      persistRouletteHistory([number], s, { suppressDispatch: true });
    }
    notifyRouletteHistoryChangedAllScopes();
    return "replay-seeded";
  }

  if (gameId !== undefined) {
    if (gameId === lastProcessedGameId) return "ignored";
    lastProcessedGameId = gameId;
    writeLastProcessedLiveGameId(gameId);
  }

  if (tableId !== null) {
    appendLiveTableOnly(tableId, number);
    const configured = getLiveRouletteTableIds().length > 0;
    const primary = getPrimaryLiveTableId();
    const updateScopes = !configured || (primary !== null && tableId === primary);
    if (updateScopes) {
      appendPrimaryScopes(number);
    }
    return "appended";
  }

  appendPrimaryScopes(number);
  return "appended";
}

/**
 * Reconciliação local ⇄ snapshot da API (ambos newest-first).
 *
 * Regra: **nunca** descartar o histórico local automaticamente.
 * - Prefixo alinhado com o snapshot → mantém o resto local.
 * - Bloco contíguo do snapshot no meio → reescreve o prefixo, preserva o mais antigo.
 * - Sufixo do snapshot no prefixo local → prepende o que falta.
 * - Sem sobreposição e local não vazio → mantém o local (não substitui pelo snapshot).
 */
function reconcileWithApiSnapshot(
  local: readonly number[],
  api: readonly number[],
): number[] {
  if (api.length === 0) return [...local];
  if (local.length === 0) return [...api];

  if (local.length >= api.length) {
    let aligned = true;
    for (let i = 0; i < api.length; i++) {
      if (local[i] !== api[i]) {
        aligned = false;
        break;
      }
    }
    if (aligned) return [...local];
  }

  for (let k = 0; k <= local.length - api.length; k++) {
    let match = true;
    for (let j = 0; j < api.length; j++) {
      if (local[k + j] !== api[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return [...api, ...local.slice(k + api.length)];
    }
  }

  const maxLen = Math.min(api.length, local.length);
  for (let len = maxLen; len > 0; len--) {
    let ok = true;
    for (let i = 0; i < len; i++) {
      if (api[api.length - len + i] !== local[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return [...api.slice(0, api.length - len), ...local];
    }
  }

  return [...local];
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Replay inicial: alinha o prefixo recente com o snapshot da Pragmatic (`last20Results`)
 * sem apagar o histórico local acumulado quando não há sobreposição reconhecível.
 */
export function applyLiveSpinReplayBatch(
  spins: { number: number; gameId: string }[],
): LiveSseApplyResult {
  if (spins.length === 0) return "ignored";

  if (lastProcessedGameId === null) {
    lastProcessedGameId = readLastProcessedLiveGameId();
  }

  const primary = getPrimaryLiveTableId();

  const byTid = new Map<number, { number: number; gameId: string }[]>();
  for (const s of spins) {
    const tid = parseLiveTableIdFromCompositeGameId(s.gameId);
    if (tid === null) continue;
    const n = Number(s.number);
    if (!Number.isInteger(n) || n < 0 || n > 36) continue;
    const list = byTid.get(tid) ?? [];
    list.push({ number: n, gameId: s.gameId });
    byTid.set(tid, list);
  }

  let touchedAny = false;

  for (const [tid, arr] of byTid) {
    const apiNums = arr.map((x) => x.number);
    const local = readLiveTableHistory(tid);
    const reconciled = reconcileWithApiSnapshot(local, apiNums);
    if (!arraysEqual(local, reconciled)) {
      persistLiveTableHistory(tid, reconciled, { suppressDispatch: true });
      notifyLiveTableHistoryChanged(tid);
      touchedAny = true;
    }
  }

  const primaryArr = primary !== null ? byTid.get(primary) : undefined;
  const primaryNums =
    primaryArr && primaryArr.length > 0
      ? primaryArr.map((x) => x.number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 36)
      : [];

  let scopesChanged = false;
  if (primaryNums.length > 0) {
    for (const sc of ALL_ROULETTE_HISTORY_SCOPES) {
      const prev = readRouletteHistory(sc);
      const next = reconcileWithApiSnapshot(prev, primaryNums);
      if (!arraysEqual(prev, next)) {
        persistRouletteHistory(next, sc, { suppressDispatch: true });
        scopesChanged = true;
      }
    }
    if (scopesChanged) notifyRouletteHistoryChangedAllScopes();
  }

  if (!touchedAny && !scopesChanged) return "ignored";

  const compositeId = spins
    .map((s) => normalizeGameId(s.gameId))
    .filter((id): id is string => id !== undefined && id !== "");
  if (compositeId.length > 0) {
    const joined = compositeId.join("|");
    lastProcessedGameId = joined;
    writeLastProcessedLiveGameId(joined);
  }

  return "replay-seeded";
}
