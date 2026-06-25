import type { PlaytechLobbyFeed, PlaytechTestSpinEvent, PlaytechTestTable } from "./types.ts";
import { isPlaytechLobbyFeed } from "./types.ts";

export type ImportFeedResult = {
  feed: PlaytechLobbyFeed;
  format: string;
  warnings: string[];
};

function slugKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function parseNumberList(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map(asNumber).filter((n): n is number => n !== null && n >= 0 && n <= 36);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\s,;|/]+/)
      .map(asNumber)
      .filter((n): n is number => n !== null && n >= 0 && n <= 36);
  }
  return [];
}

function tableLabelFromRecord(row: Record<string, unknown>): string | null {
  for (const key of ["label", "nome", "name", "title", "mesa", "tableName", "table"]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function tableEnabled(row: Record<string, unknown>): boolean {
  for (const key of ["enabled", "active", "ativa", "selected", "checked", "on"]) {
    if (key in row) return row[key] !== false;
  }
  return true;
}

function buildFeedFromTableHistories(
  rows: Array<{ label: string; key?: string; enabled: boolean; numbers: number[] }>,
  format: string,
  warnings: string[],
): ImportFeedResult {
  const active = rows.filter((r) => r.enabled);
  const tables: PlaytechTestTable[] = active.map((row, index) => ({
    id: index + 1,
    key: row.key ?? slugKey(row.label),
    label: row.label,
  }));
  const idByLabel = new Map(tables.map((t) => [t.label, t.id]));
  const events: PlaytechTestSpinEvent[] = [];

  for (const row of active) {
    const tableId = idByLabel.get(row.label);
    if (tableId == null) continue;
    const chronological = [...row.numbers].reverse();
    chronological.forEach((number, index) => {
      events.push({
        tableId,
        number,
        at: new Date(Date.now() - (chronological.length - index) * 60_000).toISOString(),
      });
    });
  }

  events.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));

  if (events.length === 0) {
    warnings.push("Nenhum giro encontrado — verifique se o export inclui sequências numéricas.");
  }

  return {
    feed: { source: "playtech", tables, events },
    format,
    warnings,
  };
}

function importPanelHistorico(raw: Record<string, unknown>, warnings: string[]): ImportFeedResult | null {
  const historico = raw.historico ?? raw.histories ?? raw.history ?? raw.sequencias ?? raw.sequences;
  if (historico == null || typeof historico !== "object" || Array.isArray(historico)) return null;

  const selectedRaw =
    raw.roletas ??
    raw.selectedTables ??
    raw.mesasAtivas ??
    raw.activeTables ??
    raw.tablesSelected;
  const selected = Array.isArray(selectedRaw)
    ? selectedRaw.filter((v): v is string => typeof v === "string")
    : null;

  const rows = Object.entries(historico as Record<string, unknown>).map(([label, numbers]) => ({
    label,
    enabled: selected ? selected.includes(label) : true,
    numbers: parseNumberList(numbers),
  }));

  return buildFeedFromTableHistories(rows, "panel-historico-map", warnings);
}

