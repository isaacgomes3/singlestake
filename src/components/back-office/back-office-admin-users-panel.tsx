import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { Button } from "@/components/ui/button";
import {
  activateAutomationManual,
  activateStartPackManual,
  adminSetUserPixKey,
  allowPixKeyEdit,
  approvePendingActivation,
  blockUser,
  copyText,
  deleteUser,
  fetchPendingActivations,
  fetchUsersWithReferralLinks,
  unblockUser,
} from "@/lib/back-office/admin-api";
import type { AdminUserRecord, PendingActivationRecord, PendingAutomationPixRecord } from "@/lib/back-office/admin-types";
import { getSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

function statusLabel(row: AdminUserRecord, t: (key: string) => string): string {
  if (row.accountStatus === "blocked") return t("admin.statusBlocked");
  if (row.accountStatus === "deleted") return t("admin.statusDeleted");
  if (row.accountActive) return t("admin.statusActive");
  return t("admin.statusPending");
}

export function BackOfficeAdminUsersPanel() {
  const { t } = useI18n();
  const { money, dateTime } = useFormat();
  const isAdmin = getSession()?.user.role === "admin";
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
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
    const [userRows, pendingData] = await Promise.all([
      fetchUsersWithReferralLinks(),
      fetchPendingActivations(),
    ]);
    setUsers(userRows.filter((u) => u.accountStatus !== "deleted"));
    setPending(pendingData.startRows);
    setPendingAutomationPix(pendingData.automationRows);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!isAdmin) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

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
    void reload();
  };

  const copyLink = async (link: string) => {
    const ok = await copyText(link);
    toast[ok ? "success" : "error"](ok ? t("admin.toastCopied") : t("admin.toastCopyFailed"));
  };

  const handleApprovePix = (orderId: string, automation = false) =>
    void runAction(
      `approve-${orderId}`,
      () => approvePendingActivation(orderId),
      automation ? "admin.automationPixApproveSuccess" : "admin.pendingApproveSuccess",
    );

  const handleActivateManual = (userId: string) =>
    void runAction(
      `activate-${userId}`,
      () => activateStartPackManual(userId),
      "admin.pendingActivateSuccess",
    );

  const handleActivateAutomation = (userId: string) =>
    void runAction(
      `auto-${userId}`,
      () => activateAutomationManual(userId),
      "admin.automationActivateSuccess",
    );

  const handleBlock = (userId: string) => {
    if (!window.confirm(t("admin.blockConfirm"))) return;
    void runAction(`block-${userId}`, () => blockUser(userId), "admin.blockSuccess");
  };

  const handleUnblock = (userId: string) =>
    void runAction(`unblock-${userId}`, () => unblockUser(userId), "admin.unblockSuccess");

  const handleDelete = (userId: string) => {
    if (!window.confirm(t("admin.deleteConfirm"))) return;
    void runAction(`delete-${userId}`, () => deleteUser(userId), "admin.deleteSuccess");
  };

  const handleAllowPixEdit = (userId: string) =>
    void runAction(`pix-edit-${userId}`, () => allowPixKeyEdit(userId, true), "admin.pixEditAllowed");

  const handleAdminSetPix = (userId: string) => {
    const pixKey = window.prompt(t("admin.pixSetPrompt"));
    if (!pixKey?.trim()) return;
    void runAction(
      `pix-set-${userId}`,
      () => adminSetUserPixKey(userId, pixKey.trim()),
      "admin.pixSetSuccess",
    );
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.pendingTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {loading ? t("shared.loading") : t("admin.pendingCount", { count: pending.length })}
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
                      <td className="px-3 py-2.5 text-text-secondary">{dateTime(row.userCreatedAt)}</td>
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
                              onClick={() => handleApprovePix(row.orderId!)}
                            >
                              {t("admin.pendingApprovePix")}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={actionKey === `activate-${row.userId}`}
                            onClick={() => handleActivateManual(row.userId)}
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
        <h2 className="text-sm font-bold text-text-primary">{t("admin.automationPixTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {loading
            ? t("shared.loading")
            : t("admin.automationPixCount", { count: pendingAutomationPix.length })}
        </p>

        {loading ? null : pendingAutomationPix.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("admin.automationPixEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colEmail")}</th>
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
                    <td className="px-3 py-2.5 text-text-secondary">{row.userEmail}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.packageName}</td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">{money(row.amount)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{dateTime(row.orderCreatedAt)}</td>
                    <td className="px-3 py-2.5">
                      <Button
                        type="button"
                        size="sm"
                        disabled={actionKey === `approve-${row.orderId}`}
                        onClick={() => handleApprovePix(row.orderId, true)}
                      >
                        {t("admin.pendingApprovePix")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.manageTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {loading ? t("shared.loading") : t("admin.allLinksCount", { count: users.length })}
        </p>

        {loading ? null : users.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("admin.allLinksEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colEmail")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colStatus")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colAutomation")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colPix")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colActions")}</th>
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
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          row.accountStatus === "blocked"
                            ? "bg-danger/15 text-danger"
                            : row.accountActive
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning",
                        )}
                      >
                        {statusLabel(row, t)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      {row.automationActive ? t("admin.automationYes") : t("admin.automationNo")}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">
                      {row.pixKeyMasked ?? t("admin.pixNone")}
                      {row.pixKeyLocked ? (
                        <span className="ml-1 text-[10px] text-warning">🔒</span>
                      ) : row.allowPixKeyEdit ? (
                        <span className="ml-1 text-[10px] text-success">✎</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.role === "admin" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void copyLink(row.referralLink)}
                        >
                          <Copy className="size-3.5" />
                          {t("admin.copy")}
                        </Button>
                      ) : (
                        <div className="flex max-w-[420px] flex-wrap gap-1.5">
                          {!row.accountActive ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actionKey === `activate-${row.id}`}
                              onClick={() => handleActivateManual(row.id)}
                            >
                              {t("admin.actionActivateAccount")}
                            </Button>
                          ) : null}
                          {row.accountActive && !row.automationActive ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actionKey === `auto-${row.id}`}
                              onClick={() => handleActivateAutomation(row.id)}
                            >
                              {t("admin.actionActivateAutomation")}
                            </Button>
                          ) : null}
                          {row.accountStatus === "blocked" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actionKey === `unblock-${row.id}`}
                              onClick={() => handleUnblock(row.id)}
                            >
                              {t("admin.actionUnblock")}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={actionKey === `block-${row.id}`}
                              onClick={() => handleBlock(row.id)}
                            >
                              {t("admin.actionBlock")}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={actionKey === `pix-edit-${row.id}`}
                            onClick={() => handleAllowPixEdit(row.id)}
                          >
                            {t("admin.actionAllowPixEdit")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={actionKey === `pix-set-${row.id}`}
                            onClick={() => handleAdminSetPix(row.id)}
                          >
                            {t("admin.actionSetPix")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={actionKey === `delete-${row.id}`}
                            onClick={() => handleDelete(row.id)}
                          >
                            {t("admin.actionDelete")}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
