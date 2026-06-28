import { randomUUID } from "node:crypto";

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { notificationReads, notifications, users } from "@/lib/server/db/schema";

export type NotificationAudience = "all" | "user";

export type UserNotificationDto = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type AdminNotificationDto = {
  id: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  createdAt: string;
};

function userVisibilityFilter(userId: string) {
  return or(eq(notifications.audience, "all"), eq(notifications.targetUserId, userId));
}

export async function listNotificationsForUser(
  userId: string,
  limit = 40,
): Promise<UserNotificationDto[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      createdAt: notifications.createdAt,
      readAt: notificationReads.readAt,
    })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(
        eq(notificationReads.notificationId, notifications.id),
        eq(notificationReads.userId, userId),
      ),
    )
    .where(userVisibilityFilter(userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(
        eq(notificationReads.notificationId, notifications.id),
        eq(notificationReads.userId, userId),
      ),
    )
    .where(and(userVisibilityFilter(userId), isNull(notificationReads.readAt)));

  return Number(row?.count ?? 0);
}

async function upsertNotificationRead(userId: string, notificationId: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(notificationReads)
    .values({ notificationId, userId, readAt: now })
    .onConflictDoUpdate({
      target: [notificationReads.notificationId, notificationReads.userId],
      set: { readAt: now },
    });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const db = getDb();
  const [visible] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), userVisibilityFilter(userId)))
    .limit(1);

  if (!visible) return false;
  await upsertNotificationRead(userId, notificationId);
  return true;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const db = getDb();
  const unread = await db
    .select({ id: notifications.id })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(
        eq(notificationReads.notificationId, notifications.id),
        eq(notificationReads.userId, userId),
      ),
    )
    .where(and(userVisibilityFilter(userId), isNull(notificationReads.readAt)));

  if (unread.length === 0) return 0;

  const now = new Date();
  for (const row of unread) {
    await db
      .insert(notificationReads)
      .values({ notificationId: row.id, userId, readAt: now })
      .onConflictDoUpdate({
        target: [notificationReads.notificationId, notificationReads.userId],
        set: { readAt: now },
      });
  }

  return unread.length;
}

export async function createNotification(input: {
  title: string;
  body: string;
  audience: NotificationAudience;
  targetUserId?: string | null;
  createdByUserId: string;
}): Promise<AdminNotificationDto> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error("Título e mensagem são obrigatórios.");

  if (input.audience === "user") {
    if (!input.targetUserId?.trim()) throw new Error("Selecione o utilizador destinatário.");
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date();

  if (input.audience === "user" && input.targetUserId) {
    const target = await db.query.users.findFirst({
      where: eq(users.id, input.targetUserId),
      columns: { id: true },
    });
    if (!target) throw new Error("Utilizador não encontrado.");
  }

  await db.insert(notifications).values({
    id,
    title,
    body,
    audience: input.audience,
    targetUserId: input.audience === "user" ? input.targetUserId!.trim() : null,
    createdByUserId: input.createdByUserId,
    createdAt: now,
  });

  const rows = await listAdminNotifications(50);
  const created = rows.find((row) => row.id === id);
  if (!created) throw new Error("Notificação criada mas não encontrada.");
  return created;
}

export async function listAdminNotifications(limit = 50): Promise<AdminNotificationDto[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      audience: notifications.audience,
      targetUserId: notifications.targetUserId,
      targetUserName: users.name,
      targetUserEmail: users.email,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.targetUserId, users.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience as NotificationAudience,
    targetUserId: row.targetUserId,
    targetUserName: row.targetUserName,
    targetUserEmail: row.targetUserEmail,
    createdAt: row.createdAt.toISOString(),
  }));
}
