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

function cookieBase(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function buildSessionCookie(sessionId: string, maxAgeSec = THIRTY_DAYS_SEC): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; ${cookieBase()}; Max-Age=${maxAgeSec}`;
}

export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieBase()}; Max-Age=0`;
}
