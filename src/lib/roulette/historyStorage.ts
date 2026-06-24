export type RouletteHistoryScope = "calculator" | "ruas" | "ruas10pct" | "nums28pct" | "espelho";

/** Chave antiga (antes dos escopos); migrada uma vez para as chaves por aba. */
export const ROULETTE_HISTORY_KEY_LEGACY = "roulette.history";

/**
 * Histórico único para Ruas 20%, Ruas 9% e Números 2,8% (mesmo gatilho espelhado — mesmo momento).
 * As chaves `ruas` / `ruas10pct` / `nums28pct` deixam de ser usadas por essas rotas; na primeira leitura
 * de `espelho`, se a chave ainda não existir, copia-se o histórico mais longo entre essas chaves antigas.
 */
export const ROULETTE_MIRROR_HISTORY_SCOPE: Extract<RouletteHistoryScope, "espelho"> = "espelho";

export const ALL_ROULETTE_HISTORY_SCOPES: readonly RouletteHistoryScope[] = [
  "calculator",
  "ruas",
  "ruas10pct",
  "nums28pct",
  "espelho",
];

let espelhoMirrorSeedChecked = false;

/** Se `roulette.history.espelho` ainda não existe, preenche a partir do legado mais longo (uma vez). */
function ensureEspelhoMirrorHistorySeededFromLegacy(): void {
  if (typeof window === "undefined" || espelhoMirrorSeedChecked) return;
  espelhoMirrorSeedChecked = true;
  try {
    const k = rouletteHistoryStorageKey("espelho");
    if (window.localStorage.getItem(k) !== null) return;
    const legacyScopes: RouletteHistoryScope[] = ["ruas10pct", "ruas", "nums28pct"];
    let best: number[] = [];
    for (const s of legacyScopes) {
      const h = parseHistoryJson(window.localStorage.getItem(rouletteHistoryStorageKey(s)));
      if (h.length > best.length) best = h;
    }
    if (best.length > 0) window.localStorage.setItem(k, JSON.stringify(best));
  } catch {
    /* quota */
  }
}

export function rouletteHistoryStorageKey(scope: RouletteHistoryScope): string {
  return `roulette.history.${scope}`;
}

/** Epoch ms por giro, alinhado a `roulette.history.espelho` (newest-first); falta de registo = `null` (histórico antigo / importação). */
export const ROULETTE_ESPELHO_SPIN_TIMES_KEY = "roulette.historySpinTimes.espelho";

