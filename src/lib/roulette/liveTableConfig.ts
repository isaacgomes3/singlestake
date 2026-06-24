/**
 * Configuração enviada pelo SSE (`ready`) com os IDs das mesas e a mesa principal
 * (primeira em `ROULETTE_TABLE_IDS`) usada para espelho / estratégias.
 */
let tableIds: number[] = [];
let primaryTableId: number | null = null;

/** Disparado quando o SSE `ready` define a lista de mesas. */
export const ROULETTE_LIVE_TABLE_CONFIG_EVENT = "roulette-live-table-config-changed";

export function setLiveRouletteTableConfigFromServer(ids: number[]): void {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of ids) {
    if (Number.isFinite(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  tableIds = out;
  primaryTableId = out.length > 0 ? out[0]! : null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ROULETTE_LIVE_TABLE_CONFIG_EVENT));
  }
}

export function getLiveRouletteTableIds(): readonly number[] {
  return tableIds;
}

export function getPrimaryLiveTableId(): number | null {
  return primaryTableId;
}

/** `gameId` do SSE no formato `{tableId}::{upstreamGameId}`. */
export function parseLiveTableIdFromCompositeGameId(gameId: string | undefined): number | null {
  if (gameId === undefined || gameId === "") return null;
  const m = /^(\d+)::/.exec(gameId);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
