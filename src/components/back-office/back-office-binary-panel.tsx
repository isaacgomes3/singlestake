import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BackOfficeBinaryBonusPanel } from "@/components/back-office/back-office-binary-bonus-panel";
import { BinaryTreeView } from "@/components/back-office/binary-tree-view";
import { BackOfficeSubAccountsPanel } from "@/components/back-office/back-office-sub-accounts-panel";
import { fetchBinaryNetwork, placeDirectInBinary, setNextDirectSide } from "@/lib/back-office/network-api";
import type { BinaryNetworkData } from "@/lib/back-office/network-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

export function BackOfficeBinaryPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const [data, setData] = useState<BinaryNetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [savingSideTarget, setSavingSideTarget] = useState<"left" | "right" | null>(null);

  const reload = () =>
    fetchBinaryNetwork().then((row) => {
      setData(row);
      setLoading(false);
    });

  useEffect(() => {
    void reload();
  }, []);

  const sideLabel = data?.placement.pending
    ? t("network.binary.placementPending")
    : data?.placement.side === "left"
      ? t("network.binary.sideLeft")
      : data?.placement.side === "right"
        ? t("network.binary.sideRight")
        : t("shared.dash");

  async function handlePlace(directUserId: string, side: "left" | "right") {
    setPlacingId(directUserId);
    const result = await placeDirectInBinary(directUserId, side);
    setPlacingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    toast.success(
      side === "left" ? t("network.binary.chooseLeft") : t("network.binary.chooseRight"),
    );
  }

  async function handleNextSideChange(side: "left" | "right") {
    if (!data || data.nextDirectSide.stored === side) return;

    setSavingSideTarget(side);
    const result = await setNextDirectSide(side);
    setSavingSideTarget(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
    toast.success(t("network.binary.nextDirectSideSaved"));
  }

  const preferredSide = data?.nextDirectSide.selected ?? "left";

  function registrationSideLabel(row: NonNullable<typeof data>["myDirects"][number]): string {
    if (row.placementPending) return t("network.binary.registrationSidePending");
    if (!row.hasActiveStart) return t("network.binary.registrationSideAwaitingStart");
    if (row.side === "left") return t("network.binary.sideLeft");
    if (row.side === "right") return t("network.binary.sideRight");
    return t("shared.dash");
  }

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binary.placementTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binary.sponsorBinary")}</p>
            <p className="mt-1 font-semibold text-text-primary">
              {loading ? "…" : (data?.placement.parentName ?? t("network.binary.root"))}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binary.side")}</p>
            <p
              className={cn(
                "mt-1 font-semibold",
                data?.placement.pending ? "text-warning" : "text-text-primary",
              )}
            >
              {loading ? "…" : sideLabel}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binary.placedAt")}</p>
            <p className="mt-1 font-semibold text-text-primary">
              {loading ? "…" : (data?.placement.placedAt ?? t("shared.dash"))}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">{t("network.binary.myDirectsCount")}</p>
            <p className="mt-1 font-semibold tabular-nums text-text-primary">
              {loading ? "…" : (data?.myDirects.length ?? 0)}
            </p>
          </div>
        </div>
        {!loading && data ? (
          <p
            className={cn(
              "mt-3 text-xs font-medium",
              data.binaryQualified ? "text-success" : "text-text-secondary",
            )}
          >
            {data.binaryQualified
              ? t("network.binary.qualifiedForBonus")
              : t("network.binary.notQualifiedForBonus")}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-text-secondary">{t("network.binary.qualifierNote")}</p>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.binary.myDirectsTitle")}</h2>
        <p className="mt-1 text-xs text-text-secondary">{t("network.binary.myDirectsHint")}</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          {loading ? (
            <p className="px-4 py-6 text-sm text-text-secondary">{t("shared.loading")}</p>
          ) : !data?.myDirects.length ? (
            <p className="px-4 py-6 text-sm text-text-secondary">{t("network.binary.myDirectsEmpty")}</p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("network.binary.colDirectName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("network.binary.colJoined")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("network.binary.colStatus")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("network.binary.colRegistrationSide")}</th>
                </tr>
              </thead>
              <tbody>
                {data.myDirects.map((row) => (
                  <tr key={row.userId} className="border-b border-border-color last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">{row.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.joinedAt}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          row.hasActiveStart ? "text-success" : "text-warning",
                        )}
                      >
                        {row.hasActiveStart
                          ? t("network.binary.startActive")
                          : t("network.binary.awaitingStart")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          row.side === "left"
                            ? "text-sky-400"
                            : row.side === "right"
                              ? "text-violet-400"
                              : row.placementPending
                                ? "text-warning"
                                : "text-text-secondary",
                        )}
                      >
                        {registrationSideLabel(row)}
                      </span>
                      {row.placedAt ? (
                        <p className="mt-0.5 text-[11px] text-text-secondary">{row.placedAt}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {t("network.binary.pendingDirectsTitle")}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">{t("network.binary.pendingDirectsHint")}</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          {loading ? (
            <p className="px-4 py-6 text-sm text-text-secondary">{t("shared.loading")}</p>
          ) : !data?.pendingDirects.length ? (
            <p className="px-4 py-6 text-sm text-text-secondary">
              {t("network.binary.pendingDirectsEmpty")}
            </p>
          ) : (
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("network.binary.colDirectName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("network.binary.colJoined")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("network.binary.colStatus")}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t("network.binary.side")}</th>
                </tr>
              </thead>
              <tbody>
                {data.pendingDirects.map((row) => {
                  const canPlace = row.hasActiveStart;
                  return (
                  <tr key={row.userId} className="border-b border-border-color last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">{row.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.joinedAt}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          canPlace ? "text-success" : "text-warning",
                        )}
                      >
                        {canPlace
                          ? t("network.binary.startActive")
                          : t("network.binary.awaitingStart")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {!canPlace ? (
                        <span className="text-xs text-text-secondary">
                          {t("network.binary.chooseLegRequiresStart")}
                        </span>
                      ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!row.leftSlotAvailable || placingId === row.userId}
                          onClick={() => void handlePlace(row.userId, "left")}
                          className={cn(
                            "rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-bg-card-hover disabled:opacity-40",
                            preferredSide === "left"
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border-color text-text-primary",
                          )}
                        >
                          {placingId === row.userId
                            ? t("network.binary.placing")
                            : t("network.binary.chooseLeft")}
                        </button>
                        <button
                          type="button"
                          disabled={!row.rightSlotAvailable || placingId === row.userId}
                          onClick={() => void handlePlace(row.userId, "right")}
                          className={cn(
                            "rounded-lg border px-2.5 py-1 text-xs font-semibold hover:bg-bg-card-hover disabled:opacity-40",
                            preferredSide === "right"
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border-color text-text-primary",
                          )}
                        >
                          {placingId === row.userId
                            ? t("network.binary.placing")
                            : t("network.binary.chooseRight")}
                        </button>
                      </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">{t("network.binary.genealogyTitle")}</h2>
            <p className="mt-1 text-xs text-text-secondary">{t("network.binary.treePendingNote")}</p>
          </div>
          {!loading && data ? (
            <div className="rounded-xl border border-border-color bg-bg-secondary px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {t("network.binary.nextDirectSideLabel")}
              </p>
              <p className="mt-0.5 text-[11px] text-text-secondary">
                {t("network.binary.nextDirectSideHint")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["left", "right"] as const).map((side) => {
                  const active = preferredSide === side;
                  return (
                    <button
                      key={side}
                      type="button"
                      disabled={savingSideTarget != null}
                      onClick={() => void handleNextSideChange(side)}
                      className={cn(
                        "min-w-[5.5rem] rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:bg-bg-card-hover disabled:cursor-not-allowed disabled:opacity-40",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border-color text-text-primary",
                      )}
                    >
                      {savingSideTarget === side
                        ? t("network.binary.placing")
                        : side === "left"
                          ? t("network.binary.chooseLeft")
                          : t("network.binary.chooseRight")}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
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
