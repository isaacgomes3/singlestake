import { useEffect, useState } from "react";

import { BackOfficeBinaryBonusPanel } from "@/components/back-office/back-office-binary-bonus-panel";
import { BinaryTreeView } from "@/components/back-office/binary-tree-view";
import { BackOfficeSubAccountsPanel } from "@/components/back-office/back-office-sub-accounts-panel";
import { fetchBinaryNetwork } from "@/lib/back-office/network-api";
import type { BinaryNetworkData } from "@/lib/back-office/network-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeBinaryPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const [data, setData] = useState<BinaryNetworkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchBinaryNetwork().then((row) => {
      setData(row);
      setLoading(false);
    });
  }, []);

  const sideLabel =
    data?.placement.side === "left"
      ? t("network.binary.sideLeft")
      : data?.placement.side === "right"
        ? t("network.binary.sideRight")
        : t("shared.dash");

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binary.placementTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binary.sponsorBinary")}</p>
            <p className="mt-1 font-semibold text-text-primary">
              {loading ? "…" : (data?.placement.parentName ?? t("network.binary.root"))}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binary.side")}</p>
            <p className="mt-1 font-semibold text-text-primary">{loading ? "…" : sideLabel}</p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binary.placedAt")}</p>
            <p className="mt-1 font-semibold text-text-primary">
              {loading ? "…" : (data?.placement.placedAt ?? t("shared.dash"))}
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binary.volumeTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: t("network.binary.left"),
              count: data?.legs.left.count ?? 0,
              volume: data?.legs.left.volume ?? 0,
            },
            {
              label: t("network.binary.right"),
              count: data?.legs.right.count ?? 0,
              volume: data?.legs.right.volume ?? 0,
            },
            {
              label: t("network.binary.weakerLegShort"),
              count: null,
              volume: data?.legs.weakerVolume ?? 0,
            },
          ].map((leg) => (
            <div
              key={leg.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{leg.label}</p>
              {leg.count !== null ? (
                <p className="mt-0.5 text-xs text-text-secondary">
                  {t("network.binary.nodesCount", { count: leg.count })}
                </p>
              ) : null}
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {loading ? "…" : money(leg.volume)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <BackOfficeBinaryBonusPanel />

      <BackOfficeSubAccountsPanel />

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binary.genealogyTitle")}</h2>
        <div className="mt-3">
          {loading || !data ? (
            <p className="text-sm text-text-secondary">{t("network.binary.treeLoading")}</p>
          ) : (
            <BinaryTreeView root={data.root} />
          )}
        </div>
      </section>
    </div>
  );
}
