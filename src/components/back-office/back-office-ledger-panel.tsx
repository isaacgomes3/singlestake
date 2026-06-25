import { useCallback, useEffect, useMemo, useState } from "react";

import { formatFinanceDate } from "@/components/back-office/finance-status-badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { fetchLedger } from "@/lib/back-office/finance-api";
import type { LedgerEntryRecord } from "@/lib/back-office/finance-types";
import {
  WALLET_BUCKET_LABELS,
  WALLET_BUCKETS,
  type WalletBucket,
} from "@/lib/back-office/finance-constants";
import { formatBrl } from "@/lib/back-office/mock-data";
import { cn } from "@/lib/utils";

type EntryTypeFilter = "all" | "credit" | "debit";
type BucketFilter = "all" | WalletBucket;

export function BackOfficeLedgerPanel() {
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
        <h2 className="text-sm font-bold text-text-primary">Resumo do extrato</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
            <p className="text-xs text-emerald-200/80">Total créditos</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-100">
              {loading ? "…" : formatBrl(totals.credits)}
            </p>
          </div>
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
            <p className="text-xs text-red-200/80">Total débitos</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-red-100">
              {loading ? "…" : formatBrl(totals.debits)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">Saldo líquido (lista)</p>
            <p
              className={cn(
                "mt-1 text-lg font-bold tabular-nums",
                totals.net >= 0 ? "text-text-primary" : "text-red-300",
              )}
            >
              {loading ? "…" : formatBrl(totals.net)}
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Movimentos</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Histórico completo de créditos e débitos na carteira.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value as BucketFilter)}
              className="h-9 rounded-md border border-border-color bg-bg-secondary px-3 text-sm text-text-primary"
              aria-label="Filtrar por carteira"
            >
              <option value="all">Todas as carteiras</option>
              {WALLET_BUCKETS.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {WALLET_BUCKET_LABELS[bucket]}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EntryTypeFilter)}
              className="h-9 rounded-md border border-border-color bg-bg-secondary px-3 text-sm text-text-primary"
              aria-label="Filtrar por tipo"
            >
              <option value="all">Créditos e débitos</option>
              <option value="credit">Só créditos</option>
              <option value="debit">Só débitos</option>
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
              Actualizar
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-text-secondary">A carregar extrato…</p>
        ) : entries.length === 0 ? (
          <p className="mt-4 text-sm text-text-secondary">Nenhum movimento encontrado.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5">Data</th>
                  {isAdmin ? <th className="px-3 py-2.5">Utilizador</th> : null}
                  <th className="px-3 py-2.5">Carteira</th>
                  <th className="px-3 py-2.5">Descrição</th>
                  <th className="px-3 py-2.5">Tipo</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                      {formatFinanceDate(row.createdAt)}
                    </td>
                    {isAdmin ? (
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-text-primary">{row.userName}</p>
                        <p className="text-xs text-text-secondary">{row.userEmail}</p>
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 text-text-secondary">
                      {WALLET_BUCKET_LABELS[row.bucket]}
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
                        {row.entryType === "credit" ? "Crédito" : "Débito"}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-semibold tabular-nums",
                        row.entryType === "credit" ? "text-emerald-300" : "text-red-300",
                      )}
                    >
                      {row.entryType === "credit" ? "+" : "−"}
                      {formatBrl(row.amount)}
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
