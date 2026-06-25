import type { UserReferralRecord } from "@/lib/back-office/admin-types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchUsersWithReferralLinks(): Promise<UserReferralRecord[]> {
  const res = await fetch("/api/back-office/users", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; users?: UserReferralRecord[]; error?: string }>(res);
  if (!res.ok || !data?.ok) return [];
  return data.users ?? [];
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
