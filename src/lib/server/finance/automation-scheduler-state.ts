import { sql } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { systemSettings } from "@/lib/server/db/schema";

const LAST_YIELD_KEY = "last_automation_yield_ymd";

export function getAutomationYieldTimezone(): string {
  return process.env.AUTOMATION_YIELD_TZ ?? "America/Sao_Paulo";
}

export function getAutomationYieldSchedule(): { hour: number; minute: number } {
  const hour = Number(process.env.AUTOMATION_YIELD_HOUR ?? "0");
  const minute = Number(process.env.AUTOMATION_YIELD_MINUTE ?? "5");
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 5,
  };
}

export function getAutomationSchedulerIntervalMs(): number {
  const raw = Number(process.env.AUTOMATION_YIELD_CHECK_MS ?? String(15 * 60 * 1000));
  return Number.isFinite(raw) && raw >= 60_000 ? raw : 15 * 60 * 1000;
}

export function isAutomationSchedulerEnabled(): boolean {
  const flag = process.env.AUTOMATION_YIELD_SCHEDULER ?? "true";
  return flag !== "0" && flag.toLowerCase() !== "false";
}

type SaoPauloClock = {
  ymd: string;
  hour: number;
  minute: number;
};

export function getClockInTimezone(tz = getAutomationYieldTimezone()): SaoPauloClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const y = pick("year");
  const m = pick("month");
  const d = pick("day");

  return {
    ymd: `${y}-${m}-${d}`,
    hour: Number(pick("hour")),
    minute: Number(pick("minute")),
  };
}

export async function getLastAutomationYieldYmd(): Promise<string | null> {
  const db = getDb();
  const row = await db.query.systemSettings.findFirst({
    where: (t, { eq }) => eq(t.key, LAST_YIELD_KEY),
  });
  if (!row) return null;
  try {
    return JSON.parse(row.valueJson) as string;
  } catch {
    return null;
  }
}

export async function setLastAutomationYieldYmd(ymd: string): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(systemSettings)
    .values({
      key: LAST_YIELD_KEY,
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

export function shouldRunAutomationYieldNow(
  clock: SaoPauloClock,
  schedule = getAutomationYieldSchedule(),
): boolean {
  if (clock.hour < schedule.hour) return false;
  if (clock.hour === schedule.hour && clock.minute < schedule.minute) return false;
  return true;
}
