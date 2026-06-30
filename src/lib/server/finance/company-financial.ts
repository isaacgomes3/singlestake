import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import {
  COMPANY_AUTOMATION_PAYMENT_SPLIT,
  START_SUBSCRIPTION_COMPANY_AFILIADOS_POOL,
  START_SUBSCRIPTION_COMPANY_EMPRESA,
} from "@/lib/back-office/product-constants";
import type { WalletBucket } from "@/lib/back-office/finance-constants";
import { getDb } from "@/lib/server/db/client";
import { auditLogs, ledgerEntries } from "@/lib/server/db/schema";
import {
  debitCompanyBucket,
  getCompanyBucketBalances,
  resolveCompanyUserId,
} from "@/lib/server/finance/company-pool";

export type CompanyWalletBucket = Extract<WalletBucket, "empresa" | "afiliados" | "automacao">;

export type CompanyFinancialMovementDto = {
  id: string;
  bucket: CompanyWalletBucket;
  entryType: "credit" | "debit";
  amount: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  /** Admin que efectuou retirada manual (quando aplicável). */
  actorLabel: string | null;
};

export type CompanyManualWithdrawalDto = {
  id: string;
  bucket: Extract<CompanyWalletBucket, "empresa" | "automacao">;
  amount: number;
  description: string;
  actorLabel: string;
  createdAt: string;
};

export type CompanyFinancialPanelDto = {
  balances: Record<CompanyWalletBucket, number>;
  splits: {
    automation: typeof COMPANY_AUTOMATION_PAYMENT_SPLIT;
    startSubscription: {
      empresa: number;
      afiliados: number;
    };
  };
  movements: CompanyFinancialMovementDto[];
  manualWithdrawals: CompanyManualWithdrawalDto[];
};

const COMPANY_BUCKETS: CompanyWalletBucket[] = ["empresa", "afiliados", "automacao"];

const MANUAL_WITHDRAWAL_BUCKETS = new Set<CompanyWalletBucket>(["empresa", "automacao"]);

export async function getCompanyFinancialPanel(limit = 80): Promise<CompanyFinancialPanelDto> {
  const companyUserId = await resolveCompanyUserId();
  const balances = await getCompanyBucketBalances();
  const db = getDb();
  const take = Math.min(Math.max(limit, 1), 200);

  const ledgerRows = await db.query.ledgerEntries.findMany({
    where: and(
      eq(ledgerEntries.userId, companyUserId),
      inArray(ledgerEntries.bucket, COMPANY_BUCKETS),
    ),
    orderBy: [desc(ledgerEntries.createdAt)],
    limit: take,
  });

  const manualRefIds = ledgerRows
    .filter((row) => row.referenceType === "company_manual_withdrawal" && row.referenceId)
    .map((row) => row.referenceId!);

  const auditByRef = new Map<string, { actorLabel: string }>();
  if (manualRefIds.length > 0) {
    const audits = await db.query.auditLogs.findMany({
      where: inArray(auditLogs.target, manualRefIds),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 200,
    });
    for (const audit of audits) {
      if (audit.target && !auditByRef.has(audit.target)) {
        auditByRef.set(audit.target, { actorLabel: audit.actorLabel });
      }
    }
  }

  const movements: CompanyFinancialMovementDto[] = ledgerRows.map((row) => ({
    id: row.id,
    bucket: row.bucket as CompanyWalletBucket,
    entryType: row.entryType,
    amount: row.amount,
    description: row.description,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt.toISOString(),
    actorLabel:
      row.referenceType === "company_manual_withdrawal" && row.referenceId
        ? (auditByRef.get(row.referenceId)?.actorLabel ?? null)
        : null,
  }));

  const auditRows = await db.query.auditLogs.findMany({
    where: eq(auditLogs.action, "company_wallet.withdrawal"),
    orderBy: [desc(auditLogs.createdAt)],
    limit: 50,
  });

  const manualWithdrawals: CompanyManualWithdrawalDto[] = [];
  for (const audit of auditRows) {
    if (!audit.target || !audit.detail) continue;
    try {
      const parsed = JSON.parse(audit.detail) as {
        bucket?: string;
        amount?: number;
        description?: string;
      };
      if (
        (parsed.bucket !== "empresa" && parsed.bucket !== "automacao") ||
        !Number.isFinite(parsed.amount)
      ) {
        continue;
      }
      manualWithdrawals.push({
        id: audit.target,
        bucket: parsed.bucket as "empresa" | "automacao",
        amount: parsed.amount!,
        description: parsed.description ?? "",
        actorLabel: audit.actorLabel,
        createdAt: audit.createdAt.toISOString(),
      });
    } catch {
      /* ignorar entradas antigas */
    }
  }

  return {
    balances,
    splits: {
      automation: COMPANY_AUTOMATION_PAYMENT_SPLIT,
      startSubscription: {
        empresa: START_SUBSCRIPTION_COMPANY_EMPRESA,
        afiliados: START_SUBSCRIPTION_COMPANY_AFILIADOS_POOL,
      },
    },
    movements,
    manualWithdrawals,
  };
}

export async function createCompanyManualWithdrawal(input: {
  actorUserId: string;
  actorName: string;
  bucket: CompanyWalletBucket;
  amount: number;
  description: string;
}): Promise<{ ok: true; referenceId: string } | { ok: false; error: string }> {
  if (!MANUAL_WITHDRAWAL_BUCKETS.has(input.bucket)) {
    return {
      ok: false,
      error: "Retirada manual só é permitida nas carteiras Empresa e Automação.",
    };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Informe um valor válido." };
  }

  const description = input.description.trim();
  if (description.length < 3) {
    return { ok: false, error: "Descreva o motivo da retirada (mínimo 3 caracteres)." };
  }

  const balances = await getCompanyBucketBalances();
  if (amount > balances[input.bucket]) {
    return { ok: false, error: "Saldo insuficiente nesta carteira." };
  }

  const referenceId = randomUUID();
  const now = new Date();
  const db = getDb();

  try {
    await debitCompanyBucket({
      bucket: input.bucket,
      amount,
      description: `Retirada manual — ${description}`,
      referenceType: "company_manual_withdrawal",
      referenceId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "INSUFFICIENT_BALANCE") {
      return { ok: false, error: "Saldo insuficiente nesta carteira." };
    }
    throw err;
  }

  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorUserId: input.actorUserId,
    actorLabel: input.actorName,
    action: "company_wallet.withdrawal",
    target: referenceId,
    detail: JSON.stringify({
      bucket: input.bucket,
      amount,
      description,
    }),
    createdAt: now,
  });

  return { ok: true, referenceId };
}
