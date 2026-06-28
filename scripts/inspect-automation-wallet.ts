import "./load-local-env";

import { and, asc, eq } from "drizzle-orm";

import { getDb } from "../src/lib/server/db/client";
import { ledgerEntries, walletAccounts } from "../src/lib/server/db/schema";
import { resolveCompanyUserId } from "../src/lib/server/finance/company-pool";

const companyUserId = await resolveCompanyUserId();
const db = getDb();

const wallet = await db.query.walletAccounts.findFirst({
  where: and(eq(walletAccounts.userId, companyUserId), eq(walletAccounts.bucket, "automacao")),
});

const entries = await db.query.ledgerEntries.findMany({
  where: and(eq(ledgerEntries.userId, companyUserId), eq(ledgerEntries.bucket, "automacao")),
  orderBy: asc(ledgerEntries.createdAt),
});

console.log("wallet balance:", wallet?.availableBalance);
let running = 0;
for (const e of entries) {
  running += e.entryType === "credit" ? e.amount : -e.amount;
  console.log(
    `${e.entryType} ${e.amount} → ${running} | ${e.referenceType} | ${e.description.slice(0, 55)}`,
  );
}

process.exit(0);
