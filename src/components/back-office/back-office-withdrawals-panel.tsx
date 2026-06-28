import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FinanceStatusBadge } from "@/components/back-office/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/auth/session";
import { fetchPixKeyProfile, savePixKeyProfile } from "@/lib/back-office/admin-api";
import type { PixKeyProfileDto } from "@/lib/back-office/admin-types";
import {
  createWithdrawal,
  fetchWallets,
  fetchWithdrawals,
  processWithdrawal,
} from "@/lib/back-office/finance-api";
import type { WalletRecord, WithdrawalRecord } from "@/lib/back-office/finance-types";
import { WITHDRAWABLE_BUCKETS } from "@/lib/back-office/finance-constants";
import type { WalletBucket } from "@/lib/back-office/finance-constants";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeWithdrawalsPanel() {
  const { t } = useI18n();
  const { money, dateTime } = useFormat();
  const isAdmin = getSession()?.user.role === "admin";
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [bucket, setBucket] = useState<WalletBucket>("rendimentos");
  const [pixKey, setPixKey] = useState("");
  const [pixProfile, setPixProfile] = useState<PixKeyProfileDto | null>(null);
  const [savingPix, setSavingPix] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [rows, walletRows, profile] = await Promise.all([
      fetchWithdrawals(),
      fetchWallets(),
      fetchPixKeyProfile(),
    ]);
    setWithdrawals(rows);
    setWallets(walletRows);
    setPixProfile(profile);
    if (profile?.pixKey) setPixKey(profile.pixKey);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const selectedWallet = wallets.find((w) => w.bucket === bucket);

  const pixFieldLocked = pixProfile != null && !pixProfile.canEdit && !!pixProfile.pixKey;

  const handleSavePix = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPix(true);
    const result = await savePixKeyProfile(pixKey.trim());
    setSavingPix(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPixProfile(result.profile);
    setPixKey(result.profile.pixKey ?? "");
    toast.success(t("finance.withdrawals.pixProfileSaved"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createWithdrawal({
      amount: Number(amount.replace(",", ".")),
      bucket,
      pixKey: pixKey.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("finance.withdrawals.toastSubmittedWait"));
    setAmount("");
    void reload();
  };

  const handleProcess = async (id: string, action: "approve" | "reject" | "paid") => {
    setProcessingId(id);
    const result = await processWithdrawal(id, action);
    setProcessingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const toastKeys = {
      approve: "finance.withdrawals.toastApprovedDebited",
      reject: "finance.withdrawals.toastRejected",
      paid: "finance.withdrawals.toastPaidPix",
    } as const;
    toast.success(t(toastKeys[action]));
    void reload();
  };

  return (
    <div className="space-y-5">
      {!isAdmin ? (
        <section className="theme-card rounded-2xl p-5">
          <h2 className="text-sm font-bold text-text-primary">
            {t("finance.withdrawals.pixProfileTitle")}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">{t("finance.withdrawals.pixProfileHint")}</p>
          {pixProfile?.locked ? (
            <p className="mt-2 text-xs font-medium text-warning">
              {t("finance.withdrawals.pixProfileLocked")}
            </p>
          ) : pixProfile?.allowEdit ? (
            <p className="mt-2 text-xs font-medium text-success">
              {t("finance.withdrawals.pixProfileAllowed")}
            </p>
          ) : null}
          <form onSubmit={handleSavePix} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <label htmlFor="profile-pix" className="text-xs font-medium text-text-secondary">
                {t("finance.withdrawals.pixLabel")}
              </label>
              <Input
                id="profile-pix"
                required
                readOnly={pixFieldLocked}
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder={t("finance.withdrawals.pixPlaceholder")}
              />
            </div>
            {!pixFieldLocked ? (
              <Button type="submit" disabled={savingPix}>
                {savingPix ? t("shared.submitting") : t("finance.withdrawals.pixProfileSave")}
              </Button>
            ) : null}
          </form>
        </section>
      ) : null}

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("finance.withdrawals.formTitle")}</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="withdraw-bucket" className="text-xs font-medium text-text-secondary">
              {t("finance.withdrawals.bucketLabel")}
            </label>
            <select
              id="withdraw-bucket"
              value={bucket}
              onChange={(e) => setBucket(e.target.value as WalletBucket)}
              className="flex h-9 w-full rounded-md border border-border-color bg-bg-secondary px-3 text-sm text-text-primary"
            >
              {WITHDRAWABLE_BUCKETS.map((b) => (
                <option key={b} value={b}>
                  {t(`shared.buckets.${b}`)}
                </option>
              ))}
            </select>
            {selectedWallet ? (
              <p className="text-xs text-text-secondary">
                {t("finance.withdrawals.available", {
                  amount: money(selectedWallet.availableBalance),
                })}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="withdraw-amount" className="text-xs font-medium text-text-secondary">
              {t("finance.withdrawals.amountLabel")}
            </label>
            <Input
              id="withdraw-amount"
              type="number"
              min={50}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="withdraw-pix" className="text-xs font-medium text-text-secondary">
              {t("finance.withdrawals.pixLabel")}
            </label>
            <Input
              id="withdraw-pix"
              required={!pixProfile?.pixKey}
              readOnly={!!pixProfile?.pixKey}
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={t("finance.withdrawals.pixPlaceholder")}
            />
            {pixProfile?.pixKey ? (
              <p className="text-[11px] text-text-secondary">
                {t("finance.withdrawals.pixProfileHint")}
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? t("shared.submitting") : t("finance.withdrawals.submit")}
            </Button>
          </div>
        </form>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {isAdmin ? t("finance.withdrawals.listAllAdmin") : t("finance.withdrawals.listMine")}
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-text-secondary">{t("shared.loading")}</p>
        ) : withdrawals.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("finance.withdrawals.empty")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5">{t("shared.columns.date")}</th>
                  {isAdmin ? <th className="px-3 py-2.5">{t("shared.columns.user")}</th> : null}
                  <th className="px-3 py-2.5">{t("shared.columns.amount")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.origin")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.pix")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.status")}</th>
                  {isAdmin ? <th className="px-3 py-2.5">{t("shared.columns.actions")}</th> : null}
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-secondary">{dateTime(row.createdAt)}</td>
                    {isAdmin ? (
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-text-primary">{row.userName}</p>
                        <p className="text-xs text-text-secondary">{row.userEmail}</p>
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-text-primary">
                      {money(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      {t(`shared.buckets.${row.bucket}`)}
                    </td>
                    <td className="max-w-[8rem] truncate px-3 py-2.5 text-text-secondary">
                      {row.pixKey ?? t("shared.dash")}
                    </td>
                    <td className="px-3 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                    {isAdmin ? (
                      <td className="px-3 py-2.5">
                        {row.status === "pending" ? (
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="success"
                              disabled={processingId === row.id}
                              onClick={() => void handleProcess(row.id, "approve")}
                            >
                              {t("shared.actions.approve")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={processingId === row.id}
                              onClick={() => void handleProcess(row.id, "reject")}
                            >
                              {t("shared.actions.reject")}
                            </Button>
                          </div>
                        ) : row.status === "approved" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={processingId === row.id}
                            onClick={() => void handleProcess(row.id, "paid")}
                          >
                            {t("shared.actions.markPaid")}
                          </Button>
                        ) : (
                          <span className="text-xs text-text-secondary">{t("shared.dash")}</span>
                        )}
                      </td>
                    ) : null}
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
