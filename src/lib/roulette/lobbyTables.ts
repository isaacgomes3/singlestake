import { getLiveRouletteTableIds, getPrimaryLiveTableId } from "@/lib/roulette/liveTableConfig";

/**
 * Chave DGA da mesa **Roulette Macao** (Pragmatic). Pode variar por operador — correr `npm run dga:verify-macao`
 * ou `DGA_PROBE_IDS=<id> npm run dga:probe-spins` e ajustar aqui ou via `ROULETTE_MACAO_TABLE_ID` / `VITE_ROULETTE_MACAO_TABLE_ID` no `.env`.
 */
function readRouletteMacaoTableIdFromEnv(): number {
  const viteRaw =
    typeof import.meta !== "undefined" && typeof import.meta.env?.VITE_ROULETTE_MACAO_TABLE_ID === "string"
      ? import.meta.env.VITE_ROULETTE_MACAO_TABLE_ID.trim()
      : "";
  if (viteRaw) {
    const n = parseInt(viteRaw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const nodeRaw =
    typeof process !== "undefined" && typeof process.env?.ROULETTE_MACAO_TABLE_ID === "string"
      ? process.env.ROULETTE_MACAO_TABLE_ID.trim()
      : "";
  if (nodeRaw) {
    const n = parseInt(nodeRaw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 206;
}

export const ROULETTE_MACAO_TABLE_ID = readRouletteMacaoTableIdFromEnv();

/** Duas mesas «clássicas» do lobby (sem Auto Roulette); a terceira posição fixa é a Roulette Macao. */
export const LEGACY_LOBBY_ROULETTE_TABLE_IDS = [234, 227] as const;

/** Índice do cartão Macao em `LOBBY_FIXED_TABLE_IDS` (0-based). */
export const LOBBY_MACAO_SLOT_INDEX = 2;

/** Quatro mesas extra validadas na DGA (Speed/Roulette 3/Roulette 2). */
export const LOBBY_EXTRA_ROULETTE_TABLE_IDS = [203, 230, 205, 201] as const;

/** Roletas regionais Pragmatic (Turca, Russa, Romena, Coreana, Brasileira) — `npm run dga:inspect-table-names`. */
export const LOBBY_REGIONAL_ROULETTE_TABLE_IDS = [224, 221, 233, 213, 237] as const;

/** French la Partage (28401) — fora da sala rotativa / automação (tapete diferente). */
export const ROTATING_ROOM_PREMIUM_TABLE_IDS = [28401] as const;

const LEGACY_LOBBY_ID_SET = new Set<number>(LEGACY_LOBBY_ROULETTE_TABLE_IDS);
const LOBBY_EXTRA_ID_SET = new Set<number>(LOBBY_EXTRA_ROULETTE_TABLE_IDS);
const LOBBY_REGIONAL_ID_SET = new Set<number>(LOBBY_REGIONAL_ROULETTE_TABLE_IDS);
const ROTATING_ROOM_PREMIUM_ID_SET = new Set<number>(ROTATING_ROOM_PREMIUM_TABLE_IDS);

/** Lista fixa dos cartões do lobby (sem duplicar Macao num slot extra). */
export function buildLobbyFixedTableIds(macaoTableId: number = ROULETTE_MACAO_TABLE_ID): number[] {
  const extras = LOBBY_EXTRA_ROULETTE_TABLE_IDS.filter((id) => id !== macaoTableId);
  const regionals = LOBBY_REGIONAL_ROULETTE_TABLE_IDS.filter((id) => id !== macaoTableId);
  return [...LEGACY_LOBBY_ROULETTE_TABLE_IDS, macaoTableId, ...extras, ...regionals];
}

/** Lista estática de referência (fallback SSR / scripts). */
export const LOBBY_FIXED_TABLE_IDS = buildLobbyFixedTableIds() as readonly number[];

/**
 * Alinha o id da Macao ao que o servidor realmente subscreveu (SSE `ready.tableIds`).
 * Ignora ids já ocupados por Latina/R1 ou pelos slots extra fixos (203/230/205/201).
 */
export function resolveMacaoTableIdFromLiveTableIds(liveIds: readonly number[]): number {
  if (liveIds.length === 0) return ROULETTE_MACAO_TABLE_ID;
  if (liveIds.includes(ROULETTE_MACAO_TABLE_ID)) return ROULETTE_MACAO_TABLE_ID;
  const macaoCandidates = liveIds.filter(
    (id) =>
      !LEGACY_LOBBY_ID_SET.has(id) &&
      !LOBBY_EXTRA_ID_SET.has(id) &&
      !LOBBY_REGIONAL_ID_SET.has(id) &&
      !ROTATING_ROOM_PREMIUM_ID_SET.has(id),
  );
  if (macaoCandidates.length === 1) return macaoCandidates[0]!;
  if (macaoCandidates.includes(206)) return 206;
  return ROULETTE_MACAO_TABLE_ID;
}

/** Ids dos cartões com alinhamento dinâmico da Macao ao SSE `ready.tableIds`. */
export function resolveLobbyCardTableIds(liveIds: readonly number[]): number[] {
  const macaoId = resolveMacaoTableIdFromLiveTableIds(liveIds);
  return buildLobbyFixedTableIds(macaoId);
}

/** Speed Roulette 2 (205) — fora do lobby principal; Speed Roulette 1 (203) está na sala rotativa. */
export const ROTATING_ROOM_EXCLUDED_TABLE_IDS = [205] as const;

/**
 * Sala rotativa — lista fechada (ordem do rodízio).
 * Roulette 1, Speed Roulette 1, Roulette 3, Extra Time, Macao (dinâmico), Brasileira, Coreana.
 * French la Partage (28401) excluída — tapete diferente, sem extensão.
 */
export const ROTATING_ROOM_CORE_TABLE_IDS = [227, 203, 230, 201, 237, 213] as const;

/** @deprecated Sala rotativa usa {@link ROTATING_ROOM_CORE_TABLE_IDS} + Macao. */
export const ROTATING_ROOM_REGIONAL_TABLE_IDS = [237] as const;

/** Lista estática da sala rotativa (fallback SSR / antes do SSE). */
export function buildRotatingRoomTableIds(macaoTableId: number = ROULETTE_MACAO_TABLE_ID): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of [227, 203, 230, 201, macaoTableId, 237, 213]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Mesas do rodízio da sala rotativa (lista fechada, filtrada pelo SSE quando disponível). */
export function resolveRotatingRoomTableIds(liveIds: readonly number[]): number[] {
  const macaoId = resolveMacaoTableIdFromLiveTableIds(liveIds);
  const ordered = buildRotatingRoomTableIds(macaoId);
  if (liveIds.length === 0) return ordered;
  const liveSet = new Set(liveIds);
  const available = ordered.filter((id) => liveSet.has(id));
  return available.length > 0 ? available : ordered;
}

/** Fallback estático quando a config ao vivo ainda não carregou. */
export const ROTATING_ROOM_FIXED_TABLE_IDS = buildRotatingRoomTableIds() as readonly number[];

/** Roletas do modo mobile — sala rotativa + Roulette Latina (cada mesa à parte). */
export function buildMobileRouletteTableIds(macaoTableId: number = ROULETTE_MACAO_TABLE_ID): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of [234, ...buildRotatingRoomTableIds(macaoTableId)]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export const MOBILE_ROULETTE_FIXED_TABLE_IDS = buildMobileRouletteTableIds() as readonly number[];

/** Mesas do modo mobile (filtradas pelo SSE quando disponível). */
export function resolveMobileRouletteTableIds(liveIds: readonly number[]): number[] {
  const macaoId = resolveMacaoTableIdFromLiveTableIds(liveIds);
  const ordered = buildMobileRouletteTableIds(macaoId);
  if (liveIds.length === 0) return ordered;
  const liveSet = new Set(liveIds);
  const available = ordered.filter((id) => liveSet.has(id));
  return available.length > 0 ? available : ordered;
}

/** Fornecedor exibido nos cartões mobile. */
export const MOBILE_ROULETTE_PROVIDER_LABEL = "Pragmatic Play";

/** Sala rotativa Ruas 9% (metade alvo): apenas Roulette 1 e Roulette 3. */
export const ROTATING_ROOM_RUAS9_TARGET_HALF_TABLE_IDS = [227, 230] as const;

export function resolveRotatingRoomRuas9TargetHalfTableIds(liveIds: readonly number[]): number[] {
  if (liveIds.length === 0) return [...ROTATING_ROOM_RUAS9_TARGET_HALF_TABLE_IDS];
  const lobbySet = new Set(resolveLobbyCardTableIds(liveIds));
  const available = ROTATING_ROOM_RUAS9_TARGET_HALF_TABLE_IDS.filter(
    (id) => lobbySet.has(id) || liveIds.includes(id),
  );
  return available.length > 0 ? [...available] : [...ROTATING_ROOM_RUAS9_TARGET_HALF_TABLE_IDS];
}

/** Mesas do rodízio conforme a estratégia (Ruas 9% = só metade alvo em R1 e R3). */
export function resolveRotatingRoomTableIdsForStrategy(
  strategy: RotatingRoomStrategyTab,
  liveIds: readonly number[],
): number[] {
  if (strategy === "ruas9pct") return resolveRotatingRoomRuas9TargetHalfTableIds(liveIds);
  return resolveRotatingRoomTableIds(liveIds);
}

export const LOBBY_TABLE_DISPLAY_NAMES: Record<(typeof LOBBY_FIXED_TABLE_IDS)[number], string> = {
  234: "Roulette Latina",
  227: "Roulette 1",
  [ROULETTE_MACAO_TABLE_ID]: "Roulette Macao",
  203: "Speed Roulette 1",
  230: "Roulette 3",
  205: "Speed Roulette 2",
  201: "Roulette 2 Extra Time",
  224: "Roleta Turca",
  221: "Roleta Russa",
  233: "Roleta Romena",
  213: "Korean Roulette",
  237: "Brasileira Roleta",
};

/** Nomes de mesas só na sala rotativa (fora do lobby fixo). */
const ROTATING_ROOM_TABLE_DISPLAY_NAMES: Record<number, string> = {
  28401: "French Roulette la Partage",
};

export function lobbyTableDisplayName(tableId: number, macaoTableId?: number): string {
  const macao =
    macaoTableId ??
    (typeof window !== "undefined"
      ? resolveMacaoTableIdFromLiveTableIds(getLiveRouletteTableIds())
      : ROULETTE_MACAO_TABLE_ID);
  if (tableId === macao) return "Roulette Macao";
  return (
    LOBBY_TABLE_DISPLAY_NAMES[tableId as keyof typeof LOBBY_TABLE_DISPLAY_NAMES] ??
    ROTATING_ROOM_TABLE_DISPLAY_NAMES[tableId] ??
    `Mesa ${tableId}`
  );
}

/**
 * Mesa cujo histórico ao vivo alimenta a vista de estratégia (`?mesa=` ou mesa principal / 1.ª do lobby).
 * Usa a mesma lista dinâmica dos cartões do lobby (Macao alinhada ao SSE).
 */
export function resolveRuas9ViewTableId(searchMesa: number | undefined): number {
  const liveIds = getLiveRouletteTableIds();
  const lobbyIds = resolveLobbyCardTableIds(liveIds);
  if (searchMesa !== undefined && Number.isInteger(searchMesa) && searchMesa > 0) {
    if (lobbyIds.includes(searchMesa)) return searchMesa;
    if (liveIds.includes(searchMesa)) return searchMesa;
  }
  const primary = getPrimaryLiveTableId();
  if (primary !== null && lobbyIds.includes(primary)) return primary;
  return lobbyIds[0] ?? LOBBY_FIXED_TABLE_IDS[0]!;
}

/** Abas de estratégia no lobby (Cassino ao vivo → Roletas). */
export type LobbyRoletasStrategyTab = "um1fator";

/** Legado — rotas directas / sala rotativa antiga; não aparece no menu do lobby. */
export type LobbyRoletasLegacyStrategyTab = "ruas9pct" | "ruas25pct" | "nums28pct";

export type RotatingRoomStrategyTab = LobbyRoletasStrategyTab | LobbyRoletasLegacyStrategyTab;

/** Ordem no menu. */
export const LOBBY_ROLETAS_STRATEGY_MENU_ORDER: readonly LobbyRoletasStrategyTab[] = ["um1fator"];

export const DEFAULT_LOBBY_ROLETAS_STRATEGY: LobbyRoletasStrategyTab = "um1fator";

const LOBBY_ROLETAS_STRATEGY_STORAGE_KEY = "roulette.lobby.roletasStrategy.v3";

export function readLobbyRoletasStrategyTab(): LobbyRoletasStrategyTab {
  return DEFAULT_LOBBY_ROLETAS_STRATEGY;
}

export function writeLobbyRoletasStrategyTab(tab: LobbyRoletasStrategyTab): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LOBBY_ROLETAS_STRATEGY_STORAGE_KEY, tab);
}

/** Ao sair do tapete de estratégia, o lobby reabre na estratégia por defeito. */
export function markLobbyReturnToDefaultStrategy(): void {
  writeLobbyRoletasStrategyTab(DEFAULT_LOBBY_ROLETAS_STRATEGY);
}

/** @deprecated Use {@link markLobbyReturnToDefaultStrategy}. */
export function markLobbyReturnToFatoresStrategy(): void {
  markLobbyReturnToDefaultStrategy();
}
