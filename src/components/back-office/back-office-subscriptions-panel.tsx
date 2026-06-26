import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchSubscription, paySubscription } from "@/lib/back-office/product-api";
import type { SubscriptionDto } from "@/lib/back-office/product-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

const STATUS_KEYS: Record<SubscriptionDto["status"], string> = {
  grace: "products.subscriptions.statusGrace",
  active: "products.subscriptions.statusActive",
  pending: "products.subscriptions.statusPending",
  expired: "products.subscriptions.statusExpired",
};

export function BackOfficeSubscriptionsPanel() {
  const { t } = useI18n();
  const { money, date } = useFormat();
  const [sub, setSub] = useState<SubscriptionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const reload = async () => {
    setLoading(true);
    setSub(await fetchSubscription());
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handlePay = async () => {
    setPaying(true);
    const result = await paySubscription();
    setPaying(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("products.subscriptions.toastPaid"));
    void reload();
  };

  const status = sub?.status ?? "pending";

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("products.subscriptions.title")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: t("products.subscriptions.fieldStatus"),
              value: loading ? "…" : t(STATUS_KEYS[status]),
            },
            {
              label: t("products.subscriptions.fieldAmount"),
              value: loading ? "…" : money(sub?.amount ?? 0),
            },
            {
              label: t("products.subscriptions.fieldAccess"),
              value: loading ? "…" : sub?.active ? t("shared.yes") : t("shared.no"),
            },
            {
              label: t("products.subscriptions.fieldDaysDue"),
              value:
                loading || sub?.daysUntilDue == null ? t("shared.dash") : String(sub.daysUntilDue),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="mt-1 font-bold text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>

        {!loading && sub && !sub.active ? (
          <Button type="button" className="mt-4" disabled={paying} onClick={() => void handlePay()}>
            {paying
              ? t("products.subscriptions.processing")
              : t("products.subscriptions.payWithAmount", { amount: money(sub.amount) })}
          </Button>
        ) : null}

        {!loading && sub?.status === "active" && sub.renewsAt ? (
          <p className="mt-3 text-xs text-text-secondary">
            {t("products.subscriptions.nextRenewal")}: {date(sub.renewsAt)}
          </p>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {t("products.subscriptions.distributionRuleTitle")}
        </h2>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {t("products.subscriptions.missedEarningsTitle")}
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-text-secondary">{t("shared.loading")}</p>
        ) : (sub?.missedCredits.length ?? 0) === 0 ? null : (
          <>
            <p className="mt-3 text-sm font-semibold text-amber-400">
              {t("products.subscriptions.missedTotalAmount", {
                amount: money(sub?.missedTotal ?? 0),
              })}
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                    <th className="px-3 py-2.5">{t("shared.columns.date")}</th>
                    <th className="px-3 py-2.5">{t("products.subscriptions.colReason")}</th>
                    <th className="px-3 py-2.5">{t("shared.columns.value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sub!.missedCredits.map((row, i) => (
                    <tr key={i} className="border-b border-border-color/60 last:border-0">
                      <td className="px-3 py-2.5 text-text-secondary">{date(row.createdAt)}</td>
                      <td className="px-3 py-2.5 text-text-primary">{row.reason}</td>
                      <td className="px-3 py-2.5 tabular-nums text-amber-400">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
