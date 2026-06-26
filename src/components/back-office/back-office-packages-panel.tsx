import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  fetchProductPackages,
  fetchUserPackages,
  purchaseProductPackage,
  runDailyAutomationYield,
} from "@/lib/back-office/product-api";
import type { PackageDto, UserPackageDto } from "@/lib/back-office/product-types";
import {
  AUTOMATION_DEPOSIT_STEP,
  PACKAGE_SPLIT_AUTOMATION,
  PACKAGE_SPLIT_START,
  START_PACKAGE_AMOUNT,
} from "@/lib/back-office/product-constants";
import { getSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficePackagesPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const isAdmin = getSession()?.user.role === "admin";
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [mine, setMine] = useState<UserPackageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [runningYield, setRunningYield] = useState(false);
  const [customAmount, setCustomAmount] = useState("500");

  const hasStart = mine.some((p) => p.packageId === "start" && p.status === "active");

  const reload = async () => {
    setLoading(true);
    const [packages, owned] = await Promise.all([fetchProductPackages(), fetchUserPackages()]);
    setCatalog(packages);
    setMine(owned);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleBuy = async (packageId: string, amount?: number) => {
    setBuyingId(packageId);
    const result = await purchaseProductPackage(packageId, amount);
    setBuyingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("products.packages.toastPurchased"));
    void reload();
  };

  const handleRunYield = async () => {
    setRunningYield(true);
    const result = await runDailyAutomationYield();
    setRunningYield(false);
    if (!result.ok) {
      toast.error(result.error ?? t("products.packages.toastYieldFailed"));
      return;
    }
    toast.success(
      t("products.packages.toastYieldSuccess", {
        pct: result.result?.yieldPct ?? 0,
        amount: money(result.result?.credited ?? 0),
      }),
    );
    void reload();
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("products.packages.splitTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3 text-sm">
            <p className="font-semibold text-text-primary">{t("products.packages.withAutomation")}</p>
            <p className="mt-1 text-text-secondary">
              {t("products.packages.splitLine", {
                aff: PACKAGE_SPLIT_AUTOMATION.afiliados * 100,
                auto: PACKAGE_SPLIT_AUTOMATION.automacao * 100,
                co: PACKAGE_SPLIT_AUTOMATION.empresa * 100,
              })}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3 text-sm">
            <p className="font-semibold text-text-primary">{t("products.packages.startPack")}</p>
            <p className="mt-1 text-text-secondary">
              {t("products.packages.splitStartLine", {
                aff: PACKAGE_SPLIT_START.afiliados * 100,
                co: PACKAGE_SPLIT_START.empresa * 100,
              })}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          {t("products.packages.rulesLong", {
            start: money(START_PACKAGE_AMOUNT),
            step: money(AUTOMATION_DEPOSIT_STEP),
          })}
        </p>
        {isAdmin ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled={runningYield}
            onClick={() => void handleRunYield()}
          >
            {runningYield ? t("products.packages.processing") : t("products.packages.runYield")}
          </Button>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("products.packages.catalog")}</h2>
        {!hasStart && mine.length > 0 ? (
          <p className="mt-2 text-xs text-amber-600">{t("products.packages.unlockStart")}</p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {loading
            ? t("shared.loading")
            : catalog.map((pkg) => {
                const isAutomation = pkg.packageKind === "automation";
                const locked = isAutomation && !hasStart;
                return (
                  <div
                    key={pkg.id}
                    className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
                  >
                    <p className="font-semibold text-text-primary">{pkg.name}</p>
                    {pkg.allowsCustomAmount ? (
                      <div className="mt-2">
                        <label className="text-xs text-text-secondary">
                          {t("products.packages.amountMultiples", {
                            step: money(AUTOMATION_DEPOSIT_STEP),
                          })}
                        </label>
                        <input
                          type="number"
                          min={pkg.minAmount}
                          max={pkg.maxAmount}
                          step={AUTOMATION_DEPOSIT_STEP}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm tabular-nums text-text-primary"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-lg font-bold tabular-nums">{money(pkg.amount)}</p>
                    )}
                    <p className="mt-1 text-xs text-text-secondary">
                      {pkg.packageKind === "start"
                        ? t("products.packages.startRequired")
                        : locked
                          ? t("products.packages.locked")
                          : t("products.packages.withAutomationShort")}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      disabled={buyingId === pkg.id || locked}
                      onClick={() =>
                        void handleBuy(
                          pkg.id,
                          pkg.allowsCustomAmount ? Number(customAmount) : undefined,
                        )
                      }
                    >
                      {buyingId === pkg.id
                        ? t("products.packages.buying")
                        : t("products.packages.buy")}
                    </Button>
                  </div>
                );
              })}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("products.packages.owned")}</h2>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("products.packages.ownedEmpty")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5">{t("products.packages.colPackage")}</th>
                  <th className="px-3 py-2.5">{t("products.packages.colAmount")}</th>
                  <th className="px-3 py-2.5">{t("products.packages.colAutomationBase")}</th>
                  <th className="px-3 py-2.5">{t("products.packages.colEarnings")}</th>
                  <th className="px-3 py-2.5">{t("products.packages.colCap")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.status")}</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">{row.packageName}</td>
                    <td className="px-3 py-2.5 tabular-nums">{money(row.amount)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{money(row.automationBase)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{money(row.totalEarned)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{money(row.maxProfit)}</td>
                    <td className="px-3 py-2.5 capitalize">{row.status}</td>
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