function parseSpinTimesJson(raw: string | null): (number | null)[] {
  if (raw == null) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: (number | null)[] = [];
    for (const x of parsed) {
      if (x === null) {
        out.push(null);
        continue;
      }
      if (typeof x === "number" && Number.isFinite(x)) out.push(x);
      else out.push(null);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Tempos de giro do espelho com o mesmo comprimento que o histórico actual (preenche com `null` se faltar dados).
 */
export function readRouletteSpinTimesEspelhoAligned(historyLength: number): (number | null)[] {
  if (typeof window === "undefined" || historyLength <= 0) return [];
  try {
    const raw = parseSpinTimesJson(window.localStorage.getItem(ROULETTE_ESPELHO_SPIN_TIMES_KEY));
    if (raw.length >= historyLength) return raw.slice(0, historyLength);
    return [...raw, ...Array.from({ length: historyLength - raw.length }, () => null)];
  } catch {
    return Array.from({ length: historyLength }, () => null);
  }
}

function persistEspelhoSpinTimes(next: (number | null)[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROULETTE_ESPELHO_SPIN_TIMES_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

/** Mantém `spinTimes` alinhado a `roulette.history.espelho` (prepend/remove head/truncar prefixo). */
export function syncEspelhoSpinTimesWithHistory(
  prevNums: readonly number[],
  nextNums: readonly number[],
  prevTimes: readonly (number | null)[],
): (number | null)[] {
  const pt = prevTimes.slice(0, prevNums.length);
  if (nextNums.length === 0) return [];
  if (
    nextNums.length === prevNums.length + 1 &&
    nextNums.slice(1).every((n, k) => n === prevNums[k])
  ) {
    return [Date.now(), ...pt.slice(0, nextNums.length - 1)];
  }
  if (
    prevNums.length === nextNums.length + 1 &&
    prevNums.slice(1).every((n, k) => n === nextNums[k])
  ) {
    return pt.slice(1);
  }
  if (nextNums.length <= prevNums.length && nextNums.every((n, k) => n === prevNums[k])) {
    return pt.slice(0, nextNums.length);
  }
  const out: (number | null)[] = [];
  for (let i = 0; i < nextNums.length; i++) {
    if (i < prevNums.length && nextNums[i] === prevNums[i] && i < pt.length) out.push(pt[i]!);
    else out.push(null);
  }
  return out;
}

/** Disparado apos persistir (mesma aba). `detail.scope` indica qual aba mudou, ou `all` (ex.: giro ao vivo). */
export const ROULETTE_HISTORY_CHANGED_EVENT = "roulette-history-changed";

export type RouletteHistoryChangedDetail = {
  scope: RouletteHistoryScope | "all";
};

/** Ultimo gameId de giro ao vivo ja aplicado ao historico (evita duplicar ao reconectar SSE / mudar de rota). */
export const ROULETTE_LAST_LIVE_GAME_ID_KEY = "roulette.lastLiveSpinGameId";

let legacyMigrationChecked = false;

function parseHistoryJson(raw: string | null): number[] {
  if (raw == null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 36);
  } catch {
    return [];
  }
}

/** Copia `roulette.history` legado para cada escopo em falta e remove a chave antiga. */
function migrateLegacyHistoryOnce(): void {
  if (typeof window === "undefined" || legacyMigrationChecked) return;
  legacyMigrationChecked = true;
  try {
    const legacyRaw = window.localStorage.getItem(ROULETTE_HISTORY_KEY_LEGACY);
    if (legacyRaw == null) return;
    const legacy = parseHistoryJson(legacyRaw);
    if (legacy.length === 0) {
      window.localStorage.removeItem(ROULETTE_HISTORY_KEY_LEGACY);
      return;
    }
    for (const scope of ALL_ROULETTE_HISTORY_SCOPES) {
      const k = rouletteHistoryStorageKey(scope);
      if (window.localStorage.getItem(k) == null) {
        window.localStorage.setItem(k, JSON.stringify(legacy));
      }
    }
    window.localStorage.removeItem(ROULETTE_HISTORY_KEY_LEGACY);
  } catch {
    /* quota / bloqueio */
  }
}

export function readRouletteHistory(scope: RouletteHistoryScope): number[] {
  if (typeof window === "undefined") return [];
  migrateLegacyHistoryOnce();
  if (scope === "espelho") ensureEspelhoMirrorHistorySeededFromLegacy();
  try {
    return parseHistoryJson(window.localStorage.getItem(rouletteHistoryStorageKey(scope)));
  } catch {
    return [];
  }
}

export function persistRouletteHistory(
  next: number[],
  scope: RouletteHistoryScope,
  options?: { suppressDispatch?: boolean },
): void {
  if (typeof window === "undefined") return;
  migrateLegacyHistoryOnce();
  try {
    const serialized = JSON.stringify(next);
    const key = rouletteHistoryStorageKey(scope);
    const prevNums = scope === ROULETTE_MIRROR_HISTORY_SCOPE ? readRouletteHistory(scope) : [];
    const prevTimes =
      scope === ROULETTE_MIRROR_HISTORY_SCOPE
        ? parseSpinTimesJson(window.localStorage.getItem(ROULETTE_ESPELHO_SPIN_TIMES_KEY))
        : [];
    if (window.localStorage.getItem(key) === serialized) {
      if (!options?.suppressDispatch) {
        window.dispatchEvent(
          new CustomEvent<RouletteHistoryChangedDetail>(ROULETTE_HISTORY_CHANGED_EVENT, {
            detail: { scope },
          }),
        );
      }
      return;
    }
    window.localStorage.setItem(key, serialized);
    if (scope === ROULETTE_MIRROR_HISTORY_SCOPE) {
      const nextTimes = syncEspelhoSpinTimesWithHistory(prevNums, next, prevTimes);
      persistEspelhoSpinTimes(nextTimes);
    }
    if (!options?.suppressDispatch) {
      window.dispatchEvent(
        new CustomEvent<RouletteHistoryChangedDetail>(ROULETTE_HISTORY_CHANGED_EVENT, {
          detail: { scope },
        }),
      );
    }
  } catch {
    /* quota / bloqueio */
  }
}

/** Um unico evento apos varias escritas (ex. giro SSE em todos os escopos). */
export function notifyRouletteHistoryChangedAllScopes(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RouletteHistoryChangedDetail>(ROULETTE_HISTORY_CHANGED_EVENT, {
      detail: { scope: "all" },
    }),
  );
}

export function historyChangeAffectsScope(
  detail: RouletteHistoryChangedDetail | undefined,
  scope: RouletteHistoryScope,
): boolean {
  if (!detail?.scope) return true;
  return detail.scope === "all" || detail.scope === scope;
}

export function readLastProcessedLiveGameId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ROULETTE_LAST_LIVE_GAME_ID_KEY);
  } catch {
    return null;
  }
}

