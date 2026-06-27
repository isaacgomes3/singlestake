import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { Button } from "@/components/ui/button";
import {
  activateStartPackManual,
  approvePendingActivation,
  copyText,
  fetchPendingActivations,
  fetchUsersWithReferralLinks,
} from "@/lib/back-office/admin-api";
import type { PendingActivationRecord, UserReferralRecord } from "@/lib/back-office/admin-types";
import { getSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeAdminUsersPanel() {
  const { t } = useI18n();
  const { money, dateTime } = useFormat();
  const isAdmin = getSession()?.user.role === "admin";
  const [users, setUsers] = useState<UserReferralRecord[]>([]);
  const [pending, setPending] = useState<PendingActivationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [userRows, pendingRows] = await Promise.all([
      fetchUsersWithReferralLinks(),
      fetchPendingActivations(),
    ]);
    setUsers(userRows);
    setPending(pendingRows);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!isAdmin) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

  const copyLink = async (link: string) => {
    const ok = await copyText(link);
    toast[ok ? "success" : "error"](
      ok ? t("admin.toastCopied") : t("admin.toastCopyFailed"),
    );
  };

  const handleApprovePix = async (orderId: string) => {
    setActionKey(`approve-${orderId}`);
    const result = await approvePendingActivation(orderId);
    setActionKey(null);
    if (!result.ok) {
      toast.error(result.error ?? t("admin.pendingActionFailed"));
      return;
    }
    toast.success(t("admin.pendingApproveSuccess"));
    void reload();
  };

  const handleActivateManual = async (userId: string) => {
    setActionKey(`activate-${userId}`);
    const result = await activateStartPackManual(userId);
    setActionKey(null);
    if (!result.ok) {
      toast.error(result.error ?? t("admin.pendingActionFailed"));
      return;
    }
    toast.success(t("admin.pendingActivateSuccess"));
    void reload();
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.pendingTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {loading
            ? t("shared.loading")
            : t("admin.pendingCount", { count: pending.length })}
        </p>

        {loading ? null : pending.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("admin.pendingEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colEmail")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colJoined")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.pendingColStatus")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.pendingColAmount")}</th>
                  <th className="px-3 py-2.5 font-semibold">Ações</th>
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
                        {dateTime(row.userCreatedAt)}
                      </td>
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
                              onClick={() => void handleApprovePix(row.orderId!)}
                            >
                              {t("admin.pendingApprovePix")}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={actionKey === `activate-${row.userId}`}
                            onClick={() => void handleActivateManual(row.userId)}
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
        )}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.myLinkTitle")}</h2>
        {getSession()?.user.referralCode ? (
          <div className="mt-4">
            <ReferralLinkField
              referralCode={getSession()!.user.referralCode}
              referralLink={getSession()?.user.referralLink}
            />
          </div>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.allLinksTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {loading
            ? t("shared.loading")
            : t("admin.allLinksCount", { count: users.length })}
        </p>

        {loading ? null : users.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("admin.allLinksEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colEmail")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colCode")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colJoined")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colLink")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">
                      {row.name}
                      {row.role === "admin" ? (
                        <span className="ml-1.5 text-[10px] uppercase text-violet-400">admin</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.email}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-primary">
                      {row.referralCode}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.createdAt}</td>
                    <td className="px-3 py-2.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void copyLink(row.referralLink)}
                      >
                        <Copy className="size-3.5" />
                        {t("admin.copy")}
                      </Button>
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
