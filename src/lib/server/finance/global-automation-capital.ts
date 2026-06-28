import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { ROULETTE_AUTOMATION_INITIAL_BANK } from "@/lib/back-office/rouletteAutomationSim";
import { getDb } from "@/lib/server/db/client";
import { ledgerEntries, walletAccounts } from "@/lib/server/db/schema";
import { resolveCompanyUserId } from "@/lib/server/finance/company-pool";
import { creditWallet, debitWallet, getWalletBalance } from "@/lib/server/finance/wallet";

export const GLOBAL_AUTOMATION_CAPITAL_REF_TYPE = "global-automation-capital-init" as const;
export const GLOBAL_AUTOMATION_SETTLE_REF_TYPE = "global-automation-settle" as const;
export const GLOBAL_AUTOMATION_BUCKET = "automacao" as const;

export const GLOBAL_AUTOMATION_LEDGER_REF_TYPES = [
  GLOBAL_AUTOMATION_CAPITAL_REF_TYPE,
  GLOBAL_AUTOMATION_SETTLE_REF_TYPE,
] as const;

export function isGlobalAutomationLedgerRef(referenceType: string | null | undefined): boolean {
  if (!referenceType) return false;
  return (GLOBAL_AUTOMATION_LEDGER_REF_TYPES as readonly string[]).includes(referenceType);
}

/** Saldo pessoal na carteira automacao — exclui capital e liquidações da automação global. */
export async function getPersonalAutomationWalletBalance(userId: string): Promise<number> {
  const db = getDb();
  const [sums] = await db
    .select({
      credits: sql<number>`coalesce(sum(case when ${ledgerEntries.entryType} = 'credit' and (${ledgerEntries.referenceType} is null or ${ledgerEntries.referenceType} not in (${GLOBAL_AUTOMATION_CAPITAL_REF_TYPE}, ${GLOBAL_AUTOMATION_SETTLE_REF_TYPE})) then ${ledgerEntries.amount} else 0 end), 0)`,
      debits: sql<number>`coalesce(sum(case when ${ledgerEntries.entryType} = 'debit' and (${ledgerEntries.referenceType} is null or ${ledgerEntries.referenceType} not in (${GLOBAL_AUTOMATION_CAPITAL_REF_TYPE}, ${GLOBAL_AUTOMATION_SETTLE_REF_TYPE})) then ${ledgerEntries.amount} else 0 end), 0)`,
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.userId, userId), eq(ledgerEntries.bucket, GLOBAL_AUTOMATION_BUCKET)));

  const net = Number(sums?.credits ?? 0) - Number(sums?.debits ?? 0);
  return Math.max(0, Math.round(net * 100) / 100);
}

export type GlobalAutomationLedgerEntryDto = {
  id: string;
  entryType: "credit" | "debit";
  amount: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type GlobalAutomationLedgerTotals = {
  capitalCredit: number;
  settlementCredits: number;
  settlementDebits: number;
  /** Vitórias − perdas (sem capital inicial). */
  operationsNet: number;
  /** Deve coincidir com o saldo da wallet se só houver capital + liquidações. */
  expectedBalance: number;
  entryCount: number;
};

export type GlobalAutomationFinanceSnapshot = {
  balance: number;
  initialCapital: number;
  capitalRegisteredAt: number | null;
  totals: GlobalAutomationLedgerTotals;
  entries: GlobalAutomationLedgerEntryDto[];
};

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
  const totals = await computeGlobalAutomationLedgerTotals(companyUserId);
  return totals.expectedBalance;
}

