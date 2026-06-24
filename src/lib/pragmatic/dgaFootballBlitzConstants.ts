/** Variantes Football Blitz / Top Card no DGA Pragmatic. */
export type FootballBlitzTableVariant = "super-trunfo" | "top-card";

export type FootballBlitzTableConfig = {
  variant: FootballBlitzTableVariant;
  tableKey: number;
  displayName: string;
  lobbyBg: string;
  route: "/super-trunfo" | "/football-blitz";
};

/** Super Trunfo Futebol Latino — mesa 4022. */
export const FOOTBALL_BLITZ_SUPER_TRUNFO: FootballBlitzTableConfig = {
  variant: "super-trunfo",
  tableKey: 4022,
  displayName: "Super Trunfo Futebol Latino",
  lobbyBg: "/lobby/super-trunfo-futebol-latino.png",
  route: "/super-trunfo",
};

/** Football Blitz Top Card — mesa 4001. */
export const FOOTBALL_BLITZ_TOP_CARD: FootballBlitzTableConfig = {
  variant: "top-card",
  tableKey: 4001,
  displayName: "Football Blitz Top Card",
  lobbyBg: "/lobby/football-blitz-top-card.png",
  route: "/football-blitz",
};

export const FOOTBALL_BLITZ_TABLES: Record<FootballBlitzTableVariant, FootballBlitzTableConfig> = {
  "super-trunfo": FOOTBALL_BLITZ_SUPER_TRUNFO,
  "top-card": FOOTBALL_BLITZ_TOP_CARD,
};

/** Mesas ligadas ao hub SSE (ordem: Super Trunfo, Top Card). */
export const DGA_FOOTBALL_BLITZ_TABLE_KEYS: readonly number[] = [
  FOOTBALL_BLITZ_SUPER_TRUNFO.tableKey,
  FOOTBALL_BLITZ_TOP_CARD.tableKey,
];

export function getFootballBlitzTableByKey(tableKey: number): FootballBlitzTableConfig | null {
  if (tableKey === FOOTBALL_BLITZ_SUPER_TRUNFO.tableKey) return FOOTBALL_BLITZ_SUPER_TRUNFO;
  if (tableKey === FOOTBALL_BLITZ_TOP_CARD.tableKey) return FOOTBALL_BLITZ_TOP_CARD;
  return null;
}

/** Retrocompat: Super Trunfo (4022). */
export const DGA_FOOTBALL_BLITZ_DEFAULT_TABLE_KEY = FOOTBALL_BLITZ_SUPER_TRUNFO.tableKey;
export const DGA_FOOTBALL_BLITZ_DISPLAY_NAME = FOOTBALL_BLITZ_SUPER_TRUNFO.displayName;
export const DGA_FOOTBALL_BLITZ_LOBBY_BG = FOOTBALL_BLITZ_SUPER_TRUNFO.lobbyBg;
