import { buildClearSessionCookie, getSessionIdFromRequest, isSecureRequest } from "@/lib/server/auth/cookies";
import { deleteHttpSession, resolveSessionUser } from "@/lib/server/auth/http-session";
import type { SessionUser } from "@/lib/server/auth/http-session";

export const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", JSON_HEADERS["Content-Type"]);
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function readJsonBody<T extends Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function requireSessionUser(request: Request): Promise<SessionUser | null> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;
  return resolveSessionUser(sessionId);
}

export function closeUserSession(request: Request): Response {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) {
    void deleteHttpSession(sessionId);
  }
  return jsonResponse({ ok: true }, { headers: { "Set-Cookie": buildClearSessionCookie(isSecureRequest(request)) } });
}

export async function toAuthUser(user: SessionUser, origin?: string) {
  const { buildAuthUserPayload } = await import("@/lib/server/finance/account-access");
  return buildAuthUserPayload(user, origin);
}
