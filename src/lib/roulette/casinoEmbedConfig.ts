/**
 * URLs embutidas por defeito (operador br4.bet / Pragmatic).
 * Com `VITE_CASINO_OPERATOR=ice` usa {@link ICE_CASINO_TABLE_EMBED_URLS}.
 * Sobrescritas por `VITE_CASINO_TABLE_EMBED_URLS` (build) ou URL guardada no browser (localStorage).
 */
import {
  ICE_CASINO_TABLE_EMBED_URLS,
} from "@/lib/roulette/casinoEmbedIceDefaults";

const BR4_DEFAULT_TABLE_EMBED_URLS: Record<number, string> = {
  /** Sala rotativa + lobby — mesmos links do `.env.example` */
  227: "https://br4.bet.br/play/pragmatic/roulette-1",
  203: "https://br4.bet.br/play/pragmatic/speed-roulette-1",
  230: "https://br4.bet.br/play/pragmatic/roulette-3",
  201: "https://br4.bet.br/play/pragmatic/roulette-2-extra-time",
  206: "https://br4.bet.br/play/pragmatic/roulette-macao",
  237: "https://br4.bet.br/play/pragmatic/roleta-brasileira",
  213: "https://br4.bet.br/play/pragmatic/korean-roulette",
};

function readCasinoOperator(): string | undefined {
  const fromVite =
    typeof import.meta !== "undefined" && typeof import.meta.env?.VITE_CASINO_OPERATOR === "string"
      ? import.meta.env.VITE_CASINO_OPERATOR.trim()
      : undefined;
  if (fromVite) return fromVite;
  return typeof process !== "undefined" && typeof process.env?.VITE_CASINO_OPERATOR === "string"
    ? process.env.VITE_CASINO_OPERATOR.trim()
    : undefined;
}

function defaultTableEmbedUrls(): Record<number, string> {
  return readCasinoOperator() === "ice"
    ? { ...ICE_CASINO_TABLE_EMBED_URLS }
    : { ...BR4_DEFAULT_TABLE_EMBED_URLS };
}

const VITE_TABLE_EMBED = (() => {
  const fromVite =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env?.VITE_CASINO_TABLE_EMBED_URLS === "string"
      ? import.meta.env.VITE_CASINO_TABLE_EMBED_URLS
      : undefined;
  if (fromVite) return fromVite;
  return typeof process !== "undefined" &&
    typeof process.env?.VITE_CASINO_TABLE_EMBED_URLS === "string"
    ? process.env.VITE_CASINO_TABLE_EMBED_URLS
    : undefined;
})();

const USER_STORAGE_KEY = "roulette.casinoEmbedUrlsByTable";

function parseEnvEmbedMap(): Record<number, string> {
  if (!VITE_TABLE_EMBED || typeof VITE_TABLE_EMBED !== "string") return {};
  try {
    const o = JSON.parse(VITE_TABLE_EMBED) as Record<string, unknown>;
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(o)) {
      const id = Number(k);
      if (!Number.isInteger(id) || id <= 0) continue;
      if (typeof v !== "string" || !v.trim()) continue;
      out[id] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function readUserEmbedMap(): Record<number, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(o)) {
      const id = Number(k);
      if (!Number.isInteger(id) || id <= 0) continue;
      if (typeof v !== "string" || !v.trim()) continue;
      out[id] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function readUserCasinoEmbedUrl(tableId: number): string | null {
  const u = readUserEmbedMap()[tableId];
  return u && isAllowedHttpUrl(u) ? u : null;
}

export function writeUserCasinoEmbedUrl(tableId: number, url: string): void {
  if (typeof localStorage === "undefined") return;
  const trimmed = url.trim();
  const map = readUserEmbedMap();
  if (!trimmed) {
    delete map[tableId];
  } else if (isAllowedHttpUrl(trimmed)) {
    map[tableId] = trimmed;
  } else {
    throw new Error("URL inválida");
  }
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(map));
}

export function clearUserCasinoEmbedUrl(tableId: number): void {
  writeUserCasinoEmbedUrl(tableId, "");
}

function isAllowedHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Ordem: URL do utilizador → variável de ambiente → URLs por defeito no código. */
export function getCasinoEmbedUrlForTable(tableId: number): string | null {
  const user = readUserCasinoEmbedUrl(tableId);
  if (user) return user;
  const fromEnv = parseEnvEmbedMap()[tableId];
  if (fromEnv && isAllowedHttpUrl(fromEnv)) return fromEnv;
  const builtin = defaultTableEmbedUrls()[tableId];
  return builtin && isAllowedHttpUrl(builtin) ? builtin : null;
}

/** Mapa mesa → URL (utilizador + env + defaults). */
export function readAllCasinoEmbedUrlMap(): Record<number, string> {
  const merged: Record<number, string> = { ...defaultTableEmbedUrls() };
  for (const [k, v] of Object.entries(parseEnvEmbedMap())) {
    merged[Number(k)] = v;
  }
  for (const [k, v] of Object.entries(readUserEmbedMap())) {
    merged[Number(k)] = v;
  }
  return merged;
}
