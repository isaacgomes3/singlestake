import { useEffect, useState } from "react";

import { fetchWallets } from "@/lib/back-office/finance-api";
import type { WalletRecord } from "@/lib/back-office/finance-types";
import { formatBrl } from "@/lib/back-office/mock-data";
import { FINANCE_DISPLAY_BUCKETS, WALLET_BUCKET_LABELS } from "@/lib/back-office/finance-constants";

export function BackOfficeWalletPanel() {
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchWallets().then((rows) => {
      setWallets(rows);
      setLoading(false);
    });
  }, []);

  const byBucket = new Map(wallets.map((w) => [w.bucket, w]));
  const totalAvailable = wallets.reduce((s, w) => s + w.availableBalance, 0);
  const totalBlocked = wallets.reduce((s, w) => s + w.blockedBalance, 0);

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Resumo</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">Total disponível</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
              {loading ? "…" : formatBrl(totalAvailable)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">Total bloqueado</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
              {loading ? "…" : formatBrl(totalBlocked)}
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Saldos por origem</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FINANCE_DISPLAY_BUCKETS.map((bucket) => {
            const row = byBucket.get(bucket);
            return (
              <div
                key={bucket}
                className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
              >
                <p className="text-xs text-text-secondary">{WALLET_BUCKET_LABELS[bucket]}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                  {loading ? "…" : formatBrl(row?.availableBalance ?? 0)}
                </p>
                {(row?.blockedBalance ?? 0) > 0 ? (
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Bloqueado: {formatBrl(row!.blockedBalance)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
