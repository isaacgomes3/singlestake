import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FinanceStatusBadge } from "@/components/back-office/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/auth/session";
import { createDeposit, fetchDeposits, processDeposit } from "@/lib/back-office/finance-api";
import type { DepositRecord } from "@/lib/back-office/finance-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

export function BackOfficeDepositsPanel() {
  const { t } = useI18n();
  const { money, dateTime } = useFormat();
  const isAdmin = getSession()?.user.role === "admin";
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"pix" | "crypto">("pix");
  const [externalRef, setExternalRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const rows = await fetchDeposits();
    setDeposits(rows);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createDeposit({
      amount: Number(amount.replace(",", ".")),
      method,
      externalRef: externalRef.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("finance.deposits.toastSubmitted"));
    setAmount("");
    setExternalRef("");
    void reload();
  };

  const handleProcess = async (id: string, action: "approve" | "reject") => {
    setProcessingId(id);
    const result = await processDeposit(id, action);
    setProcessingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      action === "approve"
        ? t("finance.deposits.toastApproved")
        : t("finance.deposits.toastRejected"),
    );
    void reload();
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("finance.deposits.formTitle")}</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="deposit-amount" className="text-xs font-medium text-text-secondary">
              {t("finance.deposits.amountLabel")}
            </label>
            <Input
              id="deposit-amount"
              type="number"
              min={50}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="deposit-method" className="text-xs font-medium text-text-secondary">
              {t("finance.deposits.methodLabel")}
            </label>
            <select
              id="deposit-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as "pix" | "crypto")}
              className="flex h-9 w-full rounded-md border border-border-color bg-bg-secondary px-3 text-sm text-text-primary"
            >
              <option value="pix">{t("shared.methods.pix")}</option>
              <option value="crypto">{t("shared.methods.crypto")}</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="deposit-ref" className="text-xs font-medium text-text-secondary">
              {t("finance.deposits.refLabel")}
            </label>
            <Input
              id="deposit-ref"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder={t("finance.deposits.refPlaceholder")}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? t("shared.submitting") : t("finance.deposits.submit")}
            </Button>
          </div>
        </form>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {isAdmin ? t("finance.deposits.listAll") : t("finance.deposits.listMine")}
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-text-secondary">{t("shared.loading")}</p>
        ) : deposits.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("finance.deposits.empty")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5">{t("shared.columns.date")}</th>
                  {isAdmin ? <th className="px-3 py-2.5">{t("shared.columns.user")}</th> : null}
                  <th className="px-3 py-2.5">{t("shared.columns.amount")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.method")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.status")}</th>
                  <th className="px-3 py-2.5">{t("shared.columns.reference")}</th>
                  {isAdmin ? <th className="px-3 py-2.5">{t("shared.columns.actions")}</th> : null}
                </tr>
              </thead>
              <tbody>
                {deposits.map((row) => (
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
                    <td className="px-3 py-2.5 uppercase text-text-secondary">
                      {t(`shared.methods.${row.method}`)}
                    </td>
                    <td className="px-3 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 text-text-secondary">
                      {row.externalRef ?? t("shared.dash")}
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
