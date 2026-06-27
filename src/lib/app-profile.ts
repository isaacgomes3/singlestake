/** Perfil de deploy — back office (produção) vs automação (sandbox operacional). */
export type AppProfile = "backoffice" | "automation";

/** Entrada por defeito no host de automação. */
export const AUTOMATION_DEFAULT_ENTRY = "/sala-rotativa-um-fator";

/** Hostnames que servem só automação (runtime no browser). */
export const AUTOMATION_HOSTNAMES = [
  "auto.stake37.com.br",
  "roleta.poupexplay.com",
] as const;

function readEnvProfile(): AppProfile | null {
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_PROFILE) ||
    (typeof process !== "undefined" && process.env?.APP_PROFILE);
  if (raw === "automation") return "automation";
  if (raw === "backoffice") return "backoffice";
  return null;
}

/** Perfil activo — servidor usa `APP_PROFILE`; cliente usa hostname ou `VITE_APP_PROFILE`. */
export function resolveAppProfile(hostname?: string | null): AppProfile {
  const fromEnv = readEnvProfile();
  if (fromEnv) return fromEnv;
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : null);
  if (host && (AUTOMATION_HOSTNAMES as readonly string[]).includes(host)) {
    return "automation";
  }
  return "backoffice";
}

export function isAutomationProfile(hostname?: string | null): boolean {
  return resolveAppProfile(hostname) === "automation";
}

export function isBackofficeProfile(hostname?: string | null): boolean {
  return !isAutomationProfile(hostname);
}

/** URL pública do ambiente de automação (subdomínio). */
export function getAutomationPublicOrigin(): string | null {
  const fromEnv =
    (typeof import.meta !== "undefined" &&
      (import.meta.env.VITE_AUTOMATION_PUBLIC_URL as string | undefined)) ||
    (typeof process !== "undefined" && process.env.PUBLIC_AUTOMATION_URL);
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if ((AUTOMATION_HOSTNAMES as readonly string[]).includes(host)) {
      return window.location.origin;
    }
  }
  return null;
}

/** Link para workspace de automação — no back office aponta para o subdomínio. */
export function automationWorkspaceHref(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isAutomationProfile()) return normalized;
  const origin = getAutomationPublicOrigin();
  if (!origin) return normalized;
  return `${origin}${normalized}`;
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
