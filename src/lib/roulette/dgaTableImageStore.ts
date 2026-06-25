/**
 * Cache cliente de `tableImage` da DGA (via `/api/roulette/table-meta`).
 */
export type DgaTableMetaClient = {
  tableName?: string;
  tableImage?: string;
};

let tables: Record<number, DgaTableMetaClient> = {};
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function subscribeDgaTableImages(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDgaTableImageUrl(tableId: number): string | undefined {
  return tables[tableId]?.tableImage;
}

export function ensureDgaTableImagesLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch("/api/roulette/table-meta");
      if (!res.ok) return;
      const body = (await res.json()) as { tables?: Record<string, DgaTableMetaClient> };
      const raw = body.tables ?? {};
      const next: Record<number, DgaTableMetaClient> = {};
      for (const [id, meta] of Object.entries(raw)) {
        const n = parseInt(id, 10);
        if (!Number.isFinite(n) || n <= 0) continue;
        next[n] = meta;
      }
      tables = next;
      notify();
    } catch {
      /* rede indisponível — fallback estático em lobbyTableCardAssets */
    }
  })();
  return loadPromise;
}
