import type { AuthUser } from "@/lib/auth/session";
import type { BackOfficeOverview } from "@/lib/back-office/types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson<{ ok: boolean; user?: AuthUser; error?: string }>(res);
  if (!res.ok || !data?.ok || !data.user) {
    return { ok: false, error: data?.error ?? "Não foi possível entrar." };
  }
  return { ok: true, user: data.user };
}

export async function apiRegister(input: {
  name: string;
  email: string;
  password: string;
  referralCode?: string;
}): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ ok: boolean; user?: AuthUser; error?: string }>(res);
  if (!res.ok || !data?.ok || !data.user) {
    return { ok: false, error: data?.error ?? "Não foi possível criar a conta." };
  }
  return { ok: true, user: data.user };
}

export async function apiLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function apiFetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  const data = await parseJson<{ ok: boolean; user?: AuthUser }>(res);
  if (!res.ok || !data?.ok || !data.user) return null;
  return data.user;
}

export async function apiFetchOverview(): Promise<BackOfficeOverview | null> {
  const res = await fetch("/api/back-office/overview", { credentials: "include" });
  if (res.status === 401) return null;
  const data = await parseJson<{ ok: boolean; overview?: BackOfficeOverview }>(res);
  if (!res.ok || !data?.ok || !data.overview) return null;
  return data.overview;
}
