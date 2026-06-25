import {
  DEFAULT_BINARY_CONFIG,
  REFERRAL_LEVELS,
} from "@/lib/back-office/constants";
import type { BinaryBonusConfig, ReferralLevel } from "@/lib/back-office/types";
import { getDb } from "@/lib/server/db/client";
import { systemSettings } from "@/lib/server/db/schema";

export async function getReferralLevels(): Promise<ReferralLevel[]> {
  const db = getDb();
  const row = await db.query.systemSettings.findFirst({
    where: (t, { eq }) => eq(t.key, "referral_levels"),
  });
  if (!row) return REFERRAL_LEVELS;
  try {
    const parsed = JSON.parse(row.valueJson) as ReferralLevel[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : REFERRAL_LEVELS;
  } catch {
    return REFERRAL_LEVELS;
  }
}

export async function getBinaryBonusConfig(): Promise<BinaryBonusConfig> {
  const db = getDb();
  const row = await db.query.systemSettings.findFirst({
    where: (t, { eq }) => eq(t.key, "binary_bonus"),
  });
  if (!row) return DEFAULT_BINARY_CONFIG;
  try {
    return { ...DEFAULT_BINARY_CONFIG, ...JSON.parse(row.valueJson) };
  } catch {
    return DEFAULT_BINARY_CONFIG;
  }
}
