import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  activateStartPackManual,
  approvePendingActivation,
  fetchPendingActivations,
} from "@/lib/back-office/admin-api";
import type { PendingActivationRecord, PendingAutomationPixRecord } from "@/lib/back-office/admin-types";
import { getSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

type Props = {
  onChanged?: () => void;
};

export function BackOfficeClientPendingSection({ onChanged }: Props) {
  const { t } = useI18n();
  const { money, dateTime } = useFormat();
  const isAdmin = getSession()?.user.role === "admin";

  const [pending, setPending] = useState<PendingActivationRecord[]>([]);
  const [pendingAutomationPix, setPendingAutomationPix] = useState<PendingAutomationPixRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchPendingActivations();
    setPending(data.startRows);
    setPendingAutomationPix(data.automationRows);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!isAdmin) return null;
  if (!loading && pending.length === 0 && pendingAutomationPix.length === 0) return null;

  const runAction = async (
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successKey: string,
  ) => {
    setActionKey(key);
    const result = await fn();
    setActionKey(null);
    if (!result.ok) {
      toast.error(result.error ?? t("admin.actionFailed"));
      return;
    }
    toast.success(t(successKey));
    await reload();
    onChanged?.();
  };

  return (
    <div className="space-y-5">
      {pending.length > 0 || loading ? (
        <section className="theme-card rounded-2xl p-5">
          <h2 className="text-sm font-bold text-text-primary">{t("admin.pendingTitle")}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {loading ? t("shared.loading") : t("admin.pendingCount", { count: pending.length })}
          </p>
          {!loading && pending.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                    <th className="px-3 py-2.5 font-semibold">{t("admin.colName")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("admin.colEmail")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("admin.pendingColStatus")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("admin.pendingColAmount")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("admin.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((row) => {
                    const hasPendingPix = row.orderId && row.orderStatus === "pending";
                    return (
                      <tr key={row.userId} className="border-b border-border-color/60 last:border-0">
                        <td className="px-3 py-2.5 text-text-primary">{row.userName}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{row.userEmail}</td>
                        <td className="px-3 py-2.5 text-text-secondary">
                          {hasPendingPix
                            ? t("admin.pendingStatusPending")
                            : t("admin.pendingStatusNone")}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-text-primary">
                          {row.orderAmount != null ? money(row.orderAmount) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-2">
                            {hasPendingPix ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={actionKey === `approve-${row.orderId}`}
                                onClick={() =>
                                  void runAction(
                                    `approve-${row.orderId}`,
                                    () => approvePendingActivation(row.orderId!),
                                    "admin.pendingApproveSuccess",
                                  )
                                }
                              >
                                {t("admin.pendingApprovePix")}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actionKey === `activate-${row.userId}`}
                              onClick={() =>
                                void runAction(
                                  `activate-${row.userId}`,
                                  () => activateStartPackManual(row.userId),
                                  "admin.pendingActivateSuccess",
                                )
                              }
                            >
                              {t("admin.pendingActivateManual")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {pendingAutomationPix.length > 0 || loading ? (
        <section className="theme-card rounded-2xl p-5">
          <h2 className="text-sm font-bold text-text-primary">{t("admin.automationPixTitle")}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {loading
              ? t("shared.loading")
              : t("admin.automationPixCount", { count: pendingAutomationPix.length })}
          </p>
          {!loading && pendingAutomationPix.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                    <th className="px-3 py-2.5 font-semibold">{t("admin.colName")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("admin.automationPixColPackage")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("admin.pendingColAmount")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("admin.colJoined")}</th>
                    <th className="px-3 py-2.5 font-semibold">{t("admin.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingAutomationPix.map((row) => (
                    <tr key={row.orderId} className="border-b border-border-color/60 last:border-0">
                      <td className="px-3 py-2.5 text-text-primary">{row.userName}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{row.packageName}</td>
                      <td className="px-3 py-2.5 tabular-nums text-text-primary">{money(row.amount)}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{dateTime(row.orderCreatedAt)}</td>
                      <td className="px-3 py-2.5">
                        <Button
                          type="button"
                          size="sm"
                          disabled={actionKey === `approve-${row.orderId}`}
                          onClick={() =>
                            void runAction(
                              `approve-${row.orderId}`,
                              () => approvePendingActivation(row.orderId),
                              "admin.automationPixApproveSuccess",
                            )
                          }
                        >
                          {t("admin.pendingApprovePix")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
