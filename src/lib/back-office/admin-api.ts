import type { PendingActivationRecord, UserReferralRecord } from "@/lib/back-office/admin-types";

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

export async function fetchPendingActivations(): Promise<PendingActivationRecord[]> {
  const res = await fetch("/api/back-office/admin/pending-activations", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; rows?: PendingActivationRecord[]; error?: string }>(res);
  if (!res.ok || !data?.ok) return [];
  return data.rows ?? [];
}

export async function approvePendingActivation(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/admin/pending-activations/${orderId}/approve`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível confirmar o PIX." };
  }
  return { ok: true };
}

export async function activateStartPackManual(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/admin/users/${userId}/activate-start`, {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível activar a conta." };
  }
  return { ok: true };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
