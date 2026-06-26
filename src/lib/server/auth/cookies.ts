export const SESSION_COOKIE_NAME = "singlestake_session";

const THIRTY_DAYS_SEC = 60 * 60 * 24 * 30;

export function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionIdFromRequest(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const id = cookies[SESSION_COOKIE_NAME]?.trim();
  return id || null;
}

/** Deteta HTTPS atrás de Nginx (X-Forwarded-Proto). */
export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function cookieBase(secure: boolean): string {
  const secureFlag = secure ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secureFlag}`;
}

export function buildSessionCookie(
  sessionId: string,
  maxAgeSec = THIRTY_DAYS_SEC,
  secure = process.env.NODE_ENV === "production",
): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; ${cookieBase(secure)}; Max-Age=${maxAgeSec}`;
}

export function buildClearSessionCookie(secure = process.env.NODE_ENV === "production"): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieBase(secure)}; Max-Age=0`;
}
