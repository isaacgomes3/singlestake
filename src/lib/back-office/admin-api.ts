import type {
  AdminUserRecord,
  PendingActivationRecord,
  PendingAutomationPixRecord,
  PixKeyProfileDto,
} from "@/lib/back-office/admin-types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchUsersWithReferralLinks(): Promise<AdminUserRecord[]> {
  const res = await fetch("/api/back-office/users", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; users?: AdminUserRecord[]; error?: string }>(res);
  if (!res.ok || !data?.ok) return [];
  return data.users ?? [];
}

export async function fetchPendingActivations(): Promise<{
  startRows: PendingActivationRecord[];
  automationRows: PendingAutomationPixRecord[];
}> {
  const res = await fetch("/api/back-office/admin/pending-activations", { credentials: "include" });
  const data = await parseJson<{
    ok: boolean;
    rows?: PendingActivationRecord[];
    automationRows?: PendingAutomationPixRecord[];
    error?: string;
  }>(res);
  if (!res.ok || !data?.ok) return { startRows: [], automationRows: [] };
  return { startRows: data.rows ?? [], automationRows: data.automationRows ?? [] };
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

export async function activateAutomationManual(
  userId: string,
  amount = 250,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/admin/users/${userId}/activate-automation`, {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ amount }),
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível activar a automação." };
  }
  return { ok: true };
}

export async function blockUser(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/admin/users/${userId}/block`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível bloquear." };
  }
  return { ok: true };
}

export async function unblockUser(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/admin/users/${userId}/unblock`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível desbloquear." };
  }
  return { ok: true };
}

export async function deleteUser(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/admin/users/${userId}/delete`, {
    method: "POST",
    credentials: "include",
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível remover." };
  }
  return { ok: true };
}

export async function allowPixKeyEdit(
  userId: string,
  allowed = true,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/admin/users/${userId}/allow-pix-edit`, {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ allowed }),
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível actualizar permissão PIX." };
  }
  return { ok: true };
}

export async function adminSetUserPixKey(
  userId: string,
  pixKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/admin/users/${userId}/pix-key`, {
    method: "PUT",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ pixKey }),
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível guardar a chave PIX." };
  }
  return { ok: true };
}

export async function fetchPixKeyProfile(): Promise<PixKeyProfileDto | null> {
  const res = await fetch("/api/back-office/profile/pix-key", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; profile?: PixKeyProfileDto }>(res);
  if (!res.ok || !data?.ok || !data.profile) return null;
  return data.profile;
}

export async function savePixKeyProfile(
  pixKey: string,
): Promise<{ ok: true; profile: PixKeyProfileDto } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/profile/pix-key", {
    method: "PUT",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ pixKey }),
  });
  const data = await parseJson<{ ok: boolean; profile?: PixKeyProfileDto; error?: string }>(res);
  if (!res.ok || !data?.ok || !data.profile) {
    return { ok: false, error: data?.error ?? "Não foi possível guardar a chave PIX." };
  }
  return { ok: true, profile: data.profile };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