/** Saldo bruto da carteira `automacao` da empresa (pode incluir rendimentos de pacotes). */
export async function getGlobalAutomationRawWalletBalance(): Promise<number> {
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

function toGlobalAutomationLedgerDto(
  row: typeof ledgerEntries.$inferSelect,
): GlobalAutomationLedgerEntryDto {
  return {
    id: row.id,
    entryType: row.entryType,
    amount: row.amount,
    description: row.description,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Extrato da caixa operacional da automação global — visível a todos os utilizadores autenticados. */
export async function listGlobalAutomationLedgerEntries(
  limit = 150,
): Promise<GlobalAutomationLedgerEntryDto[]> {
  const companyUserId = await resolveCompanyUserId();
  const db = getDb();
  const capped = Math.min(Math.max(limit, 1), 200);

  const rows = await db.query.ledgerEntries.findMany({
    where: and(
      eq(ledgerEntries.userId, companyUserId),
      eq(ledgerEntries.bucket, GLOBAL_AUTOMATION_BUCKET),
      inArray(ledgerEntries.referenceType, [
        GLOBAL_AUTOMATION_CAPITAL_REF_TYPE,
        GLOBAL_AUTOMATION_SETTLE_REF_TYPE,
      ]),
    ),
    orderBy: [desc(ledgerEntries.createdAt)],
    limit: capped,
  });

  return rows.map(toGlobalAutomationLedgerDto);
}

async function computeGlobalAutomationLedgerTotals(
  companyUserId: string,
): Promise<GlobalAutomationLedgerTotals> {
  const db = getDb();
  const baseWhere = and(
    eq(ledgerEntries.userId, companyUserId),
    eq(ledgerEntries.bucket, GLOBAL_AUTOMATION_BUCKET),
    inArray(ledgerEntries.referenceType, [
      GLOBAL_AUTOMATION_CAPITAL_REF_TYPE,
      GLOBAL_AUTOMATION_SETTLE_REF_TYPE,
    ]),
  );

  const [sums] = await db
    .select({
      capitalCredit: sql<number>`coalesce(sum(case when ${ledgerEntries.referenceType} = ${GLOBAL_AUTOMATION_CAPITAL_REF_TYPE} and ${ledgerEntries.entryType} = 'credit' then ${ledgerEntries.amount} else 0 end), 0)`,
      settlementCredits: sql<number>`coalesce(sum(case when ${ledgerEntries.referenceType} = ${GLOBAL_AUTOMATION_SETTLE_REF_TYPE} and ${ledgerEntries.entryType} = 'credit' then ${ledgerEntries.amount} else 0 end), 0)`,
      settlementDebits: sql<number>`coalesce(sum(case when ${ledgerEntries.referenceType} = ${GLOBAL_AUTOMATION_SETTLE_REF_TYPE} and ${ledgerEntries.entryType} = 'debit' then ${ledgerEntries.amount} else 0 end), 0)`,
      entryCount: sql<number>`count(*)`,
    })
    .from(ledgerEntries)
    .where(baseWhere);

  const capitalCredit = Number(sums?.capitalCredit ?? 0);
  const settlementCredits = Number(sums?.settlementCredits ?? 0);
  const settlementDebits = Number(sums?.settlementDebits ?? 0);
  const operationsNet = settlementCredits - settlementDebits;

  return {
    capitalCredit,
    settlementCredits,
    settlementDebits,
    operationsNet,
    expectedBalance: capitalCredit + operationsNet,
    entryCount: Number(sums?.entryCount ?? 0),
  };
}

export async function getGlobalAutomationFinanceSnapshot(
  ledgerLimit = 150,
): Promise<GlobalAutomationFinanceSnapshot> {
  const { registeredAt } = await ensureGlobalAutomationCapitalRegistered();
  const companyUserId = await resolveCompanyUserId();
  const balance = await getGlobalAutomationWalletBalance();
  const [entries, totals] = await Promise.all([
    listGlobalAutomationLedgerEntries(ledgerLimit),
    computeGlobalAutomationLedgerTotals(companyUserId),
  ]);

  return {
    balance,
    initialCapital: ROULETTE_AUTOMATION_INITIAL_BANK,
    capitalRegisteredAt: registeredAt,
    totals,
    entries,
  };
}
