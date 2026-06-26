import { useEffect, useState } from "react";

import { RESIDUAL_LEVELS } from "@/lib/back-office/constants";
import { DEFAULT_SUBSCRIPTION_AMOUNT, SUBSCRIPTION_NETWORK_SHARE } from "@/lib/back-office/product-constants";
import { fetchNetworkBonuses } from "@/lib/back-office/network-api";
import type { NetworkBonusesData } from "@/lib/back-office/network-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeTeamBonusPanel() {
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

  const team = data?.team;
  const networkPct = Math.round(SUBSCRIPTION_NETWORK_SHARE * 100);

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.teamBonus.indicatorsTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("network.teamBonus.activeInNetwork"), value: team?.activeInNetwork ?? 0 },
            { label: t("network.teamBonus.directActive"), value: team?.directActive ?? 0 },
            {
              label: t("network.teamBonus.networkVolume"),
              value: loading ? "…" : money(team?.networkVolume ?? 0),
            },
            {
              label: t("network.teamBonus.yourRank"),
              value: team ? t(`network.ranks.${team.qualification}`) : "…",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.teamBonus.affiliateEarningsTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.teamBonus.totalCreditedLedger")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(team?.affiliateEarnings ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.teamBonus.walletBalanceAffiliates")}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(team?.walletBalance ?? 0)}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-text-secondary">{t("network.teamBonus.teamBonusDesc")}</p>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.teamBonus.residualTitle")}</h2>
        <p className="mt-1 text-xs text-text-secondary">
          {t("network.teamBonus.residualIntroDetail", {
            amount: money(DEFAULT_SUBSCRIPTION_AMOUNT),
            pct: networkPct,
          })}
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-xs text-text-secondary">
                <th className="px-3 py-2 font-semibold">{t("network.teamBonus.colLevel")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.teamBonus.colPercent")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.teamBonus.colOnNetworkPart")}</th>
              </tr>
            </thead>
            <tbody>
              {RESIDUAL_LEVELS.map((row) => {
                const networkPart = DEFAULT_SUBSCRIPTION_AMOUNT * SUBSCRIPTION_NETWORK_SHARE;
                const payout = (networkPart * row.percent) / 100;
                return (
                  <tr key={row.level} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-text-primary">{row.level}</td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">{row.percent}%</td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">{money(payout)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
