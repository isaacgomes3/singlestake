/**
 * URL do cliente Pragmatic / operador para embutir a mesa num iframe (HUD por cima nesta app).
 * Formato JSON no .env: {"225":"https://...","226":"https://..."}
 */
const VITE_TABLE_EMBED = import.meta.env.VITE_CASINO_TABLE_EMBED_URLS as string | undefined;

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

/** Ordem: URL definida pelo utilizador no dispositivo; depois variável de ambiente. */
export function getCasinoEmbedUrlForTable(tableId: number): string | null {
  const user = readUserCasinoEmbedUrl(tableId);
  if (user) return user;
  const fromEnv = parseEnvEmbedMap()[tableId];
  return fromEnv && isAllowedHttpUrl(fromEnv) ? fromEnv : null;
}
