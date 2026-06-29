import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { AUTOMATION_MAX_DAILY_YIELD_PCT } from "@/lib/back-office/product-constants";
import { getDb } from "@/lib/server/db/client";
import { userPackages } from "@/lib/server/db/schema";
import { getAutomationDailyYieldPct } from "@/lib/server/finance/automation-yield-settings";
import {
  isAffiliateServicesActive,
  recordMissedCredit,
} from "@/lib/server/finance/subscription-access";
import { creditWallet } from "@/lib/server/finance/wallet";

import { setLastAutomationYieldYmd } from "@/lib/server/finance/automation-scheduler-state";

/** @deprecated Rendimento diário usa percentual admin (base 1%/dia). */
export function computeGlobalAutomationDailyYieldPct(): number {
  return AUTOMATION_MAX_DAILY_YIELD_PCT;
}

export type AutomationYieldResult = {
  processed: number;
  credited: number;
  missed: number;
  yieldPct: number;
  skipped?: boolean;
  ymd?: string;
};

export async function runDailyAutomationYield(
  yieldPct?: number,
): Promise<AutomationYieldResult> {
  const pct = yieldPct ?? (await getAutomationDailyYieldPct());

  const db = getDb();
  const now = new Date();
  const packages = await db.query.userPackages.findMany({
    where: and(eq(userPackages.status, "active")),
  });

  let credited = 0;
  let missed = 0;

  for (const pkg of packages) {
    if (pkg.automationBase <= 0) continue;

    let companyUserId: string | null = null;
    try {
      const { resolveCompanyUserId } = await import("@/lib/server/finance/company-pool");
      companyUserId = await resolveCompanyUserId();
    } catch {
      /* caixa empresa ainda não configurada */
    }
    if (companyUserId && pkg.userId === companyUserId) continue;

    if (pkg.adhesionEndsAt <= now) {
      await db
        .update(userPackages)
        .set({ status: "expired" })
        .where(eq(userPackages.id, pkg.id));
      continue;
    }

    const remaining = pkg.maxProfit - pkg.totalEarned;
    if (remaining <= 0) {
      await db
        .update(userPackages)
        .set({ status: "expired" })
        .where(eq(userPackages.id, pkg.id));
      continue;
    }

    const rawYield = (pkg.automationBase * pct) / 100;
    const payout = Math.min(remaining, Math.round(rawYield * 100) / 100);
    if (payout <= 0) continue;

    const active = await isAffiliateServicesActive(pkg.userId);
    const description = `Rendimento automação — ${pct}% sobre R$ ${pkg.automationBase.toFixed(2)}`;

    if (active) {
      await creditWallet({
        userId: pkg.userId,
        bucket: "automacao",
        amount: payout,
        description,
        referenceType: "automation_yield",
        referenceId: pkg.id,
      });
      credited += payout;
    } else {
      await recordMissedCredit({
        userId: pkg.userId,
        amount: payout,
        reason: description,
        referenceType: "automation_yield",
        referenceId: pkg.id,
      });
      missed += payout;
    }

    const newEarned = pkg.totalEarned + payout;
    await db
      .update(userPackages)
      .set({
        totalEarned: newEarned,
        status: newEarned >= pkg.maxProfit ? "expired" : "active",
      })
      .where(eq(userPackages.id, pkg.id));
  }

  return {
    processed: packages.length,
    credited,
    missed,
    yieldPct: pct,
  };
}

export async function triggerDailyAutomationYield(options?: {
  force?: boolean;
  ymd?: string;
  actorLabel?: string;
}): Promise<AutomationYieldResult> {
  const ymd = options?.ymd;
  if (ymd && !options?.force) {
    const { getLastAutomationYieldYmd } = await import(
      "@/lib/server/finance/automation-scheduler-state"
    );
    const last = await getLastAutomationYieldYmd();
    if (last === ymd) {
      return { processed: 0, credited: 0, missed: 0, yieldPct: 0, skipped: true, ymd };
    }
  }

  const runId = randomUUID();
  const result = await runDailyAutomationYield();
  if (ymd) {
    await setLastAutomationYieldYmd(ymd);
  }
  const db = getDb();
  const { auditLogs } = await import("@/lib/server/db/schema");
  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorLabel: options?.actorLabel ?? "sistema",
    action: "automation.daily_yield",
    detail: `run ${runId}${ymd ? ` · ${ymd}` : ""} · ${result.yieldPct}% · creditado R$ ${result.credited.toFixed(2)} · perdido R$ ${result.missed.toFixed(2)}`,
    createdAt: new Date(),
  });
  return { ...result, ymd };
}
