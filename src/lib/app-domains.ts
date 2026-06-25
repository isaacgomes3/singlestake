/** Hostnames de produção onde a app e a extensão Chrome comunicam. */
export const APP_PRODUCTION_HOSTNAMES = [
  "stake37.com.br",
  "www.stake37.com.br",
  "singlestake.bet.br",
  "www.singlestake.bet.br",
] as const;

export function isAppProductionHostname(hostname: string): boolean {
  return (APP_PRODUCTION_HOSTNAMES as readonly string[]).includes(hostname);
}

export function isLikelyExtensionBridgeOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) return true;
    if (u.hostname === "roleta.poupexplay.com" || u.hostname.endsWith(".poupexplay.com")) return true;
    if (u.hostname === "br4.bet.br" || u.hostname.endsWith(".br4.bet.br")) return true;
    if (isAppProductionHostname(u.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}
