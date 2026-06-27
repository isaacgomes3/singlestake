import { eq, or } from "drizzle-orm";

import { getDb } from "@/lib/server/db/client";
import { deposits, packagePixOrders, withdrawals } from "@/lib/server/db/schema";
import {
  isLucPaymentStatusCompleted,
  isLucPaymentStatusFailed,
  parseLucWebhookPayload,
} from "@/lib/server/finance/luc-paguei-client";
import { fulfillPackagePixOrderById } from "@/lib/server/finance/package-pix";
import { confirmDepositFromGateway } from "@/lib/server/finance/deposits";
import { confirmWithdrawalPaidFromGateway } from "@/lib/server/finance/withdrawals";

function logCallback(message: string, detail?: unknown): void {
  const ts = new Date().toISOString();
  if (detail !== undefined) console.info(`[luc-paguei-callback ${ts}]`, message, detail);
  else console.info(`[luc-paguei-callback ${ts}]`, message);
}

async function findPackageOrder(externalId: string | null, transactionId: string | null) {
  if (!externalId && !transactionId) return null;
  const db = getDb();
  const conditions = [];
  if (externalId) conditions.push(eq(packagePixOrders.txid, externalId));
  if (transactionId) conditions.push(eq(packagePixOrders.gatewayTransactionId, transactionId));
  if (conditions.length === 0) return null;

  return db.query.packagePixOrders.findFirst({
    where: conditions.length === 1 ? conditions[0] : or(...conditions),
  });
}

async function findDeposit(externalId: string | null, transactionId: string | null) {
  if (!externalId && !transactionId) return null;
  const db = getDb();
  const conditions = [];
  if (externalId) conditions.push(eq(deposits.externalRef, externalId));
  if (transactionId) conditions.push(eq(deposits.gatewayTransactionId, transactionId));
  if (conditions.length === 0) return null;

  return db.query.deposits.findFirst({
    where: conditions.length === 1 ? conditions[0] : or(...conditions),
  });
}

async function findWithdrawal(externalId: string | null, transactionId: string | null) {
  if (!externalId && !transactionId) return null;
  const db = getDb();
  const conditions = [];
  if (externalId) conditions.push(eq(withdrawals.externalRef, externalId));
  if (transactionId) conditions.push(eq(withdrawals.gatewayTransactionId, transactionId));
  if (conditions.length === 0) return null;

  return db.query.withdrawals.findFirst({
    where: conditions.length === 1 ? conditions[0] : or(...conditions),
  });
}

function kindFromExternalId(externalId: string | null): "package" | "deposit" | "withdrawal" | null {
  if (!externalId) return null;
  if (externalId.startsWith("PKG-")) return "package";
  if (externalId.startsWith("DEP-")) return "deposit";
  if (externalId.startsWith("SAQ-")) return "withdrawal";
  return null;
}

/** Webhook Luc Paguei — depósitos (pacote/carteira) e saques. Sempre responder 200. */
export async function handleLucPagueiWebhook(body: unknown): Promise<void> {
  const parsed = parseLucWebhookPayload(body);
  logCallback("evento recebido", parsed);

  if (!parsed.status) {
    logCallback("sem status — ignorado");
    return;
  }

  const kind = kindFromExternalId(parsed.externalId);

  if (isLucPaymentStatusFailed(parsed.status)) {
    logCallback("status terminal negativo", parsed.status);
    return;
  }

  if (!isLucPaymentStatusCompleted(parsed.status)) {
    logCallback("status intermédio — aguardar", parsed.status);
    return;
  }

  const pkg =
    kind === "package" || kind === null
      ? await findPackageOrder(parsed.externalId, parsed.transactionId)
      : null;

  if (pkg && pkg.status === "pending") {
    if (parsed.transactionId && !pkg.gatewayTransactionId) {
      await getDb()
        .update(packagePixOrders)
        .set({ gatewayTransactionId: parsed.transactionId })
        .where(eq(packagePixOrders.id, pkg.id));
    }
    const ok = await fulfillPackagePixOrderById(pkg.id);
    logCallback(ok ? "pacote activado" : "falha activar pacote", pkg.id);
    return;
  }

  const dep =
    kind === "deposit" || (kind === null && !pkg)
      ? await findDeposit(parsed.externalId, parsed.transactionId)
      : null;

  if (dep && dep.status === "pending") {
    if (parsed.transactionId && !dep.gatewayTransactionId) {
      await getDb()
        .update(deposits)
        .set({ gatewayTransactionId: parsed.transactionId })
        .where(eq(deposits.id, dep.id));
    }
    const result = await confirmDepositFromGateway(dep.id);
    logCallback(result.ok ? "depósito creditado" : "falha creditar depósito", dep.id);
    return;
  }

  const wd =
    kind === "withdrawal" || kind === null
      ? await findWithdrawal(parsed.externalId, parsed.transactionId)
      : null;

  if (wd && (wd.status === "approved" || wd.status === "pending")) {
    const result = await confirmWithdrawalPaidFromGateway(wd.id);
    logCallback(result.ok ? "saque confirmado" : "falha confirmar saque", wd.id);
    return;
  }

  logCallback("transação não encontrada ou já processada", {
    externalId: parsed.externalId,
    transactionId: parsed.transactionId,
  });
}
