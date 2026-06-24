import {
  streetBetTargetsFromActive,
  type StreetStrategyActive,
} from "@/lib/roulette/streetStrategy";

/** Identificador estável em `postMessage` para a página pai filtrar mensagens. */
export const CASINO_MESA_RUAS9_BRIDGE_MESSAGE_TYPE = "game-odds-glow/casino-mesa/ruas9" as const;

export const CASINO_MESA_RUAS9_BRIDGE_VERSION = 1 as const;

export type CasinoMesaRuas9BridgeActivePayload = {
  zone: StreetStrategyActive["zone"];
  excludedStreetIds: number[];
  triggerKind: StreetStrategyActive["triggerKind"];
  triggerNewerNumber: number;
  gatilhoTriple: readonly [number, number, number];
  /** Ruas a cobrir nas transversais (sem caixa exterior). */
  streetIdsForBet: number[];
  /** Metade da caixa exterior (ficha única). */
  outsideZone: StreetStrategyActive["zone"];
};

export type CasinoMesaRuas9BridgePayload = {
  type: typeof CASINO_MESA_RUAS9_BRIDGE_MESSAGE_TYPE;
  version: typeof CASINO_MESA_RUAS9_BRIDGE_VERSION;
  tableId: number;
  /** Giro mais recente no histórico local (mesma ordem que o resto da app: índice 0 = último). */
  lastSpin: number | null;
  active: CasinoMesaRuas9BridgeActivePayload | null;
};

/**
 * `true` quando a página corre dentro de um `<iframe>` (não é a janela de topo).
 * Útil para só enviar `postMessage` ao pai quando faz sentido.
 */
export function isPageEmbeddedInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function parseOptionalHttpOrigin(input: string | null | undefined): string | null {
  if (input == null || !String(input).trim()) return null;
  try {
    const u = new URL(String(input).trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

export const CASINO_MESA_IFRAME_PARENT_STORAGE_KEY = "roulette.casinoMesaIframeParentOrigin" as const;

/** Origem guardada no dispositivo (secção «URL» em `/casino-mesa`). */
export function readUserCasinoMesaIframeParentOrigin(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CASINO_MESA_IFRAME_PARENT_STORAGE_KEY);
    return parseOptionalHttpOrigin(raw ?? undefined);
  } catch {
    return null;
  }
}

/** Aceita URL completa ou só origem; guarda o texto normalizado como origem. */
export function writeUserCasinoMesaIframeParentOrigin(urlOrOrigin: string): void {
  if (typeof localStorage === "undefined") return;
  const trimmed = urlOrOrigin.trim();
  if (!trimmed) {
    localStorage.removeItem(CASINO_MESA_IFRAME_PARENT_STORAGE_KEY);
    return;
  }
  const origin = parseOptionalHttpOrigin(trimmed);
  if (!origin) throw new Error("Origem inválida (use https://…)");
  localStorage.setItem(CASINO_MESA_IFRAME_PARENT_STORAGE_KEY, origin);
}

export function clearUserCasinoMesaIframeParentOrigin(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CASINO_MESA_IFRAME_PARENT_STORAGE_KEY);
}

/**
 * Origem do pai para `postMessage` (sem path).
 * Ordem: `parentOrigin` na query; depois valor guardado em localStorage; depois `VITE_CASINO_MESA_PARENT_ORIGIN` no build.
 */
export function resolveCasinoMesaParentPostTargetOrigin(options: {
  searchParentOrigin?: string | null;
  storedParentOrigin?: string | null;
}): string | null {
  const fromSearch = parseOptionalHttpOrigin(options.searchParentOrigin);
  if (fromSearch) return fromSearch;
  const fromStored = parseOptionalHttpOrigin(options.storedParentOrigin);
  if (fromStored) return fromStored;
  const env = import.meta.env.VITE_CASINO_MESA_PARENT_ORIGIN as string | undefined;
  if (typeof env === "string" && env.trim()) {
    return parseOptionalHttpOrigin(env.trim());
  }
  return null;
}

export function buildCasinoMesaRuas9BridgePayload(
  tableId: number,
  active: StreetStrategyActive | null,
  historyNewestFirst: readonly number[],
): CasinoMesaRuas9BridgePayload {
  const lastSpin = historyNewestFirst.length > 0 ? historyNewestFirst[0]! : null;
  if (!active) {
    return {
      type: CASINO_MESA_RUAS9_BRIDGE_MESSAGE_TYPE,
      version: CASINO_MESA_RUAS9_BRIDGE_VERSION,
      tableId,
      lastSpin,
      active: null,
    };
  }
  const { streetIds, outsideZone } = streetBetTargetsFromActive(active);
  return {
    type: CASINO_MESA_RUAS9_BRIDGE_MESSAGE_TYPE,
    version: CASINO_MESA_RUAS9_BRIDGE_VERSION,
    tableId,
    lastSpin,
    active: {
      zone: active.zone,
      excludedStreetIds: [...active.excludedStreetIds],
      triggerKind: active.triggerKind,
      triggerNewerNumber: active.triggerNewerNumber,
      gatilhoTriple: active.gatilhoTriple,
      streetIdsForBet: streetIds,
      outsideZone,
    },
  };
}

export function isCasinoMesaRuas9BridgePayload(data: unknown): data is CasinoMesaRuas9BridgePayload {
  if (data === null || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === CASINO_MESA_RUAS9_BRIDGE_MESSAGE_TYPE &&
    o.version === CASINO_MESA_RUAS9_BRIDGE_VERSION &&
    typeof o.tableId === "number" &&
    Number.isInteger(o.tableId) &&
    (o.lastSpin === null || (typeof o.lastSpin === "number" && Number.isInteger(o.lastSpin)))
  );
}
