import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { ROULETTE_AUTOMATION_INITIAL_BANK } from "@/lib/back-office/rouletteAutomationSim";
import { getDb } from "@/lib/server/db/client";
import { ledgerEntries, walletAccounts } from "@/lib/server/db/schema";
import { resolveCompanyUserId } from "@/lib/server/finance/company-pool";
import { creditWallet, debitWallet, getWalletBalance } from "@/lib/server/finance/wallet";

export const GLOBAL_AUTOMATION_CAPITAL_REF_TYPE = "global-automation-capital-init" as const;
export const GLOBAL_AUTOMATION_SETTLE_REF_TYPE = "global-automation-settle" as const;
export const GLOBAL_AUTOMATION_BUCKET = "automacao" as const;

export async function ensureGlobalAutomationWallet(companyUserId: string): Promise<void> {
  const existing = await getWalletBalance(companyUserId, GLOBAL_AUTOMATION_BUCKET);
  if (existing) return;

  const db = getDb();
  await db.insert(walletAccounts).values({
    id: randomUUID(),
    userId: companyUserId,
    bucket: GLOBAL_AUTOMATION_BUCKET,
    availableBalance: 0,
    blockedBalance: 0,
    updatedAt: new Date(),
  });
}

export async function isGlobalAutomationCapitalRegistered(): Promise<boolean> {
  const companyUserId = await resolveCompanyUserId();
  const db = getDb();
  const row = await db.query.ledgerEntries.findFirst({
    where: and(
      eq(ledgerEntries.userId, companyUserId),
      eq(ledgerEntries.referenceType, GLOBAL_AUTOMATION_CAPITAL_REF_TYPE),
    ),
  });
  return row != null;
}

/** Regista R$ 50.000 uma única vez no extrato (caixa automação — empresa). */
export async function ensureGlobalAutomationCapitalRegistered(): Promise<{
  registeredAt: number;
  balance: number;
}> {
  const companyUserId = await resolveCompanyUserId();
  await ensureGlobalAutomationWallet(companyUserId);

  const db = getDb();
  const existing = await db.query.ledgerEntries.findFirst({
    where: and(
      eq(ledgerEntries.userId, companyUserId),
      eq(ledgerEntries.referenceType, GLOBAL_AUTOMATION_CAPITAL_REF_TYPE),
    ),
  });

  if (!existing) {
    await creditWallet({
      userId: companyUserId,
      bucket: GLOBAL_AUTOMATION_BUCKET,
      amount: ROULETTE_AUTOMATION_INITIAL_BANK,
      description: "Automação global — início das operações (capital R$ 50.000)",
      referenceType: GLOBAL_AUTOMATION_CAPITAL_REF_TYPE,
      referenceId: "v1",
    });
    const wallet = await getGlobalAutomationWalletBalance();
    return { registeredAt: Date.now(), balance: wallet };
  }

  const wallet = await getGlobalAutomationWalletBalance();
  return { registeredAt: existing.createdAt.getTime(), balance: wallet };
}

export async function getGlobalAutomationWalletBalance(): Promise<number> {
  const companyUserId = await resolveCompanyUserId();
  await ensureGlobalAutomationWallet(companyUserId);
  const wallet = await getWalletBalance(companyUserId, GLOBAL_AUTOMATION_BUCKET);
  return wallet?.availableBalance ?? 0;
}

export async function isGlobalAutomationSettleRecorded(settleKey: string): Promise<boolean> {
  const companyUserId = await resolveCompanyUserId();
  const db = getDb();
  const row = await db.query.ledgerEntries.findFirst({
    where: and(
      eq(ledgerEntries.userId, companyUserId),
      eq(ledgerEntries.referenceType, GLOBAL_AUTOMATION_SETTLE_REF_TYPE),
      eq(ledgerEntries.referenceId, settleKey),
    ),
  });
  return row != null;
}

/** Liquida vitória/derrota no extrato — saldo oficial da automação global. */
export async function settleGlobalAutomationInLedger(input: {
  settleKey: string;
  won: boolean;
  stake: number;
  tableLabel: string;
  recovery: number;
  kind: "win" | "loss" | "recovery";
}): Promise<{ net: number; balanceAfter: number } | null> {
  if (input.stake <= 0) return null;
  if (await isGlobalAutomationSettleRecorded(input.settleKey)) return null;

  const companyUserId = await resolveCompanyUserId();
  await ensureGlobalAutomationWallet(companyUserId);

  const recoveryNote =
    input.recovery > 0 ? ` · gale ${input.recovery}` : "";
  const baseDesc = `Automação global — ${input.tableLabel}${recoveryNote}`;

  if (input.won) {
    await creditWallet({
      userId: companyUserId,
      bucket: GLOBAL_AUTOMATION_BUCKET,
      amount: input.stake,
      description: `${baseDesc} · vitória (+R$ ${input.stake.toFixed(0)})`,
      referenceType: GLOBAL_AUTOMATION_SETTLE_REF_TYPE,
      referenceId: input.settleKey,
    });
    const balanceAfter = await getGlobalAutomationWalletBalance();
    return { net: input.stake, balanceAfter };
  }

  await debitWallet({
    userId: companyUserId,
    bucket: GLOBAL_AUTOMATION_BUCKET,
    amount: input.stake,
    description: `${baseDesc} · ${input.kind === "loss" ? "derrota" : "recuperação"} (-R$ ${input.stake.toFixed(0)})`,
    referenceType: GLOBAL_AUTOMATION_SETTLE_REF_TYPE,
    referenceId: input.settleKey,
  });

  const balanceAfter = await getGlobalAutomationWalletBalance();
  return { net: -input.stake, balanceAfter };
}
