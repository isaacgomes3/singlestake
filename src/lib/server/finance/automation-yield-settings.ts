import { sql } from "drizzle-orm";

import {
  AUTOMATION_MAX_DAILY_YIELD_PCT,
  AUTOMATION_YIELD_SETTING_KEY,
} from "@/lib/back-office/product-constants";
import { getDb } from "@/lib/server/db/client";
import { systemSettings } from "@/lib/server/db/schema";

export async function getAutomationDailyYieldPct(): Promise<number> {
  const db = getDb();
  const row = await db.query.systemSettings.findFirst({
    where: (t, { eq }) => eq(t.key, AUTOMATION_YIELD_SETTING_KEY),
  });
  if (!row) return AUTOMATION_MAX_DAILY_YIELD_PCT;
  try {
    const parsed = JSON.parse(row.valueJson) as number;
    if (!Number.isFinite(parsed) || parsed <= 0) return AUTOMATION_MAX_DAILY_YIELD_PCT;
    return Math.min(100, Math.round(parsed * 100) / 100);
  } catch {
    return AUTOMATION_MAX_DAILY_YIELD_PCT;
  }
}

export async function setAutomationDailyYieldPct(pct: number): Promise<number> {
  const value = Math.min(100, Math.max(0.01, Math.round(pct * 100) / 100));
  const db = getDb();
  const now = new Date();
  await db
    .insert(systemSettings)
    .values({
      key: AUTOMATION_YIELD_SETTING_KEY,
      valueJson: JSON.stringify(value),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        valueJson: sql`excluded.value_json`,
        updatedAt: now,
      },
    });
  return value;
}
