export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  referralCode: string;
  referralLink?: string;
};

export type AuthSession = {
  user: AuthUser;
  issuedAt: number;
};

const SESSION_KEY = "singlestake-auth-session";

export const DEV_SEED_EMAIL = "admin@singlestake.local";
export const DEV_SEED_PASSWORD = "123456";

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession() != null;
}

export function setSession(user: AuthUser): void {
  if (typeof window === "undefined") return;
  const session: AuthSession = { user, issuedAt: Date.now() };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new Error("STORAGE_BLOCKED");
  }
}

export function loginRedirectPath(fallback = "/back-office"): string {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  if (redirect && redirect.startsWith("/back-office")) return redirect;
  return fallback;
}

export function goToLogin(redirectTo?: string): void {
  if (typeof window === "undefined") return;
  const path = redirectTo && redirectTo.startsWith("/back-office") ? redirectTo : "/back-office";
  const url = new URL("/entrar", window.location.origin);
  url.searchParams.set("redirect", path);
  window.location.replace(url.pathname + url.search);
}

export function getDevLoginHint(): string | null {
  if (!import.meta.env.DEV) return null;
  return `${DEV_SEED_EMAIL} / ${DEV_SEED_PASSWORD}`;
}

export function goAfterAuth(target = "/back-office"): void {
  if (typeof window === "undefined") return;
  window.location.assign(target);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}
