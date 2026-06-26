import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { fetchLedger } from "@/lib/back-office/finance-api";
import type { LedgerEntryRecord } from "@/lib/back-office/finance-types";
import { WALLET_BUCKETS, type WalletBucket } from "@/lib/back-office/finance-constants";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

type EntryTypeFilter = "all" | "credit" | "debit";
type BucketFilter = "all" | WalletBucket;

export function BackOfficeLedgerPanel() {
  const { t } = useI18n();
  const { money, dateTime } = useFormat();
  const isAdmin = getSession()?.user.role === "admin";
  const [entries, setEntries] = useState<LedgerEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>("all");
  const [typeFilter, setTypeFilter] = useState<EntryTypeFilter>("all");

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchLedger({
      bucket: bucketFilter === "all" ? undefined : bucketFilter,
      entryType: typeFilter === "all" ? undefined : typeFilter,
      limit: 150,
    });
    setEntries(rows);
    setLoading(false);
  }, [bucketFilter, typeFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const row of entries) {
      if (row.entryType === "credit") credits += row.amount;
      else debits += row.amount;
    }
    return { credits, debits, net: credits - debits };
  }, [entries]);

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("finance.ledger.summaryTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
            <p className="text-xs text-emerald-200/80">{t("finance.ledger.totalCredits")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-100">
              {loading ? "…" : money(totals.credits)}
            </p>
          </div>
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
            <p className="text-xs text-red-200/80">{t("finance.ledger.totalDebits")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-red-100">
              {loading ? "…" : money(totals.debits)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("finance.ledger.netBalanceList")}</p>
            <p
              className={cn(
                "mt-1 text-lg font-bold tabular-nums",
                totals.net >= 0 ? "text-text-primary" : "text-red-300",
              )}
            >
              {loading ? "…" : money(totals.net)}
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">{t("finance.ledger.movementsTitle")}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value as BucketFilter)}
              className="h-9 rounded-md border border-border-color bg-bg-secondary px-3 text-sm text-text-primary"
              aria-label={t("finance.ledger.filterBucketAria")}
            >
              <option value="all">{t("finance.ledger.filterAllBuckets")}</option>
              {WALLET_BUCKETS.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {t(`shared.buckets.${bucket}`)}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EntryTypeFilter)}
              className="h-9 rounded-md border border-border-color bg-bg-secondary px-3 text-sm text-text-primary"
              aria-label={t("finance.ledger.filterTypeAria")}
            >
              <option value="all">{t("finance.ledger.filterCreditsDebits")}</option>
              <option value="credit">{t("finance.ledger.creditsOnly")}</option>
              <option value="debit">{t("finance.ledger.debitsOnly")}</option>
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
              {t("shared.refresh")}
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-text-secondary">{t("finance.ledger.loadingStatement")}</p>
        ) : entries.length === 0 ? (
          <p className="mt-4 text-sm text-text-secondary">{t("finance.ledger.empty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5">{t("shared.columns.date")}</th>
                  {isAdmin ? <th className="px-3 py-2.5">{t("shared.columns.user")}</th> : null}
                  <th className="px-3 py-2.5">{t("finance.ledger.colWallet")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.description")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.type")}</th>
                  <th className="px-3 py-2.5 text-right">{t("shared.columns.value")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 text-text-secondary">
                      {dateTime(row.createdAt)}
                    </td>
                    {isAdmin ? (
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-text-primary">{row.userName}</p>
                        <p className="text-xs text-text-secondary">{row.userEmail}</p>
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-text-secondary">
                      {t(`shared.buckets.${row.bucket}`)}
                    </td>
                    <td className="max-w-[16rem] px-3 py-2.5 text-text-primary">
                      <p className="truncate">{row.description}</p>
                      {row.referenceType ? (
                        <p className="truncate text-xs text-text-secondary">
                          {row.referenceType}
                          {row.referenceId ? ` · ${row.referenceId.slice(0, 8)}…` : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                          row.entryType === "credit"
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                            : "border-red-500/30 bg-red-500/15 text-red-200",
                        )}
                      >
                        {row.entryType === "credit"
                          ? t("finance.ledger.credit")
                          : t("finance.ledger.debit")}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-semibold tabular-nums",
                        row.entryType === "credit" ? "text-emerald-300" : "text-red-300",
                      )}
                    >
                      {row.entryType === "credit" ? "+" : "−"}
                      {money(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
