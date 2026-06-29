import { sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { binaryLegPoints, ledgerEntries, systemSettings } from "@/lib/server/db/schema";
import { refreshExpiredSubscriptions, getSubscriptionAccess } from "@/lib/server/finance/subscription-access";

const LAST_RESET_KEY = "last_binary_points_reset_ymd";

export function getBinaryResetTimezone(): string {
  return process.env.BINARY_RESET_TZ ?? "America/Sao_Paulo";
}

export function getBinaryResetSchedule(): { hour: number; minute: number } {
  const hour = Number(process.env.BINARY_RESET_HOUR ?? "1");
  const minute = Number(process.env.BINARY_RESET_MINUTE ?? "0");
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 1,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  };
}

export async function getLastBinaryResetYmd(): Promise<string | null> {
  const db = getDb();
  const row = await db.query.systemSettings.findFirst({
    where: (t, { eq }) => eq(t.key, LAST_RESET_KEY),
  });
  if (!row) return null;
  try {
    return JSON.parse(row.valueJson) as string;
  } catch {
    return null;
  }
}

export async function setLastBinaryResetYmd(ymd: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(systemSettings)
    .values({
      key: LAST_RESET_KEY,
      valueJson: JSON.stringify(ymd),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        valueJson: sql`excluded.value_json`,
        updatedAt: now,
      },
    });
}

/** Zera pontos de quem já recebeu binário e de contas com mensalidade vencida (01h). */
export async function resetBinaryPointsDaily(): Promise<{
  usersReset: number;
  rowsCleared: number;
}> {
  await refreshExpiredSubscriptions();
  const db = getDb();

  const paidUsers = await db
    .selectDistinct({ userId: ledgerEntries.userId })
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.referenceType} = 'binary_bonus'`);

  const paidSet = new Set(paidUsers.map((r) => r.userId));

  const allPointRows = await db.query.binaryLegPoints.findMany();
  const usersToReset = new Set<string>();

  for (const row of allPointRows) {
    if (paidSet.has(row.userId) || row.matchedPoints > 0) {
      usersToReset.add(row.userId);
    }
  }

  for (const userId of usersToReset) {
    const access = await getSubscriptionAccess(userId);
    if (!access.active) {
      await db.delete(binaryLegPoints).where(sql`${binaryLegPoints.userId} = ${userId}`);
      continue;
    }
    await db
      .update(binaryLegPoints)
      .set({
        totalPoints: 0,
        matchedPoints: 0,
        updatedAt: new Date(),
      })
      .where(sql`${binaryLegPoints.userId} = ${userId}`);
  }

  for (const row of allPointRows) {
    if (usersToReset.has(row.userId)) continue;
    const access = await getSubscriptionAccess(row.userId);
    if (!access.active) {
      usersToReset.add(row.userId);
      await db.delete(binaryLegPoints).where(sql`${binaryLegPoints.userId} = ${row.userId}`);
    }
  }

  return { usersReset: usersToReset.size, rowsCleared: allPointRows.length };
}
