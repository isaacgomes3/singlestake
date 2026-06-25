/** Feed exportado pelo sistema de varredura Playtech (independente da API DGA Pragmatic). */

export type PlaytechTestTable = {
  /** ID numérico local só para este teste — não é ID DGA. */
  id: number;
  /** Chave no lobby Playtech (opcional, para documentação). */
  key?: string;
  label: string;
};

export type PlaytechTestSpinEvent = {
  tableId: number;
  number: number;
  at?: string | number;
};

export type PlaytechLobbyFeed = {
  source: "playtech";
  tables: PlaytechTestTable[];
  events: PlaytechTestSpinEvent[];
};

export function isPlaytechLobbyFeed(raw: unknown): raw is PlaytechLobbyFeed {
  if (raw === null || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return o.source === "playtech" && Array.isArray(o.tables) && Array.isArray(o.events);
}
