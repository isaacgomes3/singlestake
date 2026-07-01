import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  activateAutomationManual,
  activateStartPackManual,
  adminResetUserPassword,
  adminSetUserPixKey,
  allowPixKeyEdit,
  blockUser,
  copyText,
  deleteUser,
  fetchAdminUserDetail,
  unblockUser,
  updateAdminUserProfile,
} from "@/lib/back-office/admin-api";
import type { AdminUserDetail, UserQualification } from "@/lib/back-office/admin-types";
import { WALLET_BUCKET_LABELS } from "@/lib/back-office/finance-constants";
import { sendAdminNotification } from "@/lib/back-office/notifications-api";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

const QUALIFICATIONS: UserQualification[] = ["bronze", "prata", "ouro", "diamante", "imperial"];

type TabId =
  | "profile"
  | "account"
  | "packages"
  | "subscription"
  | "pix"
  | "wallets"
  | "purchases"
  | "message";

type Props = {
  userId: string;
  onBack: () => void;
  onChanged?: () => void;
};

function statusBadge(detail: AdminUserDetail, t: (key: string) => string): string {
  if (detail.accountStatus === "blocked") return t("admin.statusBlocked");
  if (detail.accountActive) return t("admin.statusActive");
  return t("admin.statusPending");
}

export function BackOfficeClientProfile({ userId, onBack, onChanged }: Props) {
  const { t } = useI18n();
  const { money, dateTime } = useFormat();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("profile");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [qualification, setQualification] = useState<UserQualification>("bronze");
  const [password, setPassword] = useState("");
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await fetchAdminUserDetail(userId);
    if (!result.ok) {
      setDetail(null);
      setLoadError(result.error);
      setLoading(false);
      return;
    }
    setDetail(result.detail);
    setName(result.detail.name);
    setEmail(result.detail.email);
    setCpf(result.detail.cpf ?? "");
    setQualification(result.detail.qualification);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  if (loading) {
    return <p className="text-sm text-text-secondary">{t("admin.clientsProfileLoading")}</p>;
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {t("admin.clientsBackToList")}
        </Button>
        <p className="text-sm text-text-secondary">
          {loadError ?? t("admin.clientsProfileNotFound")}
        </p>
      </div>
    );
  }

  const isAdminUser = detail.role === "admin";
  const tabs: { id: TabId; label: string }[] = [
    { id: "profile", label: t("admin.clientsTabProfile") },
    { id: "account", label: t("admin.clientsTabAccount") },
    { id: "packages", label: t("admin.clientsTabPackages") },
    { id: "subscription", label: t("admin.clientsTabSubscription") },
    { id: "pix", label: t("admin.clientsTabPix") },
    { id: "wallets", label: t("admin.clientsTabWallets") },
    { id: "purchases", label: t("admin.clientsTabPurchases") },
    { id: "message", label: t("admin.clientsTabMessage") },
  ];

  const displayWallets = detail.wallets.filter(
    (w) => w.bucket === "rendimentos" || w.bucket === "afiliados" || w.bucket === "automacao",
  );

  const handleSaveProfile = async () => {
    setActionKey("save-profile");
    const result = await updateAdminUserProfile(userId, {
      name: name.trim(),
      email: email.trim(),
      cpf: cpf.trim() || null,
      qualification,
    });
    setActionKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("admin.clientsProfileSaved"));
    await reload();
    onChanged?.();
  };

  const handleResetPassword = async () => {
    if (password.trim().length < 6) {
      toast.error(t("admin.clientsPasswordMin"));
      return;
    }
    await runAction(
      "reset-password",
      () => adminResetUserPassword(userId, password.trim()),
      "admin.clientsPasswordSaved",
    );
    setPassword("");
  };

  const handleSendMessage = async () => {
    if (!msgTitle.trim() || !msgBody.trim()) {
      toast.error(t("admin.notificationsValidation"));
      return;
    }
    setActionKey("send-msg");
    const result = await sendAdminNotification({
      title: msgTitle.trim(),
      body: msgBody.trim(),
      audience: "user",
      targetUserId: userId,
    });
    setActionKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("admin.clientsMessageSent"));
    setMsgTitle("");
    setMsgBody("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {t("admin.clientsBackToList")}
        </Button>
      </div>

      <section className="theme-card rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              {detail.name}
              {isAdminUser ? (
                <span className="ml-2 text-[10px] uppercase text-violet-400">admin</span>
              ) : null}
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">{detail.email}</p>
          </div>
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
              detail.accountStatus === "blocked"
                ? "bg-danger/15 text-danger"
                : detail.accountActive
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning",
            )}
          >
            {statusBadge(detail, t)}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5 border-b border-border-color pb-3">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                tab === item.id
                  ? "bg-violet-500/20 text-violet-200"
                  : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "profile" ? (
            <div className="grid max-w-xl gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="text-text-secondary">{t("admin.colName")}</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isAdminUser} />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-text-secondary">{t("admin.colEmail")}</span>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={isAdminUser} />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-text-secondary">{t("admin.clientsFieldCpf")}</span>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} disabled={isAdminUser} />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-text-secondary">{t("admin.clientsFieldQualification")}</span>
                <select
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value as UserQualification)}
                  disabled={isAdminUser}
                  className="h-9 rounded-md border border-border-color bg-bg-primary px-3 text-sm text-text-primary"
                >
                  {QUALIFICATIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-1 text-sm text-text-secondary">
                <span>{t("admin.clientsFieldReferralCode")}</span>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-bg-secondary px-2 py-1 text-xs">{detail.referralCode}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void copyText(detail.referralLink).then((ok) =>
                        toast[ok ? "success" : "error"](
                          ok ? t("admin.toastCopied") : t("admin.toastCopyFailed"),
                        ),
                      )
                    }
                  >
                    <Copy className="size-3.5" />
                    {t("admin.copy")}
                  </Button>
                </div>
              </div>
              {detail.sponsor ? (
                <p className="text-sm text-text-secondary">
                  {t("admin.clientsFieldSponsor")}: {detail.sponsor.name} ({detail.sponsor.email})
                </p>
              ) : null}
              <p className="text-sm text-text-secondary">
                {t("admin.clientsFieldCreatedAt")}: {dateTime(detail.createdAt)}
              </p>
              {!isAdminUser ? (
                <Button
                  type="button"
                  disabled={actionKey === "save-profile"}
                  onClick={() => void handleSaveProfile()}
                >
                  {t("admin.clientsSaveProfile")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {tab === "account" && !isAdminUser ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {!detail.accountActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={actionKey === "activate-start"}
                    onClick={() =>
                      void runAction(
                        "activate-start",
                        () => activateStartPackManual(userId),
                        "admin.pendingActivateSuccess",
                      )
                    }
                  >
                    {t("admin.actionActivateAccount")}
                  </Button>
                ) : null}
                {detail.accountActive && !detail.automationActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={actionKey === "activate-auto"}
                    onClick={() =>
                      void runAction(
                        "activate-auto",
                        () => activateAutomationManual(userId),
                        "admin.automationActivateSuccess",
                      )
                    }
                  >
                    {t("admin.actionActivateAutomation")}
                  </Button>
                ) : null}
                {detail.accountStatus === "blocked" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={actionKey === "unblock"}
                    onClick={() =>
                      void runAction("unblock", () => unblockUser(userId), "admin.unblockSuccess")
                    }
                  >
                    {t("admin.actionUnblock")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={actionKey === "block"}
                    onClick={() => {
                      if (!window.confirm(t("admin.blockConfirm"))) return;
                      void runAction("block", () => blockUser(userId), "admin.blockSuccess");
                    }}
                  >
                    {t("admin.actionBlock")}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={actionKey === "delete"}
                  onClick={() => {
                    if (!window.confirm(t("admin.deleteConfirm"))) return;
                    void runAction("delete", () => deleteUser(userId), "admin.deleteSuccess");
                  }}
                >
                  {t("admin.actionDelete")}
                </Button>
              </div>

              <div className="max-w-sm space-y-3 rounded-xl border border-border-color p-4">
                <h3 className="text-sm font-semibold text-text-primary">{t("admin.clientsResetPassword")}</h3>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("admin.clientsNewPassword")}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={actionKey === "reset-password"}
                  onClick={() => void handleResetPassword()}
                >
                  {t("admin.clientsResetPassword")}
                </Button>
              </div>
            </div>
          ) : null}

          {tab === "account" && isAdminUser ? (
            <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>
          ) : null}

          {tab === "packages" ? (
            detail.packages.length === 0 ? (
              <p className="text-sm text-text-secondary">{t("admin.clientsNoPackages")}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border-color">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                      <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColPackage")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColAmount")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColStatus")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.packages.map((p) => (
                      <tr key={p.id} className="border-b border-border-color/60 last:border-0">
                        <td className="px-3 py-2.5 text-text-primary">{p.packageName}</td>
                        <td className="px-3 py-2.5 tabular-nums">{money(p.amount)}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{p.status}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{dateTime(p.startedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === "subscription" ? (
            !detail.subscription ? (
              <p className="text-sm text-text-secondary">{t("admin.clientsNoSubscription")}</p>
            ) : (
              <dl className="grid max-w-md gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">{t("admin.clientsSubStatus")}</dt>
                  <dd className="font-medium text-text-primary">{detail.subscription.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">{t("admin.clientsSubAmount")}</dt>
                  <dd className="tabular-nums text-text-primary">
                    {detail.subscription.amount != null ? money(detail.subscription.amount) : "—"}
                  </dd>
                </div>
                {detail.subscription.graceEndsAt ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-secondary">{t("admin.clientsSubGraceEnds")}</dt>
                    <dd className="text-text-primary">{dateTime(detail.subscription.graceEndsAt)}</dd>
                  </div>
                ) : null}
                {detail.subscription.renewsAt ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-secondary">{t("admin.clientsSubRenews")}</dt>
                    <dd className="text-text-primary">{dateTime(detail.subscription.renewsAt)}</dd>
                  </div>
                ) : null}
              </dl>
            )
          ) : null}

          {tab === "pix" && !isAdminUser ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border-color p-4 text-sm">
                <p className="text-text-secondary">{t("admin.colPix")}</p>
                <p className="mt-1 font-mono text-text-primary">
                  {detail.pixKeyMasked ?? t("admin.pixNone")}
                  {detail.pixKeyLocked ? (
                    <Lock className="ml-1 inline size-3.5 text-warning" aria-hidden />
                  ) : detail.allowPixKeyEdit ? (
                    <Unlock className="ml-1 inline size-3.5 text-success" aria-hidden />
                  ) : null}
                </p>
                {detail.pixKeySetAt ? (
                  <p className="mt-1 text-xs text-text-secondary">{dateTime(detail.pixKeySetAt)}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={actionKey === "pix-edit"}
                  onClick={() =>
                    void runAction(
                      "pix-edit",
                      () => allowPixKeyEdit(userId, true),
                      "admin.pixEditAllowed",
                    )
                  }
                >
                  {t("admin.actionAllowPixEdit")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={actionKey === "pix-set"}
                  onClick={() => {
                    const pixKey = window.prompt(t("admin.pixSetPrompt"));
                    if (!pixKey?.trim()) return;
                    void runAction(
                      "pix-set",
                      () => adminSetUserPixKey(userId, pixKey.trim()),
                      "admin.pixSetSuccess",
                    );
                  }}
                >
                  {t("admin.actionSetPix")}
                </Button>
              </div>
            </div>
          ) : null}

          {tab === "wallets" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border-color p-4">
                  <p className="text-xs text-text-secondary">{t("admin.clientsAutomationBalance")}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                    {money(detail.automationBalance)}
                  </p>
                </div>
                <div className="rounded-xl border border-border-color p-4">
                  <p className="text-xs text-text-secondary">{t("admin.clientsAutomationDeposited")}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                    {money(detail.automationDepositedTotal)}
                  </p>
                </div>
              </div>

              {displayWallets.length === 0 ? (
                <p className="text-sm text-text-secondary">{t("admin.clientsNoWallets")}</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-color">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                        <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColBucket")}</th>
                        <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColBalance")}</th>
                        <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColBlocked")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayWallets.map((w) => (
                        <tr key={w.bucket} className="border-b border-border-color/60 last:border-0">
                          <td className="px-3 py-2.5 text-text-primary">
                            {WALLET_BUCKET_LABELS[w.bucket as keyof typeof WALLET_BUCKET_LABELS] ??
                              w.bucket}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">{money(w.availableBalance)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-text-secondary">
                            {money(w.blockedBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {detail.ledger.length === 0 ? (
                <p className="text-sm text-text-secondary">{t("admin.clientsNoLedger")}</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-color">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                        <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColDate")}</th>
                        <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColBucket")}</th>
                        <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColType")}</th>
                        <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColAmount")}</th>
                        <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColDescription")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.ledger.map((e) => (
                        <tr key={e.id} className="border-b border-border-color/60 last:border-0">
                          <td className="px-3 py-2.5 text-text-secondary">{dateTime(e.createdAt)}</td>
                          <td className="px-3 py-2.5 text-text-secondary">{e.bucket}</td>
                          <td className="px-3 py-2.5 text-text-secondary">{e.entryType}</td>
                          <td className="px-3 py-2.5 tabular-nums text-text-primary">{money(e.amount)}</td>
                          <td className="max-w-[200px] truncate px-3 py-2.5 text-text-secondary">
                            {e.description ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {tab === "purchases" ? (
            detail.pixOrders.length === 0 ? (
              <p className="text-sm text-text-secondary">{t("admin.clientsNoPurchases")}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border-color">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                      <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColPackage")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColAmount")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColStatus")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("admin.clientsColDate")}</th>
                      <th className="px-3 py-2.5 font-semibold">{t("admin.colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.pixOrders.map((o) => (
                      <tr key={o.id} className="border-b border-border-color/60 last:border-0">
                        <td className="px-3 py-2.5 text-text-primary">{o.packageName}</td>
                        <td className="px-3 py-2.5 tabular-nums">{money(o.amount)}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{o.status}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{dateTime(o.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          {o.hasQrCode ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setQrPreview(o.qrCodeBase64)}
                            >
                              {t("admin.clientsViewQr")}
                            </Button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === "message" ? (
            <div className="max-w-lg space-y-3">
              <Input
                value={msgTitle}
                onChange={(e) => setMsgTitle(e.target.value)}
                placeholder={t("admin.notificationsFieldTitlePlaceholder")}
              />
              <textarea
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder={t("admin.notificationsFieldBodyPlaceholder")}
                rows={4}
                className="w-full rounded-md border border-border-color bg-bg-primary px-3 py-2 text-sm text-text-primary"
              />
              <Button
                type="button"
                disabled={actionKey === "send-msg"}
                onClick={() => void handleSendMessage()}
              >
                {t("admin.clientsSendMessage")}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {qrPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          aria-label={t("admin.clientsQrTitle")}
          onClick={() => setQrPreview(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQrPreview(null);
          }}
        >
          <div
            className="max-w-md rounded-2xl bg-bg-primary p-5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-text-primary">{t("admin.clientsQrTitle")}</h3>
            <img
              src={`data:image/png;base64,${qrPreview}`}
              alt={t("admin.clientsQrTitle")}
              className="mt-4 w-full rounded-lg"
            />
            <Button type="button" className="mt-4 w-full" variant="secondary" onClick={() => setQrPreview(null)}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
