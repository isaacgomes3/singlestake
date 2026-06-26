import { useEffect, useState } from "react";

import { fetchNetworkBonuses } from "@/lib/back-office/network-api";
import type { NetworkBonusesData } from "@/lib/back-office/network-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeBinaryBonusPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const [data, setData] = useState<NetworkBonusesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchNetworkBonuses().then((row) => {
      setData(row);
      setLoading(false);
    });
  }, []);

  const points = data?.binaryPoints;

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binaryBonus.rulesTitle")}</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[320px] text-left text-sm">
            <tbody>
              {[
                [
                  t("network.binaryBonus.scoringLabel"),
                  t("network.binaryBonus.scoringValue", {
                    amount: money(points?.pointsPerReal ?? 1),
                  }),
                ],
                [
                  t("network.binaryBonus.conversionLabel"),
                  t("network.binaryBonus.conversionValue", { pct: points?.payoutPercent ?? 10 }),
                ],
                [
                  t("network.binaryBonus.activationLabel"),
                  loading
                    ? "…"
                    : points?.globallyActive
                      ? t("network.binaryBonus.activationActiveDetail")
                      : t("network.binaryBonus.activationPendingDetail"),
                ],
                [
                  t("network.binaryBonus.creditWalletLabel"),
                  t("network.binaryBonus.creditWalletValue"),
                ],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-border-color/60 last:border-0">
                  <td className="px-3 py-2.5 text-text-secondary">{label}</td>
                  <td className="px-3 py-2.5 font-semibold text-text-primary">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binaryBonus.profitCapTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("network.binaryBonus.invested"), value: points?.profitCap.invested ?? 0 },
            { label: t("network.binaryBonus.annualCap"), value: points?.profitCap.cap ?? 0 },
            { label: t("network.binaryBonus.earnedReceived"), value: points?.profitCap.earned ?? 0 },
            { label: t("network.binaryBonus.available"), value: points?.profitCap.remaining ?? 0 },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {loading ? "…" : money(item.value)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binaryBonus.pointsPerLegTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { label: t("network.binaryBonus.left"), value: data?.binary.leftPoints ?? 0 },
            { label: t("network.binaryBonus.right"), value: data?.binary.rightPoints ?? 0 },
            {
              label: t("network.binaryBonus.estimatePending"),
              value: data?.binary.estimatedPayout ?? 0,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {loading ? "…" : money(item.value)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binaryBonus.levelsScoreTitle")}</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-xs text-text-secondary">
                <th className="px-3 py-2 font-semibold">{t("network.teamBonus.colLevel")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.binaryBonus.left")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.binaryBonus.right")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.binaryBonus.colQualified")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.binaryBonus.colCanMatch")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.binaryBonus.colEstimate")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-secondary">
                    {t("shared.loading")}
                  </td>
                </tr>
              ) : (
                (points?.levels ?? []).map((level) => (
                  <tr key={level.level} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-text-primary">{level.level}</td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">
                      {money(level.left.available)}{" "}
                      <span className="text-xs text-text-secondary">/ {money(level.left.total)}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">
                      {money(level.right.available)}{" "}
                      <span className="text-xs text-text-secondary">/ {money(level.right.total)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {level.qualified ? (
                        <span className="text-emerald-600">{t("shared.yes")}</span>
                      ) : (
                        <span className="text-amber-600">{t("shared.no")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {level.canMatch ? (
                        <span className="text-emerald-600">{t("shared.yes")}</span>
                      ) : (
                        <span className="text-text-secondary">{t("shared.dash")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold text-text-primary">
                      {money(level.potentialPayout)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binaryBonus.historyBinaryTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binaryBonus.totalPaidLedger")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(data?.binary.paidTotal ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binaryBonus.walletBalanceNetwork")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(data?.binary.walletBalance ?? 0)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
