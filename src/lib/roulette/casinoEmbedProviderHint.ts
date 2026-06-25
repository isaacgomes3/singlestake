/** Provedor do jogo no operador (path /play/...). */
export type CasinoEmbedProvider = "playtech" | "pragmatic" | "outro";

export function casinoEmbedProviderFromUrl(url: string | null | undefined): CasinoEmbedProvider {
  if (!url) return "outro";
  const lower = url.toLowerCase();
  if (lower.includes("/play/playtech")) return "playtech";
  if (lower.includes("/play/pragmatic")) return "pragmatic";
  return "outro";
}

export function casinoEmbedPathLabel(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname + (u.search ? u.search : "");
  } catch {
    return url.slice(0, 80);
  }
}

export function casinoEmbedProviderLabel(provider: CasinoEmbedProvider): string {
  switch (provider) {
    case "playtech":
      return "Playtech";
    case "pragmatic":
      return "Pragmatic";
    default:
      return "Operador";
  }
}