export function writeLastProcessedLiveGameId(gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ROULETTE_LAST_LIVE_GAME_ID_KEY, gameId);
  } catch {
    /* quota / modo privado */
  }
}

export function clearLastProcessedLiveGameId(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ROULETTE_LAST_LIVE_GAME_ID_KEY);
  } catch {
    /* */
  }
}

/** Histórico ao vivo por mesa Pragmatic (newest-first), separado do espelho / escopos. */
export function liveTableHistoryStorageKey(tableId: number): string {
  return `roulette.liveTableHistory.${tableId}`;
}

/** Epoch ms por giro (newest-first), alinhado a `liveTableHistoryStorageKey` — `null` = legado sem marca. */
export function liveTableSpinTimesStorageKey(tableId: number): string {
  return `roulette.liveTableSpinTimes.${tableId}`;
}

export function readLiveTableSpinTimesAligned(tableId: number, historyLength: number): (number | null)[] {
  if (typeof window === "undefined" || historyLength <= 0) return [];
  try {
    const raw = parseSpinTimesJson(window.localStorage.getItem(liveTableSpinTimesStorageKey(tableId)));
    if (raw.length >= historyLength) return raw.slice(0, historyLength);
    return [...raw, ...Array.from({ length: historyLength - raw.length }, () => null)];
  } catch {
    return Array.from({ length: historyLength }, () => null);
  }
}

function persistLiveTableSpinTimes(tableId: number, next: (number | null)[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(liveTableSpinTimesStorageKey(tableId), JSON.stringify(next));
  } catch {
    /* quota */
  }
}

/** Início da hora civil local (minutos e segundos a zero). */
export function startOfLocalHourMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  d.setMinutes(0, 0, 0);
  d.setMilliseconds(0);
  return d.getTime();
}

/**
 * Devolve o histórico completo (sem recorte por hora).
 * @deprecated O placar usa histórico acumulado; mantido por compatibilidade de API.
 */
export function sliceNewestFirstHistoryForPlacarLocalHour(
  historyNewestFirst: readonly number[],
  _timesNewestFirst?: readonly (number | null)[],
  _nowMs?: number,
): number[] {
  return [...historyNewestFirst];
}

/** Histórico ao vivo da mesa — série completa (sem limite por hora). */
export function liveTableHistoryForPlacarLocalHour(
  _tableId: number,
  historyNewestFirst: readonly number[],
  _nowMs?: number,
): number[] {
  return [...historyNewestFirst];
}

/** Espelho — série completa (sem limite por hora). */
export function rouletteEspelhoHistoryForPlacarLocalHour(_nowMs?: number): number[] {
  if (typeof window === "undefined") return [];
  return readRouletteHistory(ROULETTE_MIRROR_HISTORY_SCOPE);
}

export const ROULETTE_LIVE_TABLE_HISTORY_EVENT = "roulette-live-table-history-changed";

export type RouletteLiveTableHistoryDetail = { tableId: number };

export function readLiveTableHistory(tableId: number): number[] {
  if (typeof window === "undefined") return [];
  try {
    return parseHistoryJson(window.localStorage.getItem(liveTableHistoryStorageKey(tableId)));
  } catch {
    return [];
  }
}

export function persistLiveTableHistory(
  tableId: number,
  next: number[],
  options?: { suppressDispatch?: boolean },
): void {
  if (typeof window === "undefined") return;
  try {
    const key = liveTableHistoryStorageKey(tableId);
    const serialized = JSON.stringify(next);
    if (window.localStorage.getItem(key) === serialized) {
      if (!options?.suppressDispatch) {
        window.dispatchEvent(
          new CustomEvent<RouletteLiveTableHistoryDetail>(ROULETTE_LIVE_TABLE_HISTORY_EVENT, {
            detail: { tableId },
          }),
        );
      }
      return;
    }
    const prevNums = readLiveTableHistory(tableId);
    const prevTimes = readLiveTableSpinTimesAligned(tableId, prevNums.length);
    window.localStorage.setItem(key, serialized);
    const nextTimes = syncEspelhoSpinTimesWithHistory(prevNums, next, prevTimes);
    persistLiveTableSpinTimes(tableId, nextTimes);
    if (!options?.suppressDispatch) {
      window.dispatchEvent(
        new CustomEvent<RouletteLiveTableHistoryDetail>(ROULETTE_LIVE_TABLE_HISTORY_EVENT, {
          detail: { tableId },
        }),
      );
    }
  } catch {
    /* quota */
  }
}

export function notifyLiveTableHistoryChanged(tableId: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RouletteLiveTableHistoryDetail>(ROULETTE_LIVE_TABLE_HISTORY_EVENT, {
      detail: { tableId },
    }),
  );
}
