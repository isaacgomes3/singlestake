import { useCallback, useEffect, useState } from "react";

import { BINARY_MAX_LEVELS } from "@/lib/back-office/binary-constants";
import {
  createSubAccount,
  fetchSubAccounts,
  purchaseSubAccountStart,
} from "@/lib/back-office/network-api";
import type { SubAccountView } from "@/lib/back-office/network-types";
import { PRODUCT_PACKAGES } from "@/lib/back-office/product-constants";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

const START_AMOUNT = PRODUCT_PACKAGES.find((p) => p.id === "start")?.minAmount ?? 50;

export function BackOfficeSubAccountsPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const [items, setItems] = useState<SubAccountView[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(
    null,
  );

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState(1);
  const [legSide, setLegSide] = useState<"left" | "right">("left");

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchSubAccounts();
    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedCreds(null);
    setSubmitting(true);

    const result = await createSubAccount({ name, password, level, legSide });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCreatedCreds(result.credentials);
    setName("");
    setPassword("");
    await reload();
  }

  async function handleActivateStart(subAccountId: string, subName: string) {
    setError(null);
    setSuccess(null);
    setActivatingId(subAccountId);

    const result = await purchaseSubAccountStart(subAccountId);
    setActivatingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(t("network.subAccounts.toastStartActivated", { name: subName }));
    await reload();
  }

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.subAccounts.qualificationTitle")}</h2>
        <p className="mt-1 text-xs text-text-secondary">
          {t("network.subAccounts.qualificationDesc", { amount: money(START_AMOUNT) })}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-text-secondary">{t("network.subAccounts.fieldName")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("network.subAccounts.placeholderNameExample")}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">{t("network.subAccounts.fieldPassword")}</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">{t("network.subAccounts.fieldLegPosition")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {Array.from({ length: BINARY_MAX_LEVELS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t("network.subAccounts.levelOption", { n })}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">{t("network.subAccounts.fieldLeg")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              value={legSide}
              onChange={(e) => setLegSide(e.target.value as "left" | "right")}
            >
              <option value="left">{t("network.subAccounts.legLeft")}</option>
              <option value="right">{t("network.subAccounts.legRight")}</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            {error ? <p className="mb-2 text-sm text-red-500">{error}</p> : null}
            {success ? <p className="mb-2 text-sm text-emerald-600">{success}</p> : null}
            {createdCreds ? (
              <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-text-primary">
                <p className="font-semibold">{t("network.subAccounts.credentialsCreated")}</p>
                <p className="mt-1">
                  {t("network.subAccounts.credentialsEmail")}{" "}
                  <span className="font-mono">{createdCreds.email}</span>
                </p>
                <p>
                  {t("network.subAccounts.credentialsPassword")}{" "}
                  <span className="font-mono">{createdCreds.password}</span>
                </p>
                <p className="mt-2 text-xs text-text-secondary">
                  {t("network.subAccounts.credentialsHintActivate")}
                </p>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? t("network.subAccounts.submitting") : t("network.subAccounts.submit")}
            </button>
          </div>
        </form>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("network.subAccounts.listActiveTitle")}</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-xs text-text-secondary">
                <th className="px-3 py-2 font-semibold">{t("network.subAccounts.colName")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.subAccounts.colLevel")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.subAccounts.colLeg")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.subAccounts.colStartActive")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.subAccounts.colEmail")}</th>
                <th className="px-3 py-2 font-semibold">{t("network.subAccounts.colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-secondary">
                    {t("network.subAccounts.listLoading")}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-secondary">
                    {t("network.subAccounts.listEmpty")}
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-text-primary">{row.name}</td>
                    <td className="px-3 py-2.5 text-text-primary">{row.level}</td>
                    <td className="px-3 py-2.5 text-text-primary">
                      {row.legSide === "left"
                        ? t("network.subAccounts.legLeft")
                        : t("network.subAccounts.legRight")}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.hasActiveStart ? (
                        <span className="text-emerald-600">{t("shared.yes")}</span>
                      ) : (
                        <span className="text-amber-600">{t("network.subAccounts.startPending")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{row.email}</td>
                    <td className="px-3 py-2.5">
                      {row.hasActiveStart ? (
                        <span className="text-xs text-text-secondary">{t("shared.dash")}</span>
                      ) : (
                        <button
                          type="button"
                          disabled={activatingId === row.id}
                          onClick={() => void handleActivateStart(row.id, row.name)}
                          className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60"
                        >
                          {activatingId === row.id
                            ? t("network.subAccounts.activating")
                            : t("network.subAccounts.activateStartAmount", {
                                amount: money(START_AMOUNT),
                              })}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
