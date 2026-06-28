import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { BackOfficeNotificationsList } from "@/components/back-office/back-office-notifications-list";
import { Button } from "@/components/ui/button";
import { fetchUsersWithReferralLinks } from "@/lib/back-office/admin-api";
import type { UserReferralRecord } from "@/lib/back-office/admin-types";
import {
  fetchAdminNotifications,
  sendAdminNotification,
} from "@/lib/back-office/notifications-api";
import type { AdminNotificationRecord } from "@/lib/back-office/notifications-types";
import { getSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeAdminNotificationsPanel() {
  const { t } = useI18n();
  const { dateTime } = useFormat();
  const isAdmin = getSession()?.user.role === "admin";

  const [users, setUsers] = useState<UserReferralRecord[]>([]);
  const [sent, setSent] = useState<AdminNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "user">("all");
  const [targetUserId, setTargetUserId] = useState("");

  const reload = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [userRows, sentRows] = await Promise.all([
      fetchUsersWithReferralLinks(),
      fetchAdminNotifications(),
    ]);
    setUsers(userRows);
    setSent(sentRows);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!isAdmin) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error(t("admin.notificationsValidation"));
      return;
    }
    if (audience === "user" && !targetUserId) {
      toast.error(t("admin.notificationsPickUser"));
      return;
    }

    setSending(true);
    const result = await sendAdminNotification({
      title: title.trim(),
      body: body.trim(),
      audience,
      targetUserId: audience === "user" ? targetUserId : undefined,
    });
    setSending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      audience === "all"
        ? t("admin.notificationsSentAll")
        : t("admin.notificationsSentUser"),
    );
    setTitle("");
    setBody("");
    setTargetUserId("");
    void reload();
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.notificationsSendTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("admin.notificationsSendDesc")}</p>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAudience("all")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                audience === "all"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border-color text-text-secondary hover:bg-bg-card-hover"
              }`}
            >
              {t("admin.notificationsAudienceAll")}
            </button>
            <button
              type="button"
              onClick={() => setAudience("user")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                audience === "user"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border-color text-text-secondary hover:bg-bg-card-hover"
              }`}
            >
              {t("admin.notificationsAudienceUser")}
            </button>
          </div>

          {audience === "user" ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-text-secondary">
                {t("admin.notificationsTargetUser")}
              </span>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              >
                <option value="">{t("admin.notificationsPickUserPlaceholder")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} — {user.email}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-text-secondary">
              {t("admin.notificationsFieldTitle")}
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              placeholder={t("admin.notificationsFieldTitlePlaceholder")}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-text-secondary">
              {t("admin.notificationsFieldBody")}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full resize-y rounded-xl border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              placeholder={t("admin.notificationsFieldBodyPlaceholder")}
            />
          </label>

          <Button type="button" onClick={() => void handleSend()} disabled={sending}>
            {sending ? t("shared.loading") : t("admin.notificationsSendButton")}
          </Button>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.notificationsHistoryTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {loading ? t("shared.loading") : t("admin.notificationsHistoryCount", { count: sent.length })}
        </p>

        {loading ? null : sent.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("admin.notificationsHistoryEmpty")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sent.map((row) => (
              <div key={row.id} className="rounded-xl border border-border-color bg-bg-secondary/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{row.title}</p>
                  <span className="rounded-md border border-border-color px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                    {row.audience === "all"
                      ? t("admin.notificationsAudienceAll")
                      : t("admin.notificationsAudienceUser")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">{row.body}</p>
                <p className="mt-2 text-[10px] text-text-secondary">
                  {dateTime(row.createdAt)}
                  {row.audience === "user" && row.targetUserName
                    ? ` · ${row.targetUserName}${row.targetUserEmail ? ` (${row.targetUserEmail})` : ""}`
                    : null}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
