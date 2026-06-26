import { useEffect, useState } from "react";

import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { fetchAffiliates } from "@/lib/back-office/network-api";
import type { AffiliatesData } from "@/lib/back-office/network-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeAffiliatesPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const [data, setData] = useState<AffiliatesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchAffiliates().then((row) => {
      setData(row);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.affiliates.linkTitle")}</h2>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-text-secondary">{t("shared.loading")}</p>
          ) : data ? (
            <ReferralLinkField referralCode={data.referralCode} referralLink={data.referralLink} />
          ) : null}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.affiliates.summaryTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("network.affiliates.direct"), value: data?.totals.directCount ?? 0 },
            { label: t("network.affiliates.networkTotal"), value: data?.totals.networkCount ?? 0 },
            {
              label: t("network.affiliates.activeInNetwork"),
              value: data?.totals.activeInNetwork ?? 0,
            },
            {
              label: t("network.affiliates.networkVolume"),
              value: loading ? "…" : money(data?.totals.networkVolume ?? 0),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {t("network.affiliates.commissionsTitle")}
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                <th className="px-3 py-2.5 font-semibold">{t("network.affiliates.colLevel")}</th>
                <th className="px-3 py-2.5 font-semibold">{t("network.affiliates.colPercent")}</th>
                <th className="px-3 py-2.5 font-semibold">{t("network.affiliates.colAffiliates")}</th>
                <th className="px-3 py-2.5 font-semibold">{t("network.affiliates.colActive")}</th>
                <th className="px-3 py-2.5 font-semibold">{t("network.affiliates.colVolume")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.indirect ?? []).map((row) => (
                <tr key={row.level} className="border-b border-border-color/60 last:border-0">
                  <td className="px-3 py-2.5 text-text-primary">
                    {row.level} (
                    {row.level === 1
                      ? t("network.affiliates.levelDirect")
                      : t("network.affiliates.levelIndirect", { n: row.level })}
                    )
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-text-primary">{row.percent}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-primary">{row.count}</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-primary">{row.activeCount}</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-primary">{money(row.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.affiliates.directTitle")}</h2>
        {loading ? (
          <p className="mt-3 text-sm text-text-secondary">{t("shared.loading")}</p>
        ) : (data?.direct.length ?? 0) === 0 ? null : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("network.affiliates.colName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("network.affiliates.colJoined")}</th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("network.affiliates.colQualification")}
                  </th>
                  <th className="px-3 py-2.5 font-semibold">{t("network.affiliates.colPackage")}</th>
                  <th className="px-3 py-2.5 font-semibold">
                    {t("network.affiliates.colSubscription")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data!.direct.map((member) => (
                  <tr key={member.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">{member.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{member.joinedAt}</td>
                    <td className="px-3 py-2.5 text-text-primary">
                      {t(`network.ranks.${member.qualification}`)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">
                      {member.hasActivePackage ? money(member.packageAmount) : t("shared.dash")}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-text-primary">
                      {member.subscriptionStatus}
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
