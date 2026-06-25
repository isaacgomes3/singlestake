export type DgaTableMeta = {
  tableName?: string;
  tableImage?: string;
};

const cache = new Map<number, DgaTableMeta>();

/** Remove query string de URLs DGA (`?v=…`) para cache estável no browser. */
export function normalizeDgaTableImageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export function setDgaTableMeta(tableId: number, meta: DgaTableMeta): void {
  const prev = cache.get(tableId);
  const tableImage =
    meta.tableImage != null && meta.tableImage.trim()
      ? normalizeDgaTableImageUrl(meta.tableImage.trim())
      : prev?.tableImage;
  const tableName =
    meta.tableName != null && meta.tableName.trim() ? meta.tableName.trim() : prev?.tableName;
  if (!tableImage && !tableName) return;
  cache.set(tableId, { tableName, tableImage });
}

export function getDgaTableMeta(tableId: number): DgaTableMeta | undefined {
  return cache.get(tableId);
}

export function getAllDgaTableMeta(): Record<string, DgaTableMeta> {
  const out: Record<string, DgaTableMeta> = {};
  for (const [id, meta] of cache) {
    out[String(id)] = meta;
  }
  return out;
}
