import { useCallback, useEffect, useState } from "react";

import { fetchWallets } from "@/lib/back-office/finance-api";
import type { WalletRecord } from "@/lib/back-office/finance-types";
import { FINANCE_DISPLAY_BUCKETS } from "@/lib/back-office/finance-constants";
import { useBackOfficeFinancePoll } from "@/hooks/useBackOfficeFinancePoll";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeWalletPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [automationDepositedTotal, setAutomationDepositedTotal] = useState(0);
  const [automationBalance, setAutomationBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await fetchWallets();
    setWallets(data.wallets);
    setAutomationDepositedTotal(data.automationDepositedTotal);
    setAutomationBalance(data.automationBalance);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useBackOfficeFinancePoll(() => {
    void reload();
  });

  const byBucket = new Map(wallets.map((w) => [w.bucket, w]));
  const totalAvailable = wallets.reduce((s, w) => s + w.availableBalance, 0);
  const totalBlocked = wallets.reduce((s, w) => s + w.blockedBalance, 0);

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("finance.wallet.summaryTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("finance.wallet.totalAvailable")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(totalAvailable)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("finance.wallet.totalBlocked")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(totalBlocked)}
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("finance.wallet.automationTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("finance.wallet.automationDeposited")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(automationDepositedTotal)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("finance.wallet.automationBalance")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(automationBalance)}
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("finance.wallet.balancesByOrigin")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FINANCE_DISPLAY_BUCKETS.map((bucket) => {
            const row = byBucket.get(bucket);
            return (
              <div
                key={bucket}
                className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
              >
                <p className="text-xs text-text-secondary">{t(`shared.buckets.${bucket}`)}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                  {loading ? "…" : money(row?.availableBalance ?? 0)}
                </p>
                {(row?.blockedBalance ?? 0) > 0 ? (
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {t("finance.wallet.blocked", { amount: money(row!.blockedBalance) })}
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
