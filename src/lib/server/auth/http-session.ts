import { randomUUID } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { sessions, users } from "@/lib/server/db/schema";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  referralCode: string;
};

export async function createHttpSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
  const db = getDb();
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: new Date(),
  });
  return { sessionId, expiresAt };
}

export async function deleteHttpSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function resolveSessionUser(sessionId: string): Promise<SessionUser | null> {
  const db = getDb();
  const row = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())),
    with: {
      user: true,
    },
  });

  const user = row?.user;
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    referralCode: user.referralCode,
  };
}