function importPanelMesasArray(raw: Record<string, unknown>, warnings: string[]): ImportFeedResult | null {
  const mesas = raw.mesas ?? raw.roletas ?? raw.tables;
  if (!Array.isArray(mesas)) return null;

  const rows = mesas
    .map((item) => {
      if (typeof item === "string") {
        return { label: item, enabled: true, numbers: [] as number[] };
      }
      if (item == null || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = tableLabelFromRecord(row);
      if (!label) return null;
      const numbers = parseNumberList(
        row.numeros ?? row.numbers ?? row.history ?? row.historico ?? row.sequencia ?? row.sequence,
      );
      return {
        label,
        key: typeof row.key === "string" ? row.key : typeof row.id === "string" ? row.id : undefined,
        enabled: tableEnabled(row),
        numbers,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (rows.length === 0) return null;
  return buildFeedFromTableHistories(rows, "panel-mesas-array", warnings);
}

function importEventList(raw: unknown, warnings: string[]): ImportFeedResult | null {
  if (!Array.isArray(raw)) return null;

  const labelSet = new Set<string>();
  const parsed: Array<{ label: string; number: number; at?: string | number }> = [];

  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label =
      tableLabelFromRecord(row) ??
      (typeof row.tableLabel === "string" ? row.tableLabel : null) ??
      (typeof row.table === "string" ? row.table : null);
    const number = asNumber(row.number ?? row.numero ?? row.result ?? row.spin);
    if (!label || number == null || number < 0 || number > 36) continue;
    labelSet.add(label);
    parsed.push({
      label,
      number,
      at:
        typeof row.at === "string" || typeof row.at === "number"
          ? row.at
          : typeof row.timestamp === "string" || typeof row.timestamp === "number"
            ? row.timestamp
            : typeof row.time === "string" || typeof row.time === "number"
              ? row.time
              : undefined,
    });
  }

  if (parsed.length === 0) return null;

  const tables: PlaytechTestTable[] = [...labelSet].map((label, index) => ({
    id: index + 1,
    key: slugKey(label),
    label,
  }));
  const idByLabel = new Map(tables.map((t) => [t.label, t.id]));
  const events: PlaytechTestSpinEvent[] = parsed.map((row) => ({
    tableId: idByLabel.get(row.label)!,
    number: row.number,
    at: row.at,
  }));

  events.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  return { feed: { source: "playtech", tables, events }, format: "event-list", warnings };
}

/** Converte export bruto (painel, scanner, clipboard) → feed normalizado. */
export function importPlaytechFeed(raw: unknown): ImportFeedResult {
  const warnings: string[] = [];

  if (isPlaytechLobbyFeed(raw)) {
    return { feed: raw, format: "playtech-feed", warnings };
  }

  if (Array.isArray(raw)) {
    const fromList = importEventList(raw, warnings);
    if (fromList) return fromList;
  }

  if (raw != null && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    if (Array.isArray(obj.events) && Array.isArray(obj.tables)) {
      const tables = obj.tables as unknown[];
      const events = obj.events as unknown[];
      const normalizedTables: PlaytechTestTable[] = tables
        .map((t, index) => {
          if (t == null || typeof t !== "object") return null;
          const row = t as Record<string, unknown>;
          const label = tableLabelFromRecord(row);
          if (!label) return null;
          const id = asNumber(row.id) ?? index + 1;
          return {
            id,
            key: typeof row.key === "string" ? row.key : slugKey(label),
            label,
          };
        })
        .filter((t): t is PlaytechTestTable => t != null);

      const idSet = new Set(normalizedTables.map((t) => t.id));
      const labelToId = new Map(normalizedTables.map((t) => [t.label, t.id]));
      const normalizedEvents: PlaytechTestSpinEvent[] = [];

      for (const ev of events) {
        if (ev == null || typeof ev !== "object") continue;
        const row = ev as Record<string, unknown>;
        let tableId = asNumber(row.tableId ?? row.table_id ?? row.mesaId);
        if (tableId == null) {
          const label = tableLabelFromRecord(row);
          if (label) tableId = labelToId.get(label) ?? null;
        }
        const number = asNumber(row.number ?? row.numero ?? row.result);
        if (tableId == null || number == null || !idSet.has(tableId)) continue;
        normalizedEvents.push({
          tableId,
          number,
          at:
            typeof row.at === "string" || typeof row.at === "number"
              ? row.at
              : typeof row.timestamp === "string" || typeof row.timestamp === "number"
                ? row.timestamp
                : undefined,
        });
      }

      normalizedEvents.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
      return {
        feed: { source: "playtech", tables: normalizedTables, events: normalizedEvents },
        format: "tables+events",
        warnings,
      };
    }

    const fromHistorico = importPanelHistorico(obj, warnings);
    if (fromHistorico) return fromHistorico;

    const fromMesas = importPanelMesasArray(obj, warnings);
    if (fromMesas) return fromMesas;

    if (Array.isArray(obj.events)) {
      const fromEvents = importEventList(obj.events, warnings);
      if (fromEvents) return fromEvents;
    }
  }

  throw new Error(
    "Formato não reconhecido. Esperado: feed Playtech, mapa historico{mesa:[numeros]}, mesas[] ou events[].",
  );
}
