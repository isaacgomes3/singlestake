import type {
  AdminNotificationRecord,
  UserNotificationRecord,
} from "@/lib/back-office/notifications-types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchUserNotifications(): Promise<{
  notifications: UserNotificationRecord[];
  unreadCount: number;
}> {
  const res = await fetch("/api/back-office/notifications", { credentials: "include" });
  const data = await parseJson<{
    ok: boolean;
    notifications?: UserNotificationRecord[];
    unreadCount?: number;
  }>(res);
  if (!res.ok || !data?.ok) {
    return { notifications: [], unreadCount: 0 };
  }
  return {
    notifications: data.notifications ?? [],
    unreadCount: data.unreadCount ?? 0,
  };
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const res = await fetch("/api/back-office/notifications", {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ action: "markAllRead" }),
  });
  const data = await parseJson<{ ok: boolean }>(res);
  return res.ok && data?.ok === true;
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const res = await fetch("/api/back-office/notifications", {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ action: "markRead", notificationId }),
  });
  const data = await parseJson<{ ok: boolean }>(res);
  return res.ok && data?.ok === true;
}

export async function fetchAdminNotifications(): Promise<AdminNotificationRecord[]> {
  const res = await fetch("/api/back-office/admin/notifications", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; notifications?: AdminNotificationRecord[] }>(res);
  if (!res.ok || !data?.ok) return [];
  return data.notifications ?? [];
}

export async function sendAdminNotification(input: {
  title: string;
  body: string;
  audience: "all" | "user";
  targetUserId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/admin/notifications", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível enviar a notificação." };
  }
  return { ok: true };
}
