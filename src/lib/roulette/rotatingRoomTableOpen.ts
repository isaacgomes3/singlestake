import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";

/** Parâmetros de rota para abrir a mesa na app (`/casino-mesa`). */
export function rotatingRoomCasinoMesaSearch(tableId: number): { mesa: number } {
  return { mesa: tableId };
}

/** URL externa do casino (embed), se configurada. */
export function rotatingRoomTableEmbedUrl(tableId: number): string | null {
  return getCasinoEmbedUrlForTable(tableId);
}

function isExternalOperatorUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (typeof window !== "undefined" && u.origin === window.location.origin && u.pathname.includes("/casino-mesa")) {
      return false;
    }
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** URL do operador válida para modo mobile (nunca rota interna `/casino-mesa`). */
export function mobileRotatingRoomOperatorUrl(tableId: number): string | null {
  const embed = rotatingRoomTableEmbedUrl(tableId);
  if (!embed || !isExternalOperatorUrl(embed)) return null;
  return embed;
}

/** Melhor destino para abrir a roleta: embed directo ou rota interna. */
export function rotatingRoomTableOpenTarget(tableId: number): {
  kind: "embed" | "app";
  href: string;
} {
  const embed = rotatingRoomTableEmbedUrl(tableId);
  if (embed) return { kind: "embed", href: embed };
  return { kind: "app", href: `/casino-mesa?mesa=${tableId}` };
}

/**
 * Modo mobile / só sinal: abre só o site do operador (URL configurada).
 * Nunca usa `/casino-mesa` com iframe interno.
 */
export function openMobileRotatingRoomTable(tableId: number): boolean {
  const embed = mobileRotatingRoomOperatorUrl(tableId);
  if (!embed) return false;
  window.open(embed, "_blank", "noopener,noreferrer");
  return true;
}
